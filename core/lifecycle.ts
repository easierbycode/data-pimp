// Sample lifecycle write path: status changes and resale ("sold") events.
//
// Two write targets per the design decisions:
//   1. Postgres (`public.samples` + `inventory_transactions`) — the inventory
//      source of truth, shared with the tiktok-sample-tracker app. Reached via
//      the same db.ts helpers main.ts already uses.
//   2. Graylog — the durable analytics spine. Each event mirrors the proven
//      `sample_edit_json` pattern from core/samples.ts: one JSON-string
//      container field (lossless round-trip) plus flat scalar fields so the
//      read-side `graylog-query` skill can filter/range/aggregate without
//      parsing JSON. sendGelfMessage() strips empties and single-underscore-
//      prefixes every field, so `sample_status` is queryable as `sample_status`.
//
// The resale event deliberately reuses graylog-query's revenue vocabulary —
// `creator` + `gmv_num` (gross) — so a creator's resale revenue is queryable
// the moment it's written, with no change to that skill. `net_num` (and the
// fee/shipping/cost breakdown) are additive for profit views.
//
// Join key across the whole lifecycle is the TikTok productId, which is the
// sample's `qr_code` in Postgres (see sampleRowToKioskProduct in main.ts) and
// `product_id` on Graylog events. `sample_id` is stamped alongside so the two
// systems reconcile even when a qr_code holds a barcode instead of a real id.

import { sendGelfMessage } from "./graylog.ts";
import { InventoryTransactions, Samples } from "../db.ts";
import sampleStatuses from "./sample-statuses.json" with { type: "json" };

export type SampleStatusEntry = {
  value: string;
  label: string;
  kind: "status" | "badge";
  exclusive: boolean;
  appliesTo: string[];
  icon: string | null;
  palette: string;
  order: number;
};

type SampleRow = Record<string, unknown>;

export type SampleRef = {
  sampleId?: string | number;
  productId?: string;
  qrCode?: string;
};

export type StatusUpdateInput = SampleRef & {
  status?: string;
  note?: string;
  source?: string;
  operator?: string;
};

export type StatusUpdateResult = {
  ok: boolean;
  sampleId: number | null;
  productId: string | null;
  name: string | null;
  status: string;
  previousStatus: string | null;
  postgres: { updated: boolean; reason?: string };
  graylog: boolean;
  message: string;
};

export type SoldInput = SampleRef & {
  creator?: string;
  salePrice?: number | string;
  marketplace?: string;
  fees?: number | string;
  shipping?: number | string;
  costBasis?: number | string;
  buyer?: string;
  orderRef?: string;
  note?: string;
  operator?: string;
  // Re-sell an already-sold sample on purpose (re-attribution). Off by default
  // because the Graylog revenue total can't be un-inflated — see the guard.
  force?: boolean;
  // Set by recordBulkSampleSold to tie a per-sample sale back to its bulk lot.
  bulkId?: string;
  bulkTotal?: number | string;
};

export type SoldResult = {
  ok: boolean;
  sampleId: number | null;
  productId: string | null;
  name: string | null;
  creator: string;
  marketplace: string;
  salePrice: number;
  fees: number;
  shipping: number;
  costBasis: number;
  net: number;
  postgres: { updated: boolean; transactionId: number | null; reason?: string };
  graylog: boolean;
  message: string;
};

export type BulkSoldItemInput = SampleRef & {
  creator?: string;
  price?: number | string;
  note?: string;
};

export type BulkSoldInput = {
  items?: BulkSoldItemInput[];
  totalPrice?: number | string;
  marketplace?: string;
  creator?: string;
  fees?: number | string;
  shipping?: number | string;
  costBasis?: number | string;
  buyer?: string;
  orderRef?: string;
  note?: string;
  force?: boolean;
  bulkId?: string;
  operator?: string;
};

export type BulkSoldResult = {
  ok: boolean;
  bulkId: string;
  marketplace: string;
  totalPrice: number;
  allocatedTotal: number;
  itemCount: number;
  soldCount: number;
  netTotal: number;
  items: SoldResult[];
  failures: { item: number; ref: string; error: string }[];
  message: string;
};

