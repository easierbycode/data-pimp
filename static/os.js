// Thirsty OS — a tiny desktop window manager (no dependencies).
// Folders hold app icons; icons launch draggable, resizable windows that
// embed each app in an iframe. Built to feel like a real desktop while
// keeping the existing Inventory dashboard fully intact at /inventory.

// Escape interpolated text before it goes into an innerHTML template, so a
// future app name/title sourced from config/API can't break out of markup.
const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );

/* ---------------------------------------------------------------- icons -- */

// Gradient defs live once in a hidden sprite (injected at boot) — SVG url()
// references are document-scoped, so every icon instance reuses them without
// duplicating element ids across the DOM.
const ICON_GRADIENTS = `
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <defs>
      <linearGradient id="g-folder-back" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#c75408"/><stop offset="1" stop-color="#9c4106"/>
      </linearGradient>
      <linearGradient id="g-folder-front" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f6a93f"/><stop offset="1" stop-color="#e8650a"/>
      </linearGradient>
      <linearGradient id="g-inv" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f5832e"/><stop offset="1" stop-color="#d2560a"/>
      </linearGradient>
      <linearGradient id="g-val" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f7c64f"/><stop offset="1" stop-color="#e89b16"/>
      </linearGradient>
      <linearGradient id="g-box" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4fc3a1"/><stop offset="1" stop-color="#239b7e"/>
      </linearGradient>
      <linearGradient id="g-mobile" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#7c5cd6"/>
      </linearGradient>
      <linearGradient id="g-browser" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#5b9bd5"/><stop offset="1" stop-color="#2f6fb0"/>
      </linearGradient>
      <linearGradient id="g-kiosk" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#54c4f5"/><stop offset="1" stop-color="#1f8fd1"/>
      </linearGradient>
    </defs>
  </svg>`;

const ICONS = {
  folder: `
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5 17a4 4 0 0 1 4-4h13.2a4 4 0 0 1 2.9 1.25L31 19h24a4 4 0 0 1 4 4v25a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" fill="url(#g-folder-back)"/>
      <path d="M7 27a3 3 0 0 1 3-3h44a3 3 0 0 1 3 3v21a4 4 0 0 1-4 4H10a3 3 0 0 1-3-3Z" fill="url(#g-folder-front)"/>
      <path d="M7 27a3 3 0 0 1 3-3h44a3 3 0 0 1 3 3v3H7Z" fill="#fff" opacity=".14"/>
    </svg>`,

  inventory: `
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#g-inv)"/>
      <rect x="6" y="6" width="52" height="26" rx="14" fill="#fff" opacity=".10"/>
      <rect x="16" y="33" width="7" height="15" rx="2.5" fill="#fff" opacity=".95"/>
      <rect x="28.5" y="25" width="7" height="23" rx="2.5" fill="#fff" opacity=".95"/>
      <rect x="41" y="18" width="7" height="30" rx="2.5" fill="#fff"/>
      <circle cx="44.5" cy="14" r="3" fill="#ffe7c2"/>
    </svg>`,

  valuation: `
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#g-val)"/>
      <rect x="6" y="6" width="52" height="26" rx="14" fill="#fff" opacity=".12"/>
      <path d="M30.5 16.5h9.7a3 3 0 0 1 2.12.88l6.3 6.3a3 3 0 0 1 .88 2.12v9.7a3 3 0 0 1-.88 2.12L34.8 49.4a3 3 0 0 1-4.24 0L16.6 35.44a3 3 0 0 1 0-4.24L28.38 17.4a3 3 0 0 1 2.12-.9Z" fill="#3a2a05" opacity=".22"/>
      <path d="M29.5 15.5h9.7a3 3 0 0 1 2.12.88l6.3 6.3a3 3 0 0 1 .88 2.12v9.7a3 3 0 0 1-.88 2.12L33.8 48.4a3 3 0 0 1-4.24 0L15.6 34.44a3 3 0 0 1 0-4.24L27.38 16.4a3 3 0 0 1 2.12-.9Z" fill="#fffaf0"/>
      <circle cx="39.2" cy="24.8" r="3.4" fill="#e89b16"/>
      <text x="29.5" y="40" font-family="Space Grotesk, sans-serif" font-size="17" font-weight="700" fill="#c77f0c" text-anchor="middle">$</text>
    </svg>`,

  // Lucide "boxes" glyph on the teal tile — shared by Inventory and Kiosk.
  boxes: `
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#g-box)"/>
      <rect x="6" y="6" width="52" height="26" rx="14" fill="#fff" opacity=".10"/>
      <g transform="translate(14 14) scale(1.5)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/>
        <path d="m7 16.5-4.74-2.85"/>
        <path d="m7 16.5 5-3"/>
        <path d="M7 16.5v5.17"/>
        <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/>
        <path d="m17 16.5-5-3"/>
        <path d="m17 16.5 4.74-2.85"/>
        <path d="M17 16.5v5.17"/>
        <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/>
        <path d="M12 8 7.26 5.15"/>
        <path d="m12 8 4.74-2.85"/>
        <path d="M12 13.5V8"/>
      </g>
    </svg>`,

  mobile: `
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#g-mobile)"/>
      <rect x="6" y="6" width="52" height="26" rx="14" fill="#fff" opacity=".12"/>
      <rect x="22" y="13" width="20" height="38" rx="5" fill="#fff"/>
      <rect x="24.5" y="17.5" width="15" height="26" rx="2" fill="#7c5cd6" opacity=".45"/>
      <circle cx="32" cy="15.4" r="0.9" fill="#7c5cd6" opacity=".6"/>
      <rect x="29" y="46.5" width="6" height="1.8" rx="0.9" fill="#7c5cd6" opacity=".6"/>
    </svg>`,

  browser: `
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#g-browser)"/>
      <rect x="6" y="6" width="52" height="26" rx="14" fill="#fff" opacity=".12"/>
      <g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round">
        <circle cx="32" cy="32" r="15"/>
        <ellipse cx="32" cy="32" rx="6.5" ry="15"/>
        <line x1="17" y1="32" x2="47" y2="32"/>
        <line x1="19.5" y1="24" x2="44.5" y2="24" stroke-width="1.8" opacity=".8"/>
        <line x1="19.5" y1="40" x2="44.5" y2="40" stroke-width="1.8" opacity=".8"/>
      </g>
    </svg>`,

  // Lucide "qr-code" glyph (the Kiosk's Checkout-tab icon) on a sky tile.
  qr: `
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#g-kiosk)"/>
      <rect x="6" y="6" width="52" height="26" rx="14" fill="#fff" opacity=".12"/>
      <g transform="translate(14 14) scale(1.5)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="5" height="5" x="3" y="3" rx="1"/>
        <rect width="5" height="5" x="16" y="3" rx="1"/>
        <rect width="5" height="5" x="3" y="16" rx="1"/>
        <path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
        <path d="M21 21v.01"/>
        <path d="M12 7v3a2 2 0 0 1-2 2H7"/>
        <path d="M3 12h.01"/>
        <path d="M12 3h.01"/>
        <path d="M12 16v.01"/>
        <path d="M16 12h1"/>
        <path d="M21 12v.01"/>
        <path d="M12 21v-1"/>
      </g>
    </svg>`,
};

