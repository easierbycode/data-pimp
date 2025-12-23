#!/usr/bin/env -S deno run -A

/**

 * Seed script to load all entity data into the remote database

 * Usage: deno run -A scripts/seed-data.ts

 *

 * Requires LP_API_URL and LP_API_KEY environment variables

 */

 

import { base44, type Sample, type Bundle } from "../api/base44Client.ts";

 

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

  "Silk & Honey"

];

 

// Product categories and types

const productTypes = [

  { category: "Skincare", items: ["Serum", "Moisturizer", "Cleanser", "Toner", "Eye Cream", "Face Mask", "Exfoliator", "Essence", "Sunscreen", "Night Cream"] },

  { category: "Makeup", items: ["Foundation", "Concealer", "Blush", "Bronzer", "Highlighter", "Lipstick", "Lip Gloss", "Mascara", "Eyeliner", "Eyeshadow Palette"] },

  { category: "Haircare", items: ["Shampoo", "Conditioner", "Hair Mask", "Hair Oil", "Leave-in Treatment", "Heat Protectant", "Dry Shampoo", "Styling Cream", "Hair Serum", "Scalp Treatment"] },

  { category: "Body", items: ["Body Lotion", "Body Oil", "Body Scrub", "Hand Cream", "Shower Gel", "Body Butter", "Deodorant", "Body Mist", "Foot Cream", "Massage Oil"] }

];

 

// Locations

const locations = [

  "Shelf A-1", "Shelf A-2", "Shelf A-3",

  "Shelf B-1", "Shelf B-2", "Shelf B-3",

  "Shelf C-1", "Shelf C-2", "Shelf C-3",

  "Storage Room 1", "Storage Room 2",

  "Display Case 1", "Display Case 2",

  "Checkout Counter", "Back Office"

];

 

// Bundle definitions

const bundleDefinitions = [

  { name: "Summer Beauty Essentials", code: "BND-SUMMER-001", location: "Display Case 1" },

  { name: "K-Beauty Favorites", code: "BND-KBEAUTY-002", location: "Shelf A-1" },

  { name: "Travel Minis Collection", code: "BND-TRAVEL-003", location: "Shelf B-2" },

  { name: "Skincare Starter Kit", code: "BND-SKINCARE-004", location: "Display Case 2" },

  { name: "Glow Up Bundle", code: "BND-GLOW-005", location: "Shelf A-2" },

  { name: "Anti-Aging Essentials", code: "BND-ANTIAGE-006", location: "Shelf C-1" },

  { name: "Hydration Station", code: "BND-HYDRATE-007", location: "Shelf B-1" },

  { name: "Lip Lover's Set", code: "BND-LIPS-008", location: "Checkout Counter" },

  { name: "Hair Repair Bundle", code: "BND-HAIR-009", location: "Shelf C-2" },

  { name: "Body Care Basics", code: "BND-BODY-010", location: "Storage Room 1" },

  { name: "Spa Day at Home", code: "BND-SPA-011", location: "Display Case 1" },

  { name: "Clean Beauty Collection", code: "BND-CLEAN-012", location: "Shelf A-3" },

  { name: "Gift Set Deluxe", code: "BND-GIFT-013", location: "Display Case 2" },

  { name: "Everyday Makeup Essentials", code: "BND-MAKEUP-014", location: "Shelf B-3" },

  { name: "Sun Protection Pack", code: "BND-SUN-015", location: "Checkout Counter" }

];

 

// Generate samples

function generateSamples(): Omit<Sample, "id" | "created_date" | "updated_date">[] {

  const samples: Omit<Sample, "id" | "created_date" | "updated_date">[] = [];

 

  let sampleNum = 1;

 

  for (const category of productTypes) {

    for (const item of category.items) {

      // Create 2-3 samples per product type from different brands

      const numVariants = Math.floor(Math.random() * 2) + 2;

 

      for (let v = 0; v < numVariants && sampleNum <= 100; v++) {

        const brand = brands[Math.floor(Math.random() * brands.length)];

        const price = Math.floor(Math.random() * 80) + 10; // $10-$90

        const bestPrice = price - Math.floor(Math.random() * 15); // Up to $15 discount

        const statuses: Sample["status"][] = ["available", "available", "available", "checked_out", "reserved"];

        const status = statuses[Math.floor(Math.random() * statuses.length)];

 

        samples.push({

          name: `${brand} ${item}`,

          brand,

          qr_code: `SMP-${String(sampleNum).padStart(3, "0")}`,

          status,

          location: locations[Math.floor(Math.random() * locations.length)],

          current_price: price,

          best_price: bestPrice,

          best_price_source: ["Amazon", "Ulta", "Sephora", "Target", "CVS"][Math.floor(Math.random() * 5)],

          fire_sale: Math.random() < 0.1, // 10% chance of fire sale

          notes: Math.random() < 0.3 ? `${category.category} category - popular item` : undefined,

        });

 

        sampleNum++;

      }

    }

  }

 

  return samples.slice(0, 100); // Ensure exactly 100 samples

}

 

