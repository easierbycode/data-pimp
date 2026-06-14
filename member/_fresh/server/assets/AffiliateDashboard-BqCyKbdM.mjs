import { a as attr, d as derived } from "./index-g8GAdKGw.mjs";
import { e as escape_html } from "./escaping-ukrAy0Ul.mjs";
import "./utils-C1AuI3vl.mjs";
import "./base64-rR4j1CBY.mjs";
function checkCircle($$renderer) {
  $$renderer.push(`<svg class="icon-check svelte-2ot9y8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" class="svelte-2ot9y8"></circle><path d="m9 12 2 2 4-4" class="svelte-2ot9y8"></path></svg>`);
}
function copyIcon($$renderer) {
  $$renderer.push(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-2ot9y8"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" class="svelte-2ot9y8"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" class="svelte-2ot9y8"></path></svg>`);
}
function mousePointer($$renderer) {
  $$renderer.push(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-2ot9y8"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" class="svelte-2ot9y8"></path></svg>`);
}
function users($$renderer) {
  $$renderer.push(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-2ot9y8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" class="svelte-2ot9y8"></path><path d="M16 3.128a4 4 0 0 1 0 7.744" class="svelte-2ot9y8"></path><path d="M22 21v-2a4 4 0 0 0-3-3.87" class="svelte-2ot9y8"></path><circle cx="9" cy="7" r="4" class="svelte-2ot9y8"></circle></svg>`);
}
function dollar($$renderer) {
  $$renderer.push(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-2ot9y8"><circle cx="12" cy="12" r="10" class="svelte-2ot9y8"></circle><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" class="svelte-2ot9y8"></path><path d="M12 18V6" class="svelte-2ot9y8"></path></svg>`);
}
function externalLink($$renderer) {
  $$renderer.push(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-2ot9y8"><path d="M15 3h6v6" class="svelte-2ot9y8"></path><path d="M10 14 21 3" class="svelte-2ot9y8"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" class="svelte-2ot9y8"></path></svg>`);
}
function AffiliateDashboard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { stats } = $$props;
    const linkUrl = derived(() => stats.primaryLinkUrl);
    function extractToken(url) {
      if (!url) return null;
      try {
        return new URL(url).searchParams.get("via");
      } catch {
        return null;
      }
    }
    const affiliateToken = derived(() => extractToken(linkUrl()));
    function formatCurrency(dollars) {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(dollars);
    }
    function formatNumber(n) {
      return new Intl.NumberFormat("en-US").format(n);
    }
    function formatTimeAgo(isoString) {
      if (!isoString) return "Never synced";
      const diffMs = Date.now() - new Date(isoString).getTime();
      const minutes = Math.floor(diffMs / 6e4);
      if (minutes < 1) return "Just now";
      if (minutes < 60) {
        return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
      }
      const hours = Math.floor(minutes / 60);
      if (hours < 24) {
        return `${hours} hour${hours === 1 ? "" : "s"} ago`;
      }
      const days = Math.floor(hours / 24);
      return `${days} day${days === 1 ? "" : "s"} ago`;
    }
    $$renderer2.push(`<div class="root svelte-2ot9y8"><div class="dashboard svelte-2ot9y8"><div class="card fade-in svelte-2ot9y8"><div class="card-header svelte-2ot9y8"><div class="enrolled-row svelte-2ot9y8">`);
    checkCircle($$renderer2);
    $$renderer2.push(`<!----> <span class="badge badge-success svelte-2ot9y8">Enrolled as Affiliate</span></div> <h3 class="card-title link-title svelte-2ot9y8">Your Affiliate Link</h3></div> <div class="card-content svelte-2ot9y8"><div class="link-row svelte-2ot9y8"><input class="input mono svelte-2ot9y8"${attr("value", linkUrl())} readonly="" aria-label="Your affiliate link"/> <button type="button" class="btn btn-icon svelte-2ot9y8" aria-label="Copy affiliate link">`);
    {
      $$renderer2.push("<!--[-1-->");
      copyIcon($$renderer2);
    }
    $$renderer2.push(`<!--]--></button></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <p class="muted-text svelte-2ot9y8">Share this link to earn commissions on referrals.</p> `);
    if (affiliateToken()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="token-box svelte-2ot9y8"><div class="token-line svelte-2ot9y8"><span class="token-label svelte-2ot9y8">Your referral token</span> <code class="token-code svelte-2ot9y8">?via=${escape_html(affiliateToken())}</code></div> <p class="token-hint svelte-2ot9y8">You can also link to any page on our site by adding <code class="token-inline svelte-2ot9y8">?via=${escape_html(affiliateToken())}</code> to the end of the URL.</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> <div class="stats-grid svelte-2ot9y8"><div class="card stat-card fade-in svelte-2ot9y8" style="animation-delay:0ms"><div class="card-content stat-content svelte-2ot9y8"><div class="stat-top svelte-2ot9y8"><div class="stat-text svelte-2ot9y8"><p class="stat-label svelte-2ot9y8">Clicks</p> <p class="stat-value svelte-2ot9y8">${escape_html(formatNumber(stats.visitors))}</p> <p class="stat-sub svelte-2ot9y8">Primary link</p></div> <div class="stat-icon icon-blue svelte-2ot9y8">`);
    mousePointer($$renderer2);
    $$renderer2.push(`<!----></div></div></div></div> <div class="card stat-card fade-in svelte-2ot9y8" style="animation-delay:100ms"><div class="card-content stat-content svelte-2ot9y8"><div class="stat-top svelte-2ot9y8"><div class="stat-text svelte-2ot9y8"><p class="stat-label svelte-2ot9y8">Customers</p> <p class="stat-value svelte-2ot9y8">${escape_html(formatNumber(stats.conversions))}</p> <p class="stat-sub svelte-2ot9y8">Referred conversions</p></div> <div class="stat-icon icon-primary svelte-2ot9y8">`);
    users($$renderer2);
    $$renderer2.push(`<!----></div></div></div></div> <div class="card stat-card fade-in svelte-2ot9y8" style="animation-delay:200ms"><div class="card-content stat-content svelte-2ot9y8"><div class="stat-top svelte-2ot9y8"><div class="stat-text svelte-2ot9y8"><p class="stat-label svelte-2ot9y8">Commissions</p> <p class="stat-value stat-value-success svelte-2ot9y8">${escape_html(formatCurrency(stats.commissionsEarned))}</p> <p class="stat-sub svelte-2ot9y8">Earned</p></div> <div class="stat-icon icon-success svelte-2ot9y8">`);
    dollar($$renderer2);
    $$renderer2.push(`<!----></div></div> <div class="separator svelte-2ot9y8"></div> <div class="breakdown svelte-2ot9y8"><div class="breakdown-row svelte-2ot9y8"><span class="muted-text svelte-2ot9y8">Paid out</span> <span class="breakdown-value svelte-2ot9y8">${escape_html(formatCurrency(stats.commissionsPaid))}</span></div> <div class="breakdown-row svelte-2ot9y8"><span class="muted-text svelte-2ot9y8">Pending</span> <span class="breakdown-value svelte-2ot9y8">${escape_html(formatCurrency(stats.commissionsPending))}</span></div></div></div></div></div> <div class="synced-row svelte-2ot9y8"><span class="svelte-2ot9y8">Stats updated ${escape_html(formatTimeAgo(stats.lastSyncAt))}</span></div> <div class="card fade-in svelte-2ot9y8"><div class="card-header svelte-2ot9y8"><h3 class="card-title svelte-2ot9y8">Full Analytics</h3></div> <div class="card-content svelte-2ot9y8"><p class="muted-text svelte-2ot9y8">For a full breakdown of your commissions, payout history, and
					detailed referral analytics, open your Rewardful dashboard.</p> <button type="button" class="btn btn-primary btn-lg btn-block svelte-2ot9y8">`);
    externalLink($$renderer2);
    $$renderer2.push(`<!----> <span class="svelte-2ot9y8">Open Dashboard on Rewardful</span></button></div></div></div></div>`);
  });
}
export {
  AffiliateDashboard as default
};
