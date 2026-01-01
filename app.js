import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
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
    name: "Name",
    brand: "Brand",
    qrCode: "QR Code",
    location: "Location",
    status: "Status",
    bundle: "Bundle",
    noBundle: "No Bundle",
    currentPrice: "Current Price",
    bestPrice: "Best Price",
    bestPriceSource: "Best Price Source",
    tiktokLink: "TikTok Affiliate Link",
    fireSale: "Fire Sale",
    notes: "Notes",
    checkedOutTo: "Checked out to",
    checkedOutAt: "Checked out at",
    checkedInAt: "Checked in at",
  },
  bundle: {
    titlePlural: "Bundles",
    createNew: "New Bundle",
    notFound: "Bundle not found",
    samples: "Samples in Bundle",
    noSamples: "No samples in this bundle",
    addSample: "Add Sample",
    name: "Bundle Name",
    qrCode: "QR Code",
    location: "Location",
    notes: "Notes",
    deleteBundle: "Delete Bundle",
    deleteConfirm: "Are you sure you want to delete this bundle?",
    editBundle: "Edit Bundle",
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

const Label = React.forwardRef(({ className = "", ...props }, ref) =>
  React.createElement("label", {
    ref,
    className: `text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`,
    ...props,
  }),
);

const Textarea = React.forwardRef(({ className = "", ...props }, ref) =>
  React.createElement("textarea", {
    ref,
    className: `flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`,
    ...props,
  }),
);

const Switch = React.forwardRef(({ checked = false, onCheckedChange, disabled = false, className = "", ...props }, ref) => {
  return React.createElement(
    "button",
    {
      type: "button",
      role: "switch",
      "aria-checked": checked,
      disabled,
      ref,
      onClick: () => onCheckedChange?.(!checked),
      className: `peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-slate-900" : "bg-slate-200"} ${className}`,
      ...props,
    },
    React.createElement("span", {
      className: `pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`,
    }),
  );
});

const SelectContext = React.createContext(undefined);

const Select = ({ value = "", onValueChange = () => {}, children }) => {
  const [open, setOpen] = React.useState(false);
  return React.createElement(
    SelectContext.Provider,
    { value: { value, onValueChange, open, setOpen } },
    React.createElement("div", { className: "relative" }, children),
  );
};

const SelectTrigger = React.forwardRef(({ className = "", children, ...props }, ref) => {
  const context = React.useContext(SelectContext);
  const { ChevronDown } = LucideIcons;
  return React.createElement(
    "button",
    {
      type: "button",
      ref,
      onClick: () => context.setOpen(!context.open),
      className: `flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`,
      ...props,
    },
    children,
    React.createElement(ChevronDown, { className: "h-4 w-4 opacity-50" }),
  );
});

const SelectValue = ({ placeholder }) => {
  const context = React.useContext(SelectContext);
  return React.createElement("span", null, context.value || placeholder);
};

const SelectContent = ({ children, className = "" }) => {
  const context = React.useContext(SelectContext);
  const contentRef = React.useRef(null);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (contentRef.current && !contentRef.current.contains(event.target)) {
        context.setOpen(false);
      }
    }
    if (context.open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [context.open, context]);

  if (!context.open) return null;

  return React.createElement(
    "div",
    {
      ref: contentRef,
      className: `absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-base shadow-lg focus:outline-none sm:text-sm ${className}`,
    },
    children,
  );
};

