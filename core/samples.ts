import { dirname } from "https://deno.land/std/path/mod.ts";
import {
  type ComparisonRow,
  envValue,
  fetchProductAnalysis,
  fetchRecentProducts,
  fetchSampleEditRecords,
  type ProductAnalysis,
  type SampleValuation,
  sendGelfMessage,
} from "./graylog.ts";
import { cacheGet, cacheSet, hashKey } from "./cache.ts";

export type SamplePriceEdit = {
  productId: string;
  price: number;
  sampleCount?: number;
  notes?: string;
  source: "manual" | "scrapecreators" | "extension";
  sourceUrl?: string;
  apiTitle?: string;
  apiSeller?: string;
  fetchedAt?: string;
  updatedAt: string;
};

export type UnpricedSample = {
  productId: string;
  name: string;
  originalPrice: number;
  price: number;
  sampleCount: number;
  sampleValue: number;
  gmv: number;
  quantity: number;
  lastSeen: string | null;
  notes: string;
  source: string;
  sourceUrl: string | null;
  apiTitle: string | null;
  apiSeller: string | null;
  fetchedAt: string | null;
  updatedAt: string | null;
  priced: boolean;
  image: string | null;
  persistedTo?: string[];
};

export type UnpricedSampleList = {
  items: UnpricedSample[];
  total: number;
  unpricedCount: number;
  pricedCount: number;
};

type SampleStore = {
  version: 1;
  edits: Record<string, SamplePriceEdit>;
  products: Record<string, ProductAnalysis>;
};

type SampleUpdateInput = {
  price?: unknown;
  sampleCount?: unknown;
  notes?: unknown;
  source?: unknown;
  sourceUrl?: unknown;
  apiTitle?: unknown;
  apiSeller?: unknown;
  fetchedAt?: unknown;
};

type SampleProductInput = SampleUpdateInput & {
  productId?: unknown;
  name?: unknown;
  category?: unknown;
  seller?: unknown;
  sourceUrl?: unknown;
  lastSeen?: unknown;
  image?: unknown;
};

type ScrapeCreatorsPrice = {
  price: number;
  sourceUrl: string;
  title?: string;
  seller?: string;
  image?: string;
  product?: Record<string, unknown>;
};

const DEFAULT_STORE_PATH = ".thirsty/sample-prices.json";
const DEFAULT_SCRAPECREATORS_BASE = "https://api.scrapecreators.com";
const DEFAULT_REGION = "US";

export async function listUnpricedSamples(
  query = "",
  limit = 100,
): Promise<UnpricedSampleList> {
  const store = await loadStore();
  const products = await fetchProductsWithStored(1000, store);
  const normalizedQuery = query.trim().toLowerCase();
  const items = products
    .filter((product) => product.sampleCount > 0)
    .filter((product) =>
      product.min_sku_original_price <= 0 || store.edits[product.productId]
    )
    .map((product) =>
      sampleFromProduct(product, store.edits[product.productId])
    )
    .filter((sample) => matchesQuery(sample, normalizedQuery))
    .sort((a, b) =>
      Number(a.priced) - Number(b.priced) || a.name.localeCompare(b.name)
    );

  const total = items.length;
  const unpricedCount = items.filter((item) => !item.priced).length;

  // Samples the user has already priced (via Save or Fetch API) sort below the
  // unpriced backlog, so a plain slice(0, limit) drops a freshly priced row off
  // the end whenever the backlog is larger than the limit -- making it look like
  // the price never updated. Always keep edited samples in the page; the limit
  // only bounds how much of the unpriced backlog we return.
  const edited = items.filter((item) => store.edits[item.productId]);
  const backlog = items.filter((item) => !store.edits[item.productId]);
  const visible = [
    ...edited,
    ...backlog.slice(0, Math.max(0, limit - edited.length)),
  ].sort((a, b) =>
    Number(a.priced) - Number(b.priced) || a.name.localeCompare(b.name)
  );

  return {
    items: visible,
    total,
    unpricedCount,
    pricedCount: total - unpricedCount,
  };
}

export async function updateSamplePrice(
  productId: string,
  input: SampleUpdateInput,
): Promise<UnpricedSample> {
  const store = await loadStore();
  const products = await fetchProductsWithStored(1000, store);
  const product = products.find((item) => item.productId === productId);
  if (!product) {
    throw new Error(`Product ${productId} was not found in Graylog`);
  }

  const existing = store.edits[productId];
  const now = new Date().toISOString();
  const price = input.price === undefined
    ? existing?.price ?? 0
    : numericInput(input.price, "price");
  const sampleCount = input.sampleCount === undefined
    ? existing?.sampleCount
    : numericInput(input.sampleCount, "sample count");
  const notes = input.notes === undefined
    ? existing?.notes
    : String(input.notes || "").trim();
  // A confirmed ScrapeCreators price saves through here too, carrying the
  // fetched provenance so the row keeps its "API" source tag after saving.
  const fromApi = input.source === "scrapecreators";

  store.edits[productId] = {
    productId,
    price,
    sampleCount,
    notes,
    source: fromApi ? "scrapecreators" : "manual",
    sourceUrl: fromApi
      ? optionalString(input.sourceUrl) ?? existing?.sourceUrl
      : undefined,
    apiTitle: fromApi
      ? optionalString(input.apiTitle) ?? existing?.apiTitle
      : undefined,
    apiSeller: fromApi
      ? optionalString(input.apiSeller) ?? existing?.apiSeller
      : undefined,
    fetchedAt: fromApi
      ? optionalString(input.fetchedAt) ?? existing?.fetchedAt ?? now
      : undefined,
    updatedAt: now,
  };
  const edit = store.edits[productId];
  const persistedTo = await persistStore(store, {
    shortMessage: `thirsty sample price: ${product.name}`,
    fields: {
      sample_source: edit.source,
      sample_edit_json: JSON.stringify(edit),
    },
  });

  return { ...sampleFromProduct(product, edit), persistedTo };
}

export async function upsertSampleProduct(
  input: SampleProductInput,
): Promise<UnpricedSample> {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Product name is required");

  const store = await loadStore();
  const productId = String(input.productId || stableProductId(name)).trim();
  const existingProduct = store.products[productId];
  const existingEdit = store.edits[productId];
  const now = new Date().toISOString();
  const price = input.price === undefined
    ? existingEdit?.price ?? existingProduct?.min_sku_original_price ?? 0
    : numericInput(input.price, "price");
  const sampleCount = input.sampleCount === undefined
    ? existingEdit?.sampleCount ?? existingProduct?.sampleCount ?? 1
    : numericInput(input.sampleCount, "sample count");
  const notes = input.notes === undefined
    ? existingEdit?.notes
    : String(input.notes || "").trim();
  const sourceUrl = optionalString(input.sourceUrl) ??
    existingEdit?.sourceUrl;
  const seller = optionalString(input.apiSeller) ??
    optionalString(input.seller) ??
    existingProduct?.seller ?? "Extension";
  const category = optionalString(input.category) ??
    existingProduct?.category ??
    "Samples";
  const lastSeen = optionalString(input.lastSeen) ??
    existingProduct?.lastSeen ?? now;
  const image = optionalString(input.image) ?? existingProduct?.image ?? null;

  store.products[productId] = {
    productId,
    name,
    priceRange: price > 0 ? formatUsd(price) : "Unknown",
    min_sku_original_price: 0,
    category,
    categoryRank: existingProduct?.categoryRank ?? null,
    seller,
    creators: existingProduct?.creators ?? 0,
    liveStreams: existingProduct?.liveStreams ?? 0,
    videos: existingProduct?.videos ?? 0,
    gmv: existingProduct?.gmv ?? 0,
    customers: existingProduct?.customers ?? 0,
    quantity: existingProduct?.quantity ?? 0,
    skuOrders: existingProduct?.skuOrders ?? 0,
    refunds: existingProduct?.refunds ?? 0,
    unitsRefunded: existingProduct?.unitsRefunded ?? 0,
    sampleCount,
    estimatedRetailValue: price * sampleCount,
    lastSeen,
    image,
  };

  if (price > 0) {
    store.edits[productId] = {
      productId,
      price,
      sampleCount,
      notes,
      source: "extension",
      sourceUrl,
      apiTitle: name,
      apiSeller: seller,
      fetchedAt: optionalString(input.fetchedAt) ?? existingEdit?.fetchedAt ??
        now,
      updatedAt: now,
    };
  }

  // The product row goes out as core_data_json so the regular Graylog product
  // pipeline picks it up (the price stays on the edit, keeping the row in the
  // recovery queue with its Extension source tag, same as the local store).
  const gelfFields: Record<string, unknown> = {
    sample_source: "extension",
    core_data_json: JSON.stringify({
      productId,
      name,
      min_sku_original_price: 0,
      sample_count: sampleCount,
      category,
      seller,
      image,
      estimated_retail_value: price * sampleCount,
      scrapedAt: optionalString(input.fetchedAt) ?? now,
    }),
  };
  if (store.edits[productId]) {
    gelfFields.sample_edit_json = JSON.stringify(store.edits[productId]);
  }
  const persistedTo = await persistStore(store, {
    shortMessage: `thirsty sample product: ${name}`,
    fields: gelfFields,
  });

  return {
    ...sampleFromProduct(store.products[productId], store.edits[productId]),
    persistedTo,
  };
}

