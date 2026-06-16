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
  listUnpricedSamples,
  lookupProductByUpc,
  lookupProductDetails,
  updateSamplePrice,
  upsertSampleProduct,
} from "./core/samples.ts";
import { envValue, graylogConfigFromEnv } from "./core/graylog.ts";

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
        const catalog = rows
          .map(sampleRowToKioskProduct)
          .filter((p) => p.productId && p.name);
        return corsJson(limit ? catalog.slice(0, limit) : catalog);
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
      // UPC to a product name via UPCitemdb (falling back to Go-UPC), then find
      // the matching TikTok product via ScrapeCreators. Cross-origin GET, so it
      // carries CORS.
      const upcMatch = url.pathname.match(/^\/api\/upc-lookup\/([^/]+)$/i);
      if (upcMatch) {
        if (req.method !== "GET") {
          return corsJson({ ok: false, error: "Method not allowed" }, 405);
        }
        const upc = decodeURIComponent(upcMatch[1]);
        try {
          return corsJson(await lookupProductByUpc(upc));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return corsJson({ ok: false, upc, error: msg }, 502);
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
        return json(await fetchPriceForSample(decodeURIComponent(fetchPriceMatch[1])));
      }

      if (pathname === "/api/comparison") {
        return json(await fetchComparisonWithEdits());
      }

      if (pathname === "/api/sample-valuation") {
        return json(await fetchSampleValuationWithEdits());
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