const SelectItem = ({ value, children, className = "" }) => {
  const context = React.useContext(SelectContext);
  const { Check } = LucideIcons;
  const isSelected = context.value === value;

  return React.createElement(
    "div",
    {
      onClick: () => {
        context.onValueChange(value);
        context.setOpen(false);
      },
      className: `relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 focus:bg-slate-100 ${className}`,
    },
    isSelected &&
      React.createElement(
        "span",
        { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center" },
        React.createElement(Check, { className: "h-4 w-4" }),
      ),
    children,
  );
};

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

  // Helper function to check if sample has the lowest price online
  const hasLowestPrice = (item) => {
    if (item?.current_price === null || item?.current_price === undefined) return false;
    if (item?.best_price === null || item?.best_price === undefined) return false;
    return item.current_price < item.best_price;
  };

  const filteredSamples = samples.filter(
    (s) =>
      !search ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.brand?.toLowerCase().includes(search.toLowerCase()) ||
      s.qr_code?.toLowerCase().includes(search.toLowerCase()),
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
                        { className: "absolute top-3 left-3 flex flex-wrap gap-2" },
                        React.createElement(StatusBadge, { status: sample.status || "available" }),
                        sample.fire_sale ? React.createElement(FireSaleBadge, null) : null,
                        hasLowestPrice(sample) ? React.createElement(LowestPriceOnlineBadge, null) : null,
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
  const location = useLocation();
  const { QrCode, ExternalLink, ShoppingCart } = LucideIcons;
  const [code, setCode] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [animateBadge, setAnimateBadge] = React.useState(false);
  const [confettiOrigin, setConfettiOrigin] = React.useState(null);
  const badgeRef = React.useRef(null);
  const [cartItems, setCartItems] = React.useState([]);
  const [isDebugMode, setIsDebugMode] = React.useState(false);
  const defaultImage = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop";

  // Check for debug mode via URL parameter
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    setIsDebugMode(params.get('debug') === 'true');
  }, [location.search]);

  const hasLowestPrice = (item) => {
    if (item?.current_price === null || item?.current_price === undefined) return false;
    if (item?.best_price === null || item?.best_price === undefined) return false;
    return item.current_price < item.best_price;
  };

  const handleScan = async (nextCode) => {
    setErr(null);
    const scanCode = (typeof nextCode === "string" ? nextCode : code).trim();
    if (!scanCode) return;
    try {
      const samples = await api.entities.Sample.filter({ qr_code: scanCode });
      if (samples.length > 0) {
        setResult({ type: "sample", data: samples[0] });
      } else {
        const bundles = await api.entities.Bundle.filter({ qr_code: scanCode });
        if (bundles.length > 0) setResult({ type: "bundle", data: bundles[0] });
        else setResult({ type: "not_found" });
      }
    } catch (e) {
      setErr(e);
    }
  };

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const codeParam = params.get("code");
    if (codeParam && codeParam.trim()) {
      const trimmed = codeParam.trim();
      setCode(trimmed);
      handleScan(trimmed);
    }
  }, [location.search]);

  const handleAddToCart = () => {
    if (!result || result.type !== "sample") return;
    setCartItems((prev) => [...prev, result.data]);
  };

  const sample = result && result.type === "sample" ? result.data : null;
  const primaryLink = sample ? sample.tiktok_affiliate_link || sample.best_price_source : null;
  const showLowestBadge = sample ? hasLowestPrice(sample) : false;

  React.useEffect(() => {
    // Reset animation state
    setShowConfetti(false);
    setAnimateBadge(false);
    setConfettiOrigin(null);

    if (!sample || !hasLowestPrice(sample)) {
      return;
    }

    // Step 1: Wait for DOM to render the badge (300ms)
    // Step 2: Start badge animation
    // Step 3: After badge animation (600ms), get position and start confetti
    const startAnimationTimeout = setTimeout(() => {
      setAnimateBadge(true);

      // After badge animation completes, trigger confetti from badge position
      setTimeout(() => {
        if (badgeRef.current) {
          const rect = badgeRef.current.getBoundingClientRect();
          const origin = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          };
          setConfettiOrigin(origin);
          setShowConfetti(true);
        }
        setAnimateBadge(false);

        // Clean up confetti after animation
        setTimeout(() => {
          setShowConfetti(false);
          setConfettiOrigin(null);
        }, 3500);
      }, 600); // Badge animation duration
    }, 300); // DOM render delay

    return () => clearTimeout(startAnimationTimeout);
  }, [sample]);

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
          { className: "w-16 h-16 bg-[#2463eb] rounded-2xl flex items-center justify-center mx-auto mb-4" },
          React.createElement(QrCode, { className: "w-8 h-8 text-white" }),
        ),
        React.createElement("h1", { className: "text-3xl font-bold" }, t("checkout.title")),
        React.createElement("p", { className: "text-slate-500 mt-2" }, t("checkout.scanPrompt")),
      ),
    ),
    React.createElement(
      "div",
      { className: "max-w-4xl mx-auto px-4 py-8" },
      React.createElement(Confetti, { active: showConfetti, origin: confettiOrigin }),
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
              : result.type === "bundle"
                ? React.createElement(
                    "div",
                    null,
                    React.createElement("h2", { className: "text-xl font-bold mb-2" }, result.data.name),
                    React.createElement(
                      "p",
                      { className: "text-sm text-slate-500" },
                      "Bundle scanned. Sample details are not available.",
                    ),
                  )
                : React.createElement(
                    "div",
                    { className: "flex flex-col md:flex-row gap-6" },
                    React.createElement("img", {
                      src: sample.picture_url || defaultImage,
                      alt: sample.name,
                      className: "w-32 h-32 rounded-xl object-cover flex-shrink-0",
                    }),
                    React.createElement(
                      "div",
                      { className: "flex-1 min-w-0" },
                      React.createElement(
                        "div",
                        { className: "flex items-start justify-between gap-4 mb-2" },
                        React.createElement(
                          "div",
                          null,
                          React.createElement("h2", { className: "text-2xl font-bold text-slate-900" }, sample.name),
                          React.createElement("p", { className: "text-lg text-slate-500" }, sample.brand),
                        ),
                        React.createElement(
                          "div",
                          { className: "flex flex-col items-end gap-2" },
                          React.createElement(StatusBadge, { status: sample.status || "available" }),
                          sample.fire_sale ? React.createElement(FireSaleBadge, null) : null,
                          showLowestBadge ? React.createElement(LowestPriceOnlineBadge, { ref: badgeRef, animate: animateBadge }) : null,
                        ),
                      ),
                      React.createElement(
                        "div",
                        { className: "mb-3" },
                        React.createElement(PriceDisplay, {
                          currentPrice: sample.current_price,
                          bestPrice: sample.best_price,
                          bestPriceSource: sample.best_price_source,
                          lastChecked: sample.last_price_checked_at,
                        }),
                      ),
                      sample.tiktok_affiliate_link && React.createElement(
                        "div",
                        { className: "mt-3" },
                        React.createElement(
                          "a",
                          {
                            href: sample.tiktok_affiliate_link,
                            target: "_blank",
                            rel: "noopener noreferrer",
                            className:
                              "inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors",
                          },
                          "TikTok Affiliate Link ",
                          React.createElement(ExternalLink, { className: "w-4 h-4" }),
                        ),
                      ),
                      isDebugMode && React.createElement(
                        "p",
                        { className: "text-sm text-slate-500 mt-2" },
                        "has_fire_sale: ",
                        React.createElement(
                          "span",
                          {
                            className: `font-semibold ${
                              sample.fire_sale ? "text-orange-600" : "text-slate-600"
                            }`,
                          },
                          sample.fire_sale ? "true" : "false",
                        ),
                      ),
                      React.createElement(
                        Button,
                        {
                          onClick: handleAddToCart,
                          className:
                            "mt-4 w-full bg-[#2463eb] hover:bg-[#1f57d0]",
                        },
                        React.createElement(ShoppingCart, { className: "w-4 h-4 mr-2" }),
                        "Add to Cart",
                        cartItems.length > 0
                          ? React.createElement(
                              "span",
                              { className: "ml-2 text-xs text-white/80" },
                              `(${cartItems.length})`,
                            )
                          : null,
                      ),
                    ),
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
            className: "inline-flex items-center gap-1 text-sm text-[#4493f8] hover:text-[#4493f8]",
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

const LowestPriceOnlineBadge = React.forwardRef(({ animate = false }, ref) => {
  const { TrendingDown } = LucideIcons;
  return React.createElement(
    "div",
    { ref, className: "relative inline-block" },
    React.createElement(
      Badge,
      {
        className: `bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 gap-1 relative overflow-hidden ${animate ? 'animate-bulge' : ''}`
      },
      React.createElement(TrendingDown, { className: "w-3 h-3" }),
      "Lowest Price Online",
      animate ? React.createElement("span", { className: "absolute inset-0 animate-shine" }) : null
    ),
    React.createElement(
      "style",
      null,
      `
        @keyframes bulge {
          0% { transform: scale(1); }
          30% { transform: scale(1.3); }
          50% { transform: scale(1.2); }
          70% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        .animate-bulge {
          animation: bulge 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes shine {
          0% {
            background: linear-gradient(120deg, transparent 0%, transparent 40%, rgba(255, 255, 255, 0.8) 50%, transparent 60%, transparent 100%);
            background-size: 200% 100%;
            background-position: 200% 0;
          }
          100% {
            background: linear-gradient(120deg, transparent 0%, transparent 40%, rgba(255, 255, 255, 0.8) 50%, transparent 60%, transparent 100%);
            background-size: 200% 100%;
            background-position: -200% 0;
          }
        }
        .animate-shine {
          animation: shine 600ms ease-out forwards;
        }
      `
    )
  );
});

const Confetti = ({ active = false, origin = null }) => {
  const [particles, setParticles] = React.useState([]);
  const [renderOrigin, setRenderOrigin] = React.useState(null);

  React.useEffect(() => {
    if (active && origin) {
      setRenderOrigin(origin);
      const colors = ["#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#fbbf24", "#f59e0b"];
      const particleCount = 60;
      const newParticles = Array.from({ length: particleCount }, (_, i) => {
        const angle = (i / particleCount) * 360 + (Math.random() * 30 - 15);
        const velocity = 150 + Math.random() * 200;
        const radians = (angle * Math.PI) / 180;
        return {
          id: i,
          translateX: Math.cos(radians) * velocity,
          translateY: Math.sin(radians) * velocity,
          delay: Math.random() * 0.15,
          duration: 1.5 + Math.random() * 1,
          rotation: Math.random() * 1080 - 540,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 4 + Math.random() * 6,
          isRect: Math.random() > 0.5,
        };
      });
      setParticles(newParticles);

      const timeout = setTimeout(() => {
        setParticles([]);
        setRenderOrigin(null);
      }, 3500);

      return () => clearTimeout(timeout);
    } else if (!active) {
      setParticles([]);
      setRenderOrigin(null);
    }
  }, [active, origin]);

  if (!active || particles.length === 0 || !renderOrigin) return null;

  return React.createElement(
    "div",
    { className: "fixed inset-0 pointer-events-none z-50 overflow-hidden" },
    particles.map((particle) =>
      React.createElement("div", {
        key: particle.id,
        className: "absolute opacity-0",
        style: {
          left: renderOrigin.x,
          top: renderOrigin.y,
          width: particle.isRect ? particle.size * 1.5 : particle.size,
          height: particle.isRect ? particle.size * 0.6 : particle.size,
          backgroundColor: particle.color,
          borderRadius: particle.isRect ? "1px" : "2px",
          animationDelay: `${particle.delay}s`,
          animationDuration: `${particle.duration}s`,
          animationName: "confettiBurst",
          animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          animationFillMode: "forwards",
          "--tx": `${particle.translateX}px`,
          "--ty": `${particle.translateY}px`,
          "--rot": `${particle.rotation}deg`,
        },
      }),
    ),
    React.createElement(
      "style",
      null,
      `
        @keyframes confettiBurst {
          0% {
            transform: translate(-50%, -50%) translateX(0) translateY(0) rotateZ(0deg) scale(0);
            opacity: 1;
          }
          10% {
            transform: translate(-50%, -50%) translateX(calc(var(--tx) * 0.1)) translateY(calc(var(--ty) * 0.1)) rotateZ(calc(var(--rot) * 0.1)) scale(1);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) translateX(var(--tx)) translateY(calc(var(--ty) + 100px)) rotateZ(var(--rot)) scale(0.5);
            opacity: 0;
          }
        }
      `,
    ),
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

// Sample Form Component
const SampleForm = ({ sample, bundles = [], onSave, onCancel }) => {
  const { t } = useTranslation();
  const { Loader2, Upload, X } = LucideIcons;
  const [formData, setFormData] = React.useState({
    name: sample?.name || "",
    brand: sample?.brand || "",
    location: sample?.location || "",
    qr_code: sample?.qr_code || "",
    picture_url: sample?.picture_url || "",
    tiktok_affiliate_link: sample?.tiktok_affiliate_link || "",
    fire_sale: sample?.fire_sale || false,
    status: sample?.status || "available",
    current_price: sample?.current_price || "",
    best_price: sample?.best_price || "",
    best_price_source: sample?.best_price_source || "",
    bundle_id: sample?.bundle_id || "",
    notes: sample?.notes || "",
  });
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = t("messages.required");
    if (!formData.brand.trim()) newErrors.brand = t("messages.required");
    if (!formData.qr_code.trim()) newErrors.qr_code = t("messages.required");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    const dataToSave = {
      ...formData,
      current_price: formData.current_price ? Number(formData.current_price) : null,
      best_price: formData.best_price ? Number(formData.best_price) : null,
      bundle_id: formData.bundle_id || null,
    };
    await onSave(dataToSave);
    setSaving(false);
  };

  return React.createElement(
    "form",
    { onSubmit: handleSubmit, className: "space-y-6" },
    // Basic Information Card
    React.createElement(
      Card,
      null,
      React.createElement(CardHeader, null, React.createElement(CardTitle, { className: "text-lg" }, "Basic Information")),
      React.createElement(
        CardContent,
        { className: "grid gap-4 md:grid-cols-2" },
        // Name
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Label, { htmlFor: "name" }, t("sample.name"), " *"),
          React.createElement(Input, {
            id: "name",
            value: formData.name,
            onChange: (e) => setFormData((prev) => ({ ...prev, name: e.target.value })),
            className: errors.name ? "border-red-500" : "",
          }),
          errors.name && React.createElement("p", { className: "text-sm text-red-500" }, errors.name),
        ),
        // Brand
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Label, { htmlFor: "brand" }, t("sample.brand"), " *"),
          React.createElement(Input, {
            id: "brand",
            value: formData.brand,
            onChange: (e) => setFormData((prev) => ({ ...prev, brand: e.target.value })),
            className: errors.brand ? "border-red-500" : "",
          }),
          errors.brand && React.createElement("p", { className: "text-sm text-red-500" }, errors.brand),
        ),
        // QR Code
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Label, { htmlFor: "qr_code" }, t("sample.qrCode"), " *"),
          React.createElement(Input, {
            id: "qr_code",
            value: formData.qr_code,
            onChange: (e) => setFormData((prev) => ({ ...prev, qr_code: e.target.value })),
            className: errors.qr_code ? "border-red-500" : "",
            placeholder: "Enter unique code",
          }),
          errors.qr_code && React.createElement("p", { className: "text-sm text-red-500" }, errors.qr_code),
        ),
        // Location
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Label, { htmlFor: "location" }, t("sample.location")),
          React.createElement(Input, {
            id: "location",
            value: formData.location,
            onChange: (e) => setFormData((prev) => ({ ...prev, location: e.target.value })),
            placeholder: "e.g., Shelf A-12",
          }),
        ),
        // Status
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Label, { htmlFor: "status" }, t("sample.status")),
          React.createElement(
            Select,
            {
              value: formData.status,
              onValueChange: (value) => setFormData((prev) => ({ ...prev, status: value })),
            },
            React.createElement(SelectTrigger, null, React.createElement(SelectValue, null)),
            React.createElement(
              SelectContent,
              null,
              React.createElement(SelectItem, { value: "available" }, t("status.available")),
              React.createElement(SelectItem, { value: "checked_out" }, t("status.checked_out")),
              React.createElement(SelectItem, { value: "reserved" }, t("status.reserved")),
              React.createElement(SelectItem, { value: "discontinued" }, t("status.discontinued")),
            ),
          ),
        ),
        // Bundle
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Label, { htmlFor: "bundle" }, t("sample.bundle")),
          React.createElement(
            Select,
            {
              value: formData.bundle_id || "none",
              onValueChange: (value) => setFormData((prev) => ({ ...prev, bundle_id: value === "none" ? "" : value })),
            },
            React.createElement(SelectTrigger, null, React.createElement(SelectValue, { placeholder: t("sample.noBundle") })),
            React.createElement(
              SelectContent,
              null,
              React.createElement(SelectItem, { value: "none" }, t("sample.noBundle")),
              bundles.map((bundle) => React.createElement(SelectItem, { key: bundle.id, value: bundle.id }, bundle.name)),
            ),
          ),
        ),
      ),
    ),
    // Image Card
    React.createElement(
      Card,
      null,
      React.createElement(CardHeader, null, React.createElement(CardTitle, { className: "text-lg" }, "Image")),
      React.createElement(
        CardContent,
        null,
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Label, { htmlFor: "picture_url" }, "Image URL"),
          React.createElement(Input, {
            id: "picture_url",
            value: formData.picture_url,
            onChange: (e) => setFormData((prev) => ({ ...prev, picture_url: e.target.value })),
            placeholder: "https://...",
          }),
        ),
      ),
    ),
    // Pricing Card
    React.createElement(
      Card,
      null,
      React.createElement(CardHeader, null, React.createElement(CardTitle, { className: "text-lg" }, "Pricing")),
      React.createElement(
        CardContent,
        { className: "grid gap-4 md:grid-cols-2" },
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Label, { htmlFor: "current_price" }, t("sample.currentPrice")),
          React.createElement(Input, {
            id: "current_price",
            type: "number",
            step: "0.01",
            min: "0",
            value: formData.current_price,
            onChange: (e) => setFormData((prev) => ({ ...prev, current_price: e.target.value })),
            placeholder: "0.00",
          }),
        ),
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Label, { htmlFor: "best_price" }, t("sample.bestPrice")),
          React.createElement(Input, {
            id: "best_price",
            type: "number",
            step: "0.01",
            min: "0",
            value: formData.best_price,
            onChange: (e) => setFormData((prev) => ({ ...prev, best_price: e.target.value })),
            placeholder: "0.00",
          }),
        ),
        React.createElement(
          "div",
          { className: "md:col-span-2 space-y-2" },
          React.createElement(Label, { htmlFor: "best_price_source" }, t("sample.bestPriceSource")),
          React.createElement(Input, {
            id: "best_price_source",
            value: formData.best_price_source,
            onChange: (e) => setFormData((prev) => ({ ...prev, best_price_source: e.target.value })),
            placeholder: "https://...",
          }),
        ),
      ),
    ),
    // Additional Details Card
    React.createElement(
      Card,
      null,
      React.createElement(CardHeader, null, React.createElement(CardTitle, { className: "text-lg" }, "Additional Details")),
      React.createElement(
        CardContent,
        { className: "space-y-4" },
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Label, { htmlFor: "tiktok_link" }, t("sample.tiktokLink")),
          React.createElement(Input, {
            id: "tiktok_link",
            value: formData.tiktok_affiliate_link,
            onChange: (e) => setFormData((prev) => ({ ...prev, tiktok_affiliate_link: e.target.value })),
            placeholder: "https://tiktok.com/...",
          }),
        ),
        React.createElement(
          "div",
          { className: "flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200" },
          React.createElement(
            "div",
            null,
            React.createElement(Label, { htmlFor: "fire_sale", className: "text-base font-medium" }, t("sample.fireSale")),
            React.createElement("p", { className: "text-sm text-slate-500" }, "Mark this item for fire sale pricing"),
          ),
          React.createElement(Switch, {
            id: "fire_sale",
            checked: formData.fire_sale,
            onCheckedChange: (checked) => setFormData((prev) => ({ ...prev, fire_sale: checked })),
          }),
        ),
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Label, { htmlFor: "notes" }, t("sample.notes")),
          React.createElement(Textarea, {
            id: "notes",
            value: formData.notes,
            onChange: (e) => setFormData((prev) => ({ ...prev, notes: e.target.value })),
            rows: 3,
            placeholder: "Additional notes...",
          }),
        ),
      ),
    ),
    // Form Actions
    React.createElement(
      "div",
      { className: "flex justify-end gap-3" },
      React.createElement(
        Button,
        { type: "button", variant: "outline", onClick: onCancel, disabled: saving },
        t("actions.cancel"),
      ),
      React.createElement(
        Button,
        { type: "submit", disabled: saving },
        saving && React.createElement(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }),
        t("actions.save"),
      ),
    ),
  );
};

