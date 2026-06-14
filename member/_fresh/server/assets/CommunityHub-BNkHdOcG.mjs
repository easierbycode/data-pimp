import { b as attr_class, a as attr, e as ensure_array_like, d as derived } from "./index-g8GAdKGw.mjs";
import { e as escape_html } from "./escaping-ukrAy0Ul.mjs";
import "./utils-C1AuI3vl.mjs";
import "./base64-rR4j1CBY.mjs";
function bell($$renderer) {
  $$renderer.push(`<svg class="icon svelte-ks3dhj" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>`);
}
function alertCircle($$renderer) {
  $$renderer.push(`<svg class="icon svelte-ks3dhj" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line></svg>`);
}
function externalLink($$renderer) {
  $$renderer.push(`<svg class="icon svelte-ks3dhj" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>`);
}
function xIcon($$renderer) {
  $$renderer.push(`<svg class="icon svelte-ks3dhj" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`);
}
function discordGlyph($$renderer) {
  $$renderer.push(`<svg class="discord-glyph svelte-ks3dhj" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"></path></svg>`);
}
function CommunityHub($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { canConnectDiscord = true, platforms = [], announcements = [] } = $$props;
    const READ_KEY = "community-read-announcements";
    const BANNER_KEY = "community-banner-dismissed";
    function loadReadIds() {
      if (typeof localStorage === "undefined") return /* @__PURE__ */ new Set();
      try {
        const stored = localStorage.getItem(READ_KEY);
        return new Set(stored ? JSON.parse(stored) : []);
      } catch {
        return /* @__PURE__ */ new Set();
      }
    }
    const readIds = loadReadIds();
    let items = announcements.map((a) => ({ ...a, read: a.read || readIds.has(a.id) }));
    let activeTab = "platforms";
    function initialBannerDismissed() {
      if (typeof localStorage === "undefined") return false;
      const dismissed = localStorage.getItem(BANNER_KEY);
      if (!dismissed) return false;
      const daysSince = (Date.now() - new Date(dismissed).getTime()) / (1e3 * 60 * 60 * 24);
      return daysSince < 7;
    }
    let bannerDismissed = initialBannerDismissed();
    const unreadCount = derived(() => items.filter((a) => !a.read).length);
    const discordPlatform = derived(() => platforms.find((p) => p.id === "discord"));
    const discordConnected = derived(() => discordPlatform()?.connected ?? false);
    const disconnectedPlatforms = derived(() => platforms.filter((p) => !p.connected));
    const showConnectBanner = derived(() => disconnectedPlatforms().length > 0 && !bannerDismissed && !discordConnected() && canConnectDiscord);
    $$renderer2.push(`<div class="root svelte-ks3dhj">`);
    if (showConnectBanner()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="banner svelte-ks3dhj"><div class="banner__top svelte-ks3dhj"><div class="banner__lead svelte-ks3dhj"><div class="banner__icon svelte-ks3dhj">`);
      alertCircle($$renderer2);
      $$renderer2.push(`<!----></div> <div><h3 class="banner__title svelte-ks3dhj">Discord Required <span class="badge badge--warning svelte-ks3dhj">Important</span></h3> <p class="banner__sub svelte-ks3dhj">Connect to Discord — our primary support and community
							channel</p></div></div> <button type="button" class="icon-btn svelte-ks3dhj" aria-label="Dismiss banner">`);
      xIcon($$renderer2);
      $$renderer2.push(`<!----></button></div> <button type="button" class="btn btn--discord btn--lg svelte-ks3dhj">`);
      externalLink($$renderer2);
      $$renderer2.push(`<!----> Connect Now</button></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="tabs"><div class="tabs__list svelte-ks3dhj" role="tablist"><button type="button" role="tab"${attr_class("tab svelte-ks3dhj", void 0, { "tab--active": activeTab === "platforms" })}${attr("aria-selected", activeTab === "platforms")}>Platforms</button> <button type="button" role="tab"${attr_class("tab svelte-ks3dhj", void 0, { "tab--active": activeTab === "announcements" })}${attr("aria-selected", activeTab === "announcements")}>`);
    bell($$renderer2);
    $$renderer2.push(`<!----> Announcements `);
    if (unreadCount() > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="badge badge--info badge--count svelte-ks3dhj">${escape_html(unreadCount())}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></button></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="tab-panel svelte-ks3dhj"><!--[-->`);
      const each_array = ensure_array_like(platforms);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let platform = each_array[$$index];
        $$renderer2.push(`<div class="card platform-card svelte-ks3dhj"><div class="platform-card__header svelte-ks3dhj"><div class="platform-card__lead svelte-ks3dhj"><div class="platform-card__logo svelte-ks3dhj">`);
        discordGlyph($$renderer2);
        $$renderer2.push(`<!----></div> <div class="platform-card__meta svelte-ks3dhj"><div class="card__title svelte-ks3dhj">${escape_html(platform.name)}</div> <div class="card__desc svelte-ks3dhj">${escape_html(platform.description)}</div></div></div> `);
        if (!platform.connected) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="badge badge--info platform-card__badge svelte-ks3dhj">${escape_html(platform.id === "discord" && !canConnectDiscord ? "Subscription required" : "Connect")}</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> <div class="platform-card__body svelte-ks3dhj">`);
        if (platform.connected) {
          $$renderer2.push("<!--[0-->");
          if (platform.username) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="connected-pill svelte-ks3dhj">Connected as <span class="connected-pill__name svelte-ks3dhj">${escape_html(platform.username)}</span></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <p class="card__desc svelte-ks3dhj">You're connected to our ${escape_html(platform.name)} community! Join the
									conversation, ask questions, and connect with other members.</p> <button type="button" class="btn btn--discord btn--block svelte-ks3dhj">`);
          externalLink($$renderer2);
          $$renderer2.push(`<!----> Open ${escape_html(platform.name)}</button>`);
        } else if (platform.id === "discord" && !canConnectDiscord) {
          $$renderer2.push("<!--[1-->");
          $$renderer2.push(`<p class="card__desc svelte-ks3dhj">An active subscription or eligible access is required to
									connect Discord and join the server.</p> <button type="button" class="btn btn--primary btn--block svelte-ks3dhj">View billing &amp; plans</button>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<button type="button" class="btn btn--discord btn--block svelte-ks3dhj">`);
          externalLink($$renderer2);
          $$renderer2.push(`<!----> Connect ${escape_html(platform.name)}</button>`);
        }
        $$renderer2.push(`<!--]--></div></div>`);
      }
      $$renderer2.push(`<!--]--> <div class="card future-card svelte-ks3dhj"><div class="future-card__icon svelte-ks3dhj"><svg class="icon icon--lg svelte-ks3dhj" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16m8-8H4"></path></svg></div> <h3 class="future-card__title svelte-ks3dhj">More Platforms Coming Soon</h3> <p class="future-card__sub svelte-ks3dhj">We're working on integrating additional platforms to expand your
						community experience.</p></div></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  CommunityHub as default
};
