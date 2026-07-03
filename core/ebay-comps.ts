// Live eBay sold-comps — feed the pricing formula real competitor prices so it
// can undercut the actual market instead of falling back to a retail anchor.
//
// eBay has no free public "completed items" API without app credentials, so this
// reads eBay's public SOLD/COMPLETED search results page (the same page a human
// checks when pricing) and extracts the sold prices. It is BEST-EFFORT by design:
//   - it never throws and returns an empty comps list on any failure (blocked,
//     rate-limited, markup change, timeout) so /api/ebay-price always still works
//     (the formula just falls back to its retail anchor);
//   - results are cached (Deno KV, else in-memory) so we don't re-hit eBay per
//     request;
//   - it's gated by EBAY_COMPS_ENABLED and only runs when a caller explicitly
//     asks for it (autoComps), so it never adds latency to a normal price call.
//
// The raw prices are handed to computeEbayPrice, whose comp cleaning (outlier
// trim + median lowball lift) already tolerates the noise a scrape produces.

import { cacheGet, cacheSet } from "./cache.ts";

export type EbayCompsSource = "ebay-sold" | "cache" | "none";

export type EbayCompsResult = {
  comps: number[];
  source: EbayCompsSource;
  sampleSize: number; // raw sold prices parsed before capping to `limit`
  query: string;
  url: string | null;
  reason?: string; // why comps is empty (disabled / no-query / blocked / empty)
};

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6h — sold prices move slowly
const DEFAULT_LIMIT = 12;
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_SEARCH_BASE = "https://www.ebay.com/sch/i.html";
// A realistic desktop browser UA — eBay serves the lightweight bot page otherwise.
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function env(name: string): string | undefined {
  try {
    return Deno.env.get(name) ?? undefined;
  } catch {
    return undefined; // --allow-env not granted, etc.
  }
}