/* ------------------------------------------------------------ app model -- */

// Per-item `allow` is the iframe Permissions-Policy allowlist. The Kiosk and
// Inventory apps get `camera` for QR/barcode scanning; everything else stays
// minimal. External apps are marked so they get a sandbox that blocks
// top-navigation (a kiosk must not be navigated away from the OS shell).
const FOLDERS = [
  {
    id: "apps",
    name: "Apps",
    icon: ICONS.folder,
    items: [
      {
        id: "product-analysis",
        name: "Product Analysis",
        icon: ICONS.inventory,
        // Migrated from the kiosk — now served same-origin by data-pimp.
        url: "/inventory",
        allow: "fullscreen",
        width: 1180,
        height: 780,
      },
      {
        id: "inventory",
        name: "Inventory",
        icon: ICONS.boxes,
        url: "https://admin.thirsty.store",
        allow: "fullscreen; camera",
        external: true,
        width: 1180,
        height: 780,
      },
      {
        id: "kiosk",
        name: "Kiosk",
        icon: ICONS.qr,
        // The storefront that used to live at thirsty.store, now an app inside
        // the OS (same-origin, served under /kiosk).
        url: "/kiosk",
        allow: "fullscreen; camera",
        width: 1180,
        height: 780,
      },
    ],
  },
  {
    id: "demos",
    name: "Demos",
    icon: ICONS.folder,
    items: [
      {
        id: "sample-valuation",
        name: "Sample Valuation",
        icon: ICONS.valuation,
        url:
          "https://easierbycode.com/tok-scrape/extension-creator-demo/samples-modal/",
        allow: "fullscreen",
        external: true,
        width: 1040,
        height: 720,
      },
      {
        id: "samples",
        name: "Samples",
        icon: ICONS.mobile,
        url: "https://easierbycode.com/tok-scrape/mobile-demo/www/",
        allow: "fullscreen",
        external: true,
        // Phone-shaped window to suit the mobile demo. `mobile` keeps its width
        // fixed when snapped to a screen half (see snapWindow).
        mobile: true,
        width: 430,
        height: 780,
      },
    ],
  },
  {
    id: "member",
    name: "Member",
    icon: ICONS.folder,
    items: [
      {
        id: "tokscrape-dashboard",
        name: "App",
        icon: ICONS.mobile,
        // The TokScrape member dashboard — a third-party origin, so it gets the
        // top-navigation-blocking sandbox like the other external apps.
        url: "https://easierbycode.com/tok-scrape/mobile-app/www/",
        allow: "fullscreen",
        external: true,
        // Phone-shaped window — it's a Cordova mobile app (matches Samples).
        // `mobile` keeps its width fixed when snapped to a screen half.
        mobile: true,
        width: 430,
        height: 780,
      },
      {
        id: "member-web",
        name: "Web",
        icon: ICONS.browser,
        // The Fresh 2.3 member dashboard, served same-origin by data-pimp under
        // /member (see main.ts). Same-origin, so no top-nav-blocking sandbox —
        // it opens in a normal draggable OS window.
        url: "/member",
        allow: "fullscreen",
        width: 1180,
        height: 780,
      },
    ],
  },
];