// Bundle Form Component
const BundleForm = ({ bundle, onSave, onCancel }) => {
  const { t } = useTranslation();
  const { Loader2 } = LucideIcons;
  const [formData, setFormData] = React.useState({
    name: bundle?.name || "",
    location: bundle?.location || "",
    qr_code: bundle?.qr_code || "",
    notes: bundle?.notes || "",
  });
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = t("messages.required");
    if (!formData.qr_code.trim()) newErrors.qr_code = t("messages.required");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  return React.createElement(
    "form",
    { onSubmit: handleSubmit, className: "space-y-6" },
    React.createElement(
      Card,
      null,
      React.createElement(CardHeader, null, React.createElement(CardTitle, { className: "text-lg" }, "Bundle Information")),
      React.createElement(
        CardContent,
        { className: "grid gap-4 md:grid-cols-2" },
        // Name
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Label, { htmlFor: "name" }, t("bundle.name"), " *"),
          React.createElement(Input, {
            id: "name",
            value: formData.name,
            onChange: (e) => setFormData((prev) => ({ ...prev, name: e.target.value })),
            className: errors.name ? "border-red-500" : "",
            placeholder: "e.g., Summer Collection",
          }),
          errors.name && React.createElement("p", { className: "text-sm text-red-500" }, errors.name),
        ),
        // QR Code
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Label, { htmlFor: "qr_code" }, t("bundle.qrCode"), " *"),
          React.createElement(Input, {
            id: "qr_code",
            value: formData.qr_code,
            onChange: (e) => setFormData((prev) => ({ ...prev, qr_code: e.target.value })),
            className: errors.qr_code ? "border-red-500" : "",
            placeholder: "Enter unique bundle code",
          }),
          errors.qr_code && React.createElement("p", { className: "text-sm text-red-500" }, errors.qr_code),
        ),
        // Location
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Label, { htmlFor: "location" }, t("bundle.location")),
          React.createElement(Input, {
            id: "location",
            value: formData.location,
            onChange: (e) => setFormData((prev) => ({ ...prev, location: e.target.value })),
            placeholder: "e.g., Storage Room B",
          }),
        ),
        // Notes
        React.createElement(
          "div",
          { className: "md:col-span-2 space-y-2" },
          React.createElement(Label, { htmlFor: "notes" }, t("bundle.notes")),
          React.createElement(Textarea, {
            id: "notes",
            value: formData.notes,
            onChange: (e) => setFormData((prev) => ({ ...prev, notes: e.target.value })),
            rows: 3,
            placeholder: "Additional notes about this bundle...",
          }),
        ),
      ),
    ),
    // Form Actions
    React.createElement(
      "div",
      { className: "flex justify-end gap-3" },
      React.createElement(
        Button,
        { type: "button", variant: "outline", onClick: onCancel, disabled: saving },
        t("actions.cancel"),
      ),
      React.createElement(
        Button,
        { type: "submit", disabled: saving },
        saving && React.createElement(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }),
        t("actions.save"),
      ),
    ),
  );
};

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

