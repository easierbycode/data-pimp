#!/usr/bin/env -S deno run -A
/**
 * Seed script to load mock data into production database
 * Usage: deno run -A scripts/seed-production.ts
 *
 * Requires DATABASE_URL environment variable to be set
 */

import { Pool } from "npm:pg";
import { initializeDatabase, Samples, Bundles } from "../db.ts";

// ---- Ensure {samples,bundles,inventory_transactions}.id auto-increments + PK ----
async function ensureIdAutoIncrement(table: string) {
  const connectionString = Deno.env.get("DATABASE_URL");
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();

  const reg = `public.${table}`;
  const seq = `public.${table}_id_seq`;

  try {
    // Table exists?
    const exists = await client.query(`select to_regclass($1) as r`, [reg]);
    if (!exists.rows?.[0]?.r) {
      console.warn(`Skipping ${reg}: table not found`);
      return;
    }

    // Column type for id
    const col = await client.query(
      `
      select data_type, udt_name
      from information_schema.columns
      where table_schema='public' and table_name=$1 and column_name='id'
      limit 1
      `,
      [table],
    );

    if (!col.rows?.length) {
      console.warn(`Skipping ${reg}: no id column`);
      return;
    }

    const dataType = String(col.rows[0].data_type || "").toLowerCase();
    const udtName = String(col.rows[0].udt_name || "").toLowerCase();

    const isIntLike =
      dataType.includes("integer") ||
      dataType.includes("bigint") ||
      dataType.includes("smallint") ||
      udtName === "int2" ||
      udtName === "int4" ||
      udtName === "int8";

    const isTextLike = dataType.includes("text") || dataType.includes("character");

    if (!isIntLike && !isTextLike) {
      console.warn(
        `Skipping ${reg}: id type not supported for auto-increment (data_type=${dataType}, udt_name=${udtName})`,
      );
      return;
    }

    // 1) Ensure sequence exists
    await client.query(`create sequence if not exists ${seq};`);

    // 2) Set sequence to max numeric-looking id, safely.
    //    If empty => set to 1 with is_called=false so nextval() returns 1.
    await client.query(`
      with m as (
        select max(case
          when id::text ~ '^[0-9]+$' then (id::text)::bigint
          else null
        end) as max_id
        from ${reg}
      )
      select setval(
        '${seq}'::regclass,
        greatest(1, coalesce(max_id, 1)),
        coalesce(max_id, 0) >= 1
      )
      from m;
    `);

    // 3) Make sequence owned by the column
    await client.query(`alter sequence ${seq} owned by ${reg}.id;`);

    // 4) Backfill any null ids
    const nextExpr = isTextLike ? `nextval('${seq}')::text` : `nextval('${seq}')`;
    await client.query(`
      update ${reg}
      set id = ${nextExpr}
      where id is null;
    `);

    // 5) Set default so inserts that omit id succeed
    const defaultExpr = isTextLike ? `nextval('${seq}')::text` : `nextval('${seq}')`;
    await client.query(`
      alter table ${reg}
      alter column id set default ${defaultExpr};
    `);

    // 6) Enforce NOT NULL (now that we backfilled)
    await client.query(`
      alter table ${reg}
      alter column id set not null;
    `);

    // 7) Ensure a primary key exists (don’t care about the constraint name)
    try {
      await client.query(`
        do $$
        begin
          if not exists (
            select 1
            from pg_constraint
            where contype = 'p'
              and conrelid = '${reg}'::regclass
          ) then
            alter table ${reg}
            add constraint ${table}_pkey primary key (id);
          end if;
        end $$;
      `);
    } catch (e) {
      console.warn(
        `Note: could not add primary key on ${reg} (duplicates or incompatible type?). Continuing.`,
        e?.message ?? e,
      );
    }

    // 8) Sanity: verify no null ids remain
    const check = await client.query(`select count(*)::int as c from ${reg} where id is null;`);
    const nulls = Number(check.rows?.[0]?.c ?? 0);
    if (nulls > 0) {
      throw new Error(`${reg}.id still has ${nulls} null values after fix`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// Initialize database (warms column cache in db.ts)
console.log("Initializing database...");
await initializeDatabase();

// Fix ids BEFORE inserting anything
console.log("Ensuring samples.id / bundles.id / inventory_transactions.id are auto-incrementing...");
await ensureIdAutoIncrement("samples");
await ensureIdAutoIncrement("bundles");
await ensureIdAutoIncrement("inventory_transactions");

// Beauty brands for demo data
const brands = [
  "Glow Labs",
  "Pure Skin",
  "Luxe Beauty",
  "Seoul Glow",
  "Natura Vita",
  "Radiant Rose",
  "Velvet Touch",
  "Crystal Clear",
  "Bloom Botanicals",
  "Silk & Honey",
];

// Product categories and types
const productTypes = [
  {
    category: "Skincare",
    items: [
      "Serum",
      "Moisturizer",
      "Cleanser",
      "Toner",
      "Eye Cream",
      "Face Mask",
      "Exfoliator",
      "Essence",
      "Sunscreen",
      "Night Cream",
    ],
  },
  {
    category: "Makeup",
    items: [
      "Foundation",
      "Concealer",
      "Blush",
      "Bronzer",
      "Highlighter",
      "Lipstick",
      "Lip Gloss",
      "Mascara",
      "Eyeliner",
      "Eyeshadow Palette",
    ],
  },
  {
    category: "Haircare",
    items: [
      "Shampoo",
      "Conditioner",
      "Hair Mask",
      "Hair Oil",
      "Leave-in Treatment",
      "Heat Protectant",
      "Dry Shampoo",
      "Styling Cream",
      "Hair Serum",
      "Scalp Treatment",
    ],
  },
  {
    category: "Body",
    items: [
      "Body Lotion",
      "Body Oil",
      "Body Scrub",
      "Hand Cream",
      "Shower Gel",
      "Body Butter",
      "Deodorant",
      "Body Mist",
      "Foot Cream",
      "Massage Oil",
    ],
  },
];

// Locations
const locations = [
  "Shelf A-1",
  "Shelf A-2",
  "Shelf A-3",
  "Shelf B-1",
  "Shelf B-2",
  "Shelf B-3",
  "Shelf C-1",
  "Shelf C-2",
  "Shelf C-3",
  "Storage Room 1",
  "Storage Room 2",
  "Display Case 1",
  "Display Case 2",
  "Checkout Counter",
  "Back Office",
  "Window Display",
];

// Bundle definitions
const bundleDefinitions = [
  { name: "Summer Beauty Essentials", code: "BND-SUMMER-001", location: "Display Case 1" },
  { name: "K-Beauty Favorites", code: "BND-KBEAUTY-002", location: "Shelf A-1" },
  { name: "Travel Minis Collection", code: "BND-TRAVEL-003", location: "Shelf B-2" },
  { name: "Skincare Starter Kit", code: "BND-SKINCARE-004", location: "Display Case 2" },
  { name: "Glow Up Bundle", code: "BND-GLOW-005", location: "Shelf A-2" },
  { name: "Anti-Aging Essentials", code: "BND-ANTIAGE-006", location: "Shelf C-1" },
  { name: "Hydration Heroes", code: "BND-HYDRATE-007", location: "Shelf B-1" },
  { name: "Makeup Must-Haves", code: "BND-MAKEUP-008", location: "Display Case 1" },
  { name: "Hair Repair Kit", code: "BND-HAIRCARE-009", location: "Shelf C-2" },
  { name: "Self-Care Sunday", code: "BND-SELFCARE-010", location: "Display Case 2" },
  { name: "Bridal Beauty Box", code: "BND-BRIDAL-011", location: "Window Display" },
  { name: "Men's Grooming Set", code: "BND-MENS-012", location: "Shelf A-3" },
  { name: "Teen Skincare Basics", code: "BND-TEEN-013", location: "Shelf B-3" },
  { name: "Luxury Collection", code: "BND-LUXURY-014", location: "Display Case 1" },
  { name: "Budget Beauty Bundle", code: "BND-BUDGET-015", location: "Checkout Counter" },
];

function picsumImage(seed: string) {
  const safe = encodeURIComponent(seed);
  return `https://picsum.photos/seed/${safe}/400/400`;
}

console.log("\nCreating bundles...");
const createdBundles: any[] = [];

for (const bundle of bundleDefinitions) {
  try {
    const created = await Bundles.create({
      // write both variants; db layer will keep whichever columns exist
      name: bundle.name,
      qr_code: bundle.code,
      qrCode: bundle.code,
      location: bundle.location,
      notes: `Demo bundle: ${bundle.name}`,
    });
    createdBundles.push(created);
    console.log(`✓ Created bundle: ${bundle.name} (id=${created?.id ?? "?"})`);
  } catch (error) {
    console.error(`✗ Failed to create bundle ${bundle.name}:`, error?.message ?? error);
  }
}

console.log(`\nCreated ${createdBundles.length} bundles`);

console.log("\nCreating sample products...");
const statuses = ["available", "available", "available", "available", "checked_out", "reserved", "discontinued"];
let sampleCount = 0;

for (let i = 0; i < 120; i++) {
  const category = productTypes[Math.floor(Math.random() * productTypes.length)];
  const item = category.items[Math.floor(Math.random() * category.items.length)];
  const brand = brands[Math.floor(Math.random() * brands.length)];
  const location = locations[Math.floor(Math.random() * locations.length)];
  const status = statuses[Math.floor(Math.random() * statuses.length)];

  // Determine if this sample should have "Lowest Price Online" (35% chance)
  const hasLowestPriceOnline = Math.random() < 0.35;

  let currentPrice, bestPrice;
  if (hasLowestPriceOnline) {
    // Current price is LOWER than best price online (we have the best deal!)
    bestPrice = 20 + Math.random() * 80; // Online price ranges from $20-$100
    currentPrice = bestPrice * (0.60 + Math.random() * 0.25); // Our price is 60-85% of online price
  } else {
    // Current price is HIGHER than best price online (normal case)
    currentPrice = 15 + Math.random() * 85; // Our price ranges from $15-$100
    bestPrice = currentPrice * (0.70 + Math.random() * 0.20); // Online price is 70-90% of our price
  }

  const fireSale = Math.random() < 0.15;

  // only choose bundles that actually have an id
  const bundlesWithId = createdBundles.filter((b) => b?.id != null);
  const bundleId = Math.random() < 0.3 && bundlesWithId.length > 0
    ? bundlesWithId[Math.floor(Math.random() * bundlesWithId.length)]?.id ?? null
    : null;

  const qrCode = `PRD-${category.category.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(4, "0")}`;
  const imageUrl = picsumImage(qrCode);

  try {
    await Samples.create({
      name: `${brand} ${item}`,
      brand,
      location,
      status,
      notes: fireSale ? "🔥 Fire sale item! Limited time offer." : null,

      qr_code: qrCode,
      qrCode,

      current_price: Number(currentPrice.toFixed(2)),
      currentPrice: Number(currentPrice.toFixed(2)),

      best_price: Number(bestPrice.toFixed(2)),
      bestPrice: Number(bestPrice.toFixed(2)),

      best_price_source: "https://example.com/deals",
      bestPriceSource: "https://example.com/deals",

      fire_sale: fireSale,
      fireSale,

      bundle_id: bundleId,
      bundleId,

      picture_url: imageUrl,
      pictureUrl: imageUrl,
    });

    sampleCount++;
    if (sampleCount % 20 === 0) console.log(`Created ${sampleCount} samples...`);
  } catch (error) {
    console.error(`✗ Failed to create sample ${qrCode}:`, error?.message ?? error);
  }
}

console.log(`\n✓ Successfully created ${sampleCount} sample products`);
console.log(`✓ Successfully created ${createdBundles.length} bundles`);

if (sampleCount === 0) {
  console.error("\n❌ No samples were created. Failing seed so Deploy fails the release.");
  Deno.exit(1);
}

console.log("\n🎉 Database seeded successfully!");
Deno.exit(0);
