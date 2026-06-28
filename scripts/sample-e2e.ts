#!/usr/bin/env -S deno run -A
// Repeatable sample-lifecycle E2E. Feed product IDs (priced and/or unpriced) and
// it walks the full API + Graylog path against a live deployment:
//
//   per product id:
//     1. hydrate         GET  /api/product-lookup/:id   -> {name, price, image}
//     2. import          POST /api/sample-import         -> create row + assign to creator
//     3. verify Postgres GET  /api/samples?id=<sampleId> -> status checked_out, checked_out_to
//     4. verify Graylog  the import's graylog:true + the creator surfacing in /api/creators
//
// Optional --order-scrape (needs a GELF endpoint) also posts a synthetic
// order-detail event and confirms the creator surfaces in /api/product-creators
// (the order-scrape -> dropdown payoff).
//
// Usage:
//   deno run -A scripts/sample-e2e.ts [flags] <productId> [<productId> ...]
//   deno task e2e:samples 1729587769570529799 9001234567890
//
// Flags:
//   --creator @handle     creator to assign to (default @e2e-test)
//   --api URL             API base (default https://thirsty.store)
//   --cleanup             delete every sample + transaction it created
//   --order-scrape        also run the synthetic order-event -> dropdown check
//   --gelf-url URL        GELF input (or env GRAYLOG_GELF_URL) for --order-scrape
//   --gelf-token TOKEN    GELF key   (or env GRAYLOG_TOKEN)    for --order-scrape
//
// If no product ids are passed, a default pair is used: one likely-priced real
// TikTok product + one synthetic name-hash id (an "unpriced" sample), so the run
// exercises both the priced and unpriced paths out of the box.

type Json = Record<string, unknown>;

function parseArgs(argv: string[]) {
  const o: Record<string, string | boolean> = {};
  const ids: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) { o[key] = next; i++; } else o[key] = true;
    } else ids.push(a);
  }
  return { o, ids };
}

const { o, ids: argIds } = parseArgs(Deno.args);
const API = String(o.api || "https://thirsty.store").replace(/\/+$/, "");
const CREATOR = String(o.creator || "@e2e-test");
const CLEANUP = Boolean(o.cleanup);
const ORDER_SCRAPE = Boolean(o["order-scrape"]);
const GELF_URL = String(o["gelf-url"] || Deno.env.get("GRAYLOG_GELF_URL") || "");
const GELF_TOKEN = String(o["gelf-token"] || Deno.env.get("GRAYLOG_TOKEN") || "");

// "900"+FNV-1a(clean(name)) — matches data-pimp stableProductId + the scrapers.
function stableProductId(name: string): string {
  const s = name.replace(/\s+/g, " ").trim();
  if (!s) return "";
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return "900" + String(h >>> 0).padStart(10, "0");
}

const ids = argIds.length
  ? argIds
  : ["1729587769570529799", stableProductId("E2E Unpriced Sample")];

