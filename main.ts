// main.ts - Deno Deploy compatible server
// Serves React SPA for inventory management + fetch demo
// IMPORTANT: React app is served as /app.js to avoid inline-script template issues.

import { Pool } from "npm:pg";
import {
  initializeDatabase,
  Samples,
  Bundles,
  InventoryTransactions,
} from "./db.ts";

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
        fullMessage.substring(0, MAX_GELF_MESSAGE_SIZE - 25) +
        "... [TRUNCATED]";
    }
    const gelfMessage = {
      version: "1.1",
      host: "deno-app",
      short_message: "Fetched data from " + CHARACTER_URL,
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

// Serve the React app shell (loads /app.js)
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
      "@tanstack/react-query": "https://esm.sh/@tanstack/react-query@5.12.0?deps=react@18.2.0"
    }
  }
  </script>
</head>
<body class="bg-slate-50">
  <div id="root">
    <div class="min-h-screen flex items-center justify-center text-slate-600">Loading…</div>
  </div>
  <script type="module" src="/app.js"></script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

// IMPORTANT: no template literals inside this JS (no backticks, no ${}).
const APP_JS = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

const h = React.createElement;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false, retry: 1 }
  }
});

async function fetchJson(input, init) {
  const res = await fetch(input, init);
  if (!res.ok) {
    let text = '';
    try { text = await res.text(); } catch (_) {}
    const msg = String(res.status) + ' ' + res.statusText + (text ? (': ' + text) : '');
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.indexOf('application/json') === -1) return null;
  return res.json();
}

function makeUrl(path, params) {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(function (kv) {
      const k = kv[0];
      const v = kv[1];
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return url;
}

const api = {
  samplesList: function () {
    return fetchJson(makeUrl('/api/samples', { order_by: '-created_date' }));
  },
  bundlesList: function () {
    return fetchJson(makeUrl('/api/bundles', { order_by: '-created_date' }));
  }
};

function TopNav() {
  return h('div', { className: 'bg-white border-b border-slate-200 sticky top-0 z-10' },
    h('div', { className: 'max-w-7xl mx-auto px-4 h-16 flex items-center justify-between' },
      h(Link, { to: '/', className: 'font-bold text-slate-900' }, 'Inventory Manager'),
      h('div', { className: 'flex gap-2' },
        h(Link, { to: '/samples', className: 'text-slate-700 hover:text-slate-900' }, 'Samples'),
        h(Link, { to: '/bundles', className: 'text-slate-700 hover:text-slate-900' }, 'Bundles')
      )
    )
  );
}

function ErrorBox(props) {
  const msg = props && props.error && props.error.message ? props.error.message : String(props && props.error ? props.error : '');
  return h('div', { className: 'max-w-7xl mx-auto px-4 py-6' },
    h('div', { className: 'rounded-lg border border-red-200 bg-red-50 p-4' },
      h('div', { className: 'font-semibold text-red-800 mb-2' }, 'API Error'),
      h('pre', { className: 'text-xs whitespace-pre-wrap text-red-900' }, msg),
      h('div', { className: 'text-xs text-red-700 mt-2' }, 'Open DevTools → Network and click the failing /api/* request.')
    )
  );
}

function ListCard(title, subtitle) {
  return h('div', { className: 'rounded-lg border border-slate-200 bg-white shadow-sm p-4' },
    h('div', { className: 'font-semibold text-slate-900' }, title || '(no title)'),
    subtitle ? h('div', { className: 'text-sm text-slate-500 mt-1' }, subtitle) : null
  );
}

function SamplesPage() {
  const q = useQuery({ queryKey: ['samples'], queryFn: api.samplesList });
  if (q.isLoading) return h('div', { className: 'p-6 text-slate-600' }, 'Loading samples…');
  if (q.error) return h(ErrorBox, { error: q.error });

  const samples = q.data || [];
  return h('div', null,
    h('div', { className: 'max-w-7xl mx-auto px-4 py-6' },
      h('div', { className: 'flex items-baseline justify-between mb-4' },
        h('h1', { className: 'text-2xl font-bold text-slate-900' }, 'Samples'),
        h('div', { className: 'text-sm text-slate-500' }, String(samples.length) + ' rows')
      ),
      samples.length === 0
        ? h('div', { className: 'text-slate-600' }, 'No samples returned.')
        : h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' },
            samples.map(function (s) {
              return ListCard(s.name, s.brand);
            })
          )
    )
  );
}

function BundlesPage() {
  const q = useQuery({ queryKey: ['bundles'], queryFn: api.bundlesList });
  if (q.isLoading) return h('div', { className: 'p-6 text-slate-600' }, 'Loading bundles…');
  if (q.error) return h(ErrorBox, { error: q.error });

  const bundles = q.data || [];
  return h('div', null,
    h('div', { className: 'max-w-7xl mx-auto px-4 py-6' },
      h('div', { className: 'flex items-baseline justify-between mb-4' },
        h('h1', { className: 'text-2xl font-bold text-slate-900' }, 'Bundles'),
        h('div', { className: 'text-sm text-slate-500' }, String(bundles.length) + ' rows')
      ),
      bundles.length === 0
        ? h('div', { className: 'text-slate-600' }, 'No bundles returned.')
        : h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' },
            bundles.map(function (b) {
              return ListCard(b.name, b.location || b.qr_code);
            })
          )
    )
  );
}

function App() {
  return h(QueryClientProvider, { client: queryClient },
    h(BrowserRouter, null,
      h('div', null,
        h(TopNav, null),
        h(Routes, null,
          h(Route, { path: '/', element: h(SamplesPage, null) }),
          h(Route, { path: '/samples', element: h(SamplesPage, null) }),
          h(Route, { path: '/bundles', element: h(BundlesPage, null) }),
          h(Route, { path: '*', element: h('div', { className: 'p-6 text-slate-600' }, 'Not found') })
        )
      )
    )
  );
}

const root = createRoot(document.getElementById('root'));
root.render(h(App, null));
`;

// Main request handler
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname.toLowerCase();

  // Serve /app.js (client)
  if (pathname === "/app.js") {
    return new Response(APP_JS, {
      status: 200,
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  // DEBUG
  if (pathname === "/__debug") {
    return json({
      host: req.headers.get("host"),
      app: Deno.env.get("DENO_DEPLOY_APP_SLUG"),
      deploymentId: Deno.env.get("DENO_DEPLOYMENT_ID"),
      buildId: Deno.env.get("DENO_DEPLOY_BUILD_ID"),
      db: redactedDbUrl(),
    });
  }

  // DB DEBUG
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

  // DB COUNTS (token protected)
  if (pathname === "/__counts") {
    const token = url.searchParams.get("token");
    const expected = Deno.env.get("DEBUG_TOKEN");
    if (!expected || !token || token !== expected) {
      return new Response("forbidden", { status: 403 });
    }

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
  if (pathname === "/fetch-demo") {
    return await handleFetchDemo();
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
          const data = await req.json();
          const created = await Samples.create(data);
          return json(created, 201);
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
          const data = await req.json();
          const created = await Bundles.create(data);
          return json(created, 201);
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
          const data = await req.json();
          const created = await InventoryTransactions.create(data);
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

  // SPA routes
  const isSPARoute = SPA_ROUTES.some((route) =>
    pathname === route || pathname === route + "/"
  );
  if (isSPARoute || pathname === "/") return renderSPAShell();

  // Default SPA fallback
  return renderSPAShell();
});