/* ----------------------------------------------------------- WM globals -- */

const desktop = document.getElementById("desktop");
const dock = document.getElementById("dock");
const activeAppLabel = document.getElementById("active-app");
const statusEl = document.getElementById("menubar-status");

const windows = new Map(); // winId -> window state
let zTop = 100;
let openCount = 0;
let statusTimer = 0;

const zidx = (win) => Number(win.el.style.zIndex) || 0;

function deskRect() {
  return desktop.getBoundingClientRect();
}

// Reserve the dock's footprint (matches --dock-h used by .desktop-icons) so
// maximized windows don't tuck their bottom edge under the floating dock.
function dockClearance() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--dock-h");
  return parseInt(v, 10) || 78;
}

// Smallest a window may be, never larger than the desktop itself (so a
// portrait/kiosk viewport can't force a window wider than the screen).
function minSize(d) {
  return { w: Math.min(340, d.width - 16), h: Math.min(220, d.height - 16) };
}

// Briefly surface a status message in the menubar (app-launch toast).
function flashStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.opacity = "1";
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (statusEl.style.opacity = "0"), 1600);
}

/* ------------------------------------------------------- desktop icons -- */

// Icons are app launchers: a single click/tap opens them (kiosk-friendly,
// and far more reliable on touch than double-tap). As <button>s they also
// activate on Enter/Space for keyboard users.
function makeIcon(label, svg, onOpen) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon";
  btn.innerHTML =
    `<span class="icon-glyph">${svg}</span><span class="icon-label">${esc(label)}</span>`;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onOpen();
  });
  return btn;
}

function renderDesktop() {
  const root = document.getElementById("desktop-icons");
  for (const folder of FOLDERS) {
    root.appendChild(makeIcon(folder.name, folder.icon, () => openFolder(folder)));
  }
}

/* ----------------------------------------------------------- windowing -- */

// Move keyboard focus into a window's chrome (the close button), so a
// keyboard/SR user lands inside the window that just came forward.
function focusChrome(win) {
  const btn = win.el.querySelector(".light.close");
  if (btn) requestAnimationFrame(() => btn.focus());
}

function focusWindow(winId) {
  const win = windows.get(winId);
  if (!win) return;
  // Keep window z-indexes well below the dock/menubar, even after thousands
  // of focus changes in a long-lived kiosk session.
  if (zTop > 4000) normalizeZ();
  win.el.style.zIndex = String(++zTop);
  for (const other of windows.values()) {
    const active = other === win;
    other.el.classList.toggle("active", active);
    if (other.dockEl) other.dockEl.classList.toggle("focused", active);
  }
  activeAppLabel.textContent = win.title;
}

function normalizeZ() {
  const ordered = [...windows.values()].sort((a, b) => zidx(a) - zidx(b));
  zTop = 100;
  for (const w of ordered) w.el.style.zIndex = String(++zTop);
}

function frontWindow(exclude) {
  return [...windows.values()]
    .filter((w) => w !== exclude && !w.minimized)
    .sort((a, b) => zidx(a) - zidx(b))
    .pop();
}

