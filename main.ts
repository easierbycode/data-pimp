// main.ts - Deno Deploy compatible server
// Serves React SPA (shell + /app.js) + API + DB debug endpoints

import { Pool } from "npm:pg";
import { initializeDatabase, Samples, Bundles, InventoryTransactions } from "./db.ts";

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

const SPA_ROUTES = [
  "/",
  "/samples",
  "/sampledetails",
  "/samplecreate",
  "/sampleedit",
  "/bundles",
  "/bundledetails",
  "/bundlecreate",
  "/bundleedit",
  "/checkout",
  "/readme",
];

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

// Serve /app.js from local file (cache in-memory)
const APP_JS_URL = new URL("./app.js", import.meta.url);
let appJsCache: { text: string; mtimeMs: number | null } | null = null;

async function serveAppJs() {
  try {
    const stat = await Deno.stat(APP_JS_URL);
    const mtimeMs = stat.mtime ? stat.mtime.getTime() : null;
    if (!appJsCache || appJsCache.mtimeMs !== mtimeMs) {
      const text = await Deno.readTextFile(APP_JS_URL);
      appJsCache = { text, mtimeMs };
    }
  } catch {
    if (!appJsCache) {
      const text = await Deno.readTextFile(APP_JS_URL);
      appJsCache = { text, mtimeMs: null };
    }
  }
  const body = appJsCache?.text ?? "";
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname.toLowerCase();

  // Client app
  if (pathname === "/app.js") return await serveAppJs();

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

      return json({ error: "API endpoint not found" }, 404);
    } catch (error) {
      console.error("API error:", error);
      const msg = error instanceof Error ? (error.stack || error.message) : String(error);
      return json({ error: msg }, 500);
    }
  }

  // SPA routing
  const isSPARoute = SPA_ROUTES.some((r) => pathname === r || pathname === r + "/");
  if (isSPARoute || pathname === "/") return renderSPAShell();

  return renderSPAShell();
});
