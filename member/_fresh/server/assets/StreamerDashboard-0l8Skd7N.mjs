import { e as ensure_array_like, b as attr, a as attr_style, d as derived, s as stringify } from "./index-C7vMwkNG.mjs";
import { f as STREAMER_PAYLOAD } from "../server-entry.mjs";
import { e as escape_html } from "./escaping-ukrAy0Ul.mjs";
import "./utils-C1AuI3vl.mjs";
import "./base64-rR4j1CBY.mjs";
function StreamerDashboard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { payload = STREAMER_PAYLOAD } = $$props;
    function deltaSign(s) {
      const v = parseFloat(s.replace(/[^0-9.\-]/g, "")) || 0;
      if (v > 1e-3) return "up";
      if (v < -1e-3) return "down";
      return "flat";
    }
    const KIND = {
      GMV: "dollar",
      Views: "count",
      "Items sold": "count",
      "New followers": "count",
      CTR: "pct",
      Completion: "pct"
    };
    function parseValue(value, kind) {
      const m = value.match(/-?\d+(?:[,.]\d+)*/);
      if (!m) return 0;
      const n = Number(m[0].replace(/,/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
    const videoKindMax = derived(() => {
      const out = { dollar: 0, pct: 0, count: 0 };
      for (const v of payload.videos) {
        for (const m of v.Metrics) {
          const k = KIND[m.name];
          if (!k) continue;
          const n = parseValue(m.value);
          if (n > out[k]) out[k] = n;
        }
      }
      return out;
    });
    function videoMaxFor(name) {
      const k = KIND[name];
      return k ? videoKindMax()[k] : 0;
    }
    function trendGlyph(s) {
      return s === "up" ? "▲" : s === "down" ? "▼" : "·";
    }
    $$renderer2.push(`<section class="streamer-dash svelte-oqch6"><header class="streamer-dash__hero svelte-oqch6"><div class="streamer-dash__hero-left"><div class="streamer-dash__page svelte-oqch6">${escape_html(payload.page)}</div> <h1 class="streamer-dash__title svelte-oqch6">Streamer Compass</h1> <p class="streamer-dash__sub svelte-oqch6">Your own video performance — sampled by <code class="svelte-oqch6">bookmarklet-streamer.js</code> from <code class="svelte-oqch6">shop.tiktok.com/streamer/compass/video-analysis/view</code>.</p></div> <aside class="streamer-dash__date svelte-oqch6"><span class="streamer-dash__date-label svelte-oqch6">${escape_html(payload.dateLabel)}</span> <span class="streamer-dash__date-range svelte-oqch6">${escape_html(payload.dateRange.start)} → ${escape_html(payload.dateRange.end)}</span></aside></header> <div class="streamer-dash__kpis svelte-oqch6"><!--[-->`);
    const each_array = ensure_array_like(payload.metrics);
    for (let i = 0, $$length = each_array.length; i < $$length; i++) {
      let m = each_array[i];
      const dir = deltaSign(m.delta);
      $$renderer2.push(`<article class="streamer-dash__kpi svelte-oqch6"${attr("data-dir", dir)}${attr_style("", { "--i": i })}><span class="streamer-dash__kpi-name svelte-oqch6">${escape_html(m.name)}</span> <div class="streamer-dash__kpi-value svelte-oqch6">`);
      if (m.currency) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="streamer-dash__kpi-currency svelte-oqch6">${escape_html(m.currency)}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <span class="streamer-dash__kpi-number svelte-oqch6">${escape_html(m.value)}</span></div> <span class="streamer-dash__kpi-delta svelte-oqch6"${attr("data-dir", dir)}><span aria-hidden="true">${escape_html(trendGlyph(dir))}</span> ${escape_html(m.delta)} <em class="svelte-oqch6">vs prior period</em></span></article>`);
    }
    $$renderer2.push(`<!--]--></div> <article class="streamer-dash__card svelte-oqch6"><header class="streamer-dash__card-header svelte-oqch6"><h2 class="svelte-oqch6">Video stack — ${escape_html(payload.videos.length)} clips</h2> <p class="svelte-oqch6">Per-video metrics from the seller's own dashboard. Bars compare each
        clip against the strongest in the set for that metric kind.</p></header> <ul class="streamer-dash__videos svelte-oqch6"><!--[-->`);
    const each_array_1 = ensure_array_like(payload.videos);
    for (let i = 0, $$length = each_array_1.length; i < $$length; i++) {
      let v = each_array_1[i];
      $$renderer2.push(`<li class="streamer-dash__video svelte-oqch6"><div class="streamer-dash__video-thumb svelte-oqch6"><img${attr("src", v.Thumbnail)} alt="" loading="lazy" class="svelte-oqch6"/> <span class="streamer-dash__video-duration svelte-oqch6">${escape_html(v.Duration)}</span></div> <div class="streamer-dash__video-body svelte-oqch6"><div class="streamer-dash__video-head svelte-oqch6"><h3 class="streamer-dash__video-title svelte-oqch6">${escape_html(v.Title)}</h3> <span class="streamer-dash__video-posted svelte-oqch6">${escape_html(v.Posted)}</span></div> <ul class="streamer-dash__video-metrics svelte-oqch6"><!--[-->`);
      const each_array_2 = ensure_array_like(v.Metrics);
      for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
        let m = each_array_2[$$index_1];
        const max = videoMaxFor(m.name);
        const kind = KIND[m.name] ?? null;
        const cur = kind ? parseValue(m.value) : 0;
        const ratio = max ? cur / max : 0;
        $$renderer2.push(`<li class="svelte-oqch6"><span class="streamer-dash__vm-name svelte-oqch6">${escape_html(m.name)}</span> <span class="streamer-dash__vm-value svelte-oqch6">${escape_html(m.value)}</span> `);
        if (kind) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="streamer-dash__vm-bar svelte-oqch6"${attr("data-kind", kind)}><span class="svelte-oqch6"${attr_style("", { width: `${stringify(Math.min(100, ratio * 100))}%` })}></span></span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></li>`);
      }
      $$renderer2.push(`<!--]--></ul></div></li>`);
    }
    $$renderer2.push(`<!--]--></ul></article> <footer class="streamer-dash__footer svelte-oqch6">Snapshot scraped ${escape_html(payload.scrapedAt)}</footer></section>`);
  });
}
export {
  StreamerDashboard as default
};
