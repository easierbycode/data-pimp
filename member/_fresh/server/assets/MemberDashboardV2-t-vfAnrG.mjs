import { b as attr_class, c as attr_style, s as stringify, e as ensure_array_like, d as derived, a as attr } from "./index-CFTlFGQt.mjs";
import { f as MONTH_COMPARE, g as ACCOUNTS, h as STREAK, P as POWER_DEAL, i as acctById, j as ALL_ACCOUNT, V as VIDEOS, k as PRODUCTS, K as KPI_ALL } from "../server-entry.mjs";
import Counter from "./Counter-DyMWHnEF.mjs";
import { e as escape_html } from "./escaping-ukrAy0Ul.mjs";
import "./utils-C1AuI3vl.mjs";
import "./base64-rR4j1CBY.mjs";
function MemberDashboardV2($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const fmtMoney = (n) => {
      if (n == null || Number.isNaN(n)) return "—";
      if (n >= 1e3) {
        return `$${(n / 1e3).toLocaleString(void 0, { maximumFractionDigits: 1 })}k`;
      }
      return `$${Math.round(n).toLocaleString()}`;
    };
    const fmtMoneyFull = (n) => `$${Math.round(n).toLocaleString()}`;
    const fmtInt = (n) => {
      if (n == null || Number.isNaN(n)) return "—";
      if (n >= 1e6) {
        return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
      }
      if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
      return n.toLocaleString();
    };
    const pct = (n) => `${n >= 0 ? "+" : ""}${Math.round(n * 100)}%`;
    let period = "7d";
    let selectorOpen = false;
    const derived$1 = derived(() => {
      {
        return {
          kpi: KPI_ALL,
          products: PRODUCTS,
          videos: VIDEOS,
          scopeColor: "var(--primary)"
        };
      }
    });
    const kpi = derived(() => derived$1().kpi);
    const products = derived(() => derived$1().products);
    const videos = derived(() => derived$1().videos);
    const scopeColor = derived(() => derived$1().scopeColor);
    const current = derived(() => ALL_ACCOUNT);
    const periods = ["7d", "30d", "90d", "all"];
    const periodLabels = { "7d": "7d", "30d": "30d", "90d": "90d", all: "All" };
    const up = MONTH_COMPARE.thisMonth > MONTH_COMPARE.prevMonth;
    const tiles = derived(() => [
      {
        key: "gmv",
        label: "GMV",
        icon: "$",
        val: fmtMoneyFull(kpi().gmv.value),
        delta: kpi().gmv.delta,
        spark: kpi().gmv.spark
      },
      {
        key: "videos",
        label: "# Videos",
        icon: "▶",
        val: fmtInt(kpi().videos.value),
        delta: kpi().videos.delta,
        spark: kpi().videos.spark
      },
      {
        key: "commission",
        label: "Commission",
        icon: "%",
        val: fmtMoneyFull(kpi().commission.value),
        delta: kpi().commission.delta,
        spark: kpi().commission.spark
      }
    ]);
    function scopeAccount(s) {
      return ALL_ACCOUNT;
    }
    function sparkPaths(data) {
      const w = 120;
      const h = 34;
      const pad = 2;
      const max = Math.max(...data);
      const min = Math.min(...data);
      const span = max - min || 1;
      const step = (w - pad * 2) / (data.length - 1);
      const pts = data.map((v, i) => [pad + i * step, h - pad - (v - min) / span * (h - pad * 2)]);
      const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
      const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`;
      return { w, h, line, area };
    }
    function badgeNames(accountIds) {
      return accountIds.map((id) => acctById(id)?.name).filter(Boolean).join(", ");
    }
    function accountBadges($$renderer3, accountIds, max = 4, size = 24, title = "") {
      const shown = accountIds.slice(0, max);
      const overflow = accountIds.length - shown.length;
      $$renderer3.push(`<span class="badges svelte-1osgb41"><!--[-->`);
      const each_array = ensure_array_like(shown);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let id = each_array[$$index];
        const a = acctById(id);
        if (a) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<span class="badge svelte-1osgb41"${attr_style(`background: ${stringify(a.color)}; width: ${stringify(size)}px; height: ${stringify(size)}px`)}${attr("aria-label", a.name)}>${escape_html(a.initials)}</span>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      }
      $$renderer3.push(`<!--]--> `);
      if (overflow > 0) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<span class="badge badgeOverflow svelte-1osgb41"${attr_style(`width: ${stringify(size)}px; height: ${stringify(size)}px`)}>+${escape_html(overflow)}</span>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <span class="badgeTip svelte-1osgb41">${escape_html(title || badgeNames(accountIds))}</span></span>`);
    }
    function sparkline($$renderer3, data, color, gradId) {
      const p = sparkPaths(data);
      $$renderer3.push(`<svg class="spark svelte-1osgb41"${attr("viewBox", `0 0 ${stringify(p.w)} ${stringify(p.h)}`)} preserveAspectRatio="none" aria-hidden="true"><defs class="svelte-1osgb41"><linearGradient${attr("id", gradId)} x1="0" x2="0" y1="0" y2="1" class="svelte-1osgb41"><stop offset="0%"${attr("stop-color", color)} stop-opacity="0.35" class="svelte-1osgb41"></stop><stop offset="100%"${attr("stop-color", color)} stop-opacity="0" class="svelte-1osgb41"></stop></linearGradient></defs><path${attr("d", p.area)}${attr("fill", `url(#${stringify(gradId)})`)} class="svelte-1osgb41"></path><path${attr("d", p.line)} fill="none"${attr("stroke", color)} stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" class="svelte-1osgb41"></path></svg>`);
    }
    function scopePill($$renderer3, s) {
      const acc = scopeAccount();
      $$renderer3.push(`<span class="scopePill svelte-1osgb41"><span class="acctDot svelte-1osgb41"${attr_style(`background: ${stringify(acc.color)}`)}></span> ${escape_html(acc.name)}</span>`);
    }
    $$renderer2.push(`<div class="root svelte-1osgb41"><header class="topbar svelte-1osgb41"><div class="topbarMain svelte-1osgb41"><span class="dotBrand svelte-1osgb41"></span> <div class="svelte-1osgb41"><div class="brandText svelte-1osgb41">Tok<span class="brandTextAccent svelte-1osgb41">Scrape</span></div> <h1 class="title svelte-1osgb41">Dashboard</h1></div></div> <div class="actions svelte-1osgb41"><button type="button" class="btn btnIcon svelte-1osgb41" title="Refresh" aria-label="Refresh"><svg viewBox="0 0 24 24" aria-hidden="true" class="svelte-1osgb41"><path d="M21 12a9 9 0 1 1-2.64-6.36" class="svelte-1osgb41"></path><path d="M21 3v6h-6" class="svelte-1osgb41"></path></svg></button> <button type="button" class="btn btnIcon svelte-1osgb41" title="Settings" aria-label="Settings"><svg viewBox="0 0 24 24" aria-hidden="true" class="svelte-1osgb41"><circle cx="12" cy="12" r="3" class="svelte-1osgb41"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" class="svelte-1osgb41"></path></svg></button> <button type="button" class="btn btnIcon svelte-1osgb41" title="Profile" aria-label="Profile"><span class="avatar svelte-1osgb41">DN</span></button></div></header> <main class="page svelte-1osgb41"><div class="acctBar svelte-1osgb41"><div${attr_class("acctSelect svelte-1osgb41", void 0, { "open": selectorOpen })}><button type="button" class="acctTrigger svelte-1osgb41"><span class="acctDot svelte-1osgb41"${attr_style(`background: ${stringify(current().color)}`)}></span> <span class="acctTriggerLabel svelte-1osgb41"><span class="acctTriggerK svelte-1osgb41">Viewing</span> <span class="acctTriggerV svelte-1osgb41">${escape_html(current().name)} `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span style="color: var(--muted-foreground); font-weight: 500; font-size: 12px" class="svelte-1osgb41">· ${escape_html(ACCOUNTS.length)} accounts</span>`);
    }
    $$renderer2.push(`<!--]--></span></span> <span class="acctCaret svelte-1osgb41">▾</span></button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="seg svelte-1osgb41"><!--[-->`);
    const each_array_2 = ensure_array_like(periods);
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let p = each_array_2[$$index_2];
      $$renderer2.push(`<button type="button"${attr_class("svelte-1osgb41", void 0, { "segActive": p === period })}>${escape_html(periodLabels[p])}</button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="streak svelte-1osgb41"><div class="streakCard svelte-1osgb41"><div class="streakNum svelte-1osgb41">${escape_html(STREAK.days)}</div> <div class="streakMeta svelte-1osgb41"><span class="streakMetaK svelte-1osgb41">Daily posting streak</span> <span class="streakMetaV svelte-1osgb41">${escape_html(STREAK.days)} days · best ${escape_html(STREAK.bestDays)}</span></div> <span class="streakFlame svelte-1osgb41" role="img" aria-label="streak">🔥</span></div> <div class="trendCard svelte-1osgb41" title="Videos posted this month vs last month"><span class="trendNum svelte-1osgb41">${escape_html(MONTH_COMPARE.thisMonth)}</span> <span${attr_class("trendArrow svelte-1osgb41", void 0, { "trendArrowDown": !up })}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="svelte-1osgb41">`);
    if (up) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<path d="M6 15l6-6 6 6" class="svelte-1osgb41"></path>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<path d="M6 9l6 6 6-6" class="svelte-1osgb41"></path>`);
    }
    $$renderer2.push(`<!--]--></svg></span> <span class="trendNum svelte-1osgb41" style="opacity: 0.5">${escape_html(MONTH_COMPARE.prevMonth)}</span> <span class="trendLabel svelte-1osgb41"><strong class="svelte-1osgb41">This month</strong> <br class="svelte-1osgb41"/> vs last month</span></div></div> <div class="kpis svelte-1osgb41"><!--[-->`);
    const each_array_3 = ensure_array_like(tiles());
    for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
      let t = each_array_3[$$index_3];
      $$renderer2.push(`<div class="kpi svelte-1osgb41"><div class="kpiLabel svelte-1osgb41"><span class="kpiLabelIcon svelte-1osgb41">${escape_html(t.icon)}</span> ${escape_html(t.label)}</div> <div class="kpiVal svelte-1osgb41">${escape_html(t.val)}</div> <div class="kpiDelta svelte-1osgb41"><span${attr_class("delta svelte-1osgb41", void 0, { "deltaUp": t.delta >= 0, "deltaDown": t.delta < 0 })}>${escape_html(pct(t.delta))}</span> 
						vs prev period</div> <div class="kpiSpark svelte-1osgb41">`);
      sparkline($$renderer2, t.spark, scopeColor(), `spark-${t.key}`);
      $$renderer2.push(`<!----></div></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="powerDeal svelte-1osgb41">`);
    accountBadges($$renderer2, POWER_DEAL.accounts, 4, 30);
    $$renderer2.push(`<!----> <div class="svelte-1osgb41"><div class="powerDealK svelte-1osgb41">Today's Power Deal</div> <div class="powerDealTitle svelte-1osgb41">${escape_html(POWER_DEAL.title)}</div> <div class="powerDealSub svelte-1osgb41">${escape_html(POWER_DEAL.sub)}</div></div> <div class="powerDealBadge svelte-1osgb41">View →</div></div> <section class="section svelte-1osgb41"><div class="sectionHead svelte-1osgb41"><h2 class="sectionTitle svelte-1osgb41">Products <span class="pill svelte-1osgb41">by brand</span></h2> <div class="sectionActions svelte-1osgb41">`);
    scopePill($$renderer2);
    $$renderer2.push(`<!----></div></div> <div style="overflow-x: auto" class="svelte-1osgb41"><table class="tbl svelte-1osgb41"><thead class="svelte-1osgb41"><tr class="svelte-1osgb41"><th style="width: 32px" class="svelte-1osgb41">#</th><th class="svelte-1osgb41">Brand</th><th style="width: 120px" class="svelte-1osgb41">Accounts</th><th class="num svelte-1osgb41">GMV</th><th class="num svelte-1osgb41"># Units</th><th class="num svelte-1osgb41">Commission</th><th class="num svelte-1osgb41" style="width: 70px">Trend</th></tr></thead><tbody class="svelte-1osgb41"><!--[-->`);
    const each_array_4 = ensure_array_like(products());
    for (let i = 0, $$length = each_array_4.length; i < $$length; i++) {
      let p = each_array_4[i];
      $$renderer2.push(`<tr class="svelte-1osgb41"><td class="svelte-1osgb41"><span${attr_class("rank svelte-1osgb41", void 0, { "gold": i < 3 })}>${escape_html(i + 1)}</span></td><td class="svelte-1osgb41"><div class="brand svelte-1osgb41">${escape_html(p.brand)}</div> <div class="sub svelte-1osgb41">${escape_html(p.category)}</div></td><td class="svelte-1osgb41">`);
      accountBadges($$renderer2, p.accounts);
      $$renderer2.push(`<!----></td><td class="num money svelte-1osgb41">${escape_html(fmtMoneyFull(p.gmv))}</td><td class="num svelte-1osgb41">${escape_html(p.units)}</td><td class="num money svelte-1osgb41">${escape_html(fmtMoneyFull(p.commission))}</td><td class="num svelte-1osgb41"><span style="font-weight: 700"${attr_class("svelte-1osgb41", void 0, { "deltaUp": p.trend >= 0, "deltaDown": p.trend < 0 })}>${escape_html(pct(p.trend))}</span></td></tr>`);
    }
    $$renderer2.push(`<!--]--></tbody></table></div></section> <section class="section svelte-1osgb41"><div class="sectionHead svelte-1osgb41"><h2 class="sectionTitle svelte-1osgb41">Videos <span class="pill svelte-1osgb41">top performing</span></h2> <div class="sectionActions svelte-1osgb41"><button type="button" class="btn svelte-1osgb41" style="font-size: 12px">View all →</button></div></div> <div class="videos svelte-1osgb41"><!--[-->`);
    const each_array_5 = ensure_array_like(videos());
    for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
      let v = each_array_5[$$index_5];
      $$renderer2.push(`<article class="video svelte-1osgb41"><div class="videoThumb svelte-1osgb41"><div class="videoThumbStripes svelte-1osgb41"></div> <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="svelte-1osgb41"><path d="M8 5v14l11-7z" class="svelte-1osgb41"></path></svg> <div class="videoBadges svelte-1osgb41">`);
      accountBadges($$renderer2, v.accounts, 3, 20);
      $$renderer2.push(`<!----></div></div> <div class="videoBody svelte-1osgb41"><div class="videoBrand svelte-1osgb41">${escape_html(v.brand)} `);
      if (v.hot) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="videoHot svelte-1osgb41">🔥 HOT</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="videoCaption svelte-1osgb41">${escape_html(v.caption)}</div> <div class="videoStats svelte-1osgb41"><div class="svelte-1osgb41"><div class="videoStatK svelte-1osgb41">GMV</div> <div class="videoStatV svelte-1osgb41">${escape_html(fmtMoney(v.gmv))}</div></div> <div class="svelte-1osgb41"><div class="videoStatK svelte-1osgb41">Views</div> <div class="videoStatV svelte-1osgb41">${escape_html(fmtInt(v.views))}</div></div> <div class="svelte-1osgb41"><div class="videoStatK svelte-1osgb41">Com.</div> <div class="videoStatV svelte-1osgb41">${escape_html(fmtMoney(v.commission))}</div></div></div></div></article>`);
    }
    $$renderer2.push(`<!--]--></div></section> <section class="section svelte-1osgb41"><div class="sectionHead svelte-1osgb41"><h2 class="sectionTitle svelte-1osgb41">Accounts <span class="pill svelte-1osgb41">legend</span></h2></div> <div class="legend svelte-1osgb41"><!--[-->`);
    const each_array_6 = ensure_array_like(ACCOUNTS);
    for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
      let a = each_array_6[$$index_6];
      $$renderer2.push(`<span class="acctChip svelte-1osgb41"><span class="acctDot svelte-1osgb41"${attr_style(`background: ${stringify(a.color)}`)}></span> ${escape_html(a.name)}</span>`);
    }
    $$renderer2.push(`<!--]--></div></section> <section class="section svelte-1osgb41"><div class="sectionHead svelte-1osgb41"><h2 class="sectionTitle svelte-1osgb41">Svelte Island  <span class="pill svelte-1osgb41">react + svelte side-by-side</span></h2></div> `);
    Counter($$renderer2, { initial: 5, label: "Compiled by Svelte 5" });
    $$renderer2.push(`<!----></section></main></div>`);
  });
}
export {
  MemberDashboardV2 as default
};