// Sample Create Page
const SampleCreate = () => {
  const { t } = useTranslation();
  const { ArrowLeft } = LucideIcons;

  const { data: bundles = [] } = useQuery({
    queryKey: ["bundles"],
    queryFn: () => api.entities.Bundle.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Sample.create(data),
    onSuccess: (newSample) => {
      queryClient.invalidateQueries({ queryKey: ["samples"] });
      window.location.href = createPageUrl(`SampleDetails?id=${newSample.id}`);
    },
  });

  return React.createElement(
    "div",
    { className: "min-h-screen bg-slate-50" },
    React.createElement(
      "div",
      { className: "bg-white border-b border-slate-200" },
      React.createElement(
        "div",
        { className: "max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4" },
        React.createElement(
          Link,
          {
            to: createPageUrl("Samples"),
            className: "flex items-center gap-2 text-slate-600 hover:text-slate-900",
          },
          React.createElement(ArrowLeft, { className: "w-4 h-4" }),
          React.createElement("span", null, t("sample.titlePlural")),
        ),
        React.createElement("h1", { className: "text-2xl font-bold text-slate-900 mt-4" }, t("sample.createNew")),
      ),
    ),
    React.createElement(
      "div",
      { className: "max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8" },
      React.createElement(SampleForm, {
        bundles,
        onSave: (data) => createMutation.mutate(data),
        onCancel: () => (window.location.href = createPageUrl("Samples")),
      }),
    ),
  );
};

