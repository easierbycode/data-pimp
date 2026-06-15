// Mock-Cordova preview of the TokScrape mobile app, as a real Deno Fresh route.
//
// The TokScrape Cordova app (inventory-handheld/www) is hosted on GitHub Pages
// at MOBILE_WWW_BASE and, opened directly, 404s on cordova.js — so it has no
// native bridge, no `deviceready`, and no plugins. This handler serves that
// same app shell from our origin with a browser mock of `window.cordova`
// injected in place of cordova.js, so the unmodified app boots in any browser
// as a "mocked Cordova" app. The mock includes a barcodeScanner plugin backed
// by the ZXing-WASM `barcode-detector` ponyfill (UPC + QR), matching the app's
// own web shim.
//
// It's a handler-only route (no default page export), so it bypasses _app.tsx
// and the (saas)/app/_layout shell and renders the full-screen app document.
import { define } from "../../../utils.ts";

// The TokScrape Cordova app's web assets. Override with TOKSCRAPE_WWW.
const MOBILE_WWW_BASE = (Deno.env.get("TOKSCRAPE_WWW") ||
  "https://easierbycode.com/tok-scrape/mobile-app/www/").replace(/\/*$/, "/");

// Inline browser JS (no backticks / ${} so it survives this template literal).
const MOCK_CORDOVA_BOOTSTRAP = `(function () {
  'use strict';
  if (window.cordova && window.cordova.__mock) return;

  // ---- Cordova core + plugin stubs the shell touches (no-ops on web) ----
  var cordova = window.cordova || {};
  cordova.__mock = true;
  cordova.platformId = 'browser';
  cordova.version = 'mock-cordova';
  cordova.plugins = cordova.plugins || {};
  window.cordova = cordova;
  window.StatusBar = window.StatusBar || {
    styleLightContent: function () {}, styleDefault: function () {},
    backgroundColorByHexString: function () {}, overlaysWebView: function () {},
    hide: function () {}, show: function () {}
  };
  navigator.splashscreen = navigator.splashscreen || { show: function () {}, hide: function () {} };

  // ---- barcodeScanner plugin (ZXing-WASM via barcode-detector) ----
  var DECODER_URL = 'https://esm.sh/barcode-detector@3/ponyfill';
  var FORMATS = ['qr_code','micro_qr_code','aztec','data_matrix','pdf417','upc_a','upc_e','ean_8','ean_13','code_39','code_93','code_128','codabar','itf'];
  var detP = null;
  function detector() {
    if (detP) return detP;
    detP = import(DECODER_URL).then(function (m) {
      var BD = m.BarcodeDetector || (m.default && m.default.BarcodeDetector);
      if (typeof BD !== 'function') throw new Error('BarcodeDetector export missing');
      return new BD({ formats: FORMATS });
    }).catch(function (e) { detP = null; throw e; });
    return detP;
  }
  function scan(success, fail, opts) {
    success = success || function () {}; fail = fail || function () {}; opts = opts || {};
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { fail('Camera API unavailable'); return; }
    var ov = document.createElement('div');
    ov.setAttribute('style', 'position:fixed;inset:0;z-index:2147483000;background:#000;display:flex;align-items:flex-end;justify-content:center;font-family:system-ui,sans-serif');
    ov.innerHTML =
      '<video playsinline muted autoplay style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>' +
      '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(72vw,300px);aspect-ratio:1;border:2px solid #fff;border-radius:16px;box-shadow:0 0 0 100vmax rgba(0,0,0,.45)"></div>' +
      '<button type="button" style="position:relative;margin-bottom:calc(env(safe-area-inset-bottom,0px) + 22px);border:0;border-radius:999px;padding:13px 26px;font:700 15px system-ui;color:#fff;background:#f54e00;cursor:pointer">Cancel</button>';
    var video = ov.querySelector('video'), cancel = ov.querySelector('button');
    var stream = null, raf = 0, busy = false, done = false;
    function stop() { if (raf) cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); if (ov.parentNode) ov.parentNode.removeChild(ov); document.removeEventListener('backbutton', onBack); }
    function ok(text, format) { if (done) return; done = true; stop(); success({ text: text, format: String(format || '').toUpperCase(), cancelled: false }); }
    function cancelled() { if (done) return; done = true; stop(); success({ text: '', format: '', cancelled: true }); }
    function err(m) { if (done) return; done = true; stop(); fail(String(m && m.message ? m.message : m)); }
    function onBack(e) { if (e && e.preventDefault) e.preventDefault(); cancelled(); }
    cancel.addEventListener('click', cancelled);
    document.addEventListener('backbutton', onBack);
    document.body.appendChild(ov);
    Promise.all([
      detector(),
      navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: opts.preferFrontCamera ? 'user' : 'environment' } } })
    ]).then(function (r) {
      var det = r[0]; stream = r[1];
      if (done) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      video.srcObject = stream; var p = video.play(); if (p && p.catch) p.catch(function () {});
      (function loop() {
        if (done) return; raf = requestAnimationFrame(loop);
        if (busy || video.readyState < 2) return; busy = true;
        det.detect(video).then(function (c) { busy = false; if (done || !c || !c.length) return; ok(c[0].rawValue, c[0].format); }).catch(function () { busy = false; });
      })();
    }).catch(function (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) err('Camera permission denied.');
      else if (e && e.name === 'NotFoundError') err('No camera found.');
      else err(e);
    });
  }
  cordova.plugins.barcodeScanner = { scan: scan, Encode: {}, format: {} };
  window.BarcodeScannerShim = window.BarcodeScannerShim || { scan: scan };

  // ---- Fire deviceready so the shell proceeds past its native gate ----
  function ready() {
    try { document.dispatchEvent(new Event('deviceready')); }
    catch (e) { var ev = document.createEvent('Event'); ev.initEvent('deviceready', true, true); document.dispatchEvent(ev); }
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(ready, 0);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(ready, 0); });
})();`;

async function renderMockCordovaApp(): Promise<Response> {
  let html: string;
  try {
    const upstream = new URL("index.html", MOBILE_WWW_BASE).href;
    const res = await fetch(upstream, { headers: { accept: "text/html" } });
    if (!res.ok) throw new Error(`upstream ${res.status} for ${upstream}`);
    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response("Failed to load mobile app shell: " + msg, {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  // 1) Resolve the app's relative assets (js/, css/, icons/) against the GitHub
  //    Pages origin so this same-origin shell can pull them in.
  html = html.replace(/<head([^>]*)>/i, `<head$1>\n  <base href="${MOBILE_WWW_BASE}">`);

  // 2) Drop the app's own CSP <meta> — we author this document, so policy comes
  //    from the response header below (allowing esm.sh + the GH Pages origin +
  //    the wasm-eval the decoder needs).
  html = html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i, "");

  // 3) Swap the (404-on-web) cordova.js bridge for our browser mock.
  const mockTag = "<script>\n" + MOCK_CORDOVA_BOOTSTRAP + "\n</script>";
  const cordovaTag = /<script[^>]*\ssrc=["']cordova\.js["'][^>]*>\s*<\/script>/i;
  html = cordovaTag.test(html)
    ? html.replace(cordovaTag, mockTag)
    : html.replace(/<\/head>/i, mockTag + "\n</head>");

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      // Permissive policy for a first-party preview harness: it loads the app
      // bundle from GitHub Pages and the barcode decoder (+wasm) from esm.sh,
      // and needs eval for wasm/Highcharts. This is NOT the app's prod CSP.
      "content-security-policy":
        "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; " +
        "img-src * data: blob:; media-src * blob:; connect-src *; worker-src 'self' blob:;",
    },
  });
}

export const handler = define.handlers({
  GET() {
    return renderMockCordovaApp();
  },
});