function clampIntoView(win) {
  const d = deskRect();
  const w = win.el.offsetWidth;
  let x = win.el.offsetLeft;
  let y = win.el.offsetTop;
  x = Math.min(d.width - 60, Math.max(60 - w, x));
  y = Math.min(d.height - 44, Math.max(0, y));
  win.el.style.left = x + "px";
  win.el.style.top = y + "px";
}

function createWindow({ id, title, icon, bodyHTML, width, height, launcher, mobile }) {
  const d = deskRect();
  const min = minSize(d);
  const w = Math.max(min.w, Math.min(width, d.width - 24));
  const h = Math.max(min.h, Math.min(height, d.height - 24));

  // Cascade so stacked windows stay individually reachable.
  const step = (openCount++ % 6) * 30;
  const left = Math.max(12, Math.min((d.width - w) / 2 + step - 80, d.width - w - 12));
  const top = Math.max(12, Math.min(28 + step, d.height - h - 12));

  const el = document.createElement("section");
  el.className = "window";
  el.style.width = w + "px";
  el.style.height = h + "px";
  el.style.left = Math.round(left) + "px";
  el.style.top = Math.round(top) + "px";
  el.style.zIndex = String(++zTop);
  // Non-modal labelled group (multiple windows coexist over a live desktop);
  // focusable so keyboard move/resize and focus-restore work.
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", title);
  el.setAttribute("tabindex", "-1");

  el.innerHTML = `
    <div class="titlebar">
      <div class="traffic">
        <button class="light close" type="button" aria-label="Close ${esc(title)}"><span class="glyph">×</span></button>
        <button class="light min" type="button" aria-label="Minimize ${esc(title)}"><span class="glyph">−</span></button>
        <button class="light zoom" type="button" aria-label="Zoom ${esc(title)}"><span class="glyph">+</span></button>
      </div>
      <div class="titlebar-title"><span class="ttl-glyph">${icon}</span><span class="ttl-text"></span></div>
      <div class="titlebar-spacer"></div>
    </div>
    <div class="window-body">${bodyHTML}</div>
    <div class="resize-handle" aria-hidden="true"></div>`;

  el.querySelector(".ttl-text").textContent = title;
  desktop.appendChild(el);

  const win = {
    id,
    el,
    title,
    icon,
    minimized: false,
    maximized: false,
    snapped: null, // null | "left" | "right" — current half-screen tiling
    mobile: !!mobile, // phone-shaped app: keep its width when snapping
    prevRect: null,
    dockEl: null,
    launcher: launcher || null,
    loaderTimer: 0,
    _endGesture: null,
  };
  windows.set(id, win);

  // Window chrome wiring.
  const titlebar = el.querySelector(".titlebar");
  el.querySelector(".light.close").addEventListener("click", () => closeWindow(win));
  el.querySelector(".light.min").addEventListener("click", () => setMinimized(win, true));
  el.querySelector(".light.zoom").addEventListener("click", () => toggleMax(win));
  titlebar.addEventListener("dblclick", (e) => {
    if (!e.target.closest(".light")) toggleMax(win);
  });

  el.addEventListener("pointerdown", () => focusWindow(id), true);
  el.addEventListener("keydown", (e) => keyMoveResize(win, e));
  enableDrag(win, titlebar);
  enableResize(win, el.querySelector(".resize-handle"));
  addDockItem(win);

  // Animate in, raise, and hand keyboard focus to the new window.
  requestAnimationFrame(() => el.classList.add("open"));
  focusWindow(id);
  focusChrome(win);
  return win;
}

function closeWindow(win) {
  if (win._endGesture) win._endGesture(); // self-heal an in-flight drag/resize
  if (win.loaderTimer) clearTimeout(win.loaderTimer);
  win.el.classList.remove("open");
  if (win.dockEl) win.dockEl.remove();
  windows.delete(win.id);
  setTimeout(() => win.el.remove(), 170);

  // Hand focus to the next window, or back to the icon that launched this one.
  const next = frontWindow(win);
  if (next) {
    focusWindow(next.id);
    focusChrome(next);
  } else {
    activeAppLabel.textContent = "Finder";
    if (win.launcher && document.contains(win.launcher) && win.launcher.focus) {
      win.launcher.focus();
    }
  }
}

