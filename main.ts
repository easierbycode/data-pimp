// main.ts - Deno Deploy compatible server
// Serves React SPA (shell + /app.js) + API + DB debug endpoints

import { Pool } from "npm:pg";
import { initializeDatabase, Samples, Bundles, InventoryTransactions } from "./db.ts";
import { fetchProductImage, pdpUrlForSample } from "./product-image.ts";
// Migrated from thirsty-store-kiosk: the Graylog-backed Product Analysis
// dashboard. Catalog (/api/products) is served from Postgres instead (below).
import {
  fetchComparisonWithEdits,
  fetchPriceForSample,
  fetchProductWithEdits,
  fetchSampleValuationWithEdits,
  listSampleProducts,
  listUnpricedSamples,
  lookupProductByImage,
  lookupProductByLens,
  lookupProductByTiktokUrl,
  lookupProductByUpc,
  lookupProductDetails,
  lookupProductsByKeyword,
  resolveTiktokProductUrl,
  type UnpricedSample,
  updateSamplePrice,
  upsertSampleProduct,
} from "./core/samples.ts";
import {
  fetchDueListingSchedules,
  listSampleStatuses,
  markListingScheduleDone,
  recordAgencyIntake,
  recordBulkSampleSold,
  recordSampleAssignment,
  recordSampleImport,
  recordSampleListing,
  recordSampleSold,
  recordSampleStatus,
} from "./core/lifecycle.ts";
import {
  envValue,
  fetchCreatorsForProduct,
  fetchKnownCreators,
  fetchOrderCreatorsByName,
  graylogConfigFromEnv,
} from "./core/graylog.ts";
import { renderBarcodePng } from "./core/barcode.ts";

const pool = new Pool({
  connectionString: Deno.env.get("DATABASE_URL"),
  max: 1,
});

// Thin-client mode: with no local DATABASE_URL (e.g. the compiled desktop
// binary on a kiosk), proxy /api/* to the central deployment instead of a local
// DB — no DB credentials on-device, one shared source of truth. Override the
// upstream with THIRSTY_API.
const REMOTE_API = Deno.env.get("DATABASE_URL")
  ? null
  : (Deno.env.get("THIRSTY_API") || "https://thirsty.store").replace(/\/+$/, "");

if (REMOTE_API) {
  console.log(`[thirsty-os] No DATABASE_URL — proxying /api/* to ${REMOTE_API}`);
} else {
  // Initialize database on startup
  await initializeDatabase().catch((err) => {
    console.error("Failed to initialize database:", err);
    console.log("Will continue without database - may fail on API calls");
  });
}

const CHARACTER_URL =
  "https://spritehub-c3a33-default-rtdb.firebaseio.com/characters/dukeNukem.json";
const GRAYLOG_ENDPOINT = "http://graylog-server.thirsty.store:12201/gelf";
const MAX_GELF_MESSAGE_SIZE = 8000;

const TABLES = ["bundles", "inventory_transactions", "samples"] as const;

function redactedDbUrl() {
  const raw = Deno.env.get("DATABASE_URL");
  if (!raw) return null;

  try {
    const u = new URL(raw);
    return {
      host: u.hostname,
      database: u.pathname.replace(/^\//, ""),
      user: u.username || null,
      hasPassword: Boolean(u.password),
    };
  } catch {
    return { parseError: true };
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

// The catalog is read cross-origin by the sample tracker (admin.thirsty.store),
// so it needs a permissive CORS header (the kiosk served it the same way).
function corsJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

// CORS preflight for the endpoints that accept POST with a JSON body (e.g.
// /api/image-lookup) — a cross-origin JSON POST triggers an OPTIONS preflight
// the simple GET endpoints never see.
function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
  });
}