export type ListingInput = SampleRef & {
  creator?: string;
  marketplace?: string;
  askPrice?: number | string;
  listingUrl?: string;
  note?: string;
  operator?: string;
};

export type ListingResult = {
  ok: boolean;
  sampleId: number | null;
  productId: string | null;
  name: string | null;
  creator: string;
  marketplace: string;
  askPrice: number;
  listingUrl: string | null;
  graylog: boolean;
  message: string;
};

const STATUSES = sampleStatuses as SampleStatusEntry[];

// The full synced status vocabulary (statuses + badges) — served verbatim so the
// MCP/skill validate against the same single source the tracker uses.
export function listSampleStatuses(): SampleStatusEntry[] {
  return STATUSES;
}

// Only `kind:"status"` values can live in the single `samples.status` column;
// badges (fire_sale, lowest_price) are non-exclusive and tracked elsewhere.
function statusValues(): string[] {
  return STATUSES.filter((entry) => entry.kind === "status").map((e) => e.value);
}

function isStatusValue(value: string): boolean {
  return statusValues().includes(value);
}

// Resolve a sample by explicit id, else by productId/qr_code. A qr_code can be
// shared by several physical samples of one product, so when resolving by that
// key for a sale we prefer a not-yet-sold row (newest first).
async function resolveSampleRow(
  ref: SampleRef,
  opts: { preferUnsold?: boolean } = {},
): Promise<SampleRow | null> {
  const id = String(ref.sampleId ?? "").trim();
  if (id) {
    const rows = await Samples.filter({ id }, undefined, 1) as SampleRow[];
    if (rows[0]) return rows[0];
  }

  const key = String(ref.productId ?? ref.qrCode ?? "").trim();
  if (key) {
    const rows = await Samples.filter(
      { qr_code: key },
      "-created_at",
      25,
    ) as SampleRow[];
    if (!rows.length) return null;
    if (opts.preferUnsold) {
      const unsold = rows.find((r) => String(r.status ?? "").trim() !== "sold");
      return unsold ?? rows[0];
    }
    return rows[0];
  }

  return null;
}