// Sample Edit Page
const SampleEdit = () => {
  const { t } = useTranslation();
  const { ArrowLeft, Loader2, AlertTriangle } = LucideIcons;
  const urlParams = new URLSearchParams(window.location.search);
  const sampleId = urlParams.get("id");

  const { data: sample, isLoading } = useQuery({
    queryKey: ["sample", sampleId],
    queryFn: async () => {
      const samples = await api.entities.Sample.filter({ id: sampleId });
      return samples[0];
    },
    enabled: !!sampleId,
  });

  const { data: bundles = [] } = useQuery({
    queryKey: ["bundles"],
    queryFn: () => api.entities.Bundle.list(),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => api.entities.Sample.update(sampleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["samples"] });
      queryClient.invalidateQueries({ queryKey: ["sample", sampleId] });
      window.location.href = createPageUrl(`SampleDetails?id=${sampleId}`);
    },
  });

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
    React.createElement(
      "div",
      { className: "bg-white border-b border-slate-200" },
      React.createElement(
        "div",
        { className: "max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4" },
        React.createElement(
          Link,
          {
            to: createPageUrl(`SampleDetails?id=${sampleId}`),
            className: "flex items-center gap-2 text-slate-600 hover:text-slate-900",
          },
          React.createElement(ArrowLeft, { className: "w-4 h-4" }),
          React.createElement("span", null, "Back to Sample"),
        ),
        React.createElement("h1", { className: "text-2xl font-bold text-slate-900 mt-4" }, t("sample.editSample")),
      ),
    ),
    React.createElement(
      "div",
      { className: "max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8" },
      React.createElement(SampleForm, {
        sample,
        bundles,
        onSave: (data) => updateMutation.mutate(data),
        onCancel: () => (window.location.href = createPageUrl(`SampleDetails?id=${sampleId}`)),
      }),
    ),
  );
};