function setMinimized(win, min) {
  if (min) {
    win.minimized = true;
    win.el.classList.add("minimizing");
    if (win.dockEl) win.dockEl.classList.add("minimized");
    win.el.addEventListener("transitionend", function hide() {
      if (win.minimized) win.el.style.display = "none";
      win.el.removeEventListener("transitionend", hide);
    });
    const next = frontWindow(win);
    if (next) {
      focusWindow(next.id);
      focusChrome(next);
    } else {
      activeAppLabel.textContent = "Finder";
      if (win.dockEl) win.dockEl.focus(); // keep focus on the now-docked app
    }
  } else {
    win.minimized = false;
    win.el.style.display = "";
    if (win.dockEl) win.dockEl.classList.remove("minimized");
    void win.el.offsetWidth; // reflow so the transition replays
    win.el.classList.remove("minimizing");
    focusWindow(win.id);
    focusChrome(win);
  }
}

function toggleMax(win) {
  const d = deskRect();
  if (win.maximized) {
    const r = win.prevRect;
    Object.assign(win.el.style, {
      left: r.left + "px",
      top: r.top + "px",
      width: r.width + "px",
      height: r.height + "px",
    });
    win.el.classList.remove("maximized");
    win.maximized = false;
    clampIntoView(win); // a stale prevRect can't strand the window off-screen
  } else {
    win.prevRect = {
      left: win.el.offsetLeft,
      top: win.el.offsetTop,
      width: win.el.offsetWidth,
      height: win.el.offsetHeight,
    };
    Object.assign(win.el.style, {
      left: "0px",
      top: "0px",
      width: d.width + "px",
      height: d.height - dockClearance() + "px",
    });
    win.el.classList.add("maximized");
    win.maximized = true;
  }
  focusWindow(win.id);
}

// Tile a window to the left or right half of the desktop. Re-snapping the same
// side restores the pre-snap geometry. Mobile (phone-shaped) apps keep their
// width — they're just parked against that edge at full height. `freeRect` lets
// a drag-snap pass the geometry to restore to (its position before the drag).
function snapWindow(win, side, freeRect) {
  const d = deskRect();
  // Same-side snap toggles back to the floating geometry.
  if (win.snapped === side && !win.maximized) return restoreSnap(win);
  // Capture the floating rect once, before the first tile from a free state.
  // (Coming from maximized, prevRect already holds the pre-maximize rect.)
  if (!win.snapped && !win.maximized) {
    win.prevRect = freeRect || {
      left: win.el.offsetLeft,
      top: win.el.offsetTop,
      width: win.el.offsetWidth,
      height: win.el.offsetHeight,
    };
  }
  // Phone width is read before maximize state is cleared, so a maximized phone
  // falls back to its real (pre-maximize) width rather than the full screen.
  const phoneW = win.maximized && win.prevRect ? win.prevRect.width : win.el.offsetWidth;
  if (win.maximized) {
    win.el.classList.remove("maximized");
    win.maximized = false;
  }
  const w = win.mobile ? phoneW : Math.round(d.width / 2);
  Object.assign(win.el.style, {
    left: (side === "left" ? 0 : d.width - w) + "px",
    top: "0px",
    width: w + "px",
    height: d.height - dockClearance() + "px",
  });
  win.snapped = side;
  focusWindow(win.id);
}

// Undo a snap (or maximize), returning the window to its saved floating rect.
function restoreSnap(win) {
  win.snapped = null;
  const r = win.prevRect;
  if (!r) return;
  Object.assign(win.el.style, {
    left: r.left + "px",
    top: r.top + "px",
    width: r.width + "px",
    height: r.height + "px",
  });
  clampIntoView(win); // a stale prevRect can't strand the window off-screen
  focusWindow(win.id);
}

// Keyboard move (Arrow) / resize (Shift+Arrow) for the focused window.
function keyMoveResize(win, e) {
  if (!e.key.startsWith("Arrow")) return;
  // Ctrl+Alt+Arrow → window tiling: snap halves, maximize, or restore. Handled
  // before the maximized guard so Down can un-maximize.
  if (e.ctrlKey && e.altKey) {
    e.preventDefault();
    if (e.key === "ArrowLeft") snapWindow(win, "left");
    else if (e.key === "ArrowRight") snapWindow(win, "right");
    else if (e.key === "ArrowUp" && !win.maximized) toggleMax(win);
    else if (e.key === "ArrowDown") win.maximized ? toggleMax(win) : restoreSnap(win);
    return;
  }
  if (win.maximized) return;
  e.preventDefault();
  win.snapped = null; // an arrow nudge floats the window off its tiled half
  const d = deskRect();
  const STEP = 24;
  const dx = e.key === "ArrowLeft" ? -STEP : e.key === "ArrowRight" ? STEP : 0;
  const dy = e.key === "ArrowUp" ? -STEP : e.key === "ArrowDown" ? STEP : 0;
  if (e.shiftKey) {
    const min = minSize(d);
    const maxW = d.width - win.el.offsetLeft - 6;
    const maxH = d.height - win.el.offsetTop - 6;
    win.el.style.width = Math.min(maxW, Math.max(min.w, win.el.offsetWidth + dx)) + "px";
    win.el.style.height = Math.min(maxH, Math.max(min.h, win.el.offsetHeight + dy)) + "px";
  } else {
    const w = win.el.offsetWidth;
    let x = win.el.offsetLeft + dx;
    let y = win.el.offsetTop + dy;
    x = Math.min(d.width - 60, Math.max(60 - w, x));
    y = Math.min(d.height - 44, Math.max(0, y));
    win.el.style.left = x + "px";
    win.el.style.top = y + "px";
  }
}

