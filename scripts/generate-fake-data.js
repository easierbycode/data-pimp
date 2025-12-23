// generate-fake-data.js
const jsf = require("json-schema-faker");
const { faker } = require("@faker-js/faker");
const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

// === SETTINGS ===
const BUNDLES_COUNT = 50;
const SAMPLES_COUNT = 500;
const TRANSACTIONS_COUNT = 800;

// === SCHEMAS ===

const bundleSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    location: { type: "string" },
    qr_code: { type: "string" },
    notes: { type: "string" }
  },
  required: ["name", "qr_code"]
};

const sampleSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    brand: { type: "string" },
    location: { type: "string" },
    qr_code: { type: "string" },
    picture_url: { type: "string" },
    tiktok_affiliate_link: { type: "string" },
    fire_sale: { type: "boolean" },
    status: {
      type: "string",
      enum: ["available","checked_out","reserved","discontinued"]
    },
    current_price: { type: "number" },
    best_price: { type: "number" },
    best_price_source: { type: "string" },
    last_price_checked_at: { type: "string", format: "date-time" },
    bundle_id: { type: "number" },
    checked_out_at: { type: "string", format: "date-time" },
    checked_in_at: { type: "string", format: "date-time" },
    checked_out_to: { type: "string" },
    notes: { type: "string" }
  },
  required: ["name", "brand","qr_code","status"]
};

const transactionSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["checkout","checkin","reserve","unreserve"] },
    sample_id: { type: "number" },
    bundle_id: { type: "number" },
    scanned_code: { type: "string" },
    operator: { type: "string" },
    checked_out_to: { type: "string" },
    notes: { type: "string" },
    created_at: { type: "string", format: "date-time" }
  },
  required: ["action","scanned_code"]
};

// === GENERATORS ===

// helper for picture_url
jsf.extend("faker", () => faker);

// generate bundles
const bundles = [];
for (let i = 1; i <= BUNDLES_COUNT; i++) {
  bundles.push({
    id: i,
    name: faker.commerce.department() + " Bundle",
    location: faker.location.city(),
    qr_code: `BNDL-${faker.string.uppercase(6)}`,
    notes: faker.lorem.sentence()
  });
}

// generate samples
const samples = [];
for (let i = 1; i <= SAMPLES_COUNT; i++) {
  const bundleId = faker.helpers.arrayElement([null, ...bundles.map(b => b.id)]);
  samples.push({
    id: i,
    name: faker.commerce.productName(),
    brand: faker.company.name(),
    location: faker.location.street(),
    qr_code: `SMP-${faker.string.uppercase(8)}`,
    // ensure the picture_url points to an *existing image*
    picture_url: faker.image.urlLoremFlickr({ category: "product", width: 640, height: 480 }),
    tiktok_affiliate_link: `https://www.tiktok.com/@${faker.internet.userName()}/link`,
    fire_sale: faker.datatype.boolean(0.1),
    status: faker.helpers.arrayElement(["available","checked_out","reserved","discontinued"]),
    current_price: faker.commerce.price({ min: 5, max: 500 }),
    best_price: faker.commerce.price({ min: 1, max: 400 }),
    best_price_source: faker.internet.url(),
    last_price_checked_at: faker.date.recent().toISOString(),
    bundle_id: bundleId,
    checked_out_at: faker.datatype.boolean() ? faker.date.past().toISOString() : "",
    checked_in_at: "",
    checked_out_to: faker.datatype.boolean() ? faker.person.firstName() : "",
    notes: faker.lorem.sentence()
  });
}

// generate transactions
const transactions = [];
for (let i = 1; i <= TRANSACTIONS_COUNT; i++) {
  const sample = faker.helpers.arrayElement(samples);
  transactions.push({
    id: i,
    action: faker.helpers.arrayElement(["checkout","checkin","reserve","unreserve"]),
    sample_id: sample.id,
    bundle_id: sample.bundle_id,
    scanned_code: sample.qr_code,
    operator: faker.person.fullName(),
    checked_out_to: faker.datatype.boolean() ? faker.person.firstName() : "",
    notes: faker.lorem.sentence(),
    created_at: faker.date.recent().toISOString()
  });
}

// === CSV WRITERS ===

const bundleWriter = createCsvWriter({
  path: "bundles.csv",
  header: [
    { id: "id", title: "id" },
    { id: "name", title: "name" },
    { id: "location", title: "location" },
    { id: "qr_code", title: "qr_code" },
    { id: "notes", title: "notes" }
  ]
});

const sampleWriter = createCsvWriter({
  path: "samples.csv",
  header: Object.keys(samples[0]).map(k => ({ id: k, title: k }))
});

const transactionWriter = createCsvWriter({
  path: "inventory_transactions.csv",
  header: Object.keys(transactions[0]).map(k => ({ id: k, title: k }))
});

// write CSVs
Promise.all([
  bundleWriter.writeRecords(bundles),
  sampleWriter.writeRecords(samples),
  transactionWriter.writeRecords(transactions)
])
  .then(() => console.log("CSV files generated successfully!"))
  .catch(err => console.error("Error writing CSV:", err));
