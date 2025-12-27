#!/usr/bin/env -S deno run -A
/**
 * Seed script to load mock data into production database
 * Usage: deno run -A scripts/seed-production.ts
 *
 * Requires DATABASE_URL environment variable to be set
 */

import { initializeDatabase, Samples, Bundles } from "../db.ts";

// Initialize database
console.log("Initializing database...");
await initializeDatabase();

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
  { category: "Skincare", items: ["Serum", "Moisturizer", "Cleanser", "Toner", "Eye Cream", "Face Mask", "Exfoliator", "Essence", "Sunscreen", "Night Cream"] },
  { category: "Makeup", items: ["Foundation", "Concealer", "Blush", "Bronzer", "Highlighter", "Lipstick", "Lip Gloss", "Mascara", "Eyeliner", "Eyeshadow Palette"] },
  { category: "Haircare", items: ["Shampoo", "Conditioner", "Hair Mask", "Hair Oil", "Leave-in Treatment", "Heat Protectant", "Dry Shampoo", "Styling Cream", "Hair Serum", "Scalp Treatment"] },
  { category: "Body", items: ["Body Lotion", "Body Oil", "Body Scrub", "Hand Cream", "Shower Gel", "Body Butter", "Deodorant", "Body Mist", "Foot Cream", "Massage Oil"] },
];

// Locations
const locations = [
  "Shelf A-1", "Shelf A-2", "Shelf A-3",
  "Shelf B-1", "Shelf B-2", "Shelf B-3",
  "Shelf C-1", "Shelf C-2", "Shelf C-3",
  "Storage Room 1", "Storage Room 2",
  "Display Case 1", "Display Case 2",
  "Checkout Counter", "Back Office",
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
  // Always returns an image; deterministic per product
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
    console.log(`✓ Created bundle: ${bundle.name}`);
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
  const currentPrice = 15 + Math.random() * 85; // $15-100
  const bestPrice = currentPrice * (0.7 + Math.random() * 0.2); // 70-90% of current
  const fireSale = Math.random() < 0.15;

  const bundleId = Math.random() < 0.3 && createdBundles.length > 0
    ? createdBundles[Math.floor(Math.random() * createdBundles.length)].id
    : null;

  const qrCode = `PRD-${category.category.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(4, "0")}`;
  const imageUrl = picsumImage(qrCode);

  try {
    await Samples.create({
      // Common fields
      name: `${brand} ${item}`,
      brand,
      location,
      status,
      notes: fireSale ? "🔥 Fire sale item! Limited time offer." : null,

      // Both key styles (snake + camel) so it works with either schema
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
console.log("\n🎉 Database seeded successfully!");

Deno.exit(0);