/* --------------------------------------------------------- drag/resize -- */

// Pointer capture can throw if the pointer is already gone (or the id is
// synthetic); never let that abort a gesture.
function capture(el, pointerId) {
  try {
    el.setPointerCapture(pointerId);
  } catch { /* ignore */ }
}
function release(el, pointerId) {
  try {
    el.releasePointerCapture(pointerId);
  } catch { /* ignore */ }
}

// A single reusable highlight previewing the half a dragged window will tile
// into when dropped near a side edge (Aero-/Rectangle-style snapping).
let snapPreview = null;
function showSnapPreview(win, side) {
  const d = deskRect();
  if (!snapPreview) {
    snapPreview = document.createElement("div");
    snapPreview.className = "snap-preview";
    desktop.appendChild(snapPreview);
  }
  const w = win.mobile ? win.el.offsetWidth : Math.round(d.width / 2);
  Object.assign(snapPreview.style, {
    left: (side === "left" ? 0 : d.width - w) + "px",
    top: "0px",
    width: w + "px",
    height: d.height - dockClearance() + "px",
    zIndex: String(Math.max(1, zidx(win) - 1)), // sit just behind the window
  });
  snapPreview.classList.add("show");
}
function hideSnapPreview() {
  if (snapPreview) snapPreview.classList.remove("show");
}

// Distance (px) from a side edge that arms a left/right half snap.
const SNAP_EDGE = 28;

function enableDrag(win, handle) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".light") || e.button !== 0) return;
    if (win.maximized) toggleMax(win); // un-maximize and grab
    focusWindow(win.id);

    const r = win.el.getBoundingClientRect();
    const offX = e.clientX - r.left;
    const offY = e.clientY - r.top;
    // Grabbing a tiled window floats it again; remember where to restore to so
    // a later snap can undo back to the original floating geometry.
    const wasSnapped = win.snapped;
    const startRect = {
      left: win.el.offsetLeft,
      top: win.el.offsetTop,
      width: win.el.offsetWidth,
      height: win.el.offsetHeight,
    };
    win.snapped = null;
    let snapSide = null;
    capture(handle, e.pointerId);
    handle.classList.add("grabbing");
    document.body.classList.add("wm-busy");

    const move = (ev) => {
      const d = deskRect();
      let x = ev.clientX - d.left - offX;
      let y = ev.clientY - d.top - offY;
      const w = win.el.offsetWidth;
      x = Math.min(d.width - 60, Math.max(60 - w, x));
      y = Math.min(d.height - 44, Math.max(0, y));
      win.el.style.left = x + "px";
      win.el.style.top = y + "px";
      // Arm a half-snap when the pointer reaches a side edge.
      const px = ev.clientX - d.left;
      snapSide = px <= SNAP_EDGE ? "left" : px >= d.width - SNAP_EDGE ? "right" : null;
      if (snapSide) showSnapPreview(win, snapSide);
      else hideSnapPreview();
    };
    // Listeners live on globalThis (not `handle`) so a window closed mid-drag
    // still gets its teardown — no leaked listeners, no stuck wm-busy cursor.
    const end = (ev) => {
      release(handle, ev ? ev.pointerId : e.pointerId);
      handle.classList.remove("grabbing");
      document.body.classList.remove("wm-busy");
      hideSnapPreview();
      globalThis.removeEventListener("pointermove", move);
      globalThis.removeEventListener("pointerup", end);
      globalThis.removeEventListener("pointercancel", end);
      win._endGesture = null;
      if (snapSide) {
        snapWindow(win, snapSide, wasSnapped && win.prevRect ? win.prevRect : startRect);
      }
    };
    win._endGesture = end;
    globalThis.addEventListener("pointermove", move);
    globalThis.addEventListener("pointerup", end);
    globalThis.addEventListener("pointercancel", end);
  });
}

