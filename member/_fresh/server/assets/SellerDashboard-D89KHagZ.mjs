import { e as ensure_array_like, c as attr_style, s as stringify, a as attr, d as derived } from "./index-CFTlFGQt.mjs";
import { e as escape_html } from "./escaping-ukrAy0Ul.mjs";
import "./base64-rR4j1CBY.mjs";
import { onDestroy } from "./index-server-fy-S9KcP.mjs";
import { m as SELLER_LIVE_PAYLOAD } from "../server-entry.mjs";
import "./utils-C1AuI3vl.mjs";
function GmvImplosion($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { gmv = "0", label = "GMV ($)" } = $$props;
    let game = null;
    onDestroy(() => {
      game?.destroy(true);
      game = null;
    });
    $$renderer2.push(`<div class="gmv-implosion svelte-s51xp3"><div class="gmv-implosion__label svelte-s51xp3">${escape_html(label)}</div> <div class="gmv-implosion__stage svelte-s51xp3"></div> <div class="gmv-implosion__hint svelte-s51xp3">Phaser 4 — pixel implosion. ${escape_html(gmv)} · live session GMV</div></div>`);
  });
}
function SellerDashboard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { payload = SELLER_LIVE_PAYLOAD } = $$props;
    const PRODUCT_METRIC_LABELS = [
      "Pad",
      "Impressions",
      "CTR",
      "GMV",
      "Add-to-cart",
      "Items sold",
      "Category"
    ];
    function pct(value) {
      const m = value.match(/-?\d+(?:\.\d+)?/);
      return m ? Number(m[0]) : 0;
    }
    const PERF_KIND = {
      "Comment rate": "pct",
      "Follow rate": "pct",
      "Tap-through rate": "pct",
      "Tap-through rate (via LIVE preview)": "pct",
      "LIVE CTR": "pct",
      "Order rate (SKU orders)": "pct",
      "Share rate": "pct",
      "Like rate": "pct",
      "GMV per hour": "dollar",
      "Show GPM": "dollar",
      "GMV Max ROI": "ratio",
      "Avg. viewing duration per view": "count",
      "Impressions": "count",
      "Views": "count",
      "Impressions per hour": "count",
      "> 1 min. views": "count"
    };
    function parsePerf(value, kind) {
      if (kind === "count") {
        const m = value.match(/(\d+(?:\.\d+)?)([KM]?)/);
        if (!m) return 0;
        const n = Number(m[1]);
        return n * (m[2] === "K" ? 1e3 : m[2] === "M" ? 1e6 : 1);
      }
      return pct(value);
    }
    const perfMax = derived(() => {
      const out = {};
      for (const m of payload.performance) {
        const kind = PERF_KIND[m.name] ?? "count";
        out[kind] = Math.max(out[kind] ?? 0, parsePerf(m.value, kind));
      }
      return out;
    });
    $$renderer2.push(`<section class="seller-dash svelte-1v28q16"><header class="seller-dash__hero svelte-1v28q16"><div class="seller-dash__shop svelte-1v28q16"><div class="seller-dash__shop-avatar svelte-1v28q16" aria-hidden="true">${escape_html(payload.shop.slice(0, 2).toUpperCase())}</div> <div><div class="seller-dash__shop-name svelte-1v28q16">@${escape_html(payload.shop)}</div> <div class="seller-dash__shop-meta svelte-1v28q16">${escape_html(payload.page)} · room ${escape_html(payload.roomId)} · ${escape_html(payload.duration)}</div> <div class="seller-dash__shop-range svelte-1v28q16">${escape_html(payload.sessionRange)}</div></div></div> <div class="seller-dash__kpis svelte-1v28q16"><div class="seller-dash__kpi seller-dash__kpi--items svelte-1v28q16"><span class="seller-dash__kpi-label svelte-1v28q16">Items sold</span> <span class="seller-dash__kpi-value svelte-1v28q16">${escape_html(payload.sideKpis["Items sold"])}</span></div> <div class="seller-dash__kpi seller-dash__kpi--viewers svelte-1v28q16"><span class="seller-dash__kpi-label svelte-1v28q16">Viewers</span> <span class="seller-dash__kpi-value svelte-1v28q16">${escape_html(payload.sideKpis["Viewers"])}</span></div></div></header> <div class="seller-dash__gmv svelte-1v28q16">`);
    GmvImplosion($$renderer2, { gmv: payload.gmv, label: "Live session GMV" });
    $$renderer2.push(`<!----></div> <div class="seller-dash__grid svelte-1v28q16"><article class="seller-dash__card seller-dash__card--traffic svelte-1v28q16"><header class="seller-dash__card-header svelte-1v28q16"><h2 class="svelte-1v28q16">Traffic source mix</h2> <p class="svelte-1v28q16">Where the impressions come from — sorted by GMV share.</p></header> <ul class="seller-dash__channels svelte-1v28q16"><!--[-->`);
    const each_array = ensure_array_like(payload.trafficSources);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let ch = each_array[$$index];
      $$renderer2.push(`<li class="svelte-1v28q16"><div class="seller-dash__channel-head svelte-1v28q16"><span class="seller-dash__channel-name svelte-1v28q16">${escape_html(ch.Channel)}</span> <span class="seller-dash__channel-gmv svelte-1v28q16">${escape_html(ch.GMV)}</span></div> <div class="seller-dash__channel-bar svelte-1v28q16" aria-hidden="true"><span class="svelte-1v28q16"${attr_style("", { width: `${stringify(pct(ch.GMV))}%` })}></span></div> <div class="seller-dash__channel-foot svelte-1v28q16"><span title="Impressions share">imp ${escape_html(ch.Impressions)}</span> <span title="Views share">views ${escape_html(ch.Views)}</span></div></li>`);
    }
    $$renderer2.push(`<!--]--></ul></article> <article class="seller-dash__card seller-dash__card--perf svelte-1v28q16"><header class="seller-dash__card-header svelte-1v28q16"><h2 class="svelte-1v28q16">Performance trends</h2> <p class="svelte-1v28q16">Carousel metrics, all 16 captured in one pass.</p></header> <ul class="seller-dash__perf svelte-1v28q16"><!--[-->`);
    const each_array_1 = ensure_array_like(payload.performance);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let m = each_array_1[$$index_1];
      const kind = PERF_KIND[m.name] ?? "count";
      const v = parsePerf(m.value, kind);
      const ratio = perfMax()[kind] ? v / perfMax()[kind] : 0;
      $$renderer2.push(`<li class="seller-dash__perf-row svelte-1v28q16"${attr("data-kind", kind)}><span class="seller-dash__perf-name svelte-1v28q16">${escape_html(m.name)}</span> <span class="seller-dash__perf-bar svelte-1v28q16" aria-hidden="true"><span class="svelte-1v28q16"${attr_style("", { width: `${stringify(Math.min(100, ratio * 100))}%` })}></span></span> <span class="seller-dash__perf-value svelte-1v28q16">${escape_html(m.value)}</span></li>`);
    }
    $$renderer2.push(`<!--]--></ul></article></div> <article class="seller-dash__card seller-dash__card--products svelte-1v28q16"><header class="seller-dash__card-header svelte-1v28q16"><h2 class="svelte-1v28q16">Product list — ${escape_html(payload.products.length)} items in session</h2> <p class="svelte-1v28q16">Per-product impressions, CTR, GMV, ATC and items sold. Click a row
        to open the product on TikTok Shop.</p></header> <ul class="seller-dash__products svelte-1v28q16"><!--[-->`);
    const each_array_2 = ensure_array_like(payload.products);
    for (let i = 0, $$length = each_array_2.length; i < $$length; i++) {
      let p = each_array_2[i];
      $$renderer2.push(`<li class="svelte-1v28q16"><a class="seller-dash__product svelte-1v28q16"${attr("href", p["Product link"])} target="_blank" rel="noreferrer"><div class="seller-dash__product-rank svelte-1v28q16" aria-hidden="true">${escape_html(i + 1)}</div> <div class="seller-dash__product-body svelte-1v28q16"><div class="seller-dash__product-name svelte-1v28q16">${escape_html(p["Product name"])}</div> <div class="seller-dash__product-id svelte-1v28q16">ID ${escape_html(p["Product ID"])}</div> <dl class="seller-dash__product-metrics svelte-1v28q16"><!--[-->`);
      const each_array_3 = ensure_array_like(p.Metrics);
      for (let j = 0, $$length2 = each_array_3.length; j < $$length2; j++) {
        let cell = each_array_3[j];
        if (cell && PRODUCT_METRIC_LABELS[j]) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="svelte-1v28q16"><dt class="svelte-1v28q16">${escape_html(PRODUCT_METRIC_LABELS[j])}</dt> <dd class="svelte-1v28q16">${escape_html(cell)}</dd></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--></dl></div></a></li>`);
    }
    $$renderer2.push(`<!--]--></ul></article> <footer class="seller-dash__footer svelte-1v28q16">Snapshot scraped ${escape_html(payload.scrapedAt)}</footer></section>`);
  });
}
export {
  SellerDashboard as default
};