export async function fetchPriceForSample(
  productId: string,
): Promise<UnpricedSample> {
  const store = await loadStore();
  const products = await fetchProductsWithStored(1000, store);
  const product = products.find((item) => item.productId === productId);
  if (!product) {
    throw new Error(`Product ${productId} was not found in Graylog`);
  }

  const lookup = await fetchScrapeCreatorsPrice(product);
  if (lookup.price <= 0) {
    throw new Error("ScrapeCreators returned no usable price");
  }

  const now = new Date().toISOString();

  // The lookup response is the only place the entire product (title, seller,
  // images, skus) ever appears, so persist all of it right away -- otherwise
  // the data is gone the moment the user dismisses the price confirm. The
  // price itself still goes through the preview/confirm flow below; the saved
  // product row keeps its original price so the sample stays in the queue.
  const enriched: ProductAnalysis = {
    ...product,
    name: lookup.title || product.name,
    seller: lookup.seller || product.seller,
    image: lookup.image ?? product.image ?? null,
    lastSeen: now,
  };
  store.products[productId] = enriched;
  let persistedTo: string[] = [];
  try {
    persistedTo = await persistStore(store, {
      shortMessage: `thirsty product lookup: ${enriched.name}`,
      fields: {
        sample_source: "scrapecreators",
        product_json: scrapeCreatorsProductJson(lookup.product),
        core_data_json: JSON.stringify({
          productId,
          name: enriched.name,
          min_sku_original_price: product.min_sku_original_price,
          sample_count: enriched.sampleCount,
          category: enriched.category,
          seller: enriched.seller,
          image: enriched.image,
          estimated_retail_value: enriched.estimatedRetailValue,
          scrapedAt: now,
        }),
      },
    });
  } catch {
    // A failed product save must not eat the looked-up price -- the client
    // can still preview it and confirm, which persists via updateSamplePrice.
  }

  const existing = store.edits[productId];
  const proposed: SamplePriceEdit = {
    productId,
    price: lookup.price,
    sampleCount: existing?.sampleCount,
    notes: existing?.notes,
    source: "scrapecreators",
    sourceUrl: lookup.sourceUrl,
    apiTitle: lookup.title,
    apiSeller: lookup.seller,
    fetchedAt: now,
    updatedAt: now,
  };

  return { ...sampleFromProduct(enriched, proposed), persistedTo };
}

export type ProductDetails = {
  productId: string;
  name: string | null;
  price: number;
  image: string | null;
  seller: string | null;
  sourceUrl: string | null;
};

// Live ScrapeCreators detail lookup by product id, for sibling apps (the sample
// tracker) whose samples live in Postgres rather than Graylog. Unlike
// fetchPriceForSample this never requires the product to pre-exist in the
// Graylog/store dataset -- it falls back to a minimal product built from the id
// (and optional name) so a brand-new tracker sample can still be enriched.
// Consumes a ScrapeCreators credit, persists the enrichment best-effort, and
// returns the resolved name/price/image/seller for the caller to apply.
export async function lookupProductDetails(
  productId: string,
  name?: string,
): Promise<ProductDetails> {
  const id = productId.trim();
  if (!id) throw new Error("productId is required");

  const store = await loadStore();
  // Reuse a known product when we have one (richer name -> better slug/search),
  // but a miss is fine: we synthesize the bare minimum the lookup needs.
  let existing: ProductAnalysis | undefined;
  try {
    existing = (await fetchProductsWithStored(1000, store)).find(
      (item) => item.productId === id,
    );
  } catch {
    // Graylog offline -> proceed with the synthesized product below.
  }

  const product: ProductAnalysis = existing ?? {
    productId: id,
    name: (name || "").trim() || id,
    priceRange: "",
    min_sku_original_price: 0,
    category: "",
    categoryRank: null,
    seller: "",
    creators: 0,
    liveStreams: 0,
    videos: 0,
    gmv: 0,
    customers: 0,
    quantity: 0,
    skuOrders: 0,
    refunds: 0,
    unitsRefunded: 0,
    sampleCount: 0,
    estimatedRetailValue: 0,
    lastSeen: null,
    image: null,
  };

  const lookup = await fetchScrapeCreatorsPrice(product);
  if (lookup.price <= 0) {
    throw new Error("ScrapeCreators returned no usable price");
  }

  const now = new Date().toISOString();
  const enriched: ProductAnalysis = {
    ...product,
    name: lookup.title || product.name,
    seller: lookup.seller || product.seller,
    image: lookup.image ?? product.image ?? null,
    lastSeen: now,
  };

  // Persist so the shared catalog learns the real title/image too (mirrors
  // fetchPriceForSample), but a failed save must not lose what we just paid to
  // look up -- the details below are returned regardless.
  store.products[id] = enriched;
  try {
    await persistStore(store, {
      shortMessage: `thirsty product lookup: ${enriched.name}`,
      fields: {
        sample_source: "scrapecreators",
        product_json: scrapeCreatorsProductJson(lookup.product),
        core_data_json: JSON.stringify({
          productId: id,
          name: enriched.name,
          min_sku_original_price: product.min_sku_original_price,
          sample_count: enriched.sampleCount,
          category: enriched.category,
          seller: enriched.seller,
          image: enriched.image,
          estimated_retail_value: enriched.estimatedRetailValue,
          scrapedAt: now,
        }),
      },
    });
  } catch {
    // best-effort persistence; the looked-up details are still returned.
  }

  return {
    productId: id,
    name: enriched.name || null,
    price: lookup.price,
    image: enriched.image ?? null,
    seller: enriched.seller || null,
    sourceUrl: lookup.sourceUrl || null,
  };
}

// --- UPC -> product name -> TikTok product (for the tracker's Barcode Test) --
// ScrapeCreators is TikTok-only and can't resolve a physical barcode, so we
// first resolve the UPC to a name/brand via UPCitemdb, then search TikTok Shop
// for the best match. Either side may come up empty: a UPC with no UPCitemdb
// record is a hard miss; a known UPC with no TikTok listing still returns the
// UPCitemdb item (match: null) so the caller can save it from that data alone.
const DEFAULT_UPCITEMDB_URL = "https://api.upcitemdb.com/prod/trial/lookup";
// Go-UPC fallback: a much larger (500M+) catalog that covers general consumer
// goods UPCitemdb's free trial misses. Keyed (GOUPC_API_KEY) — skipped if unset.
const DEFAULT_GOUPC_URL = "https://go-upc.com/api/v1/code";
// Barcode Lookup fallback: another large independent catalog. Keyed
// (BARCODELOOKUP_API_KEY) — skipped if unset.
const DEFAULT_BARCODELOOKUP_URL = "https://api.barcodelookup.com/v3/products";
// Open Food Facts fallback: free, no key, no rate limit. Food/grocery/cosmetics
// focused — the last-resort provider when the keyed sources come up empty.
const DEFAULT_OPENFOODFACTS_URL = "https://world.openfoodfacts.org/api/v2/product";
// Google Lens (via SerpApi): the visual-search escape hatch for barcodes no UPC
// database indexes. We render the code as a barcode image and let Lens decode +
// match it against Google's shopping graph. Keyed (SERPAPI_API_KEY).
const DEFAULT_SERPAPI_URL = "https://serpapi.com/search.json";

