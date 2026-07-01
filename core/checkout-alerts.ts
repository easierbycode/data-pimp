/**
 * Stale-checkout alerting: find samples stuck in `checked_out` past an
 * acceptable time and ping a Discord channel so someone chases them down.
 *
 * A sample enters `checked_out` when it's assigned/imported to a creator
 * (`recordSampleAssignment` / `recordSampleImport` stamp `checked_out_at`) or
 * flipped via `recordSampleStatus`. This module reads the `samples` rows still
 * in that status, ages each from `checked_out_at` (falling back to `created_at`
 * for rows checked out before that column was stamped), and alerts on any past
 * the threshold.
 *
 * Wiring: a `Deno.cron` in main.ts calls `runCheckoutAlerts()` on a schedule.
 * Config (all optional, sensible defaults):
 *   - DISCORD_WEBHOOK_URL          Discord webhook. UNSET → alerts disabled.
 *   - CHECKOUT_ALERT_HOURS         Stale threshold in hours (default 72 = 3d).
 *   - CHECKOUT_ALERT_REPEAT_HOURS  Re-alert throttle per sample (default 24).
 *
 * Re-alert throttle: the cron runs repeatedly, so an already-flagged sample
 * would spam the channel every run. We remember each alerted sample in the
 * shared KV cache for `CHECKOUT_ALERT_REPEAT_HOURS` and skip it until then —
 * best-effort (a cache miss just means an extra ping, never a missed one).
 *
 * The selection + message builders are pure and unit-tested; `runCheckoutAlerts`
 * takes injectable deps (DB / cache / notifier) so its orchestration is testable
 * without a database or network.
 */
import { Samples } from "../db.ts";
import { cacheGet, cacheSet } from "./cache.ts";
import { envValue } from "./graylog.ts";

/** Row shape we read off `public.samples` (structural — `Samples.filter` → any). */
export interface CheckoutRow {
  id?: unknown;
  qr_code?: unknown;
  name?: unknown;
  status?: unknown;
  checked_out_to?: unknown;
  checked_out_at?: unknown;
  created_at?: unknown;
}

export interface StaleCheckout {
  sampleId: number | null;
  productId: string | null;
  name: string | null;
  checkedOutTo: string | null;
  /** ISO timestamp the checkout clock started from. */
  since: string;
  /** Whole hours in `checked_out` as of `now`. */
  ageHours: number;
  /** Whether `since` fell back to `created_at` (no stamped `checked_out_at`). */
  approximate: boolean;
}

export const DEFAULT_THRESHOLD_HOURS = 72;
export const DEFAULT_REPEAT_HOURS = 24;
// Cap on rows scanned per run (also db.ts's hard max for `limit`). The scan
// orders OLDEST-first (see runCheckoutAlerts) so that if live checkouts ever
// exceed this cap, truncation drops the freshest rows — never the stale ones
// the alert exists to catch.
const SCAN_LIMIT = 500;

