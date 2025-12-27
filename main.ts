// main.ts - Deno Deploy compatible server
// Serves React SPA for inventory management + fetch demo

import { initializeDatabase, Samples, Bundles, InventoryTransactions } from "./db.ts";

// Initialize database on startup
await initializeDatabase().catch((err) => {
  console.error("Failed to initialize database:", err);
  console.log("Will continue without database - may fail on API calls");
});

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
      "lucide-react": "https://esm.sh/lucide-react@0.294.0?deps=react@18.2.0"
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
    import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
    import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
    import * as LucideIcons from 'lucide-react';

    // Create React Query client
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5,
          refetchOnWindowFocus: false,
        },
      },
    });

    // Local API client - calls our own REST API
    const api = {
      entities: {
        Sample: {
          list: async (orderBy) => {
            const url = new URL('/api/samples', window.location.origin);
            if (orderBy) url.searchParams.set('order_by', orderBy);
            const res = await fetch(url);
            return res.ok ? res.json() : [];
          },
          filter: async (filters, orderBy, limit) => {
            const url = new URL('/api/samples', window.location.origin);
            Object.entries(filters).forEach(([key, value]) => url.searchParams.set(key, value));
            if (orderBy) url.searchParams.set('order_by', orderBy);
            if (limit) url.searchParams.set('limit', limit);
            const res = await fetch(url);
            return res.ok ? res.json() : [];
          },
          create: async (data) => {
            const res = await fetch('/api/samples', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            return res.json();
          },
          update: async (id, data) => {
            const res = await fetch(\`/api/samples/\${id}\`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            return res.json();
          },
          delete: async (id) => {
            await fetch(\`/api/samples/\${id}\`, { method: 'DELETE' });
          }
        },
        Bundle: {
          list: async (orderBy) => {
            const url = new URL('/api/bundles', window.location.origin);
            if (orderBy) url.searchParams.set('order_by', orderBy);
            const res = await fetch(url);
            return res.ok ? res.json() : [];
          },
          filter: async (filters) => {
            const url = new URL('/api/bundles', window.location.origin);
            Object.entries(filters).forEach(([key, value]) => url.searchParams.set(key, value));
            const res = await fetch(url);
            return res.ok ? res.json() : [];
          },
          create: async (data) => {
            const res = await fetch('/api/bundles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            return res.json();
          },
          update: async (id, data) => {
            const res = await fetch(\`/api/bundles/\${id}\`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            return res.json();
          },
          delete: async (id) => {
            await fetch(\`/api/bundles/\${id}\`, { method: 'DELETE' });
          }
        },
        InventoryTransaction: {
          filter: async (filters, orderBy, limit) => {
            const url = new URL('/api/transactions', window.location.origin);
            Object.entries(filters).forEach(([key, value]) => url.searchParams.set(key, value));
            if (orderBy) url.searchParams.set('order_by', orderBy);
            if (limit) url.searchParams.set('limit', limit);
            const res = await fetch(url);
            return res.ok ? res.json() : [];
          },
          create: async (data) => {
            const res = await fetch('/api/transactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            return res.json();
          }
        }
      }
    };

    // Translations
    const translations = {
      nav: { samples: 'Samples', bundles: 'Bundles', checkout: 'Checkout', inventory: 'Inventory Manager' },
      sample: { titlePlural: 'Samples', createNew: 'New Sample', notFound: 'Sample not found',
                editSample: 'Edit Sample', deleteSample: 'Delete Sample', deleteConfirm: 'Are you sure?' },
      bundle: { titlePlural: 'Bundles', createNew: 'New Bundle', notFound: 'Bundle not found',
                samples: 'Samples in Bundle', noSamples: 'No samples in this bundle', addSample: 'Add Sample' },
      checkout: { title: 'Checkout Station', scanPrompt: 'Scan a QR code or barcode',
                  recentScans: 'Recent Scans', notFound: 'Not Found', sampleFound: 'Sample Found', bundleFound: 'Bundle Found' },
      status: { available: 'Available', checked_out: 'Checked Out', reserved: 'Reserved', discontinued: 'Discontinued' },
      filters: { searchPlaceholder: 'Search...', allStatuses: 'All Statuses', allBrands: 'All Brands',
                 allLocations: 'All Locations', fireSaleOnly: 'Fire Sale Only' },
      actions: { save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', back: 'Back',
                 checkout: 'Check Out', checkin: 'Check In', reserve: 'Reserve', unreserve: 'Unreserve' },
      messages: { noResults: 'No results found', required: 'Required' }
    };
    const useTranslation = () => ({ t: (key) => key.split('.').reduce((o, k) => o?.[k], translations) || key });
    const createPageUrl = (page) => page.includes('?') ? \`/\${page.split('?')[0].toLowerCase()}?\${page.split('?')[1]}\` : \`/\${page.toLowerCase()}\`;

    // UI Components
    const Button = ({ children, variant = 'default', size = 'default', className = '', ...props }) => {
      const variants = {
        default: 'bg-slate-900 text-white hover:bg-slate-800',
        outline: 'border border-slate-200 bg-white hover:bg-slate-100',
        ghost: 'hover:bg-slate-100',
        secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
        destructive: 'bg-red-600 text-white hover:bg-red-700'
      };
      const sizes = { default: 'h-10 px-4 py-2', sm: 'h-9 px-3', lg: 'h-11 px-8', icon: 'h-10 w-10' };
      return React.createElement('button', {
        className: \`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50 \${variants[variant]} \${sizes[size]} \${className}\`,
        ...props
      }, children);
    };

    const Card = ({ children, className = '', ...props }) =>
      React.createElement('div', { className: \`rounded-lg border border-slate-200 bg-white shadow-sm \${className}\`, ...props }, children);
    const CardHeader = ({ children, className = '' }) => React.createElement('div', { className: \`p-6 \${className}\` }, children);
    const CardTitle = ({ children, className = '' }) => React.createElement('h3', { className: \`text-2xl font-semibold \${className}\` }, children);
    const CardContent = ({ children, className = '' }) => React.createElement('div', { className: \`p-6 pt-0 \${className}\` }, children);

    const Input = React.forwardRef(({ className = '', ...props }, ref) =>
      React.createElement('input', { ref, className: \`flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm \${className}\`, ...props }));

    const Badge = ({ children, className = '' }) =>
      React.createElement('span', { className: \`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold \${className}\` }, children);

    // Status Badge Component
    const StatusBadge = ({ status }) => {
      const styles = {
        available: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        checked_out: 'bg-amber-100 text-amber-800 border-amber-200',
        reserved: 'bg-blue-100 text-blue-800 border-blue-200',
        discontinued: 'bg-slate-100 text-slate-800 border-slate-200'
      };
      const { t } = useTranslation();
      return React.createElement(Badge, { className: styles[status] || styles.available }, t(\`status.\${status}\`));
    };

    // Layout Component
    const Layout = ({ children }) => {
      const { t } = useTranslation();
      const { Box, Package, QrCode } = LucideIcons;
      const navItems = [
        { name: 'samples', page: 'Samples', icon: Box },
        { name: 'bundles', page: 'Bundles', icon: Package },
        { name: 'checkout', page: 'Checkout', icon: QrCode }
      ];

      return React.createElement('div', { className: 'min-h-screen bg-slate-50' },
        React.createElement('nav', { className: 'bg-white border-b border-slate-200 sticky top-0 z-50' },
          React.createElement('div', { className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8' },
            React.createElement('div', { className: 'flex items-center justify-between h-16' },
              React.createElement(Link, { to: createPageUrl('Samples'), className: 'flex items-center gap-3' },
                React.createElement('img', {
                  src: 'https://assets.codepen.io/11817390/lifepreneur-logo.jpg',
                  alt: 'Lifepreneur',
                  className: 'h-10 w-auto rounded-lg'
                }),
                React.createElement('span', { className: 'font-bold text-xl text-slate-900 hidden sm:block' }, t('nav.inventory'))),
              React.createElement('div', { className: 'flex items-center gap-1' },
                navItems.map(item =>
                  React.createElement(Link, { key: item.page, to: createPageUrl(item.page) },
                    React.createElement(Button, { variant: 'ghost', className: 'gap-2' },
                      React.createElement(item.icon, { className: 'w-4 h-4' }),
                      t(\`nav.\${item.name}\`)))))))),
        React.createElement('main', null, children));
    };

    // Home/Samples Page
    const SamplesPage = () => {
      const { t } = useTranslation();
      const [search, setSearch] = React.useState('');
      const { Box, Plus, Search, Loader2, Filter } = LucideIcons;

      const { data: samples = [], isLoading } = useQuery({
        queryKey: ['samples'],
        queryFn: () => api.entities.Sample.list('-created_date')
      });

      const filteredSamples = samples.filter(s =>
        !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.brand?.toLowerCase().includes(search.toLowerCase())
      );

      return React.createElement('div', { className: 'min-h-screen bg-slate-50' },
        React.createElement('div', { className: 'bg-white border-b border-slate-200 sticky top-0 z-10' },
          React.createElement('div', { className: 'max-w-7xl mx-auto px-4 py-4' },
            React.createElement('div', { className: 'flex items-center justify-between' },
              React.createElement('div', null,
                React.createElement('h1', { className: 'text-2xl font-bold text-slate-900' }, t('sample.titlePlural')),
                React.createElement('p', { className: 'text-sm text-slate-500' }, \`\${filteredSamples.length} samples\`)),
              React.createElement(Link, { to: '/samplecreate' },
                React.createElement(Button, null,
                  React.createElement(Plus, { className: 'w-4 h-4 mr-2' }), t('sample.createNew')))))),
        React.createElement('div', { className: 'max-w-7xl mx-auto px-4 py-6' },
          React.createElement('div', { className: 'bg-white rounded-xl shadow-sm border p-4 mb-6' },
            React.createElement('div', { className: 'relative' },
              React.createElement(Search, { className: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' }),
              React.createElement(Input, { value: search, onChange: e => setSearch(e.target.value), placeholder: t('filters.searchPlaceholder'), className: 'pl-10' }))),
          isLoading
            ? React.createElement('div', { className: 'flex justify-center py-20' }, React.createElement(Loader2, { className: 'w-8 h-8 animate-spin text-slate-400' }))
            : filteredSamples.length === 0
              ? React.createElement('div', { className: 'text-center py-20' },
                  React.createElement(Filter, { className: 'w-12 h-12 text-slate-300 mx-auto mb-4' }),
                  React.createElement('p', { className: 'text-slate-500' }, t('messages.noResults')))
              : React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' },
                  filteredSamples.map(sample =>
                    React.createElement(Link, { key: sample.id, to: \`/sampledetails?id=\${sample.id}\` },
                      React.createElement(Card, { className: 'overflow-hidden hover:shadow-lg transition-shadow' },
                        React.createElement('div', { className: 'aspect-square bg-slate-100 relative' },
                          React.createElement('img', { src: sample.picture_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200', alt: sample.name, className: 'w-full h-full object-cover' }),
                          React.createElement('div', { className: 'absolute top-3 left-3' }, React.createElement(StatusBadge, { status: sample.status }))),
                        React.createElement(CardContent, { className: 'p-4' },
                          React.createElement('h3', { className: 'font-semibold truncate' }, sample.name),
                          React.createElement('p', { className: 'text-sm text-slate-500' }, sample.brand),
                          sample.current_price && React.createElement('p', { className: 'font-bold mt-2' }, \`$\${sample.current_price.toFixed(2)}\`))))))));
    };

    // Bundles Page
    const BundlesPage = () => {
      const { t } = useTranslation();
      const { Package, Plus, Search, Loader2 } = LucideIcons;
      const [search, setSearch] = React.useState('');

      const { data: bundles = [], isLoading } = useQuery({
        queryKey: ['bundles'],
        queryFn: () => api.entities.Bundle.list('-created_date')
      });

      const filteredBundles = bundles.filter(b => !search || b.name?.toLowerCase().includes(search.toLowerCase()));

      return React.createElement('div', { className: 'min-h-screen bg-slate-50' },
        React.createElement('div', { className: 'bg-white border-b border-slate-200' },
          React.createElement('div', { className: 'max-w-7xl mx-auto px-4 py-4' },
            React.createElement('div', { className: 'flex items-center justify-between' },
              React.createElement('h1', { className: 'text-2xl font-bold' }, t('bundle.titlePlural')),
              React.createElement(Link, { to: '/bundlecreate' },
                React.createElement(Button, null, React.createElement(Plus, { className: 'w-4 h-4 mr-2' }), t('bundle.createNew')))))),
        React.createElement('div', { className: 'max-w-7xl mx-auto px-4 py-6' },
          React.createElement('div', { className: 'bg-white rounded-xl shadow-sm border p-4 mb-6' },
            React.createElement('div', { className: 'relative max-w-md' },
              React.createElement(Search, { className: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' }),
              React.createElement(Input, { value: search, onChange: e => setSearch(e.target.value), placeholder: 'Search bundles...', className: 'pl-10' }))),
          isLoading
            ? React.createElement('div', { className: 'flex justify-center py-20' }, React.createElement(Loader2, { className: 'w-8 h-8 animate-spin' }))
            : React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' },
                filteredBundles.map(bundle =>
                  React.createElement(Link, { key: bundle.id, to: \`/bundledetails?id=\${bundle.id}\` },
                    React.createElement(Card, { className: 'p-6 hover:shadow-lg transition-shadow' },
                      React.createElement('div', { className: 'flex items-center gap-3 mb-4' },
                        React.createElement('div', { className: 'w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center' },
                          React.createElement(Package, { className: 'w-6 h-6 text-white' })),
                        React.createElement('div', null,
                          React.createElement('h3', { className: 'font-semibold' }, bundle.name),
                          bundle.location && React.createElement('p', { className: 'text-sm text-slate-500' }, bundle.location))),
                      React.createElement('code', { className: 'text-sm bg-slate-100 px-2 py-1 rounded' }, bundle.qr_code)))))));
    };

    // Checkout Page
    const CheckoutPage = () => {
      const { t } = useTranslation();
      const { QrCode } = LucideIcons;
      const [code, setCode] = React.useState('');
      const [result, setResult] = React.useState(null);

      const handleScan = async () => {
        if (!code.trim()) return;
        const samples = await api.entities.Sample.filter({ qr_code: code });
        if (samples.length > 0) {
          setResult({ type: 'sample', data: samples[0] });
        } else {
          const bundles = await api.entities.Bundle.filter({ qr_code: code });
          if (bundles.length > 0) {
            setResult({ type: 'bundle', data: bundles[0] });
          } else {
            setResult({ type: 'not_found' });
          }
        }
      };

      return React.createElement('div', { className: 'min-h-screen bg-gradient-to-br from-slate-50 to-slate-100' },
        React.createElement('div', { className: 'bg-white border-b' },
          React.createElement('div', { className: 'max-w-4xl mx-auto px-4 py-6 text-center' },
            React.createElement('div', { className: 'w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4' },
              React.createElement(QrCode, { className: 'w-8 h-8 text-white' })),
            React.createElement('h1', { className: 'text-3xl font-bold' }, t('checkout.title')),
            React.createElement('p', { className: 'text-slate-500 mt-2' }, t('checkout.scanPrompt')))),
        React.createElement('div', { className: 'max-w-4xl mx-auto px-4 py-8' },
          React.createElement(Card, { className: 'p-6 mb-6' },
            React.createElement('div', { className: 'flex gap-4' },
              React.createElement(Input, { value: code, onChange: e => setCode(e.target.value), onKeyDown: e => e.key === 'Enter' && handleScan(), placeholder: 'Scan or enter code...', className: 'flex-1 text-lg h-14' }),
              React.createElement(Button, { onClick: handleScan, className: 'h-14 px-8' }, 'Lookup'))),
          result && React.createElement(Card, { className: 'p-6' },
            result.type === 'not_found'
              ? React.createElement('p', { className: 'text-red-600 text-center' }, t('checkout.notFound'))
              : React.createElement('div', null,
                  React.createElement('h2', { className: 'text-xl font-bold mb-2' }, result.data.name),
                  React.createElement(StatusBadge, { status: result.data.status || 'available' })))));
    };

    // Simple placeholder pages
    const PlaceholderPage = ({ title }) =>
      React.createElement('div', { className: 'max-w-4xl mx-auto px-4 py-8' },
        React.createElement(Card, { className: 'p-8 text-center' },
          React.createElement('h1', { className: 'text-2xl font-bold mb-4' }, title),
          React.createElement('p', { className: 'text-slate-500' }, 'This page is under construction.')));

    // App Component
    const App = () => {
      return React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(BrowserRouter, null,
          React.createElement(Layout, null,
            React.createElement(Routes, null,
              React.createElement(Route, { path: '/', element: React.createElement(SamplesPage) }),
              React.createElement(Route, { path: '/samples', element: React.createElement(SamplesPage) }),
              React.createElement(Route, { path: '/sampledetails', element: React.createElement(PlaceholderPage, { title: 'Sample Details' }) }),
              React.createElement(Route, { path: '/samplecreate', element: React.createElement(PlaceholderPage, { title: 'Create Sample' }) }),
              React.createElement(Route, { path: '/sampleedit', element: React.createElement(PlaceholderPage, { title: 'Edit Sample' }) }),
              React.createElement(Route, { path: '/bundles', element: React.createElement(BundlesPage) }),
              React.createElement(Route, { path: '/bundledetails', element: React.createElement(PlaceholderPage, { title: 'Bundle Details' }) }),
              React.createElement(Route, { path: '/bundlecreate', element: React.createElement(PlaceholderPage, { title: 'Create Bundle' }) }),
              React.createElement(Route, { path: '/bundleedit', element: React.createElement(PlaceholderPage, { title: 'Edit Bundle' }) }),
              React.createElement(Route, { path: '/checkout', element: React.createElement(CheckoutPage) }),
              React.createElement(Route, { path: '/readme', element: React.createElement(PlaceholderPage, { title: 'README' }) }),
              React.createElement(Route, { path: '*', element: React.createElement(PlaceholderPage, { title: 'Page Not Found' }) })))));
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

  // DEBUG
  if (url.pathname === "/__debug") {
    return Response.json({
      host: req.headers.get("host"),
      app: Deno.env.get("DENO_DEPLOY_APP_SLUG"),
      deploymentId: Deno.env.get("DENO_DEPLOYMENT_ID"),
      buildId: Deno.env.get("DENO_DEPLOY_BUILD_ID"),
    });
  }

  // Fetch demo page (moved from "/" to "/fetch-demo")
  if (pathname === "/fetch-demo") {
    return await handleFetchDemo();
  }

  // API Routes
  if (pathname.startsWith("/api/")) {
    try {
      // Samples API
      if (pathname === "/api/samples") {
        if (req.method === "GET") {
          const orderBy = url.searchParams.get("order_by") || "-created_date";
          const filters: any = {};
          for (const [key, value] of url.searchParams.entries()) {
            if (key !== "order_by" && key !== "limit") {
              filters[key] = value;
            }
          }
          const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!) : undefined;

          const data = Object.keys(filters).length > 0
            ? await Samples.filter(filters, orderBy, limit)
            : await Samples.list(orderBy);

          return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
          });
        } else if (req.method === "POST") {
          const data = await req.json();
          const newSample = await Samples.create(data);
          return new Response(JSON.stringify(newSample), {
            status: 201,
            headers: { "content-type": "application/json" },
          });
        }
      }

      const sampleMatch = pathname.match(/^\/api\/samples\/([^/]+)$/);
      if (sampleMatch) {
        const id = sampleMatch[1];
        if (req.method === "PATCH") {
          const data = await req.json();
          const updated = await Samples.update(id, data);
          return new Response(JSON.stringify(updated), {
            headers: { "content-type": "application/json" },
          });
        } else if (req.method === "DELETE") {
          await Samples.delete(id);
          return new Response(null, { status: 204 });
        }
      }

      // Bundles API
      if (pathname === "/api/bundles") {
        if (req.method === "GET") {
          const orderBy = url.searchParams.get("order_by") || "-created_date";
          const filters: any = {};
          for (const [key, value] of url.searchParams.entries()) {
            if (key !== "order_by") {
              filters[key] = value;
            }
          }

          const data = Object.keys(filters).length > 0
            ? await Bundles.filter(filters)
            : await Bundles.list(orderBy);

          return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
          });
        } else if (req.method === "POST") {
          const data = await req.json();
          const newBundle = await Bundles.create(data);
          return new Response(JSON.stringify(newBundle), {
            status: 201,
            headers: { "content-type": "application/json" },
          });
        }
      }

      const bundleMatch = pathname.match(/^\/api\/bundles\/([^/]+)$/);
      if (bundleMatch) {
        const id = bundleMatch[1];
        if (req.method === "PATCH") {
          const data = await req.json();
          const updated = await Bundles.update(id, data);
          return new Response(JSON.stringify(updated), {
            headers: { "content-type": "application/json" },
          });
        } else if (req.method === "DELETE") {
          await Bundles.delete(id);
          return new Response(null, { status: 204 });
        }
      }

      // Inventory Transactions API
      if (pathname === "/api/transactions") {
        if (req.method === "GET") {
          const orderBy = url.searchParams.get("order_by") || "-created_date";
          const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!) : undefined;
          const filters: any = {};
          for (const [key, value] of url.searchParams.entries()) {
            if (key !== "order_by" && key !== "limit") {
              filters[key] = value;
            }
          }

          const data = await InventoryTransactions.filter(filters, orderBy, limit);
          return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
          });
        } else if (req.method === "POST") {
          const data = await req.json();
          const newTransaction = await InventoryTransactions.create(data);
          return new Response(JSON.stringify(newTransaction), {
            status: 201,
            headers: { "content-type": "application/json" },
          });
        }
      }

      // API route not found
      return new Response(JSON.stringify({ error: "API endpoint not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      console.error("API error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  }

  // Check if it's a known SPA route or root
  const isSPARoute = SPA_ROUTES.some((route) => pathname === route || pathname === route + "/");

  // Serve SPA for all page routes
  if (isSPARoute || pathname === "/") {
    return renderSPAShell();
  }

  // For any other routes, also serve the SPA (client-side routing will handle 404s)
  return renderSPAShell();
});
