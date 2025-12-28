import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import * as LucideIcons from "lucide-react";

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Throw on non-OK so we SEE real errors
async function fetchJson(input, init) {
  const res = await fetch(input, init);
  if (!res.ok) {
    let text = "";
    try {
      text = await res.text();
    } catch {}
    throw new Error(`${res.status} ${res.statusText}${text ? ` : ${text}` : ""}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  return res.json();
}

// Local API client - calls our own REST API
const api = {
  entities: {
    Sample: {
      list: async (orderBy) => {
        const url = new URL("/api/samples", window.location.origin);
        if (orderBy) url.searchParams.set("order_by", orderBy);
        return (await fetchJson(url)) || [];
      },
      filter: async (filters, orderBy, limit) => {
        const url = new URL("/api/samples", window.location.origin);
        Object.entries(filters || {}).forEach(([key, value]) => url.searchParams.set(key, value));
        if (orderBy) url.searchParams.set("order_by", orderBy);
        if (limit) url.searchParams.set("limit", String(limit));
        return (await fetchJson(url)) || [];
      },
      create: async (data) => {
        return fetchJson("/api/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      },
      update: async (id, data) => {
        return fetchJson(`/api/samples/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      },
      delete: async (id) => {
        await fetchJson(`/api/samples/${id}`, { method: "DELETE" });
      },
    },
    Bundle: {
      list: async (orderBy) => {
        const url = new URL("/api/bundles", window.location.origin);
        if (orderBy) url.searchParams.set("order_by", orderBy);
        return (await fetchJson(url)) || [];
      },
      filter: async (filters) => {
        const url = new URL("/api/bundles", window.location.origin);
        Object.entries(filters || {}).forEach(([key, value]) => url.searchParams.set(key, value));
        return (await fetchJson(url)) || [];
      },
      create: async (data) => {
        return fetchJson("/api/bundles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      },
      update: async (id, data) => {
        return fetchJson(`/api/bundles/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      },
      delete: async (id) => {
        await fetchJson(`/api/bundles/${id}`, { method: "DELETE" });
      },
    },
    InventoryTransaction: {
      filter: async (filters, orderBy, limit) => {
        const url = new URL("/api/transactions", window.location.origin);
        Object.entries(filters || {}).forEach(([key, value]) => url.searchParams.set(key, value));
        if (orderBy) url.searchParams.set("order_by", orderBy);
        if (limit) url.searchParams.set("limit", String(limit));
        return (await fetchJson(url)) || [];
      },
      create: async (data) => {
        return fetchJson("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      },
    },
  },
};

// Translations
const translations = {
  nav: { samples: "Samples", bundles: "Bundles", checkout: "Checkout", inventory: "Inventory Manager" },
  sample: {
    titlePlural: "Samples",
    createNew: "New Sample",
    notFound: "Sample not found",
    editSample: "Edit Sample",
    deleteSample: "Delete Sample",
    deleteConfirm: "Are you sure?",
  },
  bundle: {
    titlePlural: "Bundles",
    createNew: "New Bundle",
    notFound: "Bundle not found",
    samples: "Samples in Bundle",
    noSamples: "No samples in this bundle",
    addSample: "Add Sample",
  },
  checkout: {
    title: "Checkout Station",
    scanPrompt: "Scan a QR code or barcode",
    recentScans: "Recent Scans",
    notFound: "Not Found",
    sampleFound: "Sample Found",
    bundleFound: "Bundle Found",
  },
  status: { available: "Available", checked_out: "Checked Out", reserved: "Reserved", discontinued: "Discontinued" },
  filters: {
    searchPlaceholder: "Search...",
    allStatuses: "All Statuses",
    allBrands: "All Brands",
    allLocations: "All Locations",
    fireSaleOnly: "Fire Sale Only",
  },
  actions: { save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", back: "Back" },
  messages: { noResults: "No results found", required: "Required" },
};
const useTranslation = () => ({
  t: (key) => key.split(".").reduce((o, k) => (o ? o[k] : undefined), translations) || key,
});
const createPageUrl = (page) =>
  page.includes("?")
    ? `/${page.split("?")[0].toLowerCase()}?${page.split("?")[1]}`
    : `/${page.toLowerCase()}`;

// UI Components
const Button = ({ children, variant = "default", size = "default", className = "", ...props }) => {
  const variants = {
    default: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "border border-slate-200 bg-white hover:bg-slate-100",
    ghost: "hover:bg-slate-100",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    destructive: "bg-red-600 text-white hover:bg-red-700",
  };
  const sizes = { default: "h-10 px-4 py-2", sm: "h-9 px-3", lg: "h-11 px-8", icon: "h-10 w-10" };
  return React.createElement(
    "button",
    {
      className: `inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`,
      ...props,
    },
    children,
  );
};

const Card = ({ children, className = "", ...props }) =>
  React.createElement("div", { className: `rounded-lg border border-slate-200 bg-white shadow-sm ${className}`, ...props }, children);
const CardHeader = ({ children, className = "" }) => React.createElement("div", { className: `p-6 ${className}` }, children);
const CardTitle = ({ children, className = "" }) => React.createElement("h3", { className: `text-2xl font-semibold ${className}` }, children);
const CardContent = ({ children, className = "" }) => React.createElement("div", { className: `p-6 pt-0 ${className}` }, children);

const Input = React.forwardRef(({ className = "", ...props }, ref) =>
  React.createElement("input", {
    ref,
    className: `flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ${className}`,
    ...props,
  }),
);

const Badge = ({ children, className = "" }) =>
  React.createElement("span", { className: `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}` }, children);

const StatusBadge = ({ status }) => {
  const styles = {
    available: "bg-emerald-100 text-emerald-800 border-emerald-200",
    checked_out: "bg-amber-100 text-amber-800 border-amber-200",
    reserved: "bg-blue-100 text-blue-800 border-blue-200",
    discontinued: "bg-slate-100 text-slate-800 border-slate-200",
  };
  const { t } = useTranslation();
  return React.createElement(Badge, { className: styles[status] || styles.available }, t(`status.${status}`));
};

const ApiError = ({ error }) => {
  const msg = error?.message || String(error || "");
  return React.createElement(
    "div",
    { className: "max-w-7xl mx-auto px-4 py-6" },
    React.createElement(
      "div",
      { className: "rounded-lg border border-red-200 bg-red-50 p-4" },
      React.createElement("div", { className: "font-semibold text-red-800 mb-2" }, "API Error"),
      React.createElement("pre", { className: "text-xs whitespace-pre-wrap text-red-900" }, msg),
    ),
  );
};

// Layout Component (restored logo + nav)
const Layout = ({ children }) => {
  const { t } = useTranslation();
  const { Box, Package, QrCode } = LucideIcons;
  const navItems = [
    { name: "samples", page: "Samples", icon: Box },
    { name: "bundles", page: "Bundles", icon: Package },
    { name: "checkout", page: "Checkout", icon: QrCode },
  ];

  return React.createElement(
    "div",
    { className: "min-h-screen bg-slate-50" },
    React.createElement(
      "nav",
      { className: "bg-white border-b border-slate-200 sticky top-0 z-50" },
      React.createElement(
        "div",
        { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" },
        React.createElement(
          "div",
          { className: "flex items-center justify-between h-16" },
          React.createElement(
            Link,
            { to: createPageUrl("Samples"), className: "flex items-center gap-3" },
            React.createElement("img", {
              src: "https://assets.codepen.io/11817390/lifepreneur-logo.jpg",
              alt: "Lifepreneur",
              className: "h-10 w-auto rounded-lg",
            }),
            React.createElement("span", { className: "font-bold text-xl text-slate-900 hidden sm:block" }, t("nav.inventory")),
          ),
          React.createElement(
            "div",
            { className: "flex items-center gap-1" },
            navItems.map((item) =>
              React.createElement(
                Link,
                { key: item.page, to: createPageUrl(item.page) },
                React.createElement(
                  Button,
                  { variant: "ghost", className: "gap-2" },
                  React.createElement(item.icon, { className: "w-4 h-4" }),
                  t(`nav.${item.name}`),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
    React.createElement("main", null, children),
  );
};

// Samples Page (restored styling)
const SamplesPage = () => {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState("");
  const { Plus, Search, Loader2, Filter } = LucideIcons;

  const { data: samples = [], isLoading, error } = useQuery({
    queryKey: ["samples"],
    queryFn: () => api.entities.Sample.list("-created_date"),
  });

  if (error) return React.createElement(ApiError, { error });

  const filteredSamples = samples.filter(
    (s) =>
      !search ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.brand?.toLowerCase().includes(search.toLowerCase()),
  );

  return React.createElement(
    "div",
    { className: "min-h-screen bg-slate-50" },
    React.createElement(
      "div",
      { className: "bg-white border-b border-slate-200 sticky top-0 z-10" },
      React.createElement(
        "div",
        { className: "max-w-7xl mx-auto px-4 py-4" },
        React.createElement(
          "div",
          { className: "flex items-center justify-between" },
          React.createElement(
            "div",
            null,
            React.createElement("h1", { className: "text-2xl font-bold text-slate-900" }, t("sample.titlePlural")),
            React.createElement("p", { className: "text-sm text-slate-500" }, `${filteredSamples.length} samples`),
          ),
          React.createElement(
            Link,
            { to: "/samplecreate" },
            React.createElement(Button, null, React.createElement(Plus, { className: "w-4 h-4 mr-2" }), t("sample.createNew")),
          ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "max-w-7xl mx-auto px-4 py-6" },
      React.createElement(
        "div",
        { className: "bg-white rounded-xl shadow-sm border p-4 mb-6" },
        React.createElement(
          "div",
          { className: "relative" },
          React.createElement(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" }),
          React.createElement(Input, {
            value: search,
            onChange: (e) => setSearch(e.target.value),
            placeholder: t("filters.searchPlaceholder"),
            className: "pl-10",
          }),
        ),
      ),
      isLoading
        ? React.createElement(
            "div",
            { className: "flex justify-center py-20" },
            React.createElement(Loader2, { className: "w-8 h-8 animate-spin text-slate-400" }),
          )
        : filteredSamples.length === 0
          ? React.createElement(
              "div",
              { className: "text-center py-20" },
              React.createElement(Filter, { className: "w-12 h-12 text-slate-300 mx-auto mb-4" }),
              React.createElement("p", { className: "text-slate-500" }, t("messages.noResults")),
            )
          : React.createElement(
              "div",
              { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" },
              filteredSamples.map((sample) =>
                React.createElement(
                  Link,
                  { key: sample.id, to: `/sampledetails?id=${sample.id}` },
                  React.createElement(
                    Card,
                    { className: "overflow-hidden hover:shadow-lg transition-shadow" },
                    React.createElement(
                      "div",
                      { className: "aspect-square bg-slate-100 relative" },
                      React.createElement("img", {
                        src:
                          sample.picture_url ||
                          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200",
                        alt: sample.name,
                        className: "w-full h-full object-cover",
                      }),
                      React.createElement(
                        "div",
                        { className: "absolute top-3 left-3" },
                        React.createElement(StatusBadge, { status: sample.status || "available" }),
                      ),
                    ),
                    React.createElement(
                      CardContent,
                      { className: "p-4" },
                      React.createElement("h3", { className: "font-semibold truncate" }, sample.name),
                      React.createElement("p", { className: "text-sm text-slate-500" }, sample.brand),
                      sample.current_price
                        ? React.createElement("p", { className: "font-bold mt-2" }, `$${Number(sample.current_price).toFixed(2)}`)
                        : null,
                    ),
                  ),
                ),
              ),
            ),
    ),
  );
};

// Bundles Page (restored styling)
const BundlesPage = () => {
  const { t } = useTranslation();
  const { Package, Plus, Search, Loader2 } = LucideIcons;
  const [search, setSearch] = React.useState("");

  const { data: bundles = [], isLoading, error } = useQuery({
    queryKey: ["bundles"],
    queryFn: () => api.entities.Bundle.list("-created_date"),
  });

  if (error) return React.createElement(ApiError, { error });

  const filteredBundles = bundles.filter((b) => !search || b.name?.toLowerCase().includes(search.toLowerCase()));

  return React.createElement(
    "div",
    { className: "min-h-screen bg-slate-50" },
    React.createElement(
      "div",
      { className: "bg-white border-b border-slate-200" },
      React.createElement(
        "div",
        { className: "max-w-7xl mx-auto px-4 py-4" },
        React.createElement(
          "div",
          { className: "flex items-center justify-between" },
          React.createElement("h1", { className: "text-2xl font-bold" }, t("bundle.titlePlural")),
          React.createElement(
            Link,
            { to: "/bundlecreate" },
            React.createElement(Button, null, React.createElement(Plus, { className: "w-4 h-4 mr-2" }), t("bundle.createNew")),
          ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "max-w-7xl mx-auto px-4 py-6" },
      React.createElement(
        "div",
        { className: "bg-white rounded-xl shadow-sm border p-4 mb-6" },
        React.createElement(
          "div",
          { className: "relative max-w-md" },
          React.createElement(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" }),
          React.createElement(Input, {
            value: search,
            onChange: (e) => setSearch(e.target.value),
            placeholder: "Search bundles...",
            className: "pl-10",
          }),
        ),
      ),
      isLoading
        ? React.createElement(
            "div",
            { className: "flex justify-center py-20" },
            React.createElement(Loader2, { className: "w-8 h-8 animate-spin" }),
          )
        : React.createElement(
            "div",
            { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" },
            filteredBundles.map((bundle) =>
              React.createElement(
                Link,
                { key: bundle.id, to: `/bundledetails?id=${bundle.id}` },
                React.createElement(
                  Card,
                  { className: "p-6 hover:shadow-lg transition-shadow" },
                  React.createElement(
                    "div",
                    { className: "flex items-center gap-3 mb-4" },
                    React.createElement(
                      "div",
                      { className: "w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center" },
                      React.createElement(Package, { className: "w-6 h-6 text-white" }),
                    ),
                    React.createElement(
                      "div",
                      null,
                      React.createElement("h3", { className: "font-semibold" }, bundle.name),
                      bundle.location
                        ? React.createElement("p", { className: "text-sm text-slate-500" }, bundle.location)
                        : null,
                    ),
                  ),
                  React.createElement("code", { className: "text-sm bg-slate-100 px-2 py-1 rounded" }, bundle.qr_code),
                ),
              ),
            ),
          ),
    ),
  );
};

// Checkout Page (restored styling)
const CheckoutPage = () => {
  const { t } = useTranslation();
  const { QrCode } = LucideIcons;
  const [code, setCode] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [err, setErr] = React.useState(null);

  const handleScan = async () => {
    setErr(null);
    if (!code.trim()) return;
    try {
      const samples = await api.entities.Sample.filter({ qr_code: code });
      if (samples.length > 0) {
        setResult({ type: "sample", data: samples[0] });
      } else {
        const bundles = await api.entities.Bundle.filter({ qr_code: code });
        if (bundles.length > 0) setResult({ type: "bundle", data: bundles[0] });
        else setResult({ type: "not_found" });
      }
    } catch (e) {
      setErr(e);
    }
  };

  return React.createElement(
    "div",
    { className: "min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" },
    React.createElement(
      "div",
      { className: "bg-white border-b" },
      React.createElement(
        "div",
        { className: "max-w-4xl mx-auto px-4 py-6 text-center" },
        React.createElement(
          "div",
          { className: "w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4" },
          React.createElement(QrCode, { className: "w-8 h-8 text-white" }),
        ),
        React.createElement("h1", { className: "text-3xl font-bold" }, t("checkout.title")),
        React.createElement("p", { className: "text-slate-500 mt-2" }, t("checkout.scanPrompt")),
      ),
    ),
    React.createElement(
      "div",
      { className: "max-w-4xl mx-auto px-4 py-8" },
      err ? React.createElement(ApiError, { error: err }) : null,
      React.createElement(
        Card,
        { className: "p-6 mb-6" },
        React.createElement(
          "div",
          { className: "flex gap-4" },
          React.createElement(Input, {
            value: code,
            onChange: (e) => setCode(e.target.value),
            onKeyDown: (e) => e.key === "Enter" && handleScan(),
            placeholder: "Scan or enter code...",
            className: "flex-1 text-lg h-14",
          }),
          React.createElement(Button, { onClick: handleScan, className: "h-14 px-8" }, "Lookup"),
        ),
      ),
      result
        ? React.createElement(
            Card,
            { className: "p-6" },
            result.type === "not_found"
              ? React.createElement("p", { className: "text-red-600 text-center" }, t("checkout.notFound"))
              : React.createElement(
                  "div",
                  null,
                  React.createElement("h2", { className: "text-xl font-bold mb-2" }, result.data.name),
                  React.createElement(StatusBadge, { status: result.data.status || "available" }),
                ),
          )
        : null,
    ),
  );
};

// UI Helper Components
const QRCodeDisplay = ({ code }) => {
  const { Copy, Check, QrCode } = LucideIcons;
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!code) return null;

  return React.createElement(
    "div",
    { className: "flex items-center gap-3" },
    React.createElement(
      "div",
      { className: "flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 font-mono text-sm" },
      React.createElement(QrCode, { className: "w-4 h-4 text-slate-400" }),
      React.createElement("span", { className: "select-all" }, code),
    ),
    React.createElement(
      Button,
      { variant: "ghost", onClick: handleCopy, className: "h-8 w-8 p-0" },
      copied
        ? React.createElement(Check, { className: "w-4 h-4 text-emerald-500" })
        : React.createElement(Copy, { className: "w-4 h-4 text-slate-400" }),
    ),
  );
};

const PriceDisplay = ({ currentPrice, bestPrice, bestPriceSource, lastChecked }) => {
  const { ExternalLink } = LucideIcons;

  const formatPrice = (price) => {
    if (price === null || price === undefined) return "—";
    return `$${Number(price).toFixed(2)}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return React.createElement(
    "div",
    { className: "space-y-2" },
    React.createElement(
      "div",
      { className: "flex items-baseline gap-4" },
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "text-sm text-slate-500" }, "Current: "),
        React.createElement("span", { className: "font-semibold text-lg" }, formatPrice(currentPrice)),
      ),
      bestPrice
        ? React.createElement(
            "div",
            null,
            React.createElement("span", { className: "text-sm text-slate-500" }, "Best: "),
            React.createElement("span", { className: "font-semibold text-emerald-600" }, formatPrice(bestPrice)),
          )
        : null,
    ),
    bestPriceSource
      ? React.createElement(
          "a",
          {
            href: bestPriceSource,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800",
          },
          "View source ",
          React.createElement(ExternalLink, { className: "w-3 h-3" }),
        )
      : null,
    lastChecked
      ? React.createElement("p", { className: "text-xs text-slate-400" }, `Last checked: ${formatDate(lastChecked)}`)
      : null,
  );
};

const FireSaleBadge = () => {
  const { Flame } = LucideIcons;
  return React.createElement(
    Badge,
    { className: "bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 gap-1" },
    React.createElement(Flame, { className: "w-3 h-3" }),
    "Fire Sale",
  );
};

// Simple AlertDialog components
const AlertDialog = ({ children, open, onOpenChange }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  const handleOpenChange = (newOpen) => {
    setIsOpen(newOpen);
    if (onOpenChange) onOpenChange(newOpen);
  };

  return React.createElement(
    React.Fragment,
    null,
    React.Children.map(children, (child) => {
      if (child?.type === AlertDialogTrigger) {
        return React.cloneElement(child, { onClick: () => handleOpenChange(true) });
      }
      if (child?.type === AlertDialogContent) {
        return isOpen ? React.cloneElement(child, { onClose: () => handleOpenChange(false) }) : null;
      }
      return child;
    }),
  );
};

const AlertDialogTrigger = ({ children, asChild, onClick }) => {
  if (asChild && React.Children.only(children)) {
    return React.cloneElement(children, { onClick });
  }
  return React.createElement("button", { onClick }, children);
};

const AlertDialogContent = ({ children, onClose }) => {
  return React.createElement(
    "div",
    { className: "fixed inset-0 z-50 flex items-center justify-center" },
    React.createElement("div", { className: "fixed inset-0 bg-black/50", onClick: onClose }),
    React.createElement(
      "div",
      { className: "relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6 space-y-4 z-10" },
      children,
    ),
  );
};

const AlertDialogHeader = ({ children }) => React.createElement("div", { className: "space-y-2" }, children);
const AlertDialogTitle = ({ children }) => React.createElement("h2", { className: "text-lg font-semibold" }, children);
const AlertDialogDescription = ({ children }) => React.createElement("p", { className: "text-sm text-slate-500" }, children);
const AlertDialogFooter = ({ children }) => React.createElement("div", { className: "flex gap-2 justify-end" }, children);
const AlertDialogCancel = ({ children, onClick }) => React.createElement(Button, { variant: "outline", onClick }, children);
const AlertDialogAction = ({ children, onClick, className }) => React.createElement(Button, { onClick, className }, children);

// Sample Details Page
const SampleDetails = () => {
  const { t } = useTranslation();
  const { ArrowLeft, Edit, Trash2, Package, MapPin, Calendar, User, ExternalLink, Loader2, AlertTriangle } = LucideIcons;
  const queryClient = React.useMemo(() => new QueryClient(), []);
  const urlParams = new URLSearchParams(window.location.search);
  const sampleId = urlParams.get("id");
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  const { data: sample, isLoading } = useQuery({
    queryKey: ["sample", sampleId],
    queryFn: async () => {
      const samples = await api.entities.Sample.filter({ id: sampleId });
      return samples[0];
    },
    enabled: !!sampleId,
  });

  const { data: bundle } = useQuery({
    queryKey: ["bundle", sample?.bundle_id],
    queryFn: async () => {
      if (!sample?.bundle_id) return null;
      const bundles = await api.entities.Bundle.filter({ id: sample.bundle_id });
      return bundles[0];
    },
    enabled: !!sample?.bundle_id,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", sampleId],
    queryFn: () => api.entities.InventoryTransaction.filter({ sample_id: sampleId }, "-created_date", 10),
    enabled: !!sampleId,
  });

  const handleDelete = async () => {
    await api.entities.Sample.delete(sampleId);
    window.location.href = "/samples";
  };

  const defaultImage = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop";

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return React.createElement(
      "div",
      { className: "min-h-screen bg-slate-50 flex items-center justify-center" },
      React.createElement(Loader2, { className: "w-8 h-8 animate-spin text-slate-400" }),
    );
  }

  if (!sample) {
    return React.createElement(
      "div",
      { className: "min-h-screen bg-slate-50 flex items-center justify-center" },
      React.createElement(
        "div",
        { className: "text-center" },
        React.createElement(AlertTriangle, { className: "w-12 h-12 text-amber-500 mx-auto mb-4" }),
        React.createElement("h2", { className: "text-xl font-semibold text-slate-900 mb-2" }, t("sample.notFound")),
        React.createElement(
          Link,
          { to: createPageUrl("Samples") },
          React.createElement(Button, { variant: "outline" }, t("actions.back")),
        ),
      ),
    );
  }

  return React.createElement(
    "div",
    { className: "min-h-screen bg-slate-50" },
    // Header
    React.createElement(
      "div",
      { className: "bg-white border-b border-slate-200" },
      React.createElement(
        "div",
        { className: "max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4" },
        React.createElement(
          "div",
          { className: "flex items-center justify-between" },
          React.createElement(
            Link,
            { to: createPageUrl("Samples"), className: "flex items-center gap-2 text-slate-600 hover:text-slate-900" },
            React.createElement(ArrowLeft, { className: "w-4 h-4" }),
            React.createElement("span", null, t("sample.titlePlural")),
          ),
          React.createElement(
            "div",
            { className: "flex items-center gap-2" },
            React.createElement(
              Link,
              { to: createPageUrl(`SampleEdit?id=${sample.id}`) },
              React.createElement(
                Button,
                { variant: "outline", size: "sm" },
                React.createElement(Edit, { className: "w-4 h-4 mr-2" }),
                t("actions.edit"),
              ),
            ),
            React.createElement(
              AlertDialog,
              { open: showDeleteDialog, onOpenChange: setShowDeleteDialog },
              React.createElement(
                AlertDialogTrigger,
                { asChild: true },
                React.createElement(
                  Button,
                  { variant: "outline", size: "sm", className: "text-red-600 hover:text-red-700 hover:bg-red-50" },
                  React.createElement(Trash2, { className: "w-4 h-4 mr-2" }),
                  t("actions.delete"),
                ),
              ),
              React.createElement(
                AlertDialogContent,
                { onClose: () => setShowDeleteDialog(false) },
                React.createElement(
                  AlertDialogHeader,
                  null,
                  React.createElement(AlertDialogTitle, null, t("sample.deleteSample")),
                  React.createElement(AlertDialogDescription, null, t("sample.deleteConfirm")),
                ),
                React.createElement(
                  AlertDialogFooter,
                  null,
                  React.createElement(AlertDialogCancel, { onClick: () => setShowDeleteDialog(false) }, t("actions.cancel")),
                  React.createElement(
                    AlertDialogAction,
                    { onClick: handleDelete, className: "bg-red-600 hover:bg-red-700" },
                    t("actions.delete"),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
    // Main Content
    React.createElement(
      "div",
      { className: "max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8" },
      React.createElement(
        "div",
        { className: "grid gap-6 lg:grid-cols-3" },
        // Left Column
        React.createElement(
          "div",
          { className: "lg:col-span-2 space-y-6" },
          // Hero Card
          React.createElement(
            Card,
            { className: "overflow-hidden" },
            React.createElement(
              "div",
              { className: "md:flex" },
              React.createElement(
                "div",
                { className: "md:w-1/3" },
                React.createElement(
                  "div",
                  { className: "aspect-square relative" },
                  React.createElement("img", {
                    src: sample.picture_url || defaultImage,
                    alt: sample.name,
                    className: "w-full h-full object-cover",
                  }),
                  React.createElement(
                    "div",
                    { className: "absolute top-3 left-3 flex flex-wrap gap-2" },
                    React.createElement(StatusBadge, { status: sample.status }),
                    sample.fire_sale ? React.createElement(FireSaleBadge, null) : null,
                  ),
                ),
              ),
              React.createElement(
                CardContent,
                { className: "p-6 md:w-2/3" },
                React.createElement("h1", { className: "text-2xl font-bold text-slate-900 mb-1" }, sample.name),
                React.createElement("p", { className: "text-lg text-slate-500 mb-4" }, sample.brand),
                React.createElement("div", { className: "mb-4" }, React.createElement(QRCodeDisplay, { code: sample.qr_code })),
                React.createElement(
                  "div",
                  { className: "flex flex-wrap gap-4 text-sm" },
                  sample.location
                    ? React.createElement(
                        "div",
                        { className: "flex items-center gap-1 text-slate-600" },
                        React.createElement(MapPin, { className: "w-4 h-4" }),
                        sample.location,
                      )
                    : null,
                  bundle
                    ? React.createElement(
                        Link,
                        {
                          to: createPageUrl(`BundleDetails?id=${bundle.id}`),
                          className: "flex items-center gap-1 text-indigo-600 hover:text-indigo-800",
                        },
                        React.createElement(Package, { className: "w-4 h-4" }),
                        bundle.name,
                      )
                    : null,
                ),
              ),
            ),
          ),
          // Pricing
          React.createElement(
            Card,
            null,
            React.createElement(CardHeader, null, React.createElement(CardTitle, null, "Pricing")),
            React.createElement(
              CardContent,
              null,
              React.createElement(PriceDisplay, {
                currentPrice: sample.current_price,
                bestPrice: sample.best_price,
                bestPriceSource: sample.best_price_source,
                lastChecked: sample.last_price_checked_at,
              }),
              sample.tiktok_affiliate_link
                ? React.createElement(
                    "a",
                    {
                      href: sample.tiktok_affiliate_link,
                      target: "_blank",
                      rel: "noopener noreferrer",
                      className: "inline-flex items-center gap-2 mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors",
                    },
                    "TikTok Affiliate Link ",
                    React.createElement(ExternalLink, { className: "w-4 h-4" }),
                  )
                : null,
            ),
          ),
          // Notes
          sample.notes
            ? React.createElement(
                Card,
                null,
                React.createElement(CardHeader, null, React.createElement(CardTitle, null, t("sample.notes"))),
                React.createElement(
                  CardContent,
                  null,
                  React.createElement("p", { className: "text-slate-600 whitespace-pre-wrap" }, sample.notes),
                ),
              )
            : null,
        ),
        // Right Column - Sidebar
        React.createElement(
          "div",
          { className: "space-y-6" },
          // Checkout Status
          React.createElement(
            Card,
            null,
            React.createElement(CardHeader, null, React.createElement(CardTitle, null, "Checkout Status")),
            React.createElement(
              CardContent,
              { className: "space-y-4" },
              sample.checked_out_to
                ? React.createElement(
                    "div",
                    { className: "flex items-center gap-3" },
                    React.createElement(User, { className: "w-4 h-4 text-slate-400" }),
                    React.createElement(
                      "div",
                      null,
                      React.createElement("p", { className: "text-sm text-slate-500" }, t("sample.checkedOutTo")),
                      React.createElement("p", { className: "font-medium" }, sample.checked_out_to),
                    ),
                  )
                : null,
              sample.checked_out_at
                ? React.createElement(
                    "div",
                    { className: "flex items-center gap-3" },
                    React.createElement(Calendar, { className: "w-4 h-4 text-slate-400" }),
                    React.createElement(
                      "div",
                      null,
                      React.createElement("p", { className: "text-sm text-slate-500" }, t("sample.checkedOutAt")),
                      React.createElement("p", { className: "font-medium" }, formatDate(sample.checked_out_at)),
                    ),
                  )
                : null,
              sample.checked_in_at
                ? React.createElement(
                    "div",
                    { className: "flex items-center gap-3" },
                    React.createElement(Calendar, { className: "w-4 h-4 text-slate-400" }),
                    React.createElement(
                      "div",
                      null,
                      React.createElement("p", { className: "text-sm text-slate-500" }, t("sample.checkedInAt")),
                      React.createElement("p", { className: "font-medium" }, formatDate(sample.checked_in_at)),
                    ),
                  )
                : null,
            ),
          ),
          // Recent Transactions
          React.createElement(
            Card,
            null,
            React.createElement(CardHeader, null, React.createElement(CardTitle, null, "Recent Activity")),
            React.createElement(
              CardContent,
              null,
              transactions.length === 0
                ? React.createElement("p", { className: "text-sm text-slate-400 text-center py-4" }, "No activity yet")
                : React.createElement(
                    "div",
                    { className: "space-y-3" },
                    transactions.map((tx) =>
                      React.createElement(
                        "div",
                        { key: tx.id, className: "flex items-start gap-3 text-sm" },
                        React.createElement("div", {
                          className: `w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            tx.action === "checkout" ? "bg-amber-500" : tx.action === "checkin" ? "bg-emerald-500" : "bg-blue-500"
                          }`,
                        }),
                        React.createElement(
                          "div",
                          null,
                          React.createElement("p", { className: "font-medium capitalize" }, tx.action),
                          React.createElement(
                            "p",
                            { className: "text-slate-500" },
                            `${formatDate(tx.created_date)}${tx.operator ? ` by ${tx.operator}` : ""}`,
                          ),
                        ),
                      ),
                    ),
                  ),
            ),
          ),
        ),
      ),
    ),
  );
};

// Placeholder pages
const PlaceholderPage = ({ title }) =>
  React.createElement(
    "div",
    { className: "max-w-4xl mx-auto px-4 py-8" },
    React.createElement(
      Card,
      { className: "p-8 text-center" },
      React.createElement("h1", { className: "text-2xl font-bold mb-4" }, title),
      React.createElement("p", { className: "text-slate-500" }, "This page is under construction."),
    ),
  );

// App
const App = () =>
  React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(
      BrowserRouter,
      null,
      React.createElement(
        Layout,
        null,
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/", element: React.createElement(SamplesPage) }),
          React.createElement(Route, { path: "/samples", element: React.createElement(SamplesPage) }),
          React.createElement(Route, { path: "/sampledetails", element: React.createElement(SampleDetails) }),
          React.createElement(Route, { path: "/samplecreate", element: React.createElement(PlaceholderPage, { title: "Create Sample" }) }),
          React.createElement(Route, { path: "/sampleedit", element: React.createElement(PlaceholderPage, { title: "Edit Sample" }) }),
          React.createElement(Route, { path: "/bundles", element: React.createElement(BundlesPage) }),
          React.createElement(Route, { path: "/bundledetails", element: React.createElement(PlaceholderPage, { title: "Bundle Details" }) }),
          React.createElement(Route, { path: "/bundlecreate", element: React.createElement(PlaceholderPage, { title: "Create Bundle" }) }),
          React.createElement(Route, { path: "/bundleedit", element: React.createElement(PlaceholderPage, { title: "Edit Bundle" }) }),
          React.createElement(Route, { path: "/checkout", element: React.createElement(CheckoutPage) }),
          React.createElement(Route, { path: "/readme", element: React.createElement(PlaceholderPage, { title: "README" }) }),
          React.createElement(Route, { path: "*", element: React.createElement(PlaceholderPage, { title: "Page Not Found" }) }),
        ),
      ),
    ),
  );

createRoot(document.getElementById("root")).render(React.createElement(App));