// Google Lens "type" for the image-lookup endpoint. `products` returns
// product-oriented matches (names + store links); `exact_matches` is the
// strictest (only confirmed same-product listings). Overridable via
// SERPAPI_LENS_TYPE. We parse exact_matches / products / visual_matches from the
// response regardless, so this just steers which set SerpApi prioritizes.
const DEFAULT_LENS_TYPE = "products";

// Cache TTLs (ms) for the cost-bearing lookups. Hits live a day by default
// (a UPC/image → product mapping is stable; only the price drifts), misses an
// hour (so a transient gap re-checks sooner). Both env-tunable. Parsed
// explicitly (not `Number(...) || default`) so an operator can set "0" to
// disable caching — cacheSet treats ttl<=0 as a no-op — while only an unset or
// non-numeric value falls back to the default.
function lookupCacheTtl(): number {
  const n = Number(envValue("LOOKUP_CACHE_TTL_MS"));
  return Number.isFinite(n) ? n : 24 * 60 * 60 * 1000;
}
function lookupCacheNegTtl(): number {
  const n = Number(envValue("LOOKUP_CACHE_NEG_TTL_MS"));
  return Number.isFinite(n) ? n : 60 * 60 * 1000;
}

export type UpcItem = {
  title: string;
  brand: string | null;
  category: string | null;
};

export type UpcMatch = {
  productId: string | null;
  name: string | null;
  price: number;
  image: string | null;
  seller: string | null;
  sourceUrl: string | null;
  product?: Record<string, unknown>;
};

// Providers in the lookup chain (diagnostics for the caller).
export type UpcSource =
  | "upcitemdb"
  | "go-upc"
  | "barcodelookup"
  | "openfoodfacts"
  | "googlelens"
  | "googleshopping";

export type UpcLookup = {
  ok: boolean;
  upc: string;
  upcItem?: UpcItem;
  match?: UpcMatch | null;
  error?: string;
  // Every provider attempted, in order — e.g. ["upcitemdb","go-upc",
  // "openfoodfacts"] when both fallbacks ran before giving up.
  providersTried: UpcSource[];
  // Set when an item was found, naming the provider that supplied it.
  source?: UpcSource;
  // Raw provider payloads, keyed by "engine:query" — only populated when the
  // caller asks for debug (e.g. /api/upc-lookup/<upc>?debug=1). Lets us inspect
  // exactly what the SerpApi engines returned without re-running them.
  debug?: SerpDebug;
};

// Raw provider responses captured for diagnostics, keyed by "engine:query".
export type SerpDebug = Record<string, unknown>;

// Result of resolving a product *image* (not a barcode) to a TikTok Shop
// product: SerpApi Google Lens turns the image into candidate product names,
// then ScrapeCreators resolves the best candidate to a live listing. Mirrors
// UpcLookup so the tracker can share rendering, keyed by imageUrl instead of upc.
export type ImageLookup = {
  ok: boolean;
  imageUrl: string;
  // Best candidate Lens surfaced (its title drives the TikTok search).
  item?: UpcItem;
  // Every candidate title Lens returned, best-first — diagnostic context for the
  // debug panel even when none resolved to a TikTok product.
  candidates?: string[];
  match?: UpcMatch | null;
  error?: string;
  // Which Lens result set answered ("googlelens" — products/exact/visual).
  source?: "googlelens";
  // Raw SerpApi payload when the caller asks for debug (?debug=1).
  debug?: SerpDebug;
};