// Generate bundles

function generateBundles(): Omit<Bundle, "id" | "created_date" | "updated_date">[] {

  return bundleDefinitions.map(def => ({

    name: def.name,

    qr_code: def.code,

    location: def.location,

    notes: `Bundle collection - ${def.name}`,

  }));

}

 

async function clearExistingData() {

  console.log("🗑️  Clearing existing data...");

 

  try {

    // Clear transactions first (they may reference samples/bundles)

    const transactions = await base44.entities.InventoryTransaction.list();

    for (const tx of transactions) {

      await base44.entities.InventoryTransaction.delete(tx.id);

    }

    console.log(`   Deleted ${transactions.length} transactions`);

 

    // Clear samples

    const samples = await base44.entities.Sample.list();

    for (const sample of samples) {

      await base44.entities.Sample.delete(sample.id);

    }

    console.log(`   Deleted ${samples.length} samples`);

 

    // Clear bundles

    const bundles = await base44.entities.Bundle.list();

    for (const bundle of bundles) {

      await base44.entities.Bundle.delete(bundle.id);

    }

    console.log(`   Deleted ${bundles.length} bundles`);

  } catch (error) {

    console.log("   No existing data to clear or API not configured");

  }

}

 

async function seedData() {

  console.log("🌱 Starting data seed...\n");

 

  // Check for API configuration

  const apiKey = Deno.env.get("LP_API_KEY");

  const apiUrl = Deno.env.get("LP_API_URL") || "https://thirsty.store";

 

  console.log(`📡 API URL: ${apiUrl || "https://thirsty.store (default)"}`);

  console.log(`🔑 API Key: ${apiKey ? "✓ configured" : "⚠️  not set"}\n`);

 

  if (!apiKey) {

    console.log("⚠️  Warning: LP_API_KEY not set. API calls may fail.\n");

  }

 

  // Clear existing data

  await clearExistingData();

 

  console.log("\n📦 Creating bundles...");

  const bundles = generateBundles();

  const createdBundles: Bundle[] = [];

 

  for (const bundle of bundles) {

    try {

      const created = await base44.entities.Bundle.create(bundle);

      createdBundles.push(created);

      console.log(`   ✓ ${bundle.name} (${bundle.qr_code})`);

    } catch (error) {

      console.log(`   ✗ Failed to create ${bundle.name}: ${error}`);

    }

  }

 

  console.log(`\n   Created ${createdBundles.length} bundles\n`);

 

  console.log("📦 Creating samples...");

  const samples = generateSamples();

  let createdCount = 0;

  let errorCount = 0;

 

  // Assign some samples to bundles (distribute across bundles)

  for (let i = 0; i < samples.length; i++) {

    // Assign ~5-7 samples to each bundle

    if (i < createdBundles.length * 6 && createdBundles.length > 0) {

      const bundleIndex = Math.floor(i / 6);

      if (bundleIndex < createdBundles.length) {

        samples[i].bundle_id = createdBundles[bundleIndex].id;

      }

    }

 

    try {

      await base44.entities.Sample.create(samples[i]);

      createdCount++;

      if (createdCount % 10 === 0) {

        console.log(`   Created ${createdCount} samples...`);

      }

    } catch (error) {

      errorCount++;

      console.log(`   ✗ Failed to create ${samples[i].name}: ${error}`);

    }

  }

 

  console.log(`\n   Created ${createdCount} samples (${errorCount} errors)\n`);

 

  console.log("✅ Seed complete!\n");

  console.log("Summary:");

  console.log(`   Bundles: ${createdBundles.length}`);

  console.log(`   Samples: ${createdCount}`);

  console.log("\nYou can now use codes like SMP-001 through SMP-100 for samples");

  console.log("and BND-SUMMER-001 through BND-SUN-015 for bundles.");

}

 

// Run the seed

seedData().catch(console.error);