function enableResize(win, handle) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (win.maximized) return;
    win.snapped = null; // a hand-resized window is no longer cleanly tiled
    focusWindow(win.id);

    const startW = win.el.offsetWidth;
    const startH = win.el.offsetHeight;
    const startX = e.clientX;
    const startY = e.clientY;
    capture(handle, e.pointerId);
    document.body.classList.add("wm-busy");

    const move = (ev) => {
      const d = deskRect();
      const min = minSize(d);
      const maxW = d.width - win.el.offsetLeft - 6;
      const maxH = d.height - win.el.offsetTop - 6;
      win.el.style.width = Math.min(maxW, Math.max(min.w, startW + (ev.clientX - startX))) + "px";
      win.el.style.height = Math.min(maxH, Math.max(min.h, startH + (ev.clientY - startY))) + "px";
    };
    const end = (ev) => {
      release(handle, ev ? ev.pointerId : e.pointerId);
      document.body.classList.remove("wm-busy");
      globalThis.removeEventListener("pointermove", move);
      globalThis.removeEventListener("pointerup", end);
      globalThis.removeEventListener("pointercancel", end);
      win._endGesture = null;
    };
    win._endGesture = end;
    globalThis.addEventListener("pointermove", move);
    globalThis.addEventListener("pointerup", end);
    globalThis.addEventListener("pointercancel", end);
  });
}

/* --------------------------------------------------------------- dock -- */

function addDockItem(win) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "dock-item running";
  item.innerHTML =
    `${win.icon}<span class="dock-dot"></span><span class="dock-tip">${esc(win.title)}</span>`;
  item.setAttribute("aria-label", win.title);
  item.addEventListener("click", () => {
    if (win.minimized) {
      setMinimized(win, false);
    } else if (zidx(win) === zTop) {
      setMinimized(win, true); // already front → minimize
    } else {
      focusWindow(win.id);
      focusChrome(win);
    }
  });
  dock.appendChild(item);
  win.dockEl = item;
}

/* ------------------------------------------------------- open windows -- */

function openApp(item) {
  const id = "app:" + item.id;
  const existing = windows.get(id);
  if (existing) {
    if (existing.minimized) setMinimized(existing, false);
    else {
      focusWindow(id);
      focusChrome(existing);
    }
    return;
  }
  const launcher = document.activeElement;
  const win = createWindow({
    id,
    title: item.name,
    icon: item.icon,
    bodyHTML: `<div class="window-loader"><div class="spinner"></div><span></span></div>`,
    width: item.width || 1024,
    height: item.height || 720,
    mobile: item.mobile,
    launcher,
  });
  win.el.querySelector(".window-loader span").textContent = `Opening ${item.name}…`;

  // Build the iframe with the DOM API (setAttribute never parses HTML) and an
  // https/same-origin URL allowlist, so a stray javascript:/data: url can't slip in.
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", item.name);
  iframe.setAttribute("allow", item.allow || "fullscreen");
  iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  if (item.external) {
    // Let the third-party demo run + keep its own origin, but block it from
    // navigating the top-level kiosk away from the OS shell.
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  }
  if (/^https:\/\//i.test(item.url) || item.url.startsWith("/")) {
    iframe.setAttribute("src", item.url);
  }

  const loader = win.el.querySelector(".window-loader");
  const hide = () => loader && loader.classList.add("hidden");
  iframe.addEventListener("load", hide);
  win.loaderTimer = setTimeout(hide, 8000); // safety net for cross-origin loads
  win.el.querySelector(".window-body").appendChild(iframe);

  flashStatus(`Opening ${item.name}`);
}

function openFolder(folder) {
  const id = "folder:" + folder.id;
  const existing = windows.get(id);
  if (existing) {
    if (existing.minimized) setMinimized(existing, false);
    else {
      focusWindow(id);
      focusChrome(existing);
    }
    return;
  }
  const launcher = document.activeElement;
  const bodyHTML = `<div class="folder-grid">${
    folder.items.length ? "" : `<p class="folder-empty">This folder is empty.</p>`
  }</div>`;

  const win = createWindow({
    id,
    title: folder.name,
    icon: folder.icon,
    bodyHTML,
    width: 520,
    height: 360,
    launcher,
  });

  const grid = win.el.querySelector(".folder-grid");
  for (const item of folder.items) {
    grid.appendChild(makeIcon(item.name, item.icon, () => openApp(item)));
  }
  flashStatus(folder.name);
}