// Forward an /api/* request to the central deployment (thin-client mode).
async function proxyApi(req: Request, url: URL): Promise<Response> {
  const target = REMOTE_API + url.pathname + url.search;
  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const kioskId = req.headers.get("x-kiosk-id");
  if (kioskId) headers.set("x-kiosk-id", kioskId);
  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }
  try {
    const resp = await fetch(target, init);
    return new Response(await resp.arrayBuffer(), {
      status: resp.status,
      headers: {
        "content-type": resp.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return json({
      error: `Upstream ${REMOTE_API} unreachable: ${e instanceof Error ? e.message : String(e)}`,
    }, 502);
  }
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

// Map a Postgres `samples` row back to the kiosk's catalog product shape that
// the tracker expects (inverse of scripts/seed-from-kiosk.ts).
interface KioskProduct {
  productId: string;
  name: string;
  priceRange: string;
  min_sku_original_price: number;
  category: string;
  seller: string;
  sampleCount: number;
  estimatedRetailValue: number;
  lastSeen: string | null;
  image: string | null;
}

function sampleRowToKioskProduct(row: Record<string, unknown>): KioskProduct {
  const price = Number(row.current_price) || 0;
  return {
    productId: String(row.qr_code ?? "").trim(),
    name: String(row.name ?? "").trim(),
    priceRange: price > 0 ? `$${price.toFixed(2)}` : "",
    min_sku_original_price: price,
    category: "",
    seller: row.brand ? String(row.brand) : "Unknown seller",
    sampleCount: 0,
    estimatedRetailValue: 0,
    lastSeen: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
    image: row.picture_url ? String(row.picture_url) : null,
  };
}

// Map a Product Analysis sample (Graylog-backed) into the same kiosk catalog
// shape as sampleRowToKioskProduct, so /api/products can surface it alongside
// the Postgres catalog for audit-mode search. `sample.name` already reflects any
// apiTitle edit (see sampleFromProduct).
function sampleProductToKioskProduct(sample: UnpricedSample): KioskProduct {
  return {
    productId: sample.productId,
    name: sample.name,
    priceRange: sample.price > 0 ? `$${sample.price.toFixed(2)}` : "",
    min_sku_original_price: sample.price,
    category: "",
    seller: sample.apiSeller || "Unknown seller",
    sampleCount: sample.sampleCount,
    estimatedRetailValue: sample.sampleValue,
    lastSeen: sample.lastSeen,
    image: sample.image,
  };
}

// Kiosk-fleet heartbeat state (in-memory; powers the dashboard's Fleet panel).
const kiosks = new Map<string, { lastSeen: number; disabled: boolean }>();

async function fetchCharacter() {
  try {
    const res = await fetch(CHARACTER_URL);
    if (!res.ok) throw new Error(`fetch failed with status ${res.status}`);
    const data = await res.json();
    return { data };
  } catch (err) {
    console.error("Fetch error:", err);
    return { error: err };
  }
}

async function logToGraylog(data: unknown) {
  try {
    let fullMessage = JSON.stringify(data);
    if (fullMessage.length > MAX_GELF_MESSAGE_SIZE) {
      fullMessage =
        fullMessage.substring(0, MAX_GELF_MESSAGE_SIZE - 25) + "... [TRUNCATED]";
    }
    const gelfMessage = {
      version: "1.1",
      host: "deno-app",
      short_message: `Fetched data from ${CHARACTER_URL}`,
      full_message: fullMessage,
      timestamp: Date.now() / 1000,
      _source: "fetchHandler",
    };
    await fetch(GRAYLOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gelfMessage),
    });
  } catch (logErr) {
    console.error("Graylog logging failed:", logErr);
  }
}

// Fetch demo page
async function handleFetchDemo(): Promise<Response> {
  const { data, error } = await fetchCharacter();
  if (error) return new Response("Error fetching data", { status: 500 });

  logToGraylog(data);

  const jsonText = JSON.stringify(data, null, 2).replace(/<\/script>/g, "<\\/script>");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Deno Fetch Demo</title></head>
<body>
  <h1>Deno Fetch Demo</h1>
  <p>Fetched JSON data from Firebase Realtime DB:</p>
  <pre id="data">${jsonText}</pre>
  <script>
    const fetchedData = JSON.parse(document.getElementById('data').textContent);
    console.log("Fetched JSON data:", fetchedData);
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function renderSPAShell(): Response {
  const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#070a12" />
  <title>Inventory Manager - Data Pimp</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    // Register the shadcn semantic color tokens the Kiosk uses (bg-card,
    // text-foreground, bg-primary, border-border, ...) against the dark theme
    // CSS variables below, so it matches the Inventory app (admin.thirsty.store).
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"] },
          borderColor: { DEFAULT: "hsl(var(--border) / <alpha-value>)" },
          colors: {
            border: "hsl(var(--border) / <alpha-value>)",
            input: "hsl(var(--input) / <alpha-value>)",
            ring: "hsl(var(--ring) / <alpha-value>)",
            background: "hsl(var(--background) / <alpha-value>)",
            foreground: "hsl(var(--foreground) / <alpha-value>)",
            primary: { DEFAULT: "hsl(var(--primary) / <alpha-value>)", foreground: "hsl(var(--primary-foreground) / <alpha-value>)" },
            secondary: { DEFAULT: "hsl(var(--secondary) / <alpha-value>)", foreground: "hsl(var(--secondary-foreground) / <alpha-value>)" },
            destructive: { DEFAULT: "hsl(var(--destructive) / <alpha-value>)", foreground: "hsl(var(--destructive-foreground) / <alpha-value>)" },
            muted: { DEFAULT: "hsl(var(--muted) / <alpha-value>)", foreground: "hsl(var(--muted-foreground) / <alpha-value>)" },
            accent: { DEFAULT: "hsl(var(--accent) / <alpha-value>)", foreground: "hsl(var(--accent-foreground) / <alpha-value>)" },
            success: { DEFAULT: "hsl(var(--success) / <alpha-value>)", foreground: "hsl(var(--success-foreground) / <alpha-value>)" },
            warning: { DEFAULT: "hsl(var(--warning) / <alpha-value>)", foreground: "hsl(var(--warning-foreground) / <alpha-value>)" },
            popover: { DEFAULT: "hsl(var(--popover) / <alpha-value>)", foreground: "hsl(var(--popover-foreground) / <alpha-value>)" },
            card: { DEFAULT: "hsl(var(--card) / <alpha-value>)", foreground: "hsl(var(--card-foreground) / <alpha-value>)" },
          },
          borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
        },
      },
    };
  </script>

  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.2.0",
      "react/": "https://esm.sh/react@18.2.0/",
      "react-dom": "https://esm.sh/react-dom@18.2.0",
      "react-dom/": "https://esm.sh/react-dom@18.2.0/",
      "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
      "react-router-dom": "https://esm.sh/react-router-dom@6.20.0?deps=react@18.2.0",
      "@tanstack/react-query": "https://esm.sh/@tanstack/react-query@5.12.0?deps=react@18.2.0",
      "lucide-react": "https://esm.sh/lucide-react@0.294.0?deps=react@18.2.0"
    }
  }
  </script>

  <style>
    /* Dark theme tokens, ported from the Inventory app (tiktok-sample-tracker
       src/index.css). Defined on :root so they apply regardless of the dark
       class; Tailwind's tokens above resolve hsl(var(--...)) against these. */
    :root {
      color-scheme: dark;
      --background: 222 47% 5%;
      --foreground: 210 40% 96%;
      --card: 218 24.4% 8.8%;
      --card-foreground: 210 40% 96%;
      --popover: 220 45% 8%;
      --popover-foreground: 210 40% 96%;
      --primary: 30 97% 61%;
      --primary-foreground: 222 47% 5%;
      --secondary: 38 92% 50%;
      --secondary-foreground: 222 47% 5%;
      --muted: 217 33% 17%;
      --muted-foreground: 220 20% 75%;
      --accent: 199 89% 60%;
      --accent-foreground: 222 47% 5%;
      --destructive: 0 72% 71%;
      --destructive-foreground: 0 60% 15%;
      --success: 142 71% 45%;
      --success-foreground: 144 61% 10%;
      --warning: 48 96% 53%;
      --warning-foreground: 220 20% 10%;
      --border: 217 32% 15%;
      --input: 217 32% 15%;
      --ring: 30 97% 61%;
      --radius: 0.5rem;
    }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: hsl(var(--background)); }
    ::-webkit-scrollbar-thumb { background: hsl(var(--muted)); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground)); }
    @keyframes spin { to { transform: rotate(360deg); } }
    .animate-spin { animation: spin 1s linear infinite; }
    /* Status badges (Fire Sale / Available / Checked Out) drop their colored
       tint for a uniform dark translucent fill, keeping their colored text and
       border. !important is required to beat the Tailwind Play CDN's own
       .bg-*\/15 utilities, which it injects into <head> after this block. The
       class names carry a literal backslash (Tailwind escapes the "/"), doubled
       here so the template literal emits a single "\". */
    .bg-primary\\/15,
    .bg-success\\/15,
    .bg-warning\\/15 {
      background-color: rgb(11 13 17 / 70%) !important;
    }
  </style>
</head>
<body class="bg-background text-foreground antialiased">
  <div id="root">
    <div class="min-h-screen bg-background flex items-center justify-center">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-muted-foreground">Loading Inventory Manager...</p>
      </div>
    </div>
  </div>
  <script type="module" src="/app.js"></script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

