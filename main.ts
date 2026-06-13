// main.ts - Deno Deploy compatible server
// Serves React SPA (shell + /app.js) + API + DB debug endpoints

import { Pool } from "npm:pg";
import { initializeDatabase, Samples, Bundles, InventoryTransactions } from "./db.ts";
// Migrated from thirsty-store-kiosk: the Graylog-backed Product Analysis
// dashboard. Catalog (/api/products) is served from Postgres instead (below).
import {
  fetchComparisonWithEdits,
  fetchPriceForSample,
  fetchProductWithEdits,
  fetchSampleValuationWithEdits,
  listUnpricedSamples,
  updateSamplePrice,
  upsertSampleProduct,
} from "./core/samples.ts";
import { envValue, graylogConfigFromEnv } from "./core/graylog.ts";

const pool = new Pool({
  connectionString: Deno.env.get("DATABASE_URL"),
  max: 1,
});

// Initialize database on startup
await initializeDatabase().catch((err) => {
  console.error("Failed to initialize database:", err);
  console.log("Will continue without database - may fail on API calls");
});

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
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inventory Manager - Data Pimp</title>
  <script src="https://cdn.tailwindcss.com"></script>

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
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .animate-spin { animation: spin 1s linear infinite; }
  </style>
</head>
<body>
  <div id="root">
    <div class="min-h-screen bg-slate-50 flex items-center justify-center">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-slate-600">Loading Inventory Manager...</p>
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
    <div id="menubar" class="menubar">
      <div class="menubar-left">
        <span class="brand"><span class="brand-mark">◆</span> Thirsty&nbsp;OS</span>
        <span id="active-app" class="active-app" aria-live="polite" aria-atomic="true">Finder</span>
      </div>
      <div class="menubar-right">
        <span id="menubar-status" class="mb-status"></span>
        <span id="clock" class="clock tnum"></span>
      </div>
    </div>
    <main id="desktop" class="desktop" aria-label="Desktop">
      <div id="desktop-icons" class="desktop-icons" aria-label="Desktop items"></div>
    </main>
    <div id="dock" class="dock" aria-label="Dock"></div>
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

Deno.serve({ port: Number(Deno.env.get("PORT")) || 8000 }, async (req) => {
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
});