// Bundle Create Page
const BundleCreate = () => {
  const { t } = useTranslation();
  const { ArrowLeft } = LucideIcons;

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Bundle.create(data),
    onSuccess: (newBundle) => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      window.location.href = createPageUrl(`BundleDetails?id=${newBundle.id}`);
    },
  });

  return React.createElement(
    "div",
    { className: "min-h-screen bg-slate-50" },
    React.createElement(
      "div",
      { className: "bg-white border-b border-slate-200" },
      React.createElement(
        "div",
        { className: "max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4" },
        React.createElement(
          Link,
          {
            to: createPageUrl("Bundles"),
            className: "flex items-center gap-2 text-slate-600 hover:text-slate-900",
          },
          React.createElement(ArrowLeft, { className: "w-4 h-4" }),
          React.createElement("span", null, t("bundle.titlePlural")),
        ),
        React.createElement("h1", { className: "text-2xl font-bold text-slate-900 mt-4" }, t("bundle.createNew")),
      ),
    ),
    React.createElement(
      "div",
      { className: "max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8" },
      React.createElement(BundleForm, {
        onSave: (data) => createMutation.mutate(data),
        onCancel: () => (window.location.href = createPageUrl("Bundles")),
      }),
    ),
  );
};

// Bundle Edit Page
const BundleEdit = () => {
  const { t } = useTranslation();
  const { ArrowLeft, Loader2, AlertTriangle } = LucideIcons;
  const urlParams = new URLSearchParams(window.location.search);
  const bundleId = urlParams.get("id");

  const { data: bundle, isLoading } = useQuery({
    queryKey: ["bundle", bundleId],
    queryFn: async () => {
      const bundles = await api.entities.Bundle.filter({ id: bundleId });
      return bundles[0];
    },
    enabled: !!bundleId,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => api.entities.Bundle.update(bundleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      queryClient.invalidateQueries({ queryKey: ["bundle", bundleId] });
      window.location.href = createPageUrl(`BundleDetails?id=${bundleId}`);
    },
  });

  if (isLoading) {
    return React.createElement(
      "div",
      { className: "min-h-screen bg-slate-50 flex items-center justify-center" },
      React.createElement(Loader2, { className: "w-8 h-8 animate-spin text-slate-400" }),
    );
  }

  if (!bundle) {
    return React.createElement(
      "div",
      { className: "min-h-screen bg-slate-50 flex items-center justify-center" },
      React.createElement(
        "div",
        { className: "text-center" },
        React.createElement(AlertTriangle, { className: "w-12 h-12 text-amber-500 mx-auto mb-4" }),
        React.createElement("h2", { className: "text-xl font-semibold text-slate-900 mb-2" }, t("bundle.notFound")),
        React.createElement(
          Link,
          { to: createPageUrl("Bundles") },
          React.createElement(Button, { variant: "outline" }, t("actions.back")),
        ),
      ),
    );
  }

  return React.createElement(
    "div",
    { className: "min-h-screen bg-slate-50" },
    React.createElement(
      "div",
      { className: "bg-white border-b border-slate-200" },
      React.createElement(
        "div",
        { className: "max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4" },
        React.createElement(
          Link,
          {
            to: createPageUrl(`BundleDetails?id=${bundleId}`),
            className: "flex items-center gap-2 text-slate-600 hover:text-slate-900",
          },
          React.createElement(ArrowLeft, { className: "w-4 h-4" }),
          React.createElement("span", null, "Back to Bundle"),
        ),
        React.createElement("h1", { className: "text-2xl font-bold text-slate-900 mt-4" }, t("bundle.editBundle")),
      ),
    ),
    React.createElement(
      "div",
      { className: "max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8" },
      React.createElement(BundleForm, {
        bundle,
        onSave: (data) => updateMutation.mutate(data),
        onCancel: () => (window.location.href = createPageUrl(`BundleDetails?id=${bundleId}`)),
      }),
    ),
  );
};