// Thirsty OS desktop shell — the front door at thirsty.store. Folders launch
// each app (the storefront, the sample tracker, etc.) in draggable windows.
function renderOSShell(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>Thirsty OS</title>
    <meta name="theme-color" content="#0b0d11">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&amp;family=Figtree:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/os.css">
  </head>
  <body>
    <main id="desktop" class="desktop" aria-label="Desktop">
      <div id="desktop-icons" class="desktop-icons" aria-label="Desktop items"></div>
    </main>
    <footer id="taskbar" class="taskbar" aria-label="Taskbar">
      <div class="taskbar-left">
        <span class="brand"><span class="brand-mark">◆</span> Thirsty&nbsp;OS</span>
        <span id="active-app" class="active-app" aria-live="polite" aria-atomic="true">Finder</span>
        <span id="menubar-status" class="mb-status"></span>
        <select id="role-switch" class="role-switch" aria-label="Profile" title="Switch profile">
          <option value="dj">DJ</option>
          <option value="ka">Karl · Warehouse</option>
        </select>
      </div>
      <div id="dock" class="dock" aria-label="Dock"></div>
      <div class="taskbar-right">
        <span id="clock" class="clock tnum"></span>
      </div>
    </footer>
    <script type="module" src="/os.js"></script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

// Escape a value for safe interpolation into HTML text and double-quoted
// attributes. The public product page below injects DB-sourced sample fields
// (name/brand/notes/picture_url) into markup, so every dynamic value goes
// through this first.
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Build the trimmed, copy-paste-friendly product page document. Mirrors the
// surface the Inventory app renders at admin.thirsty.store/p/<id>: product image
// (with "Copy image") plus Name / Brand / Price / Notes rows, each with a
// per-field copy button — and no BIN/affiliate/action chrome. `sample` is null
// for a missing product; `errored` flags a lookup failure (vs. a clean miss).
// Exported for the offline render test (scripts/verify-product-page.ts).
export function productPageDocument(
  sample: Record<string, unknown> | null,
  code: string,
  errored = false,
): string {
  const name = sample?.name != null ? String(sample.name) : "";
  const brand = sample?.brand != null ? String(sample.brand) : "";
  const notes = sample?.notes != null ? String(sample.notes) : "";
  // Only trust an absolute http(s) image URL: it flows into <img src>, og:image,
  // and the clipboard (copyImage), so reject javascript:/data:/relative values
  // (falls back to the "No image" placeholder).
  const rawPicture = sample?.picture_url != null ? String(sample.picture_url) : "";
  const picture = /^https?:\/\//i.test(rawPicture) ? rawPicture : "";
  // Postgres numerics can arrive as strings via node-pg; coerce defensively.
  // Treat <= 0 as unpriced (the rest of the codebase uses price > 0 as the
  // "has a price" test), so the row is omitted rather than advertising "$0.00".
  const rawPrice = sample?.current_price;
  const priceNum = rawPrice == null || rawPrice === "" ? null : Number(rawPrice);
  const price = priceNum != null && Number.isFinite(priceNum) && priceNum > 0
    ? `$${priceNum.toFixed(2)}`
    : null;

  const title = sample ? (name || "Product") : "Product not found";
  const desc = sample ? [brand, price].filter(Boolean).join(" · ") : "";

  // Name always renders; the rest only when present (matching the Inventory app).
  const fields: Array<[label: string, value: string, isPrice: boolean]> = [];
  if (sample) {
    fields.push(["Name", name, false]);
    if (brand) fields.push(["Brand", brand, false]);
    if (price) fields.push(["Price", price, true]);
    if (notes) fields.push(["Notes", notes, false]);
  }

  const fieldsHtml = fields.map(([label, value, isPrice]) =>
    `        <div class="row${isPrice ? " price" : ""}">
          <div class="col">
            <div class="label">${escapeHtml(label)}</div>
            <div class="value">${escapeHtml(value) || "&mdash;"}</div>
          </div>
          <button class="copy" type="button" data-copy="${escapeHtml(value)}" aria-label="Copy ${escapeHtml(label)}">Copy</button>
        </div>`
  ).join("\n");

  const mediaHtml = picture
    ? `<img src="${escapeHtml(picture)}" alt="${escapeHtml(name)}" />
        <button class="copy copy-image" type="button" data-copy-image="${escapeHtml(picture)}" aria-label="Copy image">Copy image</button>`
    : `<div class="placeholder">No image</div>`;

  const bodyHtml = sample
    ? `<main class="card">
        <div class="media">${mediaHtml}</div>
        <div class="fields">
${fieldsHtml}
        </div>
      </main>`
    : `<main class="card">
        <div class="empty">
          <h1>${errored ? "Temporarily unavailable" : "Product not found"}</h1>
          <p>${errored
            ? "Please try again in a moment."
            : `No sample matches <code>${escapeHtml(code)}</code>.`}</p>
        </div>
      </main>`;

  // og:image only when we have a picture, so link previews (eBay/social) get one.
  const ogImage = picture
    ? `\n  <meta property="og:image" content="${escapeHtml(picture)}" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#070a12" />
  <title>${escapeHtml(title)}</title>
  ${desc ? `<meta name="description" content="${escapeHtml(desc)}" />\n  ` : ""}<meta property="og:title" content="${escapeHtml(title)}" />
  ${desc ? `<meta property="og:description" content="${escapeHtml(desc)}" />\n  ` : ""}<meta property="og:type" content="product" />${ogImage}
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="https://assets.codepen.io/11817390/LifePreneur-logo.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    /* Dark theme tokens, shared with the Inventory app (tiktok-sample-tracker
       src/index.css) so the public page matches admin.thirsty.store/p/<id>. */
    :root {
      color-scheme: dark;
      --background: 222 47% 5%;
      --foreground: 210 40% 96%;
      --card: 218 24.4% 8.8%;
      --muted-foreground: 220 20% 75%;
      --primary: 30 97% 61%;
      --border: 217 32% 15%;
      --radius: 0.5rem;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem;
      background: hsl(var(--background)); color: hsl(var(--foreground));
      font: 16px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      width: 100%; max-width: 30rem; background: hsl(var(--card));
      border: 1px solid hsl(var(--border)); border-radius: calc(var(--radius) * 2);
      overflow: hidden; box-shadow: 0 18px 50px -22px rgba(0,0,0,.8);
    }
    .media {
      position: relative; aspect-ratio: 1 / 1; background: hsl(var(--background));
      display: grid; place-items: center;
    }
    .media img { width: 100%; height: 100%; object-fit: contain; }
    .media .placeholder { color: hsl(var(--muted-foreground)); font-size: .85rem; }
    .media .copy-image {
      position: absolute; right: .6rem; bottom: .6rem;
      background: hsl(var(--background) / .82); backdrop-filter: blur(4px);
    }
    .fields { padding: .5rem .85rem 1rem; }
    .row {
      display: flex; align-items: flex-start; gap: .75rem;
      padding: .8rem .15rem; border-bottom: 1px solid hsl(var(--border) / .6);
    }
    .row:last-child { border-bottom: 0; }
    .row .col { flex: 1 1 auto; min-width: 0; }
    .row .label {
      font-size: .68rem; text-transform: uppercase; letter-spacing: .06em;
      color: hsl(var(--muted-foreground)); margin-bottom: .2rem;
    }
    .row .value { font-size: 1rem; font-weight: 500; word-break: break-word; white-space: pre-wrap; }
    .row.price .value { color: hsl(var(--primary)); font-weight: 700; }
    button.copy {
      flex: 0 0 auto; cursor: pointer; border: 1px solid hsl(var(--border));
      background: transparent; color: hsl(var(--foreground)); border-radius: var(--radius);
      font: 600 .8rem/1 Inter, ui-sans-serif, system-ui, sans-serif;
      padding: .55rem .7rem; transition: color .15s, border-color .15s;
    }
    button.copy:hover { border-color: hsl(var(--primary)); color: hsl(var(--primary)); }
    button.copy.copied { border-color: hsl(var(--primary)); color: hsl(var(--primary)); }
    .empty { padding: 3.5rem 1.5rem; text-align: center; color: hsl(var(--muted-foreground)); }
    .empty h1 { color: hsl(var(--foreground)); font-size: 1.1rem; margin: 0 0 .5rem; }
    .empty code { color: hsl(var(--foreground)); }
  </style>
</head>
<body>
  ${bodyHtml}
  <script>
    (function () {
      function flash(btn, msg) {
        if (!btn.hasAttribute('data-label')) btn.setAttribute('data-label', btn.textContent);
        btn.textContent = msg;
        btn.classList.add('copied');
        clearTimeout(btn._t);
        btn._t = setTimeout(function () {
          btn.textContent = btn.getAttribute('data-label');
          btn.classList.remove('copied');
        }, 1400);
      }
      async function copyText(text, btn) {
        try { await navigator.clipboard.writeText(text); flash(btn, 'Copied'); }
        catch (_) { flash(btn, 'Copy failed'); }
      }
      async function copyImage(url, btn) {
        try {
          var blob = await (await fetch(url, { mode: 'cors' })).blob();
          if (typeof ClipboardItem === 'undefined') throw new Error('no ClipboardItem');
          await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
          flash(btn, 'Copied image');
        } catch (_) {
          try { await navigator.clipboard.writeText(url); flash(btn, 'Copied image URL'); }
          catch (_e) { flash(btn, 'Copy failed'); }
        }
      }
      document.addEventListener('click', function (e) {
        var btn = e.target.closest('button.copy');
        if (!btn) return;
        if (btn.hasAttribute('data-copy-image')) copyImage(btn.getAttribute('data-copy-image'), btn);
        else if (btn.hasAttribute('data-copy')) copyText(btn.getAttribute('data-copy'), btn);
      });
    })();
  </script>
</body>
</html>`;
}

// Defense-in-depth headers for the public product page. No X-Frame-Options: the
// page is meant to be embeddable in eBay listings; nosniff + a privacy-preserving
// referrer policy are safe to send and cheap insurance behind the output escaping.
const PRODUCT_PAGE_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};