function productIdOf(row: SampleRow | null, ref: SampleRef): string | null {
  if (row) {
    const fromRow = String(row.qr_code ?? "").trim();
    if (fromRow) return fromRow;
  }
  const fromRef = String(ref.productId ?? ref.qrCode ?? "").trim();
  return fromRef || null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/[$,]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

function numOrZero(value: unknown): number {
  const n = toNumber(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Update a sample's exclusive status (available / checked_out / reserved /
// cleared_to_sell / discontinued). `sold` is rejected on purpose: it must go
// through the sold flow so resale revenue is attributed to a creator. Patches
// Postgres when a row matches, and always emits a Graylog status event so the
// change is recoverable/queryable even if the row is Graylog-only.
export async function recordSampleStatus(
  input: StatusUpdateInput,
): Promise<StatusUpdateResult> {
  const status = String(input.status || "").trim();
  if (!status) throw new Error("status is required");
  if (!isStatusValue(status)) {
    throw new Error(
      `Unknown status "${status}". Valid statuses: ${statusValues().join(", ")}`,
    );
  }
  if (status === "sold") {
    throw new Error(
      "Use the sold flow (mark_sample_sold / POST /api/sample-sold) to mark a " +
        "sample sold, so the resale revenue is attributed to a creator account.",
    );
  }

  const row = await resolveSampleRow(input);
  const sampleId = row ? Number(row.id) : null;
  const productId = productIdOf(row, input);
  const name = row ? String(row.name ?? "").trim() || null : null;
  const previousStatus = row ? String(row.status ?? "").trim() || null : null;
  const now = new Date().toISOString();
  const source = String(input.source || "skill").trim() || "skill";
  const note = String(input.note || "").trim();

  let updated = false;
  let reason: string | undefined;
  if (row) {
    try {
      await Samples.update(String(row.id), { status });
      updated = true;
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
  } else {
    reason = "no matching sample row in Postgres (Graylog event still written)";
  }

  const graylog = await sendGelfMessage(
    `thirsty sample status: ${name ?? productId ?? "unknown"}`,
    {
      sample_status_json: JSON.stringify({
        productId,
        sampleId,
        status,
        previousStatus,
        qrCode: productId,
        name,
        source,
        note: note || undefined,
        updatedAt: now,
      }),
      sample_status: status,
      product_id: productId ?? undefined,
      sample_id: sampleId != null ? String(sampleId) : undefined,
      sample_source: source,
    },
  );

  return {
    ok: updated || graylog,
    sampleId,
    productId,
    name,
    status,
    previousStatus,
    postgres: { updated, reason },
    graylog,
    message: describe("status", {
      updated,
      graylog,
      name,
      productId,
      status,
      warnings: graylog ? [] : ["Graylog event was NOT written"],
    }),
  };
}

// Mark a sample sold and attribute the resale revenue to a creator. Writes the
// inventory truth to Postgres (status=sold + sale columns + a `sold` transaction)
// and the analytics event to Graylog. `creator`, `salePrice`, and `marketplace`
// are required; fees/shipping/costBasis are optional and feed the computed net.
export async function recordSampleSold(input: SoldInput): Promise<SoldResult> {
  const creator = String(input.creator || "").trim();
  if (!creator) {
    throw new Error(
      "creator is required — which creator account should this resale revenue " +
        "be attributed to?",
    );
  }
  const salePrice = toNumber(input.salePrice);
  if (!(salePrice > 0)) {
    throw new Error("salePrice must be a positive number");
  }
  const marketplace = String(input.marketplace || "").trim();
  if (!marketplace) {
    throw new Error(
      "marketplace is required (e.g. ebay, offerup, fbmarketplace)",
    );
  }

  const fees = numOrZero(input.fees);
  const shipping = numOrZero(input.shipping);
  const costBasis = numOrZero(input.costBasis);
  const net = round2(salePrice - fees - shipping - costBasis);

  const row = await resolveSampleRow(input, { preferUnsold: true });
  const sampleId = row ? Number(row.id) : null;
  const productId = productIdOf(row, input);
  const name = row ? String(row.name ?? "").trim() || null : null;
  const previousStatus = row ? String(row.status ?? "").trim() || null : null;

  // Guard against double-selling. GELF revenue events are append-only and the
  // read side sums `gmv_num` client-side, so a second sale permanently inflates
  // the creator's attributed revenue — the Postgres overwrite self-heals, the
  // analytics total can't. Refuse unless the caller explicitly re-attributes.
  if (previousStatus === "sold" && input.force !== true) {
    const soldAt = row ? String(row.sold_at ?? "").trim() : "";
    throw new Error(
      `Sample ${row?.id ?? productId ?? "?"} is already sold${
        soldAt ? ` (sold_at=${soldAt})` : ""
      } — re-attributing would double-count the creator's resale revenue. Pass ` +
        "force:true to override.",
    );
  }

  const now = new Date().toISOString();
  const buyer = String(input.buyer || "").trim();
  const orderRef = String(input.orderRef || "").trim();
  const note = String(input.note || "").trim();
  const operator = String(input.operator || "").trim();

  let updated = false;
  let transactionId: number | null = null;
  const reasons: string[] = [];
  if (row) {
    try {
      await Samples.update(String(row.id), {
        status: "sold",
        sold_price: salePrice,
        sold_at: now,
        sold_to: buyer || null,
      });
      updated = true;
    } catch (error) {
      reasons.push(error instanceof Error ? error.message : String(error));
    }
    try {
      const summary = `Resale via ${marketplace} → ${creator} | gross $${
        salePrice.toFixed(2)
      }${net !== salePrice ? ` | net $${net.toFixed(2)}` : ""}${
        note ? ` | ${note}` : ""
      }`;
      const tx = await InventoryTransactions.create({
        action: "sold",
        sample_id: row.id,
        checked_out_to: buyer || null,
        operator: operator || null,
        scanned_code: productId || null,
        notes: summary,
      }) as SampleRow | undefined;
      transactionId = tx && tx.id != null ? Number(tx.id) : null;
    } catch (error) {
      reasons.push(
        `transaction: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    reasons.push("no matching sample row in Postgres (Graylog event still written)");
  }

  // Bulk-lot provenance (only present when called from recordBulkSampleSold).
  const bulkId = String(input.bulkId || "").trim();
  const bulkTotalNum = toNumber(input.bulkTotal);
  const bulkTotal = Number.isFinite(bulkTotalNum) ? bulkTotalNum : null;

  const graylog = await sendGelfMessage(
    `thirsty sample sold: ${name ?? productId ?? "sample"} $${
      salePrice.toFixed(2)
    } via ${marketplace} → ${creator}`,
    {
      sample_sold_json: JSON.stringify({
        productId,
        sampleId,
        name,
        creator,
        marketplace,
        salePrice,
        fees,
        shipping,
        costBasis,
        net,
        buyer: buyer || undefined,
        orderRef: orderRef || undefined,
        soldAt: now,
        note: note || undefined,
        bulkId: bulkId || undefined,
        bulkTotal: bulkTotal ?? undefined,
      }),
      creator,
      gmv_num: salePrice,
      sale_price_num: salePrice,
      fee_num: fees,
      shipping_num: shipping,
      cost_num: costBasis,
      net_num: net,
      marketplace,
      product_id: productId ?? undefined,
      sample_id: sampleId != null ? String(sampleId) : undefined,
      sample_status: "sold",
      sample_source: bulkId ? "skill-bulk-resale" : "skill-resale",
      bulk_id: bulkId || undefined,
      bulk_total_num: bulkTotal ?? undefined,
    },
  );

  // Honest headline: the sample UPDATE and the audit-transaction INSERT can
  // fail independently, and the GELF write can fail silently — surface each.
  const warnings: string[] = [];
  if (!graylog) warnings.push("Graylog revenue event was NOT written");
  if (updated && transactionId === null) {
    warnings.push("the inventory audit transaction was NOT recorded");
  }

  return {
    ok: updated || graylog,
    sampleId,
    productId,
    name,
    creator,
    marketplace,
    salePrice,
    fees,
    shipping,
    costBasis,
    net,
    postgres: {
      updated,
      transactionId,
      reason: reasons.length ? reasons.join("; ") : undefined,
    },
    graylog,
    message: describe("sold", {
      updated,
      graylog,
      name,
      productId,
      creator,
      salePrice,
      marketplace,
      warnings,
    }),
  };
}

// Mark a BULK lot sold: one marketplace sale spread across N samples, each
// attributed to a (possibly different) creator. Allocates the lot total across
// items (explicit per-item `price`, else an equal split of the remainder) and
// allocates lot-level fees/shipping/costBasis proportionally to each item's
// gross, then writes ONE per-sample sale via recordSampleSold stamped with a
// shared bulk_id. Because each item still emits a normal sample_sold_json, every
// existing per-creator / per-marketplace revenue query includes bulk lots with
// no new read logic. Per-item failures (e.g. already-sold) are collected, not
// fatal, so one bad unit doesn't strand the rest of the lot.
export async function recordBulkSampleSold(
  input: BulkSoldInput,
): Promise<BulkSoldResult> {
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length) {
    throw new Error("items is required — the samples in the bulk lot");
  }
  const marketplace = String(input.marketplace || "").trim();
  if (!marketplace) {
    throw new Error(
      "marketplace is required (e.g. ebay, offerup, fbmarketplace)",
    );
  }
  const totalPrice = toNumber(input.totalPrice);
  if (!(totalPrice > 0)) {
    throw new Error("totalPrice must be a positive number");
  }
  const lotCreator = String(input.creator || "").trim();

  // Validate creator + explicit price for every item up front, so a bad input
  // never writes a partial lot.
  const prepared = items.map((it, i) => {
    const creator = String(it.creator || lotCreator || "").trim();
    if (!creator) {
      throw new Error(
        `item ${i + 1}: creator is required (set item.creator or a lot-level creator)`,
      );
    }
    let explicit: number | null = null;
    if (it.price !== undefined) {
      const p = toNumber(it.price);
      if (!Number.isFinite(p) || p < 0) {
        throw new Error(`item ${i + 1}: price must be a non-negative number`);
      }
      explicit = p;
    }
    return { it, creator, explicit };
  });

  // Allocate gross: honor explicit prices, split the remainder equally across
  // the rest (last unpriced item absorbs the rounding remainder).
  const explicitSum = round2(
    prepared.reduce((sum, p) => sum + (p.explicit ?? 0), 0),
  );
  const remaining = round2(totalPrice - explicitSum);
  const unpricedCount = prepared.filter((p) => p.explicit === null).length;
  if (remaining < -0.001) {
    throw new Error(
      `explicit item prices ($${explicitSum.toFixed(2)}) exceed totalPrice ($${
        totalPrice.toFixed(2)
      })`,
    );
  }
  if (unpricedCount === 0 && Math.abs(remaining) > 0.01) {
    throw new Error(
      `explicit item prices ($${explicitSum.toFixed(2)}) do not sum to totalPrice ($${
        totalPrice.toFixed(2)
      })`,
    );
  }
  const per = unpricedCount
    ? Math.floor((remaining / unpricedCount) * 100) / 100
    : 0;
  let unpricedSeen = 0;
  const grosses = prepared.map((p) => {
    if (p.explicit !== null) return p.explicit;
    unpricedSeen++;
    return unpricedSeen === unpricedCount
      ? round2(remaining - per * (unpricedCount - 1))
      : per;
  });
  if (grosses.some((g) => !(g > 0))) {
    throw new Error(
      "allocation produced a non-positive per-item price — give explicit item " +
        "prices or a larger totalPrice",
    );
  }

  const allocatedTotal = round2(grosses.reduce((sum, g) => sum + g, 0));
  const fees = numOrZero(input.fees);
  const shipping = numOrZero(input.shipping);
  const costBasis = numOrZero(input.costBasis);
  const bulkId = String(input.bulkId || "").trim() || `bulk-${crypto.randomUUID()}`;

  const results: SoldResult[] = [];
  const failures: { item: number; ref: string; error: string }[] = [];
  for (let i = 0; i < prepared.length; i++) {
    const { it, creator } = prepared[i];
    const gross = grosses[i];
    const share = allocatedTotal > 0 ? gross / allocatedTotal : 0;
    try {
      const result = await recordSampleSold({
        sampleId: it.sampleId,
        productId: it.productId,
        qrCode: it.qrCode,
        creator,
        salePrice: gross,
        marketplace,
        fees: round2(fees * share),
        shipping: round2(shipping * share),
        costBasis: round2(costBasis * share),
        buyer: input.buyer,
        orderRef: input.orderRef,
        note: [input.note, it.note].map((n) => String(n || "").trim())
          .filter(Boolean).join(" | ") || undefined,
        force: input.force,
        operator: input.operator,
        bulkId,
        bulkTotal: totalPrice,
      });
      results.push(result);
    } catch (error) {
      failures.push({
        item: i + 1,
        ref: String(it.sampleId ?? it.productId ?? it.qrCode ?? i + 1),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const netTotal = round2(results.reduce((sum, r) => sum + r.net, 0));
  const tail = failures.length
    ? ` WARNING: ${failures.length} item(s) failed: ${
      failures.map((f) => `#${f.item} (${f.ref}): ${f.error}`).join("; ")
    }.`
    : "";
  return {
    ok: failures.length === 0 && results.length > 0,
    bulkId,
    marketplace,
    totalPrice,
    allocatedTotal,
    itemCount: items.length,
    soldCount: results.length,
    netTotal,
    items: results,
    failures,
    message: `Bulk-sold ${results.length}/${items.length} sample(s) for $${
      totalPrice.toFixed(2)
    } via ${marketplace} (net $${netTotal.toFixed(2)}, lot ${bulkId}).${tail}`,
  };
}

// Record that a sample has been LISTED for resale on a marketplace — the step
// between "how much GMV did my content drive?" and "what did the listing sell
// for?". Analytics-only on purpose: a listing is intent-to-sell, not an
// inventory-status change (there is no "listed" status), so this emits a Graylog
// event and does NOT mutate Postgres. The event reuses the lifecycle vocabulary
// (creator + product_id + sample_id) plus ask_price_num, so graylog-query can
// answer "what's listed where" and compare ask price to the eventual sale.
export async function recordSampleListing(
  input: ListingInput,
): Promise<ListingResult> {
  const creator = String(input.creator || "").trim();
  if (!creator) {
    throw new Error(
      "creator is required — which creator account is this listing attributed to?",
    );
  }
  const marketplace = String(input.marketplace || "").trim();
  if (!marketplace) {
    throw new Error(
      "marketplace is required (e.g. ebay, offerup, fbmarketplace)",
    );
  }
  const askPrice = toNumber(input.askPrice);
  if (!(askPrice > 0)) {
    throw new Error("askPrice must be a positive number");
  }

  const row = await resolveSampleRow(input, { preferUnsold: true });
  const sampleId = row ? Number(row.id) : null;
  const productId = productIdOf(row, input);
  const name = row ? String(row.name ?? "").trim() || null : null;
  const listingUrl = String(input.listingUrl || "").trim() || null;
  const note = String(input.note || "").trim();
  const now = new Date().toISOString();

  const graylog = await sendGelfMessage(
    `thirsty sample listed: ${name ?? productId ?? "sample"} @ $${
      askPrice.toFixed(2)
    } on ${marketplace} → ${creator}`,
    {
      sample_listing_json: JSON.stringify({
        productId,
        sampleId,
        name,
        creator,
        marketplace,
        askPrice,
        listingUrl: listingUrl || undefined,
        listedAt: now,
        note: note || undefined,
      }),
      creator,
      ask_price_num: askPrice,
      marketplace,
      product_id: productId ?? undefined,
      sample_id: sampleId != null ? String(sampleId) : undefined,
      sample_event: "listed",
      sample_source: "skill-listing",
    },
  );

  const where = graylog ? "Graylog" : "nothing";
  const warning = graylog
    ? ""
    : " WARNING: Graylog listing event was NOT written.";
  return {
    ok: graylog,
    sampleId,
    productId,
    name,
    creator,
    marketplace,
    askPrice,
    listingUrl,
    graylog,
    message: `Listed ${name ?? productId ?? "sample"} at $${
      askPrice.toFixed(2)
    } on ${marketplace} for ${creator} (recorded to ${where}).${warning}`,
  };
}

// Human-readable outcome line. Honest about partial success: a Graylog write can
// silently fail (sendGelfMessage returns false), so we never report success that
// didn't happen.
function describe(
  kind: "status" | "sold",
  o: {
    updated: boolean;
    graylog: boolean;
    name: string | null;
    productId: string | null;
    status?: string;
    creator?: string;
    salePrice?: number;
    marketplace?: string;
    warnings?: string[];
  },
): string {
  const label = o.name ?? o.productId ?? "sample";
  const targets: string[] = [];
  if (o.updated) targets.push("Postgres");
  if (o.graylog) targets.push("Graylog");
  const where = targets.length ? targets.join(" + ") : "nothing";

  const base = kind === "status"
    ? `Set ${label} to "${o.status}" (persisted to ${where}).`
    : `Sold ${label} for $${(o.salePrice ?? 0).toFixed(2)} via ${
      o.marketplace
    }, attributed to ${o.creator} (persisted to ${where}).`;

  const warnings = o.warnings ?? [];
  return warnings.length ? `${base} WARNING: ${warnings.join("; ")}.` : base;
}
