// Offline render test for the public product page (thirsty.store/<id>).
// Exercises productPageDocument() directly — no DB needed — to verify HTML
// escaping/XSS-safety, conditional field rows, price formatting, and the
// not-found / error states.
//
//   deno run -A scripts/verify-product-page.ts
//
// Importing main.ts starts its server, so we force a high PORT to avoid a
// conflict and Deno.exit() when the checks finish.
import { productPageDocument } from "../main.ts";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

// 1) Full sample, with HTML-special chars and an XSS attempt in the fields.
const sample = {
  id: 2390,
  name: 'Cell-Tech <b>Creatine</b> "Monohydrate" & more',
  brand: "MuscleTech",
  notes: "Top shelf </script><script>alert(1)</script>",
  picture_url: "https://cdn.example.com/x.webp?a=1&b=2",
  current_price: "27.98", // node-pg returns numerics as strings
  location: "BIN D",
  tiktok_affiliate_link: "https://www.tiktok.com/shop/pdp/1730796046489392119",
  status: "available",
};
const html = productPageDocument(sample, "1730796046489392119");

console.log("full sample:");
check("starts with DOCTYPE", html.startsWith("<!DOCTYPE html>"));
check(
  "title = escaped product name",
  html.includes("<title>Cell-Tech &lt;b&gt;Creatine&lt;/b&gt; &quot;Monohydrate&quot; &amp; more</title>"),
);
check("raw <b> from name not leaked", !html.includes("<b>Creatine</b>"));
check("notes script-injection neutralized", !html.includes("</script><script>alert(1)</script>"));
check("escaped script shows as text", html.includes("&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;"));
check("Name row present", html.includes(">Name</div>"));
check("Brand row present", html.includes(">Brand</div>") && html.includes("MuscleTech"));
check("Price row present + formatted", html.includes(">Price</div>") && html.includes("$27.98"));
check("Notes row present", html.includes(">Notes</div>"));
check("price row tagged for styling", html.includes('class="row price"'));
check(
  "copy-image button has escaped url",
  html.includes('data-copy-image="https://cdn.example.com/x.webp?a=1&amp;b=2"'),
);
check("og:image present", html.includes('property="og:image"'));
check("og:type product", html.includes('content="product"'));
check("3+ copy buttons rendered", (html.match(/class="copy"/g) || []).length >= 3);
check("no leaked template literal ${", !html.includes("${"));
check("affiliate link not shown", !html.includes("/shop/pdp/"));
check("BIN/location not shown", !html.includes("BIN D"));

// 2) Minimal sample: only a name, everything else null.
const minimal = { name: "Just A Name", current_price: null, brand: null, notes: null, picture_url: null };
const html2 = productPageDocument(minimal, "9999999999");
console.log("minimal sample:");
check("[min] Name present", html2.includes(">Name</div>"));
check("[min] Brand omitted", !html2.includes(">Brand</div>"));
check("[min] Price omitted", !html2.includes(">Price</div>"));
check("[min] Notes omitted", !html2.includes(">Notes</div>"));
check("[min] image placeholder", html2.includes("No image"));
check("[min] no og:image", !html2.includes('property="og:image"'));

// 3) Price coercion: integer number -> two decimals.
console.log("price formatting:");
check("[int] 30 -> $30.00", productPageDocument({ name: "N", current_price: 30 }, "1111111111").includes("$30.00"));
check(
  "[zero] 0 treated as unpriced (row omitted)",
  !productPageDocument({ name: "N", current_price: 0 }, "1111111111").includes(">Price</div>"),
);
check(
  "[bad] non-numeric price omitted",
  !productPageDocument({ name: "N", current_price: "n/a" }, "1111111111").includes(">Price</div>"),
);

// 3b) picture_url scheme allowlist: only absolute http(s) renders an image.
console.log("image scheme allowlist:");
const jsUrl = productPageDocument({ name: "N", picture_url: "javascript:alert(1)" }, "1111111111");
check("[img] javascript: rejected -> placeholder", jsUrl.includes("No image") && !jsUrl.includes("javascript:alert"));
check("[img] relative path rejected", productPageDocument({ name: "N", picture_url: "/x.png" }, "1111111111").includes("No image"));
check(
  "[img] https accepted",
  productPageDocument({ name: "N", picture_url: "https://cdn.example.com/x.webp" }, "1111111111").includes("data-copy-image="),
);

// 4) Not found.
const nf = productPageDocument(null, "1234567890");
console.log("not found:");
check("[nf] message", nf.includes("Product not found"));
check("[nf] echoes code", nf.includes("<code>1234567890</code>"));
check("[nf] no copy buttons", !nf.includes('class="copy"'));

// 5) Lookup error.
const er = productPageDocument(null, "1234567890", true);
console.log("errored:");
check("[err] temporarily unavailable", er.includes("Temporarily unavailable"));

console.log(failures === 0 ? "\nALL PASSED ✅" : `\n${failures} CHECK(S) FAILED ❌`);
Deno.exit(failures === 0 ? 0 : 1);