// Look up a sample by its TikTok product id (qr_code, the value used in the
// bare-digit URL) in the shared Postgres this deployment owns and render the
// trimmed public product page. In thin-client mode (no local DB) defer to the
// central deployment, mirroring the /api/* proxy.
async function renderPublicProductPage(code: string, req: Request, url: URL): Promise<Response> {
  if (REMOTE_API && new URL(REMOTE_API).host !== url.host) {
    return await proxyApi(req, url);
  }
  let sample: Record<string, unknown> | null = null;
  try {
    const rows = await Samples.filter({ qr_code: code }, undefined, 1);
    sample = (rows[0] as Record<string, unknown>) ?? null;
    // Fail closed: db.ts's buildWhere silently drops a filter key that isn't a
    // known column, which would turn this into "newest sample" for any digit
    // URL. Only treat a row as a match when its qr_code actually equals `code`.
    if (sample && String(sample.qr_code) !== code) sample = null;
  } catch (err) {
    console.error(`product page lookup failed for ${code}:`, err);
    return new Response(productPageDocument(null, code, true), {
      status: 503,
      headers: { ...PRODUCT_PAGE_HEADERS, "cache-control": "no-store" },
    });
  }
  return new Response(productPageDocument(sample, code), {
    status: sample ? 200 : 404,
    headers: {
      ...PRODUCT_PAGE_HEADERS,
      // Short shared cache for found products (good for link-preview crawlers /
      // embeds); never cache a miss so a freshly-added sample shows up promptly.
      "cache-control": sample ? "public, max-age=60" : "no-store",
    },
  });
}

// Serve a local file (cached in-memory, refreshed when its mtime changes).
// Used for the client bundle (/app.js) and the Thirsty OS shell assets.
const fileCache = new Map<string, { text: string; mtimeMs: number | null }>();

async function serveLocalFile(relPath: string, contentType: string) {
  const fileUrl = new URL(relPath, import.meta.url);
  try {
    const stat = await Deno.stat(fileUrl);
    const mtimeMs = stat.mtime ? stat.mtime.getTime() : null;
    const cached = fileCache.get(relPath);
    if (!cached || cached.mtimeMs !== mtimeMs) {
      fileCache.set(relPath, { text: await Deno.readTextFile(fileUrl), mtimeMs });
    }
  } catch {
    if (!fileCache.has(relPath)) {
      fileCache.set(relPath, { text: await Deno.readTextFile(fileUrl), mtimeMs: null });
    }
  }
  return new Response(fileCache.get(relPath)?.text ?? "", {
    status: 200,
    headers: { "content-type": contentType, "cache-control": "no-store" },
  });
}

// --- Product image resolution via ScrapeCreators (TikTok Shop) ---------------
// Older samples were created by a price-only fetch and have picture_url = null.
// We resolve the real product image on demand from the TikTok Shop PDP (see
// product-image.ts) and backfill it into Postgres so it is fetched only once.
// Runs on the central deployment (which has DATABASE_URL); kiosks reach it via
// the /api/* proxy above.
async function resolveSampleImage(id: string): Promise<string | null> {
  const rows = await Samples.filter({ id }, undefined, 1);
  const sample = rows[0];
  if (!sample) return null;
  if (sample.picture_url) return sample.picture_url as string;

  const pdpUrl = pdpUrlForSample(sample);
  if (!pdpUrl) return null;

  const imageUrl = await fetchProductImage(pdpUrl);
  if (!imageUrl) return null;

  // Backfill so the image is saved permanently (best-effort).
  try {
    await Samples.update(String(sample.id), { picture_url: imageUrl });
  } catch (err) {
    console.error(`Failed to backfill picture_url for sample ${id}:`, err);
  }
  return imageUrl;
}