function compsEnabled(): boolean {
  const v = (env("EBAY_COMPS_ENABLED") ?? "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off" && v !== "no";
}

function searchBase(): string {
  return (env("EBAY_SOLD_SEARCH_BASE") || DEFAULT_SEARCH_BASE).trim() || DEFAULT_SEARCH_BASE;
}

// Build the eBay SOLD + COMPLETED search URL for a query.
// LH_Sold=1 + LH_Complete=1 = the "sold listings" filter; _ipg maxes the page size.
export function ebaySoldSearchUrl(query: string, opts: { ipg?: number } = {}): string {
  const base = searchBase();
  const params = new URLSearchParams({
    _nkw: query,
    LH_Sold: "1",
    LH_Complete: "1",
    _ipg: String(opts.ipg ?? 120),
    rt: "nc",
  });
  return `${base}?${params.toString()}`;
}

// Extract ALL sold prices from an eBay sold-search HTML page — unfiltered and
// uncapped (the raw prices we cache). Anchored on the `s-item__price` class so we
// only pick listing prices (not shipping/other $), grabbing the first dollar
// amount after each — which also takes the LOW end of a "$X to $Y" range.
//
// eBay seeds the results with a generic "Shop on eBay" promo card whose
// placeholder price is NOT for the queried product; left in, a low placeholder
// becomes a bogus cheapest comp. We strip each promo card's price first (all of
// them — eBay sometimes injects promo rows mid-results), leaving real listings.
export function extractSoldPrices(html: string): number[] {
  if (typeof html !== "string" || !html) return [];
  const cleaned = html.replace(
    /Shop on eBay[\s\S]{0,400}?s-item__price[^$]*?\$\s*[0-9][0-9,]*\.[0-9]{2}/gi,
    "Shop on eBay",
  );
  const out: number[] = [];
  // `s-item__price` … first `$1,234.56`. [^$]*? stays within one element's markup.
  const re = /s-item__price[^$]*?\$\s*([0-9][0-9,]*\.[0-9]{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

// Drop prices wildly off a known retail (typos / wrong-item / bundles) and cap
// the count. Retail-DEPENDENT, so it's applied at read time, never baked into the
// cache. The formula cleans whatever noise survives.
export function filterComps(prices: number[], retail?: number, max = DEFAULT_LIMIT): number[] {
  const r = Number(retail);
  const hasRetail = Number.isFinite(r) && r > 0;
  return prices
    .filter((n) =>
      Number.isFinite(n) && n > 0 && (!hasRetail || (n <= r * 3 && n >= r * 0.02))
    )
    .slice(0, max);
}

// Pure convenience: extract + retail-filter + cap in one call (used by callers
// that have the HTML in hand, and by the tests).
export function parseEbaySoldPrices(
  html: string,
  opts: { retail?: number; max?: number } = {},
): number[] {
  return filterComps(extractSoldPrices(html), opts.retail, opts.max ?? DEFAULT_LIMIT);
}

export type FetchEbayCompsInput = {
  query: string;
  retail?: number;
  limit?: number;
  ttlMs?: number;
  timeoutMs?: number;
  // Injectable for tests; defaults to global fetch.
  fetchImpl?: typeof fetch;
};

// Best-effort: fetch eBay sold comps for a query. Never throws; returns an empty
// comps list (with a `reason`) on any failure so callers degrade gracefully.
export async function fetchEbaySoldComps(
  input: FetchEbayCompsInput,
): Promise<EbayCompsResult> {
  const query = String(input.query || "").replace(/\s+/g, " ").trim();
  const limit = input.limit && input.limit > 0 ? Math.trunc(input.limit) : DEFAULT_LIMIT;
  const url = query ? ebaySoldSearchUrl(query) : null;

  if (!query) return { comps: [], source: "none", sampleSize: 0, query, url, reason: "no query" };
  if (!compsEnabled()) {
    return { comps: [], source: "none", sampleSize: 0, query, url, reason: "disabled (EBAY_COMPS_ENABLED)" };
  }

  // Cache the RAW (unfiltered) sold prices keyed by query only — the retail
  // filter + cap are applied per request below, so different retails/limits for
  // the same title reuse one correct cache entry instead of a stale filtered one.
  const cacheKey = `${query.toLowerCase()}::raw`;
  try {
    const cachedRaw = await cacheGet<number[]>("ebay-comps", cacheKey);
    if (cachedRaw && Array.isArray(cachedRaw)) {
      const comps = filterComps(cachedRaw, input.retail, limit);
      return {
        comps,
        source: "cache",
        sampleSize: cachedRaw.length,
        query,
        url,
        reason: comps.length ? undefined : "no comps after retail filter",
      };
    }
  } catch { /* cache miss/fault → live fetch */ }

  const doFetch = input.fetchImpl ?? fetch;
  const ttlMs = input.ttlMs ?? (Number(env("EBAY_COMPS_TTL_MS")) || DEFAULT_TTL_MS);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await doFetch(url as string, {
      signal: controller.signal,
      headers: {
        "user-agent": env("EBAY_COMPS_UA") || DEFAULT_UA,
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) {
      return { comps: [], source: "none", sampleSize: 0, query, url, reason: `http ${res.status}` };
    }
    const html = await res.text();
    const raw = extractSoldPrices(html); // unfiltered — what we cache
    if (raw.length) {
      try {
        await cacheSet("ebay-comps", cacheKey, raw, ttlMs);
      } catch { /* caching is optional */ }
    }
    const comps = filterComps(raw, input.retail, limit);
    return {
      comps,
      source: comps.length ? "ebay-sold" : "none",
      sampleSize: raw.length,
      query,
      url,
      reason: comps.length
        ? undefined
        : (raw.length ? "no comps after retail filter" : "no prices parsed"),
    };
  } catch (error) {
    return {
      comps: [],
      source: "none",
      sampleSize: 0,
      query,
      url,
      reason: error instanceof Error
        ? (error.name === "AbortError" ? "timeout" : error.message)
        : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}