async function getJson(path: string): Promise<Json | Json[] | null> {
  try {
    const r = await fetch(`${API}${path}`, { headers: { accept: "application/json" } });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
async function postJson(path: string, body: Json): Promise<Json> {
  try {
    const r = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`    ${ok ? "✓" : "✗ FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
}

const created: { sampleId: number }[] = [];

console.log(`Sample E2E → ${API} · creator ${CREATOR} · ${ids.length} product id(s)\n`);

for (const id of ids) {
  console.log(`▶ product ${id}`);
  // 1. hydrate
  const hyd = await getJson(`/api/product-lookup/${encodeURIComponent(id)}`) as Json | null;
  const priced = !!(hyd && Number(hyd.price) > 0);
  const name = (hyd && (hyd.name as string)) || id;
  console.log(`    hydrate: ${priced ? "PRICED" : "unpriced"} · ${name}${hyd && hyd.price ? ` · $${hyd.price}` : ""}`);

  // 2. import (create row + assign to creator)
  const imp = await postJson("/api/sample-import", {
    productId: id,
    name,
    price: hyd ? hyd.price : 0,
    image: hyd ? hyd.image : null,
    seller: hyd ? hyd.seller : null,
    creator: CREATOR,
  });
  check("import ok", imp.ok === true, String(imp.error || ""));
  check("import wrote Graylog", imp.graylog === true);
  const sampleId = Number((imp.sampleId as number) ?? NaN);
  check("import created Postgres row", !!(imp.postgres as Json)?.created && Number.isFinite(sampleId));
  if (Number.isFinite(sampleId)) created.push({ sampleId });

  // 3. verify Postgres truth
  if (Number.isFinite(sampleId)) {
    const rows = await getJson(`/api/samples?id=${sampleId}`);
    const row = (Array.isArray(rows) ? rows[0] : rows) as Json | undefined;
    check("Postgres status=checked_out", row?.status === "checked_out", String(row?.status || "?"));
    check("Postgres checked_out_to=creator", row?.checked_out_to === CREATOR, String(row?.checked_out_to || "?"));
  }
  console.log("");
}

// 4. verify Graylog: the creator surfaced from the assignment events
console.log("▶ Graylog: creator surfaces in /api/creators");
let seen = false;
for (let i = 0; i < 6 && !seen; i++) {
  await sleep(5000);
  const j = await getJson(`/api/creators?limit=200`) as Json | null;
  const list = (j?.creators as string[]) || [];
  if (list.includes(CREATOR)) seen = true;
}
check(`creator "${CREATOR}" in /api/creators`, seen, seen ? "" : "not indexed in window");
console.log("");

// 5. optional order-scrape → dropdown
if (ORDER_SCRAPE) {
  console.log("▶ order-scrape variant (synthetic order event → /api/product-creators)");
  if (!GELF_URL || !GELF_TOKEN) {
    console.log("    (skipped — pass --gelf-url + --gelf-token or set GRAYLOG_GELF_URL/GRAYLOG_TOKEN)");
  } else {
    const oname = `E2E Order Product ${Date.now()}`;
    const opid = stableProductId(oname);
    const gelf: Json = {
      version: "1.1",
      host: "tiktok-bookmarklet-orders",
      short_message: `e2e order: ${oname}`,
      _order_id: "e2e" + Date.now(),
      _store: "E2E Test Shop",
      _default_product: oname,
      _default_price: 19.99,
      _creator: "E2E Order Tester",
      _creator_kind: "display_name",
      _product_id: opid,
      _product_id_source: "name-hash",
      _graylog_key: GELF_TOKEN,
    };
    let posted = false;
    try {
      const r = await fetch(GELF_URL.endsWith("/gelf") ? GELF_URL : `${GELF_URL}/gelf`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(gelf),
      });
      posted = r.ok;
      check("order GELF accepted", r.ok, `HTTP ${r.status}`);
    } catch (e) {
      check("order GELF accepted", false, e instanceof Error ? e.message : String(e));
    }
    if (posted) {
      let ok = false;
      for (let i = 0; i < 6 && !ok; i++) {
        await sleep(5000);
        const j = await getJson(`/api/product-creators?productId=${opid}&name=${encodeURIComponent(oname)}`) as Json | null;
        if (((j?.orderCreators as string[]) || []).includes("E2E Order Tester")) ok = true;
      }
      check("order creator in /api/product-creators orderCreators", ok);
    }
  }
  console.log("");
}

// cleanup
if (CLEANUP && created.length) {
  console.log(`▶ cleanup: deleting ${created.length} sample(s) + transactions`);
  for (const { sampleId } of created) {
    const txns = await getJson(`/api/transactions?sample_id=${sampleId}`) as Json[] | null;
    for (const t of (Array.isArray(txns) ? txns : [])) {
      await fetch(`${API}/api/transactions/${t.id}`, { method: "DELETE" }).catch(() => {});
    }
    await fetch(`${API}/api/samples/${sampleId}`, { method: "DELETE" }).catch(() => {});
  }
  console.log("    done\n");
} else if (created.length) {
  console.log(`▶ left ${created.length} sample(s) in inventory (pass --cleanup to remove): ${created.map((c) => c.sampleId).join(", ")}\n`);
}

console.log(`Result: ${pass} passed, ${fail} failed.`);
Deno.exit(fail ? 1 : 0);