// Bundle Details Page
const BundleDetails = () => {
  const { t } = useTranslation();
  const { ArrowLeft, Edit, Trash2, Package, MapPin, Plus, X, Loader2, AlertTriangle } = LucideIcons;
  const urlParams = new URLSearchParams(window.location.search);
  const bundleId = urlParams.get("id");
  const [selectedSampleToAdd, setSelectedSampleToAdd] = React.useState("");
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  const { data: bundle, isLoading } = useQuery({
    queryKey: ["bundle", bundleId],
    queryFn: async () => {
      const bundles = await api.entities.Bundle.filter({ id: bundleId });
      return bundles[0];
    },
    enabled: !!bundleId,
  });

  const { data: bundleSamples = [] } = useQuery({
    queryKey: ["bundleSamples", bundleId],
    queryFn: () => api.entities.Sample.filter({ bundle_id: bundleId }),
    enabled: !!bundleId,
  });

  const { data: allSamples = [] } = useQuery({
    queryKey: ["samples"],
    queryFn: () => api.entities.Sample.list(),
  });

  // Samples not in this bundle
  const availableSamples = allSamples.filter((s) => !s.bundle_id);

  const deleteMutation = useMutation({
    mutationFn: () => api.entities.Bundle.delete(bundleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      window.location.href = createPageUrl("Bundles");
    },
  });

  const addSampleMutation = useMutation({
    mutationFn: (sampleId) =>
      api.entities.Sample.update(sampleId, {
        bundle_id: bundleId,
        location: bundle.location,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundleSamples", bundleId] });
      queryClient.invalidateQueries({ queryKey: ["samples"] });
      setSelectedSampleToAdd("");
    },
  });

  const removeSampleMutation = useMutation({
    mutationFn: (sampleId) => api.entities.Sample.update(sampleId, { bundle_id: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundleSamples", bundleId] });
      queryClient.invalidateQueries({ queryKey: ["samples"] });
    },
  });

  if (isLoading) {
    return React.createElement(
      "div",
      { className: "min-h-screen bg-slate-50 flex items-center justify-center" },
      React.createElement(Loader2, { className: "w-8 h-8 animate-spin text-slate-400" }),
    );
  }

  if (!bundle) {
    return React.createElement(
      "div",
      { className: "min-h-screen bg-slate-50 flex items-center justify-center" },
      React.createElement(
        "div",
        { className: "text-center" },
        React.createElement(AlertTriangle, { className: "w-12 h-12 text-amber-500 mx-auto mb-4" }),
        React.createElement("h2", { className: "text-xl font-semibold text-slate-900 mb-2" }, t("bundle.notFound")),
        React.createElement(
          Link,
          { to: createPageUrl("Bundles") },
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
            {
              to: createPageUrl("Bundles"),
              className: "flex items-center gap-2 text-slate-600 hover:text-slate-900",
            },
            React.createElement(ArrowLeft, { className: "w-4 h-4" }),
            React.createElement("span", null, t("bundle.titlePlural")),
          ),
          React.createElement(
            "div",
            { className: "flex items-center gap-2" },
            React.createElement(
              Link,
              { to: createPageUrl(`BundleEdit?id=${bundle.id}`) },
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
                  {
                    variant: "outline",
                    size: "sm",
                    className: "text-red-600 hover:text-red-700 hover:bg-red-50",
                  },
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
                  React.createElement(AlertDialogTitle, null, t("bundle.deleteBundle")),
                  React.createElement(
                    AlertDialogDescription,
                    null,
                    t("bundle.deleteConfirm"),
                    " This will remove all samples from this bundle but won't delete the samples themselves.",
                  ),
                ),
                React.createElement(
                  AlertDialogFooter,
                  null,
                  React.createElement(
                    AlertDialogCancel,
                    { onClick: () => setShowDeleteDialog(false) },
                    t("actions.cancel"),
                  ),
                  React.createElement(
                    AlertDialogAction,
                    {
                      onClick: () => deleteMutation.mutate(),
                      className: "bg-red-600 hover:bg-red-700",
                    },
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
      // Bundle Info Card
      React.createElement(
        Card,
        { className: "mb-6" },
        React.createElement(
          CardContent,
          { className: "p-6" },
          React.createElement(
            "div",
            { className: "flex items-start gap-6" },
            React.createElement(
              "div",
              {
                className:
                  "w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0",
              },
              React.createElement(Package, { className: "w-10 h-10 text-white" }),
            ),
            React.createElement(
              "div",
              { className: "flex-1" },
              React.createElement("h1", { className: "text-2xl font-bold text-slate-900 mb-2" }, bundle.name),
              React.createElement(
                "div",
                { className: "flex flex-wrap gap-4 mb-4" },
                bundle.location &&
                  React.createElement(
                    "div",
                    { className: "flex items-center gap-1 text-slate-600" },
                    React.createElement(MapPin, { className: "w-4 h-4" }),
                    bundle.location,
                  ),
                React.createElement(
                  "span",
                  { className: "text-slate-500" },
                  `${bundleSamples.length} ${bundleSamples.length === 1 ? "sample" : "samples"}`,
                ),
              ),
              React.createElement(QRCodeDisplay, { code: bundle.qr_code }),
              bundle.notes &&
                React.createElement(
                  "p",
                  { className: "mt-4 text-slate-600 p-4 bg-slate-50 rounded-lg" },
                  bundle.notes,
                ),
            ),
          ),
        ),
      ),
      // Samples Management Card
      React.createElement(
        Card,
        null,
        React.createElement(
          CardHeader,
          { className: "flex flex-row items-center justify-between" },
          React.createElement(CardTitle, null, t("bundle.samples")),
          React.createElement(
            "div",
            { className: "flex items-center gap-2" },
            React.createElement(
              Select,
              {
                value: selectedSampleToAdd,
                onValueChange: setSelectedSampleToAdd,
              },
              React.createElement(
                SelectTrigger,
                { className: "w-[200px]" },
                React.createElement(SelectValue, { placeholder: "Select sample to add" }),
              ),
              React.createElement(
                SelectContent,
                null,
                availableSamples.map((sample) =>
                  React.createElement(
                    SelectItem,
                    { key: sample.id, value: sample.id },
                    `${sample.name} (${sample.brand})`,
                  ),
                ),
              ),
            ),
            React.createElement(
              Button,
              {
                onClick: () => addSampleMutation.mutate(selectedSampleToAdd),
                disabled: !selectedSampleToAdd || addSampleMutation.isPending,
                size: "sm",
              },
              React.createElement(Plus, { className: "w-4 h-4 mr-1" }),
              t("bundle.addSample"),
            ),
          ),
        ),
        React.createElement(
          CardContent,
          null,
          bundleSamples.length === 0
            ? React.createElement(
                "div",
                { className: "text-center py-12" },
                React.createElement(Package, { className: "w-12 h-12 text-slate-300 mx-auto mb-4" }),
                React.createElement("p", { className: "text-slate-500" }, t("bundle.noSamples")),
                React.createElement(
                  "p",
                  { className: "text-sm text-slate-400 mt-1" },
                  "Add samples using the dropdown above",
                ),
              )
            : React.createElement(
                "div",
                { className: "space-y-3" },
                bundleSamples.map((sample) =>
                  React.createElement(
                    "div",
                    { key: sample.id, className: "flex items-center gap-3" },
                    React.createElement(
                      "div",
                      { className: "flex-1" },
                      React.createElement(
                        Link,
                        { to: createPageUrl(`SampleDetails?id=${sample.id}`) },
                        React.createElement(
                          Card,
                          { className: "p-4 hover:shadow-md transition-shadow" },
                          React.createElement(
                            "div",
                            { className: "flex items-center gap-4" },
                            React.createElement(
                              "div",
                              { className: "flex-1" },
                              React.createElement(
                                "h4",
                                { className: "font-medium text-slate-900" },
                                sample.name,
                              ),
                              React.createElement(
                                "p",
                                { className: "text-sm text-slate-500" },
                                sample.brand,
                              ),
                            ),
                            React.createElement(StatusBadge, { status: sample.status }),
                          ),
                        ),
                      ),
                    ),
                    React.createElement(
                      Button,
                      {
                        variant: "ghost",
                        size: "icon",
                        onClick: () => removeSampleMutation.mutate(sample.id),
                        disabled: removeSampleMutation.isPending,
                        className: "text-slate-400 hover:text-red-500",
                      },
                      React.createElement(X, { className: "w-4 h-4" }),
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
          React.createElement(Route, { path: "/samplecreate", element: React.createElement(SampleCreate) }),
          React.createElement(Route, { path: "/sampleedit", element: React.createElement(SampleEdit) }),
          React.createElement(Route, { path: "/bundles", element: React.createElement(BundlesPage) }),
          React.createElement(Route, { path: "/bundledetails", element: React.createElement(BundleDetails) }),
          React.createElement(Route, { path: "/bundlecreate", element: React.createElement(BundleCreate) }),
          React.createElement(Route, { path: "/bundleedit", element: React.createElement(BundleEdit) }),
          React.createElement(Route, { path: "/checkout", element: React.createElement(CheckoutPage) }),
          React.createElement(Route, { path: "/readme", element: React.createElement(PlaceholderPage, { title: "README" }) }),
          React.createElement(Route, { path: "*", element: React.createElement(PlaceholderPage, { title: "Page Not Found" }) }),
        ),
      ),
    ),
  );

createRoot(document.getElementById("root")).render(React.createElement(App));