// UPCitemdb: trial endpoint needs no key (rate-limited ~100/day, shared). A paid
// plan key (UPCITEMDB_API_KEY) switches to the authenticated endpoint headers.
async function fetchUpcItemDb(upc: string): Promise<UpcItem | null> {
  const base = envValue("UPCITEMDB_API_URL") || DEFAULT_UPCITEMDB_URL;
  const url = new URL(base);
  url.searchParams.set("upc", upc);

  const headers: Record<string, string> = { accept: "application/json" };
  const key = envValue("UPCITEMDB_API_KEY");
  if (key) {
    headers["user_key"] = key;
    headers["key_type"] = "3scale";
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`UPCitemdb lookup failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  const item = isRecord(body) && Array.isArray(body.items) ? body.items[0] : null;
  if (!isRecord(item) || !item.title) return null;
  return {
    title: String(item.title),
    brand: item.brand ? String(item.brand) : null,
    category: item.category ? String(item.category) : null,
  };
}

// Go-UPC fallback: GET /api/v1/code/<upc> with a Bearer key, returning a single
// { product: { name, brand, category, ... } }. An unknown code yields 404 (or a
// product-less body) — both are a clean miss, not an error.
async function fetchGoUpcItem(upc: string, key: string): Promise<UpcItem | null> {
  const base = (envValue("GOUPC_API_URL") || DEFAULT_GOUPC_URL).replace(/\/+$/, "");
  const res = await fetch(`${base}/${encodeURIComponent(upc)}`, {
    headers: { accept: "application/json", authorization: `Bearer ${key}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Go-UPC lookup failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  const product = isRecord(body) && isRecord(body.product) ? body.product : null;
  if (!product || !product.name) return null;
  return {
    title: String(product.name),
    brand: product.brand ? String(product.brand) : null,
    category: product.category ? String(product.category) : null,
  };
}

// Barcode Lookup: GET /v3/products?barcode=<upc>&key=<key>. 404 = not in their
// database; otherwise a { products: [ { product_name, brand, category } ] } list.
async function fetchBarcodeLookupItem(upc: string, key: string): Promise<UpcItem | null> {
  const base = (envValue("BARCODELOOKUP_API_URL") || DEFAULT_BARCODELOOKUP_URL)
    .replace(/\/+$/, "");
  const url = new URL(base);
  url.searchParams.set("barcode", upc);
  url.searchParams.set("key", key);

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Barcode Lookup failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  const product = isRecord(body) && Array.isArray(body.products) ? body.products[0] : null;
  if (!isRecord(product)) return null;
  const title = product.product_name
    ? String(product.product_name).trim()
    : product.title
    ? String(product.title).trim()
    : "";
  if (!title) return null;
  return {
    title,
    brand: product.brand ? String(product.brand) : null,
    category: product.category ? String(product.category) : null,
  };
}

// Open Food Facts: free, keyless. GET /api/v2/product/<upc>.json — status 0 (or
// HTTP 404) means the barcode isn't in the open database. `brands`/`categories`
// come back as comma lists: take the first brand and the most-specific category.
async function fetchOpenFoodFactsItem(upc: string): Promise<UpcItem | null> {
  const base = (envValue("OPENFOODFACTS_API_URL") || DEFAULT_OPENFOODFACTS_URL)
    .replace(/\/+$/, "");
  const url = new URL(`${base}/${encodeURIComponent(upc)}.json`);
  url.searchParams.set("fields", "product_name,brands,categories");

  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      // Open Food Facts asks API clients to identify themselves.
      "user-agent": "data-pimp/1.0 (+https://thirsty.store)",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Open Food Facts lookup failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  if (!isRecord(body) || body.status !== 1) return null; // 0 = product not found
  const product = isRecord(body.product) ? body.product : null;
  const title = product?.product_name ? String(product.product_name).trim() : "";
  if (!title) return null;

  const brand = product?.brands
    ? String(product.brands).split(",")[0].trim() || null
    : null;
  const cats = product?.categories
    ? String(product.categories).split(",").map((c) => c.trim()).filter(Boolean)
    : [];
  return { title, brand, category: cats.length ? cats[cats.length - 1] : null };
}

// Lens/shopping titles carry retail noise ("Buy …", "… - Walmart.com"). Trim the
// leading verb and any trailing " - site" / " | site" suffix so the name we feed
// the TikTok search is the product, not the storefront.
function cleanLensTitle(raw: string): string {
  return raw
    .replace(/^\s*(buy|shop|get|order)\s+/i, "")
    .split(/\s+[|–—]\s+|\s+-\s+(?=\S+\.\w{2,}|\w+\.com)/i)[0]
    .replace(/\s+/g, " ")
    .trim();
}

// Google Lens via SerpApi. We point Lens at our own rendered barcode image
// (served by /api/barcode/<upc>.png) so it decodes the code and returns the
// shopping "visual_matches" — resolving products no UPC database indexes. Needs
// a publicly reachable base URL for the image, hence publicBase.
async function fetchGoogleLensItem(
  upc: string,
  key: string,
  publicBase: string,
  debug?: SerpDebug,
): Promise<UpcItem | null> {
  const imageUrl = `${publicBase.replace(/\/+$/, "")}/api/barcode/${
    encodeURIComponent(upc)
  }.png`;
  const url = new URL(envValue("SERPAPI_API_URL") || DEFAULT_SERPAPI_URL);
  url.searchParams.set("engine", "google_lens");
  url.searchParams.set("url", imageUrl);
  url.searchParams.set("api_key", key);

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Google Lens lookup failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  if (debug) debug[`google_lens:${upc}`] = body;
  const matches = isRecord(body) && Array.isArray(body.visual_matches)
    ? body.visual_matches
    : [];
  for (const match of matches) {
    if (!isRecord(match) || !match.title) continue;
    const title = cleanLensTitle(String(match.title));
    if (title) return { title, brand: null, category: null };
  }
  return null;
}

// A product candidate Lens returned for an image: the cleaned listing title
// (drives the TikTok search) and its source link (diagnostic).
type LensCandidate = { title: string; link: string | null };

// Google Lens via SerpApi, pointed at a *product image* (the image-lookup
// endpoint). Unlike the barcode fallback above, this matches the photo itself —
// SerpApi's `google searches by image` behavior — and returns product-oriented
// candidates. We request the configured type (products / exact_matches) but
// parse every result set the response carries, most-precise first, so the caller
// gets candidate names even when SerpApi files them under a different key.
async function fetchGoogleLensProducts(
  imageUrl: string,
  key: string,
  debug?: SerpDebug,
): Promise<LensCandidate[]> {
  const url = new URL(envValue("SERPAPI_API_URL") || DEFAULT_SERPAPI_URL);
  url.searchParams.set("engine", "google_lens");
  url.searchParams.set("url", imageUrl);
  url.searchParams.set("type", envValue("SERPAPI_LENS_TYPE") || DEFAULT_LENS_TYPE);
  url.searchParams.set("api_key", key);

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Google Lens lookup failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  if (debug) debug[`google_lens:${imageUrl}`] = body;

  // Exact matches are confirmed same-product listings; products / visual matches
  // are progressively looser. Walk them in that order and dedup by cleaned title.
  const groups = ["exact_matches", "products", "product_results", "visual_matches"];
  const seen = new Set<string>();
  const out: LensCandidate[] = [];
  if (isRecord(body)) {
    for (const groupKey of groups) {
      const arr = Array.isArray(body[groupKey]) ? body[groupKey] as unknown[] : [];
      for (const entry of arr) {
        if (!isRecord(entry) || !entry.title) continue;
        const title = cleanLensTitle(String(entry.title));
        if (!title) continue;
        const dedup = title.toLowerCase();
        if (seen.has(dedup)) continue;
        seen.add(dedup);
        out.push({ title, link: entry.link ? String(entry.link) : null });
      }
    }
  }
  return out;
}

// Google Shopping via SerpApi. Shopping listings are indexed by GTIN/UPC, so a
// raw barcode query often surfaces the exact product even when plain web search
// (and Lens visual matching) come up empty — the more reliable of the two
// SerpApi routes for resolving a scanned code to a product name.
async function fetchGoogleShoppingItem(
  upc: string,
  key: string,
  debug?: SerpDebug,
): Promise<UpcItem | null> {
  const url = new URL(envValue("SERPAPI_API_URL") || DEFAULT_SERPAPI_URL);
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", upc);
  url.searchParams.set("api_key", key);

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Google Shopping lookup failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  if (debug) debug[`google_shopping:${upc}`] = body;
  const results = isRecord(body) && Array.isArray(body.shopping_results)
    ? body.shopping_results
    : [];
  for (const result of results) {
    if (!isRecord(result) || !result.title) continue;
    const title = cleanLensTitle(String(result.title));
    if (title) return { title, brand: null, category: null };
  }
  return null;
}

type UpcItemResult = {
  item: UpcItem | null;
  source: UpcSource | null;
  providersTried: UpcSource[];
  debug?: SerpDebug;
};

// A scanned code may arrive as UPC-A (12 digits) or zero-padded EAN-13 (13).
// Try the as-given form first, then the alternate, so a provider that only
// indexes one representation still resolves. Deduped, order-preserving.
function upcCandidates(upc: string): string[] {
  const out = [upc];
  if (upc.length === 13 && upc.startsWith("0")) {
    out.push(upc.slice(1)); // EAN-13 leading zero → UPC-A (12)
  } else if (upc.length === 12) {
    out.push("0" + upc); // UPC-A → EAN-13
  }
  return [...new Set(out)];
}

// Resolve a UPC to a product, walking a provider chain so a single source's
// gap (or the trial endpoint's ~100/day cap) doesn't strand the lookup:
//   UPCitemdb → Go-UPC → Barcode Lookup (each keyed) → Open Food Facts (free)
//   → Google Shopping → Google Lens (both SerpApi; for codes no DB indexes).
// Each DB provider is tried across every UPC candidate form; the SerpApi steps
// run once (per candidate for Shopping) and cost a credit each. Records every
// provider attempted (providersTried) and which one answered (source). A
// provider error is only fatal when *every* attempt threw — otherwise a clean
// miss from any source means a genuine "not found". publicBase is the
// externally reachable origin Lens fetches the barcode image from. When debug
// is set, raw SerpApi payloads are collected for the caller to inspect.
async function fetchUpcItem(
  upc: string,
  publicBase: string,
  debug = false,
): Promise<UpcItemResult> {
  const candidates = upcCandidates(upc);
  const providersTried: UpcSource[] = [];
  const debugInfo: SerpDebug | undefined = debug ? {} : undefined;
  let primaryError: unknown = null;
  let anyAnswered = false; // a provider responded cleanly (hit or definitive miss)

  // Run one provider across the given UPC candidate forms (defaulting to all).
  // Returns the first hit, or null on a clean miss. Marks anyAnswered when the
  // provider responds without throwing, and captures UPCitemdb's error as the
  // primary failure.
  const run = async (
    source: UpcSource,
    fn: (u: string) => Promise<UpcItem | null>,
    cands: string[] = candidates,
  ): Promise<UpcItem | null> => {
    providersTried.push(source);
    let answered = false;
    let firstError: unknown = null;
    for (const candidate of cands) {
      try {
        const item = await fn(candidate);
        answered = true;
        if (item) return item;
      } catch (error) {
        if (firstError === null) firstError = error;
      }
    }
    if (answered) anyAnswered = true;
    else if (source === "upcitemdb" && firstError !== null) primaryError = firstError;
    return null;
  };

  let item = await run("upcitemdb", fetchUpcItemDb);
  if (item) return { item, source: "upcitemdb", providersTried, debug: debugInfo };

  const goUpcKey = envValue("GOUPC_API_KEY");
  if (goUpcKey) {
    item = await run("go-upc", (u) => fetchGoUpcItem(u, goUpcKey));
    if (item) return { item, source: "go-upc", providersTried, debug: debugInfo };
  }

  const barcodeLookupKey = envValue("BARCODELOOKUP_API_KEY");
  if (barcodeLookupKey) {
    item = await run("barcodelookup", (u) => fetchBarcodeLookupItem(u, barcodeLookupKey));
    if (item) return { item, source: "barcodelookup", providersTried, debug: debugInfo };
  }

  item = await run("openfoodfacts", fetchOpenFoodFactsItem);
  if (item) return { item, source: "openfoodfacts", providersTried, debug: debugInfo };

  // SerpApi fallbacks for codes no UPC database indexes. Both are keyed
  // (SERPAPI_API_KEY) and run only after the DBs miss. Google Shopping first —
  // its GTIN-indexed listings resolve a raw barcode query reliably and fast
  // (~1s). Google Lens is the last resort: a visual match against our rendered
  // barcode image (needs a public origin), kept only for the rare code Shopping
  // misses, since it's slow (~30s) and can't actually decode barcodes itself.
  const serpApiKey = envValue("SERPAPI_API_KEY");
  if (serpApiKey) {
    item = await run(
      "googleshopping",
      (u) => fetchGoogleShoppingItem(u, serpApiKey, debugInfo),
    );
    if (item) return { item, source: "googleshopping", providersTried, debug: debugInfo };

    if (publicBase) {
      item = await run(
        "googlelens",
        (u) => fetchGoogleLensItem(u, serpApiKey, publicBase, debugInfo),
        [upc],
      );
      if (item) return { item, source: "googlelens", providersTried, debug: debugInfo };
    }
  }

  // Nothing matched. If at least one provider answered, it's a genuine miss; if
  // they ALL errored, surface the primary failure so the caller returns 502.
  if (!anyAnswered && primaryError) throw primaryError;
  return { item: null, source: null, providersTried, debug: debugInfo };
}

// Pull the numeric TikTok product id out of a PDP url
// (.../shop/pdp/<slug>/<productId>).
function productIdFromUrl(sourceUrl: string | undefined): string | null {
  if (!sourceUrl) return null;
  const m = sourceUrl.match(/(\d{6,})(?:[/?#]|$)/);
  return m ? m[1] : null;
}

// The synthetic ProductAnalysis the ScrapeCreators name search needs. Only
// `name` is read by that search; the "9"-prefixed id forces the name-search path
// (never a real PDP) and the rest are zero placeholders.
function syntheticProduct(name: string, idHint = ""): ProductAnalysis {
  return {
    productId: "9" + idHint,
    name,
    priceRange: "",
    min_sku_original_price: 0,
    category: "",
    categoryRank: null,
    seller: "",
    creators: 0,
    liveStreams: 0,
    videos: 0,
    gmv: 0,
    customers: 0,
    quantity: 0,
    skuOrders: 0,
    refunds: 0,
    unitsRefunded: 0,
    sampleCount: 0,
    estimatedRetailValue: 0,
    lastSeen: null,
    image: null,
  };
}

// Resolve a free-text product name to the best matching TikTok Shop listing via
// ScrapeCreators. Shared by the UPC and image lookups. Never throws — a price
// miss must not fail the whole lookup. Returns { match, errored }: `errored` is
// true only when the ScrapeCreators call itself failed transiently
// (network/5xx/429/credit), distinct from a clean "no listing" miss, so the
// caller can cache a transient failure briefly instead of for the full positive
// TTL. `idHint` only labels the synthetic id; the real product id comes from the
// matched listing's URL.
async function resolveTiktokMatchByName(
  name: string,
  idHint = "",
): Promise<{ match: UpcMatch | null; errored: boolean }> {
  const apiKey = envValue("SCRAPECREATORS_API_KEY") || envValue("API_KEY");
  if (!apiKey) return { match: null, errored: false };
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (!trimmed) return { match: null, errored: false };

  const base = (envValue("SCRAPECREATORS_API_BASE") || DEFAULT_SCRAPECREATORS_BASE)
    .replace(/\/+$/, "");
  const region = envValue("SCRAPECREATORS_REGION") || DEFAULT_REGION;

  let lookup: ScrapeCreatorsPrice | null = null;
  try {
    lookup = await fetchScrapeCreatorsPriceByName(
      base,
      apiKey,
      region,
      syntheticProduct(trimmed, idHint),
    );
  } catch {
    return { match: null, errored: true }; // transient — don't cache long
  }
  if (!lookup || !lookup.title) return { match: null, errored: false };

  return {
    match: {
      productId: productIdFromUrl(lookup.sourceUrl),
      name: lookup.title || null,
      price: lookup.price || 0,
      image: lookup.image ?? null,
      seller: lookup.seller ?? null,
      sourceUrl: lookup.sourceUrl || null,
      product: lookup.product,
    },
    errored: false,
  };
}

// `origin` is the request's public origin, used to build the barcode-image URL
// for the Google Lens fallback. PUBLIC_BASE_URL overrides it when the request
// origin isn't externally reachable (e.g. behind an internal proxy). `debug`
// echoes the raw SerpApi payloads back to the caller for diagnostics — and
// bypasses the cache, so a debug call always returns fresh raw payloads.
export async function lookupProductByUpc(
  upc: string,
  opts: { origin?: string; debug?: boolean } = {},
): Promise<UpcLookup> {
  const clean = String(upc || "").replace(/\D/g, "");
  if (!clean) throw new Error("upc is required");

  // Cache by UPC to spare repeat scans the provider + SerpApi credits. Skipped
  // under debug so the raw payloads are always live. Only resolved results are
  // cached (computeUpcLookup throws on hard provider failure, so those aren't
  // stored).
  if (!opts.debug) {
    const cached = await cacheGet<UpcLookup>("upc", clean);
    if (cached) return cached;
  }

  const { lookup, matchErrored } = await computeUpcLookup(clean, opts);

  if (!opts.debug) {
    // A transient ScrapeCreators failure yields ok:true/match:null; cache it only
    // briefly (negative TTL) so the price re-checks within the hour once the
    // provider recovers, rather than pinning a matchless result for the full day.
    const ttl = matchErrored || !lookup.ok ? lookupCacheNegTtl() : lookupCacheTtl();
    await cacheSet("upc", clean, lookup, ttl);
  }
  return lookup;
}

async function computeUpcLookup(
  clean: string,
  opts: { origin?: string; debug?: boolean },
): Promise<{ lookup: UpcLookup; matchErrored: boolean }> {
  const publicBase = envValue("PUBLIC_BASE_URL") || opts.origin || "";
  const { item, source, providersTried, debug } = await fetchUpcItem(
    clean,
    publicBase,
    opts.debug,
  );
  if (!item) {
    return {
      lookup: {
        ok: false,
        upc: clean,
        error: "No product found for that UPC",
        providersTried,
        debug,
      },
      matchErrored: false,
    };
  }

  // Search TikTok Shop by brand + title (deduped) for the best match.
  const query = [item.brand, item.title]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const { match, errored } = await resolveTiktokMatchByName(
    query || item.title,
    clean,
  );

  return {
    lookup: {
      ok: true,
      upc: clean,
      upcItem: item,
      providersTried,
      source: source ?? undefined,
      debug,
      match,
    },
    matchErrored: errored,
  };
}

// Resolve a product *image* (URL) to a TikTok Shop product: SerpApi Google Lens
// turns the image into candidate product names, then ScrapeCreators resolves the
// best candidate to a live listing — the "search by image" path for TikTok
// metadata/image matching. Gated on SERPAPI_API_KEY. Cached by image URL to
// control cost; `debug` bypasses the cache and echoes the raw Lens payload.
export async function lookupProductByImage(
  imageUrl: string,
  opts: { debug?: boolean } = {},
): Promise<ImageLookup> {
  const url = String(imageUrl || "").trim();
  if (!url) throw new Error("image url is required");

  const serpApiKey = envValue("SERPAPI_API_KEY");
  if (!serpApiKey) {
    return {
      ok: false,
      imageUrl: url,
      error: "image lookup unavailable: SERPAPI_API_KEY is not configured",
    };
  }

  const cacheKey = await hashKey(url);
  if (!opts.debug) {
    const cached = await cacheGet<ImageLookup>("image", cacheKey);
    if (cached) return cached;
  }

  const { lookup, matchErrored } = await computeImageLookup(
    url,
    serpApiKey,
    opts.debug,
  );

  if (!opts.debug) {
    // As in lookupProductByUpc: a transient ScrapeCreators failure re-checks
    // within the hour instead of pinning a matchless result for the full day.
    const ttl = matchErrored || !lookup.ok ? lookupCacheNegTtl() : lookupCacheTtl();
    await cacheSet("image", cacheKey, lookup, ttl);
  }
  return lookup;
}

async function computeImageLookup(
  url: string,
  serpApiKey: string,
  debug = false,
): Promise<{ lookup: ImageLookup; matchErrored: boolean }> {
  const debugInfo: SerpDebug | undefined = debug ? {} : undefined;
  const candidates = await fetchGoogleLensProducts(url, serpApiKey, debugInfo);
  const candidateTitles = candidates.map((c) => c.title);

  if (!candidates.length) {
    return {
      lookup: {
        ok: false,
        imageUrl: url,
        error: "No product matches for that image",
        candidates: candidateTitles,
        debug: debugInfo,
      },
      matchErrored: false,
    };
  }

  const best = candidates[0];
  const item: UpcItem = { title: best.title, brand: null, category: null };
  // Resolve only the top candidate to a TikTok listing — one ScrapeCreators
  // search keeps the per-lookup cost bounded.
  const { match, errored } = await resolveTiktokMatchByName(best.title);

  return {
    lookup: {
      ok: true,
      imageUrl: url,
      item,
      candidates: candidateTitles,
      source: "googlelens",
      debug: debugInfo,
      match,
    },
    matchErrored: errored,
  };
}

// Catalog endpoint used by sibling apps (sample tracker, thirsty.store). The
// local/recovered store keeps serving products even when Graylog is offline.
export async function listProducts(limit = 100): Promise<ProductAnalysis[]> {
  const store = await loadStore();
  let recent: ProductAnalysis[] = [];
  try {
    recent = await fetchRecentProducts(limit);
  } catch {
    // Graylog being unreachable must not take the catalog down -- the store
    // still has every product saved by lookups and intake.
  }

  const products = new Map<string, ProductAnalysis>();
  for (const product of recent) {
    products.set(product.productId, product);
  }
  for (const product of Object.values(store.products)) {
    if (!products.has(product.productId)) {
      products.set(product.productId, product);
    }
  }

  return [...products.values()]
    .map((product) => productWithEdit(product, store.edits[product.productId]))
    .sort((a, b) => (b.lastSeen || "").localeCompare(a.lastSeen || ""))
    .slice(0, limit);
}

export async function fetchProductWithEdits(
  productId: string,
): Promise<ProductAnalysis | null> {
  const store = await loadStore();
  const product = await fetchProductAnalysis(productId) ??
    store.products[productId];
  if (!product) return null;

  // The product-detail view reads raw Graylog data, so a price recovered via
  // Save or Fetch API (stored as an edit) would otherwise never show here even
  // though the sample queue reflects it. Apply the edit so both views agree.
  return productWithEdit(product, store.edits[productId]);
}

function productWithEdit(
  product: ProductAnalysis,
  edit?: SamplePriceEdit,
): ProductAnalysis {
  if (!edit) return product;

  const price = edit.price ?? product.min_sku_original_price;
  return {
    ...product,
    name: edit.apiTitle || product.name,
    min_sku_original_price: price,
    priceRange: price > 0 ? formatUsd(price) : product.priceRange,
    estimatedRetailValue: price > 0
      ? price * product.sampleCount
      : product.estimatedRetailValue,
  };
}

export async function fetchSampleValuationWithEdits(): Promise<
  SampleValuation
> {
  const store = await loadStore();
  const products = await fetchProductsWithStored(1000, store);
  const samples = products
    .filter((product) => product.sampleCount > 0)
    .map((product) =>
      sampleFromProduct(product, store.edits[product.productId])
    );
  const totalSamples = samples.reduce(
    (sum, sample) => sum + sample.sampleCount,
    0,
  );
  const totalRetailValue = samples.reduce(
    (sum, sample) => sum + sample.sampleValue,
    0,
  );
  const lastUpdated =
    samples.map((sample) => sample.lastSeen).filter(Boolean).sort().at(-1) ||
    null;

  return {
    totalSamples,
    productsTracked: samples.length,
    totalRetailValue,
    averageSampleValue: totalSamples ? totalRetailValue / totalSamples : 0,
    maintainableMonthlyValue: Math.min(totalRetailValue, 5000),
    resale10Value: totalRetailValue * 0.1,
    resale20Value: totalRetailValue * 0.2,
    resale30Value: totalRetailValue * 0.3,
    lastUpdated,
  };
}

export async function fetchComparisonWithEdits(): Promise<ComparisonRow[]> {
  const store = await loadStore();
  const products = await fetchProductsWithStored(200, store);

  return products
    .map((product) => {
      const sample = sampleFromProduct(product, store.edits[product.productId]);
      const creatorVideos = product.creators || product.videos || 0;
      const platformVideos = product.videos || 0;
      const rank = product.categoryRank;

      return {
        productId: product.productId,
        name: sample.name,
        category: product.category,
        rank,
        creatorVideos,
        platformVideos,
        sales: product.gmv,
        min_sku_original_price: sample.price,
        sampleValue: sample.sampleValue,
        signal: comparisonSignal(
          rank,
          creatorVideos,
          platformVideos,
          product.gmv,
        ),
      };
    })
    .sort((a, b) => {
      const aRank = a.rank ?? 999999;
      const bRank = b.rank ?? 999999;
      return aRank - bRank || b.sampleValue - a.sampleValue;
    });
}

function sampleFromProduct(
  product: ProductAnalysis,
  edit?: SamplePriceEdit,
): UnpricedSample {
  const price = edit?.price ?? product.min_sku_original_price;
  const sampleCount = edit?.sampleCount ?? product.sampleCount;

  return {
    productId: product.productId,
    name: edit?.apiTitle || product.name,
    originalPrice: product.min_sku_original_price,
    price,
    sampleCount,
    sampleValue: price * sampleCount,
    gmv: product.gmv,
    quantity: product.quantity,
    lastSeen: product.lastSeen,
    notes: edit?.notes || "",
    source: edit?.source || "graylog",
    sourceUrl: edit?.sourceUrl || null,
    apiTitle: edit?.apiTitle || null,
    apiSeller: edit?.apiSeller || null,
    fetchedAt: edit?.fetchedAt || null,
    updatedAt: edit?.updatedAt || null,
    priced: price > 0,
    image: product.image ?? null,
  };
}

function matchesQuery(sample: UnpricedSample, query: string): boolean {
  if (!query) return true;

  return sample.productId.toLowerCase().includes(query) ||
    sample.name.toLowerCase().includes(query) ||
    sample.notes.toLowerCase().includes(query);
}

// Retry transient ScrapeCreators failures (5xx/429) a few times with linear
// backoff. Their endpoints occasionally fault on requests they can otherwise
// serve, and a short retry recovers the accurate result without resorting to a
// less-precise fallback lookup.
async function fetchWithRetry(
  url: URL,
  init: RequestInit,
  attempts = 3,
): Promise<Response> {
  let response!: Response;
  for (let attempt = 0; attempt < attempts; attempt++) {
    response = await fetch(url, init);
    if (response.status < 500 && response.status !== 429) return response;
    if (attempt < attempts - 1) {
      // Drain the unused body so the connection can be reused, then back off.
      await response.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  return response;
}

async function fetchScrapeCreatorsPrice(
  product: ProductAnalysis,
): Promise<ScrapeCreatorsPrice> {
  const apiKey = envValue("SCRAPECREATORS_API_KEY") || envValue("API_KEY");
  if (!apiKey) throw new Error("SCRAPECREATORS_API_KEY is not configured");

  const base =
    (envValue("SCRAPECREATORS_API_BASE") || DEFAULT_SCRAPECREATORS_BASE)
      .replace(/\/+$/, "");
  const region = envValue("SCRAPECREATORS_REGION") || DEFAULT_REGION;

  // Synthetic "9"-prefixed ids never map to a real PDP, so go straight to the
  // name search.
  if (product.productId.startsWith("9")) {
    return fetchScrapeCreatorsPriceByName(base, apiKey, region, product);
  }

  // Prefer the by-URL lookup -- when it works it returns the exact PDP's price.
  // But that endpoint is flaky (ScrapeCreators intermittently 500s with "Cannot
  // set properties of undefined (setting 'related_videos')" on products it can
  // otherwise resolve) and some products never resolve, so fall back to the
  // name search instead of failing the whole request. The fallback may match a
  // different listing for the same product, which still beats no price at all.
  try {
    const byUrl = await fetchScrapeCreatorsPriceByUrl(
      base,
      apiKey,
      region,
      product,
    );
    if (byUrl.price > 0) return byUrl;
  } catch (error) {
    console.error(
      "ScrapeCreators by-url lookup failed; trying name search:",
      error,
    );
  }

  return fetchScrapeCreatorsPriceByName(base, apiKey, region, product);
}

async function fetchScrapeCreatorsPriceByUrl(
  base: string,
  apiKey: string,
  region: string,
  product: ProductAnalysis,
): Promise<ScrapeCreatorsPrice> {
  const productUrl = tiktokProductUrl(product);
  const url = new URL(`${base}/v1/tiktok/product`);
  url.searchParams.set("url", productUrl);
  url.searchParams.set("region", region);

  // This endpoint intermittently 500s on products it can otherwise resolve, so
  // retry transient 5xx/429 before giving up -- a retry usually returns the
  // correct PDP price (and only then do we fall back to the name search).
  const response = await fetchWithRetry(url, {
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(
      `ScrapeCreators lookup failed: ${response.status} ${await response
        .text()}`,
    );
  }

  const body = await response.json();
  const price = priceFromScrapeCreators(body);

  return {
    price,
    sourceUrl: productUrl,
    title: stringAt(body, ["product_info", "product_base", "title"]) ||
      stringAt(body, ["product_base", "title"]),
    seller: stringAt(body, ["product_info", "seller", "name"]) ||
      stringAt(body, ["seller", "name"]) ||
      stringAt(body, ["shop_info", "shop_name"]),
    image: imageFromScrapeCreators(body),
    product: isRecord(body) ? body : undefined,
  };
}

async function fetchScrapeCreatorsPriceByName(
  base: string,
  apiKey: string,
  region: string,
  product: ProductAnalysis,
): Promise<ScrapeCreatorsPrice> {
  const url = new URL(`${base}/v1/tiktok/shop/search`);
  url.searchParams.set("query", product.name);
  url.searchParams.set("region", region);

  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(
      `ScrapeCreators name lookup failed: ${response.status} ${await response
        .text()}`,
    );
  }

  const body = await response.json();
  const result = bestScrapeCreatorsSearchProduct(body, product.name);
  if (!result) {
    return {
      price: 0,
      sourceUrl: url.href,
    };
  }

  return {
    price: priceFromScrapeCreatorsSearchProduct(result),
    sourceUrl: scrapeCreatorsSearchProductUrl(result) || url.href,
    title: scrapeCreatorsSearchProductTitle(result),
    seller: scrapeCreatorsSearchProductSeller(result),
    image: imageFromScrapeCreators(result),
    product: result,
  };
}

function priceFromScrapeCreators(body: unknown): number {
  const candidates = [
    valueAt(body, [
      "product_info",
      "product_base",
      "price",
      "min_sku_original_price",
    ]),
    valueAt(body, ["product_base", "price", "min_sku_original_price"]),
    valueAt(body, ["product_info", "product_base", "price", "min_sku_price"]),
    valueAt(body, ["product_base", "price", "min_sku_price"]),
    valueAt(body, ["product_info", "product_base", "price", "original_price"]),
    valueAt(body, ["product_base", "price", "original_price"]),
    valueAt(body, ["product_info", "product_base", "price", "real_price"]),
    valueAt(body, ["product_base", "price", "real_price"]),
    ...skuPriceCandidates(valueAt(body, ["product_info", "skus"])),
    ...skuPriceCandidates(valueAt(body, ["skus"])),
    valueAt(body, [
      "product_info",
      "product_base",
      "price",
      "max_sku_original_price",
    ]),
    valueAt(body, ["product_base", "price", "max_sku_original_price"]),
  ];

  for (const candidate of candidates) {
    const price = numberFrom(candidate, 0);
    if (price > 0) return price;
  }

  return 0;
}

function skuPriceCandidates(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((sku) => [
    valueAt(sku, ["price", "original_price_value"]),
    valueAt(sku, ["price", "original_price"]),
    valueAt(sku, ["price", "real_price", "price_val"]),
    valueAt(sku, ["price", "real_price", "price_str"]),
  ]);
}

function bestScrapeCreatorsSearchProduct(
  body: unknown,
  query: string,
): Record<string, unknown> | null {
  const products = scrapeCreatorsSearchProducts(body);
  let best: Record<string, unknown> | null = null;
  let bestScore = -Infinity;

  for (const product of products) {
    if (priceFromScrapeCreatorsSearchProduct(product) <= 0) continue;

    const score = searchProductScore(
      query,
      scrapeCreatorsSearchProductTitle(product) || "",
    );
    if (score > bestScore) {
      best = product;
      bestScore = score;
    }
  }

  return best;
}

function scrapeCreatorsSearchProducts(
  body: unknown,
): Record<string, unknown>[] {
  const candidates = [
    valueAt(body, ["products"]),
    valueAt(body, ["data", "products"]),
    valueAt(body, ["items"]),
    valueAt(body, ["data", "items"]),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }

  return [];
}

function searchProductScore(query: string, title: string): number {
  const normalizedQuery = searchText(query);
  const normalizedTitle = searchText(title);
  if (!normalizedQuery || !normalizedTitle) return 0;
  if (normalizedTitle === normalizedQuery) return 1000;
  if (normalizedTitle.includes(normalizedQuery)) return 800;
  if (normalizedQuery.includes(normalizedTitle)) return 700;

  const queryTerms = new Set(normalizedQuery.split(" ").filter(Boolean));
  const titleTerms = new Set(normalizedTitle.split(" ").filter(Boolean));
  let shared = 0;
  for (const term of queryTerms) {
    if (titleTerms.has(term)) shared++;
  }

  return shared / Math.max(queryTerms.size, 1);
}

function searchText(value: string): string {
  return value.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function priceFromScrapeCreatorsSearchProduct(product: unknown): number {
  const candidates = [
    valueAt(product, ["price"]),
    valueAt(product, ["sale_price"]),
    valueAt(product, ["original_price"]),
    valueAt(product, ["product_price_info", "sale_price_decimal"]),
    valueAt(product, ["product_price_info", "sale_price_format"]),
    valueAt(product, ["product_price_info", "single_product_price_decimal"]),
    valueAt(product, ["product_price_info", "single_product_price_format"]),
    valueAt(product, ["product_price_info", "original_price"]),
    valueAt(product, ["product_price_info", "original_price_value"]),
  ];

  for (const candidate of candidates) {
    const price = numberFrom(candidate, 0);
    if (price > 0) return price;
  }

  return 0;
}

function scrapeCreatorsSearchProductTitle(
  product: unknown,
): string | undefined {
  return stringAt(product, ["title"]) ||
    stringAt(product, ["name"]) ||
    stringAt(product, ["product_name"]);
}

function scrapeCreatorsSearchProductSeller(
  product: unknown,
): string | undefined {
  return stringAt(product, ["seller_info", "shop_name"]) ||
    stringAt(product, ["shop_name"]) ||
    stringAt(product, ["seller", "name"]);
}

function scrapeCreatorsSearchProductUrl(product: unknown): string | undefined {
  return stringAt(product, ["url"]) ||
    stringAt(product, ["seo_url", "canonical_url"]) ||
    stringAt(product, ["canonical_url"]);
}

// Works for both response shapes: the product endpoint nests image objects
// (url_list/thumb_url_list) under product_base, while search results carry
// flat cover/img fields.
function imageFromScrapeCreators(body: unknown): string | undefined {
  const candidates = [
    valueAt(body, ["product_info", "product_base", "images"]),
    valueAt(body, ["product_base", "images"]),
    valueAt(body, ["product_info", "images"]),
    valueAt(body, ["images"]),
    valueAt(body, ["cover"]),
    valueAt(body, ["cover_url"]),
    valueAt(body, ["img"]),
    valueAt(body, ["image"]),
    valueAt(body, ["thumbnail"]),
  ];

  for (const candidate of candidates) {
    const url = firstImageUrl(candidate);
    if (url) return url;
  }

  return undefined;
}

function firstImageUrl(value: unknown): string | undefined {
  if (typeof value === "string") {
    return /^https?:\/\//.test(value) ? value : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = firstImageUrl(item);
      if (url) return url;
    }
    return undefined;
  }
  if (isRecord(value)) {
    return firstImageUrl(value.url_list) ??
      firstImageUrl(value.thumb_url_list) ??
      firstImageUrl(value.url) ??
      firstImageUrl(value.uri);
  }
  return undefined;
}

// Graylog indexes each GELF field, and oversized values can fail to index --
// ship the entire payload when it fits, otherwise keep the sections that
// matter (identity, pricing, images, seller) so the save never fails.
function scrapeCreatorsProductJson(
  product: Record<string, unknown> | undefined,
): string | undefined {
  if (!product) return undefined;

  const full = JSON.stringify(product);
  if (full.length <= 30000) return full;

  const compact: Record<string, unknown> = {};
  for (
    const key of [
      "product_base",
      "product_info",
      "skus",
      "seller",
      "seller_info",
      "shop_info",
      "seo_url",
      "title",
      "name",
      "price",
      "product_price_info",
      "cover",
      "img",
      "image",
      "images",
      "url",
    ]
  ) {
    if (product[key] !== undefined) compact[key] = product[key];
  }
  const compactJson = JSON.stringify(compact);
  if (compactJson.length <= 30000) return compactJson;

  return JSON.stringify({ truncated: true, keys: Object.keys(product) });
}

async function readStore(): Promise<SampleStore> {
  try {
    const store = JSON.parse(await Deno.readTextFile(storePath()));
    if (
      store && typeof store === "object" && store.version === 1 &&
      isRecord(store.edits)
    ) {
      return {
        version: 1,
        edits: store.edits,
        products: isRecord(store.products) ? store.products : {},
      } as SampleStore;
    }
  } catch {
    // Missing or malformed stores fall back to an empty edit map.
  }

  return { version: 1, edits: {}, products: {} };
}

async function writeStore(store: SampleStore): Promise<void> {
  const path = storePath();
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, `${JSON.stringify(store, null, 2)}\n`);
}

function storePath(): string {
  return envValue("THIRSTY_SAMPLE_STORE") || DEFAULT_STORE_PATH;
}

// The extension used to stamp every auto-priced sample with a note like
// "Estimated by extension demo · confidence med · variant Black, 10*300cm". The
// row's source badge (API / Extension) already conveys that provenance, so the
// note was pure noise. Drop it on read so existing records show a clean Notes
// column and the cleared value persists on the next save. The pattern matches
// only the machine-generated shape, so a manual note is never touched.
const AUTO_EXTENSION_NOTE_RE =
  /^(?:Estimated by extension demo|Resolved by extension lookup)(?: · confidence [^·]*)?(?: · variant .*)?$/;

function withoutAutoExtensionNote(
  edit: SamplePriceEdit,
): SamplePriceEdit {
  if (edit.notes && AUTO_EXTENSION_NOTE_RE.test(edit.notes.trim())) {
    return { ...edit, notes: undefined };
  }
  return edit;
}

// The local JSON store is wiped whenever the deployed app restarts, so the
// durable copy of every price edit lives in Graylog (sample_edit_json
// messages). Reads merge both, newest updatedAt per product winning.
async function loadStore(): Promise<SampleStore> {
  const store = await readStore();

  for (const record of await fetchSampleEditRecords()) {
    const edit = editFromRecord(record);
    if (!edit) continue;

    const existing = store.edits[edit.productId];
    if (!existing || edit.updatedAt > (existing.updatedAt || "")) {
      store.edits[edit.productId] = edit;
    }
  }

  for (const productId of Object.keys(store.edits)) {
    store.edits[productId] = withoutAutoExtensionNote(store.edits[productId]);
  }

  return store;
}

function editFromRecord(
  record: Record<string, unknown>,
): SamplePriceEdit | null {
  const productId = String(record.productId || "").trim();
  const price = numberFrom(record.price, NaN);
  if (!productId || !Number.isFinite(price) || price < 0) return null;

  const sampleCount = numberFrom(record.sampleCount, NaN);
  const source = record.source === "scrapecreators" ||
      record.source === "extension"
    ? record.source
    : "manual";

  return {
    productId,
    price,
    sampleCount: Number.isFinite(sampleCount) ? sampleCount : undefined,
    notes: optionalString(record.notes),
    source,
    sourceUrl: optionalString(record.sourceUrl),
    apiTitle: optionalString(record.apiTitle),
    apiSeller: optionalString(record.apiSeller),
    fetchedAt: optionalString(record.fetchedAt),
    updatedAt: optionalString(record.updatedAt) || "",
  };
}

type GelfRecord = {
  shortMessage: string;
  fields: Record<string, unknown>;
};

// Persist everywhere we can reach: the local file (fast reads in dev, but
// read-only or ephemeral once deployed) and Graylog (durable). Only when
// neither accepts the write did the save actually fail.
async function persistStore(
  store: SampleStore,
  gelf: GelfRecord,
): Promise<string[]> {
  const targets: string[] = [];

  try {
    await writeStore(store);
    targets.push("file");
  } catch {
    // Expected on deployed read-only filesystems; Graylog is the durable copy.
  }

  if (await sendGelfMessage(gelf.shortMessage, gelf.fields)) {
    targets.push("graylog");
  }

  if (!targets.length) {
    throw new Error(
      "Could not persist sample data to the local store or Graylog",
    );
  }

  return targets;
}

async function fetchProductsWithStored(
  limit: number,
  store: SampleStore,
): Promise<ProductAnalysis[]> {
  const products = new Map<string, ProductAnalysis>();

  for (const product of await fetchRecentProducts(limit)) {
    products.set(product.productId, product);
  }

  for (const product of Object.values(store.products)) {
    products.set(product.productId, products.get(product.productId) ?? product);
  }

  return [...products.values()]
    .sort((a, b) => (b.lastSeen || "").localeCompare(a.lastSeen || ""))
    .slice(0, limit);
}

function numericInput(value: unknown, label: string): number {
  const number = numberFrom(value, NaN);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`Invalid ${label}`);
  }
  return number;
}

function numberFrom(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
    .format(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function stableProductId(name: string): string {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `900${String(hash >>> 0).padStart(10, "0")}`;
}

function tiktokProductUrl(product: ProductAnalysis): string {
  return `https://www.tiktok.com/shop/pdp/${
    slug(product.name)
  }/${product.productId}`;
}

function slug(value: string): string {
  return value.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90) || "product";
}

function valueAt(value: unknown, path: string[]): unknown {
  let current = value;

  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }

  return current;
}

function stringAt(value: unknown, path: string[]): string | undefined {
  const result = valueAt(value, path);
  return typeof result === "string" && result ? result : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function comparisonSignal(
  rank: number | null,
  creatorVideos: number,
  platformVideos: number,
  gmv: number,
): string {
  if (
    (rank !== null && rank <= 10 || gmv >= 1000) && creatorVideos <= 2 &&
    platformVideos >= 50
  ) {
    return "Under-posted";
  }
  if (creatorVideos >= 8 && gmv < 1000) return "Over-posted";
  if (rank !== null && rank <= 25) return "Priority";
  return "Watch";
}
