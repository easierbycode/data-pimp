// main.ts - Deno Deploy compatible server
// Serves React SPA for inventory management + fetch demo

const CHARACTER_URL = "https://spritehub-c3a33-default-rtdb.firebaseio.com/characters/dukeNukem.json";
const GRAYLOG_ENDPOINT = "http://graylog-server.thirsty.store:12201/gelf";
const MAX_GELF_MESSAGE_SIZE = 8000; // Max size for UDP GELF

// Page routes that should serve the React SPA
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

async function fetchCharacter() {
  try {
    const res = await fetch(CHARACTER_URL);
    if (!res.ok) {
      throw new Error(`fetch failed with status ${res.status}`);
    }
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
      fullMessage = fullMessage.substring(0, MAX_GELF_MESSAGE_SIZE - 25) + "... [TRUNCATED]";
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

// Fetch demo page (moved from "/" to "/fetch-demo")
async function handleFetchDemo(): Promise<Response> {
  const { data, error } = await fetchCharacter();
  if (error) {
    return new Response("Error fetching data", { status: 500 });
  }

  logToGraylog(data);

  const jsonText = JSON.stringify(data, null, 2);
  const safeJsonText = jsonText.replace(/<\/script>/g, "<\\/script>");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Deno Fetch Demo</title>
</head>
<body>
  <h1>Deno Fetch Demo</h1>
  <p>Fetched JSON data from Firebase Realtime DB:</p>
  <pre id="data">${safeJsonText}</pre>
  <script>
    const fetchedData = JSON.parse(document.getElementById('data').textContent);
    console.log("Fetched JSON data:", fetchedData);
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// React SPA shell - serves the inventory management app
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
      "lucide-react": "https://esm.sh/lucide-react@0.294.0?deps=react@18.2.0",
      "@/": "./",
      "@/api/": "./api/",
      "@/components/": "./Components/",
      "@/utils": "./utils.ts"
    }
  }
  </script>
  <style>
    /* Custom scrollbar */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

    /* Loading animation */
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

  <script type="module">
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { BrowserRouter, Routes, Route } from 'react-router-dom';
    import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

    // Import actual page components
    import Layout from './Layout.tsx';
    import Samples from './Pages/Samples.tsx';
    import SampleDetails from './Pages/SampleDetails.tsx';
    import SampleCreate from './Pages/SampleCreate.tsx';
    import SampleEdit from './Pages/SampleEdit.tsx';
    import Bundles from './Pages/Bundles.tsx';
    import BundleDetails from './Pages/BundleDetails.tsx';
    import BundleCreate from './Pages/BundleCreate.tsx';
    import BundleEdit from './Pages/BundleEdit.tsx';
    import Checkout from './Pages/Checkout.tsx';

    // Create React Query client
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5,
          refetchOnWindowFocus: false,
        },
      },
    });

    // App Component
    const App = () => {
      return React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(BrowserRouter, null,
          React.createElement(Routes, null,
            React.createElement(Route, { path: '/', element: React.createElement(Layout, { currentPageName: 'Samples' }, React.createElement(Samples)) }),
            React.createElement(Route, { path: '/samples', element: React.createElement(Layout, { currentPageName: 'Samples' }, React.createElement(Samples)) }),
            React.createElement(Route, { path: '/sampledetails', element: React.createElement(Layout, { currentPageName: 'SampleDetails' }, React.createElement(SampleDetails)) }),
            React.createElement(Route, { path: '/samplecreate', element: React.createElement(Layout, { currentPageName: 'SampleCreate' }, React.createElement(SampleCreate)) }),
            React.createElement(Route, { path: '/sampleedit', element: React.createElement(Layout, { currentPageName: 'SampleEdit' }, React.createElement(SampleEdit)) }),
            React.createElement(Route, { path: '/bundles', element: React.createElement(Layout, { currentPageName: 'Bundles' }, React.createElement(Bundles)) }),
            React.createElement(Route, { path: '/bundledetails', element: React.createElement(Layout, { currentPageName: 'BundleDetails' }, React.createElement(BundleDetails)) }),
            React.createElement(Route, { path: '/bundlecreate', element: React.createElement(Layout, { currentPageName: 'BundleCreate' }, React.createElement(BundleCreate)) }),
            React.createElement(Route, { path: '/bundleedit', element: React.createElement(Layout, { currentPageName: 'BundleEdit' }, React.createElement(BundleEdit)) }),
            React.createElement(Route, { path: '/checkout', element: React.createElement(Layout, { currentPageName: 'Checkout' }, React.createElement(Checkout)) }))));
    };

    // Mount the app
    const root = createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Main request handler
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname.toLowerCase();

  // Fetch demo page (moved from "/" to "/fetch-demo")
  if (pathname === "/fetch-demo") {
    return await handleFetchDemo();
  }

  // No API routes needed - app uses base44 client directly

  // Check if it's a known SPA route or root
  const isSPARoute = SPA_ROUTES.some((route) => pathname === route || pathname === route + "/");

  // Serve SPA for all page routes
  if (isSPARoute || pathname === "/") {
    return renderSPAShell();
  }

  // For any other routes, also serve the SPA (client-side routing will handle 404s)
  return renderSPAShell();
});
