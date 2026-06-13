// seed-from-kiosk.ts
//
// Replaces ALL data in the data-pimp database with the real products tracked
// by thirsty-store-kiosk. No more generated/fake seed data.
//
// Product sources, in order:
//   1. The kiosk API (--kiosk, default https://thirsty-store-kiosk.easierbycode.deno.net)
//   2. A kiosk sample-prices.json store file (--store), for when the kiosk's
//      Graylog backend is offline
//
// Database access, in order:
//   1. DATABASE_URL (direct Postgres, fast TRUNCATE + INSERT)
//   2. The deployed data-pimp API (--api, default https://thirsty.store)
//
// Usage:
//   deno run -A scripts/seed-from-kiosk.ts [--dry-run]
//     [--kiosk <url>] [--store <path>] [--api <url>]

const args = parseArgs(Deno.args);
const KIOSK_BASE = String(
  args.kiosk || "https://thirsty-store-kiosk.easierbycode.deno.net",
).replace(/\/+$/, "");
const API_BASE = String(args.api || "https://thirsty.store").replace(/\/+$/, "");
const DRY_RUN = Boolean(args["dry-run"]);
const CONCURRENCY = 20;

type SeedSample = {
  name: string;
  brand: string | null;
  qr_code: string;
  status: string;
  location: string | null;
  current_price: number | null;
  best_price: number | null;
  best_price_source: string | null;
  picture_url: string | null;
  tiktok_affiliate_link: string | null;
  fire_sale: string | null;
  notes: string | null;
};

const products = await loadKioskProducts();
if (products.length === 0) {
  console.error(
    "No kiosk products found. Pass --store <path to sample-prices.json> " +
      "or make sure the kiosk API is reachable.",
  );
  Deno.exit(1);
}

console.log(`Seeding ${products.length} kiosk products:`);
for (const product of products) {
  console.log(
    `  - ${product.name} | ${product.brand ?? "?"} | ` +
      `${product.current_price !== null ? `$${product.current_price}` : "unpriced"}`,
  );
}

if (DRY_RUN) {
  console.log("\n--dry-run: nothing was changed.");
  Deno.exit(0);
}

if (Deno.env.get("DATABASE_URL")) {
  await seedViaDatabase(products);
} else {
  await seedViaApi(products);
}

// ---------------------------------------------------------------------------

async function loadKioskProducts(): Promise<SeedSample[]> {
  const merged = new Map<string, SeedSample>();

  // The catalog endpoint lists every product the kiosk knows about; the
  // unpriced-samples queue carries the user's price edits (title, seller,
  // source URL), so it overlays the catalog rows.
  try {
    const catalog = await fetchJson(`${KIOSK_BASE}/api/products?limit=500`);
    if (Array.isArray(catalog)) {
      for (const item of catalog) {
        const sample = sampleFromProduct(item);
        if (sample) merged.set(sample.qr_code, sample);
      }
    }
    const queue = await fetchJson(`${KIOSK_BASE}/api/unpriced-samples?limit=500`);
    const items = (queue as { items?: unknown[] })?.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        const sample = sampleFromQueueItem(item);
        if (sample) merged.set(sample.qr_code, sample);
      }
    }
  } catch (error) {
    console.warn(`Kiosk API unavailable (${message(error)})`);
  }

  if (merged.size === 0 && args.store) {
    console.log(`Falling back to kiosk store file: ${args.store}`);
    const store = JSON.parse(await Deno.readTextFile(String(args.store)));
    for (const product of Object.values(store.products ?? {})) {
      const sample = sampleFromProduct(product);
      if (sample) merged.set(sample.qr_code, sample);
    }
    for (const edit of Object.values(store.edits ?? {})) {
      const sample = sampleFromEdit(edit, merged.get(editId(edit)));
      if (sample) merged.set(sample.qr_code, sample);
    }
  }

  return [...merged.values()];
}

// deno-lint-ignore no-explicit-any
function sampleFromProduct(item: any): SeedSample | null {
  const productId = String(item?.productId || "").trim();
  const name = String(item?.name || "").trim();
  if (!productId || !name) return null;

  const price = Number(item?.min_sku_original_price) || 0;
  const seller = String(item?.seller || "").trim();

  return {
    name,
    brand: seller && seller !== "Unknown seller" ? seller : null,
    qr_code: productId,
    status: "available",
    location: null,
    current_price: price > 0 ? price : null,
    best_price: null,
    best_price_source: null,
    picture_url: optionalString(item?.image),
    tiktok_affiliate_link: tiktokUrl(productId, name),
    fire_sale: "false",
    notes: null,
  };
}