// The legacy data-pimp surface: Thirsty OS shell, /kiosk, /inventory, the React
// SPA bundle, and the whole /api/* + DB/proxy/Graylog stack. Exported so the
// Fresh-composition entry at the bottom of this file can delegate to it.
export async function legacyHandler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname.toLowerCase();

  // Client app + Thirsty OS shell assets. The React bundle is stored as
  // static/app.bundle (no .js extension) so `deno compile --include static`
  // treats it as a data file instead of trying to resolve its browser imports
  // (react-dom/client etc.) as a Deno module.
  if (pathname === "/app.js") {
    return await serveLocalFile("./static/app.bundle", "text/javascript; charset=utf-8");
  }
  if (pathname === "/os.js") {
    return await serveLocalFile("./static/os.js", "text/javascript; charset=utf-8");
  }
  if (pathname === "/os.css") {
    return await serveLocalFile("./static/os.css", "text/css; charset=utf-8");
  }

  // Product Analysis dashboard (migrated from the kiosk) + its assets.
  if (pathname === "/inventory" || pathname === "/inventory.html") {
    return await serveLocalFile("./static/inventory.html", "text/html; charset=utf-8");
  }
  // tok-scrape extension install help (download chrome.zip + load-unpacked).
  // Same-origin so the OS opens it in a normal (unsandboxed) window and the
  // download link works. Surfaced by the samples-import skill / the Apps folder.
  if (pathname === "/install" || pathname === "/install.html") {
    return await serveLocalFile("./static/install.html", "text/html; charset=utf-8");
  }
  if (pathname === "/ui.js") {
    return await serveLocalFile("./static/ui.js", "text/javascript; charset=utf-8");
  }
  if (pathname === "/styles.css") {
    return await serveLocalFile("./static/styles.css", "text/css; charset=utf-8");
  }

  // Debug
  if (pathname === "/__debug") {
    return json({
      host: req.headers.get("host"),
      app: Deno.env.get("DENO_DEPLOY_APP_SLUG"),
      deploymentId: Deno.env.get("DENO_DEPLOYMENT_ID"),
      buildId: Deno.env.get("DENO_DEPLOY_BUILD_ID"),
      db: redactedDbUrl(),
    });
  }

  // DB debug
  if (pathname === "/__dbdebug") {
    const client = await pool.connect();
    try {
      const meta = await client.query(`
        select
          current_database() as db,
          current_user as user,
          current_schema() as schema,
          current_setting('search_path') as search_path
      `);

      const tables = await client.query(`
        select table_schema, table_name
        from information_schema.tables
        where table_type='BASE TABLE'
          and table_schema not in ('pg_catalog','information_schema')
        order by table_schema, table_name
        limit 25
      `);

      return json({ meta: meta.rows[0], tables: tables.rows });
    } finally {
      client.release();
    }
  }

  // Token-protected counts
  if (pathname === "/__counts") {
    const token = url.searchParams.get("token");
    const expected = Deno.env.get("DEBUG_TOKEN");
    if (!expected || !token || token !== expected) return new Response("forbidden", { status: 403 });

    const client = await pool.connect();
    try {
      const counts: Record<string, number> = {};
      for (const t of TABLES) {
        const r = await client.query(`select count(*)::bigint as count from public.${t}`);
        counts[t] = Number.parseInt(r.rows[0].count, 10);
      }
      return json({ counts });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    } finally {
      client.release();
    }
  }

  // Fetch demo
  if (pathname === "/fetch-demo") return await handleFetchDemo();

  // Thin-client mode: forward every API call to the central deployment.
  // Skip if the upstream is ourselves (misconfig guard against a proxy loop).
  if (
    REMOTE_API && pathname.startsWith("/api/") &&
    new URL(REMOTE_API).host !== url.host
  ) {
    return await proxyApi(req, url);
  }

  // API
  if (pathname.startsWith("/api/")) {
    try {
      // Samples
      if (pathname === "/api/samples") {
        if (req.method === "GET") {
          const orderBy = url.searchParams.get("order_by") || "-created_date";
          const filters: Record<string, string> = {};
          for (const [key, value] of url.searchParams.entries()) {
            if (key !== "order_by" && key !== "limit") filters[key] = value;
          }
          const limit = url.searchParams.get("limit")
            ? parseInt(url.searchParams.get("limit")!, 10)
            : undefined;

          const data = Object.keys(filters).length > 0
            ? await Samples.filter(filters, orderBy, limit)
            : await Samples.list(orderBy);

          return json(data);
        }
        if (req.method === "POST") {
          const body = await req.json();
          const created = await Samples.create(body);
          return json(created, 201);
        }
      }

      // Resolve (and backfill) a sample's product image via ScrapeCreators
      const sampleImageMatch = pathname.match(/^\/api\/samples\/([^/]+)\/image$/);
      if (sampleImageMatch) {
        const id = sampleImageMatch[1];
        if (req.method === "GET") {
          const picture_url = await resolveSampleImage(id);
          return json({ id, picture_url });
        }
      }

      const sampleMatch = pathname.match(/^\/api\/samples\/([^/]+)$/);
      if (sampleMatch) {
        const id = sampleMatch[1];
        if (req.method === "PATCH") {
          const body = await req.json();
          const updated = await Samples.update(id, body);
          return json(updated);
        }
        if (req.method === "DELETE") {
          await Samples.delete(id);
          return new Response(null, { status: 204 });
        }
      }

      // Bundles
      if (pathname === "/api/bundles") {
        if (req.method === "GET") {
          const orderBy = url.searchParams.get("order_by") || "-created_date";
          const filters: Record<string, string> = {};
          for (const [key, value] of url.searchParams.entries()) {
            if (key !== "order_by") filters[key] = value;
          }

          const data = Object.keys(filters).length > 0
            ? await Bundles.filter(filters)
            : await Bundles.list(orderBy);

          return json(data);
        }
        if (req.method === "POST") {
          const body = await req.json();
          const created = await Bundles.create(body);
          return json(created, 201);
        }
      }

      const bundleMatch = pathname.match(/^\/api\/bundles\/([^/]+)$/);
      if (bundleMatch) {
        const id = bundleMatch[1];
        if (req.method === "PATCH") {
          const body = await req.json();
          const updated = await Bundles.update(id, body);
          return json(updated);
        }
        if (req.method === "DELETE") {
          await Bundles.delete(id);
          return new Response(null, { status: 204 });
        }
      }

      // Transactions
      if (pathname === "/api/transactions") {
        if (req.method === "GET") {
          const orderBy = url.searchParams.get("order_by") || "-created_date";
          const limit = url.searchParams.get("limit")
            ? parseInt(url.searchParams.get("limit")!, 10)
            : undefined;

          const filters: Record<string, string> = {};
          for (const [key, value] of url.searchParams.entries()) {
            if (key !== "order_by" && key !== "limit") filters[key] = value;
          }

          const data = await InventoryTransactions.filter(filters, orderBy, limit);
          return json(data);
        }
        if (req.method === "POST") {
          const body = await req.json();
          const created = await InventoryTransactions.create(body);
          return json(created, 201);
        }
      }

      const transactionMatch = pathname.match(/^\/api\/transactions\/([^/]+)$/);
      if (transactionMatch && req.method === "DELETE") {
        await InventoryTransactions.delete(transactionMatch[1]);
        return new Response(null, { status: 204 });
      }

      // ---- Migrated from thirsty-store-kiosk ----

      // Catalog: durable, Postgres-backed (the data already lives in `samples`).
      // Consumed cross-origin by the tracker, so it carries CORS.
      if (pathname === "/api/products") {
        const limit = url.searchParams.get("limit")
          ? parseInt(url.searchParams.get("limit")!, 10)
          : undefined;
        const rows = await Samples.list("-created_at") as Record<string, unknown>[];
        const base = rows
          .map(sampleRowToKioskProduct)
          .filter((p) => p.productId && p.name);

        // Fold the live Product Analysis backlog (Graylog-backed) into the
        // catalog so audit-mode search in the tracker can match samples that
        // exist only in Graylog -- not yet in this Postgres snapshot. Deduped by
        // productId with the Postgres catalog winning on overlap (both key on
        // the TikTok product id -- see seed-from-kiosk.ts). When the merge
        // succeeds we return the full union so every sample stays searchable;
        // `limit` only bounds the Postgres-only catalog we fall back to when
        // Graylog is unavailable (the merge must never take the catalog down).
        try {
          const byId = new Map(base.map((p) => [p.productId, p]));
          for (const sample of await listSampleProducts()) {
            if (!sample.productId || !sample.name || byId.has(sample.productId)) {
              continue;
            }
            byId.set(sample.productId, sampleProductToKioskProduct(sample));
          }
          return corsJson([...byId.values()]);
        } catch (error) {
          console.error("Product Analysis merge into /api/products failed:", error);
          return corsJson(limit ? base.slice(0, limit) : base);
        }
      }

      // Live ScrapeCreators detail lookup by product id. Consumed cross-origin
      // by the tracker's "Fetch from API" button (admin.thirsty.store), so it
      // carries CORS like /api/products. Unlike /api/unpriced-samples/:id/
      // fetch-price it does not require the product to exist in Graylog -- the
      // tracker's samples live only in Postgres. A simple GET needs no preflight.
      const lookupMatch = url.pathname.match(/^\/api\/product-lookup\/([^/]+)$/i);
      if (lookupMatch) {
        if (req.method !== "GET") {
          return corsJson({ ok: false, error: "Method not allowed" }, 405);
        }
        const id = decodeURIComponent(lookupMatch[1]);
        const name = url.searchParams.get("name") || undefined;
        try {
          return corsJson(await lookupProductDetails(id, name));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return corsJson({ ok: false, error: msg }, 502);
        }
      }

      // Scanned-barcode lookup for the tracker's Barcode Test page: resolve a
      // UPC to a product name via UPCitemdb (falling back to Go-UPC, Barcode
      // Lookup, Open Food Facts, then SerpApi Google Shopping + Google Lens),
      // then find the matching TikTok product via ScrapeCreators. ?debug=1 echoes
      // the raw SerpApi payloads. Cross-origin GET, carries CORS.
      const upcMatch = url.pathname.match(/^\/api\/upc-lookup\/([^/]+)$/i);
      if (upcMatch) {
        if (req.method !== "GET") {
          return corsJson({ ok: false, error: "Method not allowed" }, 405);
        }
        const upc = decodeURIComponent(upcMatch[1]);
        // ?debug=1 echoes the raw SerpApi payloads in the response for diagnosing
        // why the Lens/Shopping fallbacks did or didn't resolve a code.
        const debug = url.searchParams.get("debug") === "1";
        try {
          return corsJson(await lookupProductByUpc(upc, { origin: url.origin, debug }));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return corsJson({ ok: false, upc, error: msg }, 502);
        }
      }

      // Image lookup for the tracker's "search by image" path: resolve a product
      // IMAGE (URL) to a TikTok product via SerpApi Google Lens (type=products /
      // exact_matches) → candidate names → ScrapeCreators. Gated on
      // SERPAPI_API_KEY, cached by image URL. ?debug=1 echoes the raw Lens
      // payload (bypassing the cache). Accepts GET ?url= or POST {url}; carries
      // CORS + an OPTIONS preflight for the cross-origin JSON POST.
      if (pathname === "/api/image-lookup") {
        if (req.method === "OPTIONS") return corsPreflight();
        if (req.method !== "GET" && req.method !== "POST") {
          return corsJson({ ok: false, error: "Method not allowed" }, 405);
        }
        let imageUrl = url.searchParams.get("url") || url.searchParams.get("image") || "";
        let debug = url.searchParams.get("debug") === "1";
        if (req.method === "POST") {
          const body = await readJsonBody(req);
          if (!imageUrl && typeof body.url === "string") imageUrl = body.url;
          if (!imageUrl && typeof body.image === "string") imageUrl = body.image;
          if (body.debug === true || body.debug === "1" || body.debug === 1) debug = true;
        }
        imageUrl = imageUrl.trim();
        if (!imageUrl) {
          return corsJson(
            {
              ok: false,
              error: "image url is required (?url= / ?image= or POST {url})",
            },
            400,
          );
        }
        try {
          const result = await lookupProductByImage(imageUrl, { debug });
          // SERPAPI_API_KEY unset → the feature is unavailable, not a bad request.
          const status = !result.ok && /SERPAPI_API_KEY/.test(result.error || "")
            ? 503
            : 200;
          return corsJson(result, status);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return corsJson({ ok: false, imageUrl, error: msg }, 502);
        }
      }

      // Resolve a pasted/shared TikTok product-page URL to a product for the
      // inventory app (admin.thirsty.store), which saves it as a sample. Extract
      // the numeric product id from the url (following vt/vm/t.tiktok.com short
      // links server-side), then run the same ScrapeCreators lookup
      // /api/product-lookup uses. A bad/non-TikTok url or one with no id is a 400;
      // a ScrapeCreators outage is a 502. ?debug=1 echoes the raw ScrapeCreators
      // payload. Cross-origin GET, carries CORS.
      if (pathname === "/api/product-by-url") {
        if (req.method !== "GET") {
          return corsJson({ ok: false, error: "Method not allowed" }, 405);
        }
        const rawUrl = (url.searchParams.get("url") || "").trim();
        if (!rawUrl) {
          return corsJson(
            { ok: false, error: "url is required (?url=<tiktok product url>)" },
            400,
          );
        }
        const resolved = await resolveTiktokProductUrl(rawUrl);
        if (!resolved.ok) {
          return corsJson({ ok: false, error: resolved.error }, 400);
        }
        const debug = url.searchParams.get("debug") === "1";
        try {
          return corsJson(
            await lookupProductByTiktokUrl(resolved.productId, { debug }),
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return corsJson(
            {
              ok: false,
              productId: resolved.productId,
              source: "tiktok",
              error: msg,
            },
            502,
          );
        }
      }

      // Image lookup variant for the inventory app's "Find by photo" flow:
      // resolve a public product IMAGE (URL) to ranked candidates in the same
      // UpcMatch shape /api/upc-lookup returns. SerpApi Google Lens visual
      // matches are mapped to UpcMatch and any that resolve to a TikTok Shop
      // listing (via ScrapeCreators) are boosted and tagged source:"tiktok";
      // match == candidates[0]. Gated on SERPAPI_API_KEY, cached by image URL.
      // ?debug=1 echoes the raw Lens payload (mirrors upc-lookup), bypassing the
      // cache. Cross-origin GET; carries CORS + an OPTIONS preflight.
      if (pathname === "/api/lens-lookup") {
        if (req.method === "OPTIONS") return corsPreflight();
        if (req.method !== "GET") {
          return corsJson({ ok: false, error: "Method not allowed" }, 405);
        }
        const image =
          (url.searchParams.get("image") || url.searchParams.get("url") || "").trim();
        const debug = url.searchParams.get("debug") === "1";
        // The image must be a public http(s) URL Lens can fetch — reject missing
        // or non-http(s) values up front rather than handing SerpApi garbage.
        let validImage = false;
        if (image) {
          try {
            const proto = new URL(image).protocol;
            validImage = proto === "http:" || proto === "https:";
          } catch {
            validImage = false;
          }
        }
        if (!validImage) {
          return corsJson(
            {
              ok: false,
              error: "image must be an http(s) URL (?image=<url-encoded url>)",
            },
            400,
          );
        }
        try {
          const result = await lookupProductByLens(image, { debug });
          // SERPAPI_API_KEY unset → the feature is unavailable, not a bad request.
          const status = !result.ok && /SERPAPI_API_KEY/.test(result.error || "")
            ? 503
            : 200;
          return corsJson(result, status);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return corsJson({ ok: false, image, error: msg }, 502);
        }
      }

      // Keyword search for the inventory app's catalog search box: resolve a
      // free-text query to ranked TikTok Shop listings (via ScrapeCreators) in
      // the same UpcMatch shape /api/upc-lookup returns; match == candidates[0].
      // Gated on SCRAPECREATORS_API_KEY, cached by (query, limit). Optional
      // ?limit= (1..50, default 20). ?debug=1 echoes the raw ScrapeCreators
      // payload, bypassing the cache. Cross-origin GET; carries CORS + an OPTIONS
      // preflight.
      if (pathname === "/api/product-search") {
        if (req.method === "OPTIONS") return corsPreflight();
        if (req.method !== "GET") {
          return corsJson({ ok: false, error: "Method not allowed" }, 405);
        }
        // Collapse internal whitespace + trim, matching lookupProductsByKeyword's
        // own normalization so the echoed `query` is identical across 200/503/502.
        const query = (url.searchParams.get("q") || url.searchParams.get("query") || "")
          .replace(/\s+/g, " ")
          .trim();
        if (!query) {
          return corsJson(
            { ok: false, error: "q is required (?q=<search terms>)" },
            400,
          );
        }
        const debug = url.searchParams.get("debug") === "1";
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam ? Number(limitParam) : undefined;
        try {
          const result = await lookupProductsByKeyword(query, { limit, debug });
          // SCRAPECREATORS_API_KEY unset → the feature is unavailable, not a bad
          // request (mirrors /api/lens-lookup's SERPAPI_API_KEY handling).
          const status =
            !result.ok && /SCRAPECREATORS_API_KEY/.test(result.error || "")
              ? 503
              : 200;
          return corsJson(result, status);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return corsJson({ ok: false, query, error: msg }, 502);
        }
      }

      // Render a UPC as a barcode PNG. Backs the UPC lookup's Google Lens
      // fallback: SerpApi fetches this image so Lens can decode the barcode and
      // match products no UPC database indexes. Public GET (image, not JSON).
      const barcodeMatch = url.pathname.match(/^\/api\/barcode\/([^/]+?)\.png$/i);
      if (barcodeMatch) {
        if (req.method !== "GET") {
          return corsJson({ ok: false, error: "Method not allowed" }, 405);
        }
        const upc = decodeURIComponent(barcodeMatch[1]).replace(/\D/g, "");
        try {
          const png = await renderBarcodePng(upc);
          return new Response(png, {
            status: 200,
            headers: {
              "content-type": "image/png",
              "cache-control": "public, max-age=86400",
              "access-control-allow-origin": "*",
            },
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return corsJson({ ok: false, upc, error: msg }, 400);
        }
      }

      // Product Analysis dashboard endpoints (Graylog-backed; degrade to empty
      // when GRAYLOG_* env is unset, exactly as on the kiosk).
      if (pathname === "/api/health") {
        const graylog = graylogConfigFromEnv();
        return json({
          ok: true,
          graylogConfigured: Boolean(graylog),
          graylogStreamId: graylog?.streamId || null,
          graylogRangeSeconds: graylog?.rangeSeconds || null,
          scrapeCreatorsConfigured: Boolean(
            envValue("SCRAPECREATORS_API_KEY") || envValue("API_KEY"),
          ),
        });
      }

      if (pathname.startsWith("/api/product/")) {
        // Extract the id from the RAW path; the lowercased `pathname` would
        // corrupt any product id containing letters (the kiosk used raw too).
        const id = decodeURIComponent(url.pathname.split("/").pop() || "");
        const product = await fetchProductWithEdits(id);
        if (!product) return json({ ok: false, error: "Product not found in Graylog" }, 404);
        return json(product);
      }

      if (pathname === "/api/unpriced-samples") {
        return json(await listUnpricedSamples(
          url.searchParams.get("query") || "",
          Number(url.searchParams.get("limit") || 100),
        ));
      }

      if (pathname === "/api/sample-products") {
        if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
        return json(await upsertSampleProduct(await readJsonBody(req)));
      }

      // Match against the RAW path so captured ids keep their original case.
      const unpricedMatch = url.pathname.match(/^\/api\/unpriced-samples\/([^/]+)$/i);
      if (unpricedMatch) {
        if (req.method !== "PATCH") return json({ ok: false, error: "Method not allowed" }, 405);
        return json(await updateSamplePrice(decodeURIComponent(unpricedMatch[1]), await readJsonBody(req)));
      }

      const fetchPriceMatch = url.pathname.match(/^\/api\/unpriced-samples\/([^/]+)\/fetch-price$/i);
      if (fetchPriceMatch) {
        if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
        try {
          return json(await fetchPriceForSample(decodeURIComponent(fetchPriceMatch[1])));
        } catch (error) {
          // A ScrapeCreators miss/outage (or a product missing from Graylog)
          // must not surface as a raw 500 stack trace -- return a clean error
          // like the sibling /api/product-lookup and /api/upc-lookup routes so
          // the row simply stays unpriced.
          const msg = error instanceof Error ? error.message : String(error);
          return json({ ok: false, error: msg }, 502);
        }
      }

      if (pathname === "/api/comparison") {
        return json(await fetchComparisonWithEdits());
      }

      if (pathname === "/api/sample-valuation") {
        return json(await fetchSampleValuationWithEdits());
      }

      // ---- Sample lifecycle (status changes + resale revenue) ----
      // Backs the sample-lifecycle skill / thirsty-samples MCP. Writes inventory
      // truth to Postgres AND an analytics event to Graylog (see core/lifecycle.ts).
      // Open like the sibling sample/transaction writes — no auth gate by design.

      // The synced status vocabulary, so callers validate against one source.
      if (pathname === "/api/sample-statuses") {
        return json(listSampleStatuses());
      }

      // Distinct creator handles seen in Graylog — the live attribution list for
      // the sold flow (mirrors graylog-query's `--terms creator`).
      if (pathname === "/api/creators") {
        const raw = Number(url.searchParams.get("limit"));
        const limit = Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 1000;
        return json({ creators: await fetchKnownCreators(limit) });
      }

      // Creators who ordered a given product (the derived assigned-creator
      // dropdown). ?all=1 unions in every known creator so an admin can also
      // assign someone who hasn't ordered it yet. Derived from affiliate-export
      // (the only source with product_id + creator) — see fetchCreatorsForProduct.
      // CORS — read cross-origin by the Samples-Import demo (easierbycode.com).
      if (pathname === "/api/product-creators") {
        if (req.method === "OPTIONS") return corsPreflight();
        const productId = (url.searchParams.get("productId") ||
          url.searchParams.get("product") || "").trim();
        if (!productId) {
          return corsJson({ ok: false, error: "productId is required" }, 400);
        }
        const raw = Number(url.searchParams.get("limit"));
        const limit = Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 1000;
        // Optional product name → also include creators who ORDERED it (order
        // scrapes carry a display-name `_creator` + `_default_product` but no
        // numeric product_id, so it's a name match — see fetchOrderCreatorsByName).
        const name = (url.searchParams.get("name") || "").trim();
        const ordered = await fetchCreatorsForProduct(productId, limit);
        const orderCreators = name
          ? await fetchOrderCreatorsByName(name, limit)
          : [];
        const all = url.searchParams.get("all") === "1"
          ? await fetchKnownCreators(limit)
          : undefined;
        const merged = [
          ...new Set([...ordered, ...orderCreators, ...(all || [])]),
        ];
        return corsJson({
          productId,
          orderedCreators: ordered,
          orderCreators,
          ...(all ? { allKnown: all, creators: merged } : { creators: merged }),
          note:
            "orderedCreators come from affiliate-export (creator = agency label); orderCreators come from order scrapes matched by product name (creator = buyer display name) — neither is guaranteed to be a TikTok @handle.",
        });
      }

      // Update a sample's status (rejects "sold" — that goes through the sold
      // flow so revenue is attributed to a creator). Validation failures return
      // a clean 400 (not the outer 500 + stack) so the MCP surfaces the reason.
      if (pathname === "/api/sample-status") {
        if (req.method !== "POST") {
          return json({ ok: false, error: "Method not allowed" }, 405);
        }
        try {
          return json(await recordSampleStatus(await readJsonBody(req)));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return json({ ok: false, error: msg }, 400);
        }
      }

      // Mark a sample sold and attribute the resale revenue to a creator.
      // CORS: the LP Sample Tracker (admin.thirsty.store) POSTs here cross-origin
      // in graylogOnly mode to attribute resale revenue per creator.
      if (pathname === "/api/sample-sold") {
        if (req.method === "OPTIONS") return corsPreflight();
        if (req.method !== "POST") {
          return corsJson({ ok: false, error: "Method not allowed" }, 405);
        }
        try {
          return corsJson(await recordSampleSold(await readJsonBody(req)));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return corsJson({ ok: false, error: msg }, 400);
        }
      }

      // List a sample on a resale marketplace — analytics-only Graylog event
      // (the step between the content-GMV and resale-net questions). No Postgres
      // status change: a listing is intent-to-sell, not an inventory state.
      if (pathname === "/api/sample-listing") {
        if (req.method !== "POST") {
          return json({ ok: false, error: "Method not allowed" }, 405);
        }
        try {
          return json(await recordSampleListing(await readJsonBody(req)));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return json({ ok: false, error: msg }, 400);
        }
      }

      // Mark a BULK lot sold: one sale across N samples, attributed per-creator.
      // Allocates the total + emits one sample_sold_json per sample (tagged with
      // a shared bulk_id), so existing revenue queries include bulk lots.
      if (pathname === "/api/sample-bulk-sold") {
        if (req.method !== "POST") {
          return json({ ok: false, error: "Method not allowed" }, 405);
        }
        try {
          return json(await recordBulkSampleSold(await readJsonBody(req)));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return json({ ok: false, error: msg }, 400);
        }
      }

      // Agency intake: credit a bulk lot of one product to an agency bucket
      // (reserved), before any creator is assigned.
      if (pathname === "/api/agency-intake") {
        if (req.method !== "POST") {
          return json({ ok: false, error: "Method not allowed" }, 405);
        }
        try {
          return json(await recordAgencyIntake(await readJsonBody(req)));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return json({ ok: false, error: msg }, 400);
        }
      }

      // Fulfillment: assign a unit to a creator → checked out (+ campaign match
      // + enrichment note). Returns the note for the admin.
      if (pathname === "/api/sample-assign") {
        if (req.method !== "POST") {
          return json({ ok: false, error: "Method not allowed" }, 405);
        }
        try {
          return json(await recordSampleAssignment(await readJsonBody(req)));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return json({ ok: false, error: msg }, 400);
        }
      }

      // Import a product as a NEW sample assigned to a creator — the
      // Samples-Import demo loop. Called cross-origin (easierbycode.com) → CORS.
      if (pathname === "/api/sample-import") {
        if (req.method === "OPTIONS") return corsPreflight();
        if (req.method !== "POST") {
          return corsJson({ ok: false, error: "Method not allowed" }, 405);
        }
        try {
          return corsJson(await recordSampleImport(await readJsonBody(req)));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return corsJson({ ok: false, error: msg }, 400);
        }
      }

      // Kiosk-fleet heartbeat (in-memory; powers the dashboard's Fleet panel).
      if (pathname === "/api/heartbeat") {
        const id = req.headers.get("x-kiosk-id") || "unknown";
        const existing = kiosks.get(id);
        kiosks.set(id, { lastSeen: Date.now(), disabled: existing?.disabled || false });
        return json({ ok: true, disabled: kiosks.get(id)?.disabled || false });
      }
      if (pathname === "/api/kiosks") {
        return json([...kiosks.entries()].map(([id, k]) => ({
          id,
          lastSeen: k.lastSeen,
          online: !k.disabled && Date.now() - k.lastSeen < 15000,
          disabled: k.disabled,
        })));
      }
      if (pathname.startsWith("/api/kiosks/") && pathname.endsWith("/disable")) {
        // Raw path id, to match the (case-preserving) x-kiosk-id heartbeat key.
        const id = url.pathname.split("/")[3];
        const existing = kiosks.get(id);
        kiosks.set(id, { lastSeen: existing?.lastSeen || 0, disabled: true });
        return json({ ok: true, id, disabled: true });
      }
      if (pathname.startsWith("/api/kiosks/") && pathname.endsWith("/enable")) {
        const id = url.pathname.split("/")[3];
        const existing = kiosks.get(id);
        kiosks.set(id, { lastSeen: existing?.lastSeen || Date.now(), disabled: false });
        return json({ ok: true, id, disabled: false });
      }

      return json({ error: "API endpoint not found" }, 404);
    } catch (error) {
      console.error("API error:", error);
      const msg = error instanceof Error ? (error.stack || error.message) : String(error);
      return json({ error: msg }, 500);
    }
  }

  // The storefront SPA now lives under /kiosk (its BrowserRouter uses
  // basename="/kiosk"); serve its shell for /kiosk and any client-routed path.
  if (pathname === "/kiosk" || pathname.startsWith("/kiosk/")) return renderSPAShell();

  // Public product page: a bare, all-digits path (the TikTok product id, 10+
  // digits so it can't collide with real store routes) renders the trimmed,
  // shareable sample page — the same surface as admin.thirsty.store/p/<id> — so
  // a thirsty.store/<id> link can be shared/embedded in eBay listings. An
  // optional trailing slash is tolerated so a copy-pasted ".../<id>/" still works.
  const productPageMatch = url.pathname.match(/^\/(\d{10,})\/?$/);
  if (productPageMatch && (req.method === "GET" || req.method === "HEAD")) {
    return await renderPublicProductPage(productPageMatch[1], req, url);
  }

  // Thirsty OS desktop owns the root; unknown routes fall back to it too.
  return renderOSShell();
}

// ── Fresh 2.3 member app ─────────────────────────────────────────────────────
// The member dashboard is a vendored Fresh 2.3 app (./member) built to
// member/_fresh by `deno task member:build`. We mount it same-origin under
// /member and delegate everything else to legacyHandler. Loaded dynamically so
// the rest of the server still boots if the Fresh app hasn't been built yet.
//
// Fresh's basePath ("/member") prefixes routes and the island bootstrap JS, but
// CSS <link>s and asset() statics still emit at the document root (/assets/*,
// /logo.svg, /lp-logo.png). The basePath'd Fresh server serves those under
// /member, so we hoist the root-emitted asset paths back under /member here.
type FetchFn = (req: Request) => Response | Promise<Response>;

let memberFetch: FetchFn | null = null;
let memberLoadError: string | null = null;
try {
  const mod = await import("./member/_fresh/server.js");
  memberFetch = (mod.default as { fetch: FetchFn }).fetch;
} catch (err) {
  memberLoadError = err instanceof Error ? err.message : String(err);
  console.warn(
    "[thirsty-os] /member is unavailable — run `deno task member:build` to build the Fresh member app.",
    memberLoadError,
  );
}

function memberOwnsPath(p: string): boolean {
  return p === "/member" || p.startsWith("/member/") ||
    p.startsWith("/assets/") || p === "/logo.svg" || p === "/lp-logo.png";
}

// The Fresh member app failed to load (its build output, member/_fresh, wasn't
// present at startup — it's git-ignored and produced by `deno task build`).
// Serve a clear notice for the member routes instead of letting them fall
// through to legacyHandler, which would render the entire Thirsty OS desktop
// shell inside the member window (the "Member/Web opens Finder" bug).
function renderMemberUnavailable(): Response {
  const headers: Record<string, string> = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  };
  if (memberLoadError) {
    headers["x-member-load-error"] = memberLoadError.slice(0, 200);
  }
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>Member app not built</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: #0b0d11; color: #e8eaed; padding: 2rem;
        font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      .card {
        max-width: 32rem; text-align: center; background: #14181f;
        border: 1px solid #232a35; border-radius: 16px; padding: 2rem 1.75rem;
      }
      h1 { font-size: 1.15rem; margin: 0 0 .65rem; }
      p { margin: .5rem 0; color: #aab3c0; }
      code {
        background: #0b0d11; border: 1px solid #232a35; border-radius: 6px;
        padding: .15rem .4rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: .9em; color: #e8eaed;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Member app isn't built yet</h1>
      <p>The Fresh member dashboard hasn't been built for this deployment.</p>
      <p>Run <code>deno task build</code> (which runs <code>deno task member:build</code>)
         before serving, or set it as the deployment's build command.</p>
    </div>
  </body>
</html>`;
  return new Response(html, { status: 503, headers });
}

// Auto-list scheduled samples: hourly, fire any due `sample_schedule_json`
// intents (recorded by recordSampleImport's auto-list option) as a STUB eBay
// draft listing + a status flip to `cleared_to_sell`, then mark them done so the
// at-least-once cron doesn't re-list. Only the central deployment (DATABASE_URL +
// Graylog) runs it; a thin client no-ops. NOTE: "draft eBay listing" is a stub —
// recordSampleListing records a Graylog listing intent; nothing posts to eBay.
// `Deno.cron` is stable on Deno Deploy at runtime but gated behind the unstable
// type lib for `deno check`; feature-detect + cast so the type-check passes and
// runtimes without cron skip gracefully.
const denoCron = (Deno as unknown as {
  cron?: (
    name: string,
    schedule: string,
    handler: () => void | Promise<void>,
  ) => void;
}).cron;
if (denoCron) {
  denoCron("thirsty-sample-auto-list", "0 * * * *", async () => {
    if (REMOTE_API) return; // thin client: the central deploy owns the cron
    try {
      const due = await fetchDueListingSchedules();
      for (const s of due) {
        try {
          if (s.askPrice > 0) {
            await recordSampleListing({
              sampleId: s.sampleId ?? undefined,
              productId: s.productId,
              creator: s.creator,
              marketplace: s.marketplace,
              askPrice: s.askPrice,
              note: "auto-listed (scheduled draft — not posted to eBay)",
            });
            await recordSampleStatus({
              sampleId: s.sampleId ?? undefined,
              productId: s.productId,
              status: "cleared_to_sell",
              source: "skill-cron",
              note: `auto-list fired (${s.marketplace})`,
            });
          }
          await markListingScheduleDone(s.scheduleId); // always: avoid re-firing
        } catch (e) {
          console.error("[auto-list] schedule", s.scheduleId, "failed:", e);
        }
      }
      if (due.length) {
        console.log(`[auto-list] fired ${due.length} scheduled listing(s)`);
      }
    } catch (e) {
      console.error("[auto-list] cron error:", e);
    }
  });
} else {
  console.error("[auto-list] Deno.cron unavailable — auto-listing won't fire");
}

Deno.serve({ port: Number(Deno.env.get("PORT")) || 8000 }, (req) => {
  const p = new URL(req.url).pathname;
  if (memberFetch && memberOwnsPath(p)) {
    if (p.startsWith("/member")) return memberFetch(req);
    // Hoist a root-emitted member asset (/assets/*, /logo.svg, /lp-logo.png)
    // under /member so the basePath'd Fresh server can serve it.
    const u = new URL(req.url);
    u.pathname = "/member" + p;
    return memberFetch(new Request(u, req));
  }
  // Member app unavailable: intercept its own routes so they never render the
  // OS desktop shell inside the member window (the Member/Web "Finder" bug).
  if (!memberFetch && (p === "/member" || p.startsWith("/member/"))) {
    return renderMemberUnavailable();
  }
  return legacyHandler(req);
});