// Hosts that refuse to be iframed (X-Frame-Options / CSP frame-ancestors), so a
// browser window must offer "open in a new tab" instead of a blank frame.
const UNFRAMEABLE = /(^|\.)(tiktok\.com|tiktokv\.[a-z]+|instagram\.com|youtube\.com|google\.com|facebook\.com|amazon\.[a-z.]+)$/i;

// Open a URL in a draggable Thirsty OS "browser" window. Used when a link
// inside an app (e.g. a TikTok affiliate link in the Kiosk) wants to leave the
// app's own frame.
function openBrowser(url) {
  let host = url;
  let frameHost = "";
  try {
    const u = new URL(url);
    frameHost = u.hostname;
    host = u.hostname.replace(/^www\./, "");
  } catch { /* keep url as host fallback */ }

  const id = "browser:" + url;
  const existing = windows.get(id);
  if (existing) {
    if (existing.minimized) setMinimized(existing, false);
    else {
      focusWindow(id);
      focusChrome(existing);
    }
    return;
  }

  const blocked = UNFRAMEABLE.test(frameHost);
  const launcher = document.activeElement;
  const bodyHTML = `
    <div class="browser">
      <div class="browser-bar">
        <span class="browser-dot"></span>
        <span class="browser-url"></span>
        <button class="browser-open" type="button">Open ↗</button>
      </div>
      <div class="browser-view">${
    blocked
      ? `<div class="browser-blocked"><p></p><button class="browser-open-lg" type="button">Open in a new tab ↗</button></div>`
      : `<div class="window-loader"><div class="spinner"></div><span>Loading…</span></div>`
  }</div>
    </div>`;

  const win = createWindow({
    id,
    title: host,
    icon: ICONS.browser,
    bodyHTML,
    width: 1024,
    height: 720,
    launcher,
  });

  win.el.querySelector(".browser-url").textContent = url;
  for (const btn of win.el.querySelectorAll(".browser-open, .browser-open-lg")) {
    btn.addEventListener("click", () => globalThis.open(url, "_blank", "noopener,noreferrer"));
  }

  if (blocked) {
    win.el.querySelector(".browser-blocked p").textContent =
      `${host} can't be displayed inside Thirsty OS — it blocks embedding. Open it in a new browser tab:`;
  } else {
    const view = win.el.querySelector(".browser-view");
    const loader = view.querySelector(".window-loader");
    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", url);
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    iframe.addEventListener("load", () => loader && loader.classList.add("hidden"));
    win.loaderTimer = setTimeout(() => loader && loader.classList.add("hidden"), 8000);
    view.appendChild(iframe);
  }
  flashStatus(`Opening ${host}`);
}

/* ------------------------------------------------------- chrome / boot -- */

function tickClock() {
  const clock = document.getElementById("clock");
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  clock.textContent = `${date}   ${time}`;
}

// Keep maximized windows fitted and stray windows fully in view (position AND
// size) when the viewport changes — a window can never end up bigger than,
// or pushed off, a shrunken desktop.
let resizeRAF = 0;
globalThis.addEventListener("resize", () => {
  cancelAnimationFrame(resizeRAF);
  resizeRAF = requestAnimationFrame(() => {
    const d = deskRect();
    const min = minSize(d);
    const dockH = dockClearance();
    for (const win of windows.values()) {
      if (win.maximized) {
        win.el.style.width = d.width + "px";
        win.el.style.height = d.height - dockH + "px";
      } else if (!win.minimized) {
        win.el.style.width = Math.max(min.w, Math.min(win.el.offsetWidth, d.width - 16)) + "px";
        win.el.style.height = Math.max(min.h, Math.min(win.el.offsetHeight, d.height - 16)) + "px";
        clampIntoView(win);
      }
    }
  });
});

// Esc minimizes the focused window (state-preserving) — only when focus is
// actually inside that window, so it never fires from the dock/desktop or
// destroys in-progress iframe state.
globalThis.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const front = frontWindow(null);
  if (front && front.el.contains(document.activeElement)) setMinimized(front, true);
});

// Same-origin apps (e.g. the Kiosk storefront at /kiosk) post a message to ask
// the OS to open an external link in a browser window instead of leaving their
// own frame. Only trust same-origin senders + http(s) URLs.
globalThis.addEventListener("message", (e) => {
  if (e.origin !== location.origin) return;
  const data = e.data;
  if (!data || data.source !== "thirsty-os" || data.type !== "open-url") return;
  if (typeof data.url !== "string" || !/^https?:\/\//i.test(data.url)) return;
  openBrowser(data.url);
});

document.body.insertAdjacentHTML("afterbegin", ICON_GRADIENTS);
renderDesktop();
tickClock();
setInterval(tickClock, 15000);