// deno-lint-ignore no-explicit-any
function sampleFromQueueItem(item: any): SeedSample | null {
  const productId = String(item?.productId || "").trim();
  const name = String(item?.apiTitle || item?.name || "").trim();
  if (!productId || !name) return null;

  const price = Number(item?.price) || 0;
  const seller = String(item?.apiSeller || "").trim();

  return {
    name,
    brand: seller || null,
    qr_code: productId,
    status: "available",
    location: null,
    current_price: price > 0 ? price : null,
    best_price: null,
    best_price_source: null,
    picture_url: optionalString(item?.image),
    tiktok_affiliate_link: optionalString(item?.sourceUrl) ?? tiktokUrl(productId, name),
    fire_sale: "false",
    notes: optionalString(item?.notes),
  };
}

// deno-lint-ignore no-explicit-any
function sampleFromEdit(edit: any, existing?: SeedSample): SeedSample | null {
  const productId = editId(edit);
  if (!productId) return null;

  const name = String(edit?.apiTitle || existing?.name || `Product ${productId}`)
    .trim();
  const price = Number(edit?.price) || 0;
  const seller = String(edit?.apiSeller || "").trim();

  return {
    name,
    brand: seller || existing?.brand || null,
    qr_code: productId,
    status: "available",
    location: existing?.location ?? null,
    current_price: price > 0 ? price : existing?.current_price ?? null,
    best_price: null,
    best_price_source: null,
    picture_url: existing?.picture_url ?? null,
    tiktok_affiliate_link: optionalString(edit?.sourceUrl) ??
      existing?.tiktok_affiliate_link ?? tiktokUrl(productId, name),
    fire_sale: "false",
    notes: optionalString(edit?.notes),
  };
}

// deno-lint-ignore no-explicit-any
function editId(edit: any): string {
  return String(edit?.productId || "").trim();
}

async function seedViaDatabase(rows: SeedSample[]) {
  const { Pool } = await import("npm:pg");
  const pool = new Pool({ connectionString: Deno.env.get("DATABASE_URL"), max: 1 });
  const client = await pool.connect();

  try {
    console.log("\nClearing database (transactions, samples, bundles)...");
    await client.query(
      "truncate table public.inventory_transactions, public.samples, public.bundles restart identity cascade",
    );

    console.log("Inserting samples...");
    for (const row of rows) {
      const keys = Object.keys(row) as Array<keyof SeedSample>;
      await client.query(
        `insert into public.samples (${keys.map((k) => `"${k}"`).join(", ")})
         values (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
        keys.map((key) => row[key]),
      );
    }
    console.log(`Done. ${rows.length} samples inserted via DATABASE_URL.`);
  } finally {
    client.release();
    await pool.end();
  }
}

async function seedViaApi(rows: SeedSample[]) {
  console.log(`\nClearing ${API_BASE} via API...`);

  const transactions = await fetchJson(`${API_BASE}/api/transactions?limit=500`);
  if (Array.isArray(transactions) && transactions.length > 0) {
    await deleteAll("transactions", transactions);
  }

  const samples = await fetchJson(`${API_BASE}/api/samples`);
  if (Array.isArray(samples)) await deleteAll("samples", samples);

  const bundles = await fetchJson(`${API_BASE}/api/bundles`);
  if (Array.isArray(bundles)) await deleteAll("bundles", bundles);

  console.log("Inserting samples...");
  let inserted = 0;
  await inBatches(rows, CONCURRENCY, async (row) => {
    const response = await fetch(`${API_BASE}/api/samples`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(row),
    });
    if (!response.ok) {
      throw new Error(`POST sample failed: ${response.status} ${await response.text()}`);
    }
    await response.body?.cancel();
    inserted++;
  });

  console.log(`Done. ${inserted} samples inserted via ${API_BASE}.`);
}

async function deleteAll(resource: string, rows: Array<{ id: unknown }>) {
  let deleted = 0;
  await inBatches(rows, CONCURRENCY, async (row) => {
    const response = await fetch(`${API_BASE}/api/${resource}/${row.id}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`DELETE ${resource}/${row.id} failed: ${response.status}`);
    }
    await response.body?.cancel();
    deleted++;
    if (deleted % 200 === 0) console.log(`  ${resource}: ${deleted}/${rows.length}`);
  });
  console.log(`  ${resource}: deleted ${deleted}`);
}

async function inBatches<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
) {
  let index = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (index < items.length) {
        const item = items[index++];
        await task(item);
      }
    },
  );
  await Promise.all(workers);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url}: ${response.status} ${text.slice(0, 200)}`);
  }
  return JSON.parse(text);
}

function tiktokUrl(productId: string, name: string): string | null {
  // IDs starting with "9" are synthetic (hashed from a product name by the
  // kiosk) -- no TikTok page exists for them.
  if (productId.startsWith("9")) return null;
  const slug = name.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90) || "product";
  return `https://www.tiktok.com/shop/pdp/${slug}/${productId}`;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      i++;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}