// pg returns timestamps as JS `Date`; the API/JSON paths hand back ISO strings.
// Accept either (and reject anything unparseable) so age is never a fake 0.
function parseTime(value: unknown): number | null {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "string" && value.trim()) {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function str(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s || null;
}

/**
 * Pure selection: given `checked_out` sample rows, return those aged at or past
 * `thresholdHours`, oldest first. Rows in any other status, or with no parseable
 * checkout/created timestamp, are skipped (never guessed as brand-new).
 */
export function findStaleCheckouts(
  rows: CheckoutRow[],
  opts: { now: number; thresholdHours: number },
): StaleCheckout[] {
  const thresholdMs = Math.max(0, opts.thresholdHours) * 3_600_000;
  const stale: StaleCheckout[] = [];

  for (const row of rows) {
    if (str(row.status) !== "checked_out") continue;

    const stampedAt = parseTime(row.checked_out_at);
    const since = stampedAt ?? parseTime(row.created_at);
    if (since === null) continue; // no basis to age it — don't invent one

    const ageMs = opts.now - since;
    if (ageMs < thresholdMs) continue;

    const rawId = Number(row.id);
    stale.push({
      sampleId: Number.isFinite(rawId) ? rawId : null,
      productId: str(row.qr_code),
      name: str(row.name),
      checkedOutTo: str(row.checked_out_to),
      since: new Date(since).toISOString(),
      ageHours: Math.floor(ageMs / 3_600_000),
      approximate: stampedAt === null,
    });
  }

  stale.sort((a, b) => Date.parse(a.since) - Date.parse(b.since));
  return stale;
}

/** Stable throttle key for a stale sample (prefers the sample id). */
export function alertKey(item: StaleCheckout): string {
  if (item.sampleId !== null) return `sample:${item.sampleId}`;
  if (item.productId) return `product:${item.productId}`;
  return `since:${item.since}:${item.name ?? ""}`;
}

function humanAge(hours: number): string {
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem ? `${days}d ${rem}h` : `${days}d`;
}

/** The Discord webhook JSON body (content + one summary embed). */
export interface DiscordBody {
  content?: string;
  embeds?: Array<{
    title: string;
    description: string;
    color: number;
    footer?: { text: string };
  }>;
}

// Discord caps an embed description at 4096 chars; keep the list well under it.
const MAX_LISTED = 25;

/**
 * Build the Discord message for a batch of stale checkouts. Pure — no env, no
 * network — so the exact payload is unit-tested.
 */
export function buildCheckoutAlertContent(
  stale: StaleCheckout[],
  opts: { thresholdHours: number },
): DiscordBody {
  const lines = stale.slice(0, MAX_LISTED).map((s) => {
    const who = s.checkedOutTo ? ` → ${s.checkedOutTo}` : "";
    const id = s.sampleId !== null ? ` \`#${s.sampleId}\`` : "";
    const approx = s.approximate ? " (approx.)" : "";
    return `• **${s.name ?? s.productId ?? "Unknown sample"}**${id}${who} — ${
      humanAge(s.ageHours)
    }${approx}`;
  });
  if (stale.length > MAX_LISTED) {
    lines.push(`…and ${stale.length - MAX_LISTED} more.`);
  }

  const noun = stale.length === 1 ? "sample" : "samples";
  return {
    content:
      `⚠️ ${stale.length} ${noun} checked out longer than ${opts.thresholdHours}h`,
    embeds: [{
      title: "Stale checkouts",
      description: lines.join("\n"),
      color: 0xf59e0b, // amber
      footer: { text: "Thirsty OS · sample tracker" },
    }],
  };
}

/** POST a prebuilt body to a Discord webhook. Best-effort → boolean. */
export async function postDiscord(
  webhookUrl: string,
  body: DiscordBody,
): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface RunCheckoutAlertsResult {
  /** False when DISCORD_WEBHOOK_URL is unset (feature off). */
  enabled: boolean;
  /** checked_out rows scanned. */
  checked: number;
  /** rows past the threshold. */
  stale: number;
  /** stale rows newly alerted this run (excludes throttled). */
  alerted: number;
  /** stale rows skipped by the re-alert throttle. */
  skipped: number;
  /** whether the Discord post (if any) succeeded. */
  ok: boolean;
}

/** Injectable seams so the orchestration is testable without DB/cache/network. */
export interface RunCheckoutAlertsDeps {
  now?: number;
  thresholdHours?: number;
  repeatHours?: number;
  webhookUrl?: string | null;
  listCheckedOut?: () => Promise<CheckoutRow[]>;
  wasAlerted?: (key: string) => Promise<boolean>;
  markAlerted?: (key: string, ttlMs: number) => Promise<void>;
  notify?: (webhookUrl: string, body: DiscordBody) => Promise<boolean>;
  log?: (msg: string) => void;
}

function envHours(name: string, fallback: number): number {
  const raw = Number(envValue(name));
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/**
 * Scan `checked_out` samples, alert Discord about any past the threshold that
 * we haven't already pinged inside the repeat window, and remember what we
 * alerted. Safe to call on a cron: no webhook configured → no-op.
 */
export async function runCheckoutAlerts(
  deps: RunCheckoutAlertsDeps = {},
): Promise<RunCheckoutAlertsResult> {
  const now = deps.now ?? Date.now();
  const thresholdHours = deps.thresholdHours ??
    envHours("CHECKOUT_ALERT_HOURS", DEFAULT_THRESHOLD_HOURS);
  const repeatHours = deps.repeatHours ??
    envHours("CHECKOUT_ALERT_REPEAT_HOURS", DEFAULT_REPEAT_HOURS);
  const webhookUrl = deps.webhookUrl ?? envValue("DISCORD_WEBHOOK_URL") ?? null;
  const log = deps.log ?? ((m: string) => console.log(m));

  const empty: RunCheckoutAlertsResult = {
    enabled: !!webhookUrl,
    checked: 0,
    stale: 0,
    alerted: 0,
    skipped: 0,
    ok: true,
  };

  if (!webhookUrl) {
    log("[checkout-alerts] DISCORD_WEBHOOK_URL unset — alerts disabled");
    return empty;
  }

  const listCheckedOut = deps.listCheckedOut ??
    (() =>
      Samples.filter(
        { status: "checked_out" },
        // OLDEST-first: if checkouts exceed SCAN_LIMIT, keep the stalest rows
        // (the ones we alert on) and let the newest fall off the cap.
        "checked_out_at",
        SCAN_LIMIT,
      ) as Promise<CheckoutRow[]>);
  const wasAlerted = deps.wasAlerted ??
    (async (key: string) =>
      (await cacheGet<number>("checkout-alert", key)) !== null);
  const markAlerted = deps.markAlerted ??
    ((key: string, ttlMs: number) =>
      cacheSet("checkout-alert", key, now, ttlMs));
  const notify = deps.notify ?? postDiscord;

  const rows = await listCheckedOut();
  const stale = findStaleCheckouts(rows, { now, thresholdHours });

  // Throttle: drop samples we've already pinged inside the repeat window.
  const fresh: StaleCheckout[] = [];
  let skipped = 0;
  for (const item of stale) {
    if (await wasAlerted(alertKey(item))) {
      skipped++;
      continue;
    }
    fresh.push(item);
  }

  if (fresh.length === 0) {
    return { ...empty, checked: rows.length, stale: stale.length, skipped };
  }

  const body = buildCheckoutAlertContent(fresh, { thresholdHours });
  const ok = await notify(webhookUrl, body);

  // Only remember what we actually delivered — a failed post retries next run.
  if (ok) {
    const ttlMs = repeatHours * 3_600_000;
    for (const item of fresh) await markAlerted(alertKey(item), ttlMs);
  }

  return {
    enabled: true,
    checked: rows.length,
    stale: stale.length,
    alerted: ok ? fresh.length : 0,
    skipped,
    ok,
  };
}
