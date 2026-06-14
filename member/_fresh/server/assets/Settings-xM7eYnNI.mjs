import { e as ensure_array_like, b as attr_class, a as attr } from "./index-g8GAdKGw.mjs";
import { g as SETTINGS_DATA } from "../server-entry.mjs";
import { e as escape_html } from "./escaping-ukrAy0Ul.mjs";
import "./utils-C1AuI3vl.mjs";
import "./base64-rR4j1CBY.mjs";
function iconSettings($$renderer) {
  $$renderer.push(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-1rwstlc"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" class="svelte-1rwstlc"></path><circle cx="12" cy="12" r="3" class="svelte-1rwstlc"></circle></svg>`);
}
function iconLock($$renderer) {
  $$renderer.push(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-1rwstlc"><circle cx="12" cy="16" r="1" class="svelte-1rwstlc"></circle><rect x="3" y="10" width="18" height="12" rx="2" class="svelte-1rwstlc"></rect><path d="M7 10V7a5 5 0 0 1 10 0v3" class="svelte-1rwstlc"></path></svg>`);
}
function iconCard($$renderer) {
  $$renderer.push(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-1rwstlc"><rect width="20" height="14" x="2" y="5" rx="2" class="svelte-1rwstlc"></rect><line x1="2" x2="22" y1="10" y2="10" class="svelte-1rwstlc"></line></svg>`);
}
function iconAlert($$renderer) {
  $$renderer.push(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-1rwstlc"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" class="svelte-1rwstlc"></path><path d="M12 9v4" class="svelte-1rwstlc"></path><path d="M12 17h.01" class="svelte-1rwstlc"></path></svg>`);
}
function navIcon($$renderer, id) {
  if (id === "general") {
    $$renderer.push("<!--[0-->");
    iconSettings($$renderer);
  } else if (id === "security") {
    $$renderer.push("<!--[1-->");
    iconLock($$renderer);
  } else if (id === "billing") {
    $$renderer.push("<!--[2-->");
    iconCard($$renderer);
  } else {
    $$renderer.push("<!--[-1-->");
    iconAlert($$renderer);
  }
  $$renderer.push(`<!--]-->`);
}
function Settings($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data = SETTINGS_DATA } = $$props;
    const NAV = [
      { id: "general", title: "General" },
      { id: "security", title: "Security" },
      { id: "billing", title: "Billing" },
      { id: "danger-zone", title: "Danger Zone" }
    ];
    let active = "general";
    let name = data.user.name;
    let email = data.user.email;
    let notificationEmail = data.user.notificationEmail;
    $$renderer2.push(`<div class="root svelte-1rwstlc"><div class="layout svelte-1rwstlc"><aside class="sidebar svelte-1rwstlc"><div class="sidebar__head svelte-1rwstlc"><span class="avatar svelte-1rwstlc">${escape_html(data.user.initials)}</span> <h2 class="sidebar__heading svelte-1rwstlc">Account</h2></div> <ul class="nav svelte-1rwstlc"><!--[-->`);
    const each_array = ensure_array_like(NAV);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let item = each_array[$$index];
      $$renderer2.push(`<li class="svelte-1rwstlc"><button type="button"${attr_class("nav__item svelte-1rwstlc", void 0, { "active": active === item.id })}${attr("aria-current", active === item.id ? "page" : void 0)}><span class="nav__icon svelte-1rwstlc">`);
      navIcon($$renderer2, item.id);
      $$renderer2.push(`<!----></span> <span class="svelte-1rwstlc">${escape_html(item.title)}</span></button></li>`);
    }
    $$renderer2.push(`<!--]--></ul></aside> <div class="content svelte-1rwstlc">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<section class="card svelte-1rwstlc"><div class="card__grid svelte-1rwstlc"><div class="card__meta svelte-1rwstlc"><h3 class="card__title svelte-1rwstlc">Avatar</h3> <p class="card__desc svelte-1rwstlc">Upload an image for your profile.</p> <p class="card__hint svelte-1rwstlc">JPG, PNG or GIF. Max 1MB.</p></div> <div class="card__body svelte-1rwstlc"><div class="avatar-row svelte-1rwstlc"><span class="avatar avatar--lg svelte-1rwstlc">${escape_html(data.user.initials)}</span> <button type="button" class="btn btn--light svelte-1rwstlc" disabled=""><svg class="btn__icon svelte-1rwstlc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" class="svelte-1rwstlc"></path><path d="m17 8-5-5-5 5" class="svelte-1rwstlc"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" class="svelte-1rwstlc"></path></svg> Upload</button></div> <p class="note svelte-1rwstlc">Account changes are available once sign-in is connected.</p></div></div></section> <section class="card svelte-1rwstlc"><div class="card__grid svelte-1rwstlc"><div class="card__meta svelte-1rwstlc"><h3 class="card__title svelte-1rwstlc">Change name</h3></div> <div class="card__body svelte-1rwstlc"><input class="input svelte-1rwstlc" type="text"${attr("value", name)}/> <div class="actions svelte-1rwstlc"><button type="button" class="btn btn--primary svelte-1rwstlc" disabled="">Save</button></div> <p class="note svelte-1rwstlc">Account changes are available once sign-in is connected.</p></div></div></section> <section class="card svelte-1rwstlc"><div class="card__grid svelte-1rwstlc"><div class="card__meta svelte-1rwstlc"><h3 class="card__title svelte-1rwstlc">Change email</h3> <p class="card__desc svelte-1rwstlc">This is the email you use to sign in.</p></div> <div class="card__body svelte-1rwstlc"><input class="input svelte-1rwstlc" type="email"${attr("value", email)}/> <div class="actions svelte-1rwstlc"><button type="button" class="btn btn--primary svelte-1rwstlc" disabled="">Save</button></div> <p class="note svelte-1rwstlc">Account changes are available once sign-in is connected.</p></div></div></section> <section class="card svelte-1rwstlc"><div class="card__grid svelte-1rwstlc"><div class="card__meta svelte-1rwstlc"><h3 class="card__title svelte-1rwstlc">Notification email</h3> <p class="card__desc svelte-1rwstlc">Where we send product and billing notifications.</p></div> <div class="card__body svelte-1rwstlc"><input class="input svelte-1rwstlc" type="email"${attr("placeholder", data.user.email)}${attr("value", notificationEmail)}/> <div class="actions svelte-1rwstlc"><button type="button" class="btn btn--primary svelte-1rwstlc" disabled="">Save</button></div> <p class="note svelte-1rwstlc">Account changes are available once sign-in is connected.</p></div></div></section>`);
    }
    $$renderer2.push(`<!--]--></div></div></div>`);
  });
}
export {
  Settings as default
};
