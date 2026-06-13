#!/usr/bin/env -S deno run -A
/**
 * Verify product-image resolution against a real TikTok Shop product.
 *
 * Exercises the SAME code that powers /api/samples/:id/image (product-image.ts),
 * so a green run here means the live endpoint will resolve images too.
 *
 * Usage:
 *   SCRAPECREATORS_API_KEY=... deno run -A scripts/verify-product-image.ts
 *   SCRAPECREATORS_API_KEY=... deno run -A scripts/verify-product-image.ts <productId | pdpUrl>
 *
 * PowerShell:
 *   $env:SCRAPECREATORS_API_KEY="..."; deno run -A scripts/verify-product-image.ts
 */
import {
  extractProductImage,
  fetchProductImage,
  pdpUrlForSample,
  SCRAPECREATORS_API_KEY,
  SCRAPECREATORS_PRODUCT_URL,
} from "../product-image.ts";

// Real production samples (qr_code = TikTok product id, plus their PDP links).
const KNOWN = [
  {
    qr_code: "1729527400425427463",
    name: "Goli Dreamy Sleep Gummy",
    tiktok_affiliate_link:
      "https://www.tiktok.com/shop/pdp/goli-dreamy-sleep-gummy-melatonin-vitamin-d-magnesium-lemon-balm-extract-gelatin-free-glut/1729527400425427463",
  },
  {
    qr_code: "1732314264145597292",
    name: "Cherry Slush from Lucky Energy",
    tiktok_affiliate_link:
      "https://www.tiktok.com/shop/pdp/cherry-slush-from-lucky-energy-12-pack-12oz-can/1732314264145597292",
  },
];

function targetsFromArgs(): Array<Record<string, unknown>> {
  const arg = Deno.args[0];
  if (!arg) return KNOWN;
  if (arg.startsWith("http")) return [{ name: "(cli url)", tiktok_affiliate_link: arg }];
  return [{ name: `(cli id ${arg})`, qr_code: arg }];
}

if (!SCRAPECREATORS_API_KEY) {
  console.error("❌ SCRAPECREATORS_API_KEY is not set in this environment.");
  console.error("   Set it and re-run, e.g. (PowerShell):");
  console.error('   $env:SCRAPECREATORS_API_KEY="<key>"; deno run -A scripts/verify-product-image.ts');
  Deno.exit(2);
}

let failures = 0;

for (const sample of targetsFromArgs()) {
  const label = (sample.name as string) ?? "(product)";
  const pdpUrl = pdpUrlForSample(sample);
  console.log(`\n=== ${label} ===`);
  console.log(`pdp url: ${pdpUrl}`);

  if (!pdpUrl) {
    console.error("❌ could not derive a PDP url (no affiliate link / non-numeric qr_code)");
    failures++;
    continue;
  }

  // 1) Resolve via the shipped helper.
  const image = await fetchProductImage(pdpUrl);

  // 2) Also dump the raw response shape so we can confirm the field path.
  const endpoint = new URL(SCRAPECREATORS_PRODUCT_URL);
  endpoint.searchParams.set("url", pdpUrl);
  endpoint.searchParams.set("region", "US");
  const raw = await fetch(endpoint, { headers: { "x-api-key": SCRAPECREATORS_API_KEY } })
    .then((r) => r.json())
    .catch(() => null);
  const imagesArr = (raw as any)?.product_base?.images;
  const title = (raw as any)?.product_base?.title;

  console.log(`api success:      ${(raw as any)?.success}`);
  console.log(`title (from api): ${title ?? "(none)"}`);
  console.log(`images[] length:  ${Array.isArray(imagesArr) ? imagesArr.length : "n/a"}`);
  console.log(`extractor matched: ${!!extractProductImage(raw)}`);

  if (image) {
    console.log(`✅ resolved image: ${image}`);
  } else {
    console.error("❌ no image resolved");
    failures++;
  }
}

console.log(`\n${failures === 0 ? "✅ ALL PASSED" : `❌ ${failures} FAILED`}`);
Deno.exit(failures === 0 ? 0 : 1);
