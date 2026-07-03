// Kiosk scan intake — companion to the Scanner app (admin.thirsty.store/scanner).
//
// Loaded by the /kiosk SPA shell alongside app.js. Two sources feed it:
//   1. Embedded under Thirsty OS: the shell routes productID scans into this
//      frame as a same-origin postMessage {source:"thirsty-os", type:"scan"}.
//   2. Standalone kiosk tab (no OS shell): connects straight to the scan relay
//      (same origin, or THIRSTY_SCAN_RELAY on thin clients) and reacts to scan
//      events itself.
// Either way a usable code lands on the Checkout page via ?code=, which
// Pages/Checkout already auto-scans (and re-scans when location.search
// changes). Navigation is client-side: react-router v6 subscribes to popstate,
// so pushState + a synthetic PopStateEvent routes without a reload.

const PRODUCT_ID_RE = /^\d{18,19}$/; // TikTok product ids, e.g. 1731891756549444298
const BARCODE_RE = /^(\d{8}|\d{12,14})$/; // UPC-A/E, EAN-8/13, ITF-14

const embedded = window.parent !== window.self;
const seenScanIds = new Set();

function rememberScan(scanId) {
  if (!scanId) return true; // no id → cannot dedupe, accept
  if (seenScanIds.has(scanId)) return false;
  seenScanIds.add(scanId);
  if (seenScanIds.size > 500) {
    for (const id of seenScanIds) {
      seenScanIds.delete(id);
      if (seenScanIds.size <= 250) break;
    }
  }
  return true;
}

let rescanNonce = 0;
function goToCheckout(code) {
  let target = `/kiosk/checkout?code=${encodeURIComponent(code)}`;
  const here = location.pathname + location.search;
  if (here === target) {
    // Same code scanned again: Checkout's ?code= effect only re-fires when
    // location.search changes, so vary the URL with a throwaway nonce.
    target += `&rescan=${++rescanNonce}`;
  }
  history.pushState({}, "", target);
  dispatchEvent(new PopStateEvent("popstate"));
}

function handleScan(value, scanId) {
  if (typeof value !== "string" || !value) return;
  if (!rememberScan(scanId)) return;
  if (PRODUCT_ID_RE.test(value)) {
    goToCheckout(value);
    return;
  }
  // Standalone checkout station: a retail barcode is still a checkout lookup
  // (samples store the UPC in qr_code when no TikTok match existed). Under the
  // OS the shell routes barcodes to Apps/Inventory instead — it never sends
  // them here.
  if (!embedded && BARCODE_RE.test(value)) {
    goToCheckout(value);
  }
}

// Source 1 — Thirsty OS shell (same-origin parent).
window.addEventListener("message", (e) => {
  if (e.origin !== location.origin) return;
  const data = e.data;
  if (!data || data.source !== "thirsty-os" || data.type !== "scan") return;
  handleScan(data.value, data.scanId);
});

// Source 2 — direct relay subscription when there is no OS shell above us.
if (!embedded) {
  const relayUrl = globalThis.THIRSTY_SCAN_RELAY ||
    `${location.protocol === "http:" ? "ws" : "wss"}://${location.host}/api/scan-socket`;
  let retryMs = 1000;

  function connect() {
    let socket;
    try {
      socket = new WebSocket(relayUrl);
    } catch {
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 30000);
      return;
    }
    let pingTimer = 0;
    socket.addEventListener("open", () => {
      retryMs = 1000;
      socket.send(JSON.stringify({ type: "hello", role: "listener", name: "Kiosk" }));
      pingTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 10000);
    });
    socket.addEventListener("message", (e) => {
      let msg;
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (msg && msg.type === "scan") handleScan(msg.value, msg.scanId);
    });
    const reconnect = () => {
      clearInterval(pingTimer);
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 30000);
    };
    socket.addEventListener("close", reconnect, { once: true });
  }

  connect();
}
