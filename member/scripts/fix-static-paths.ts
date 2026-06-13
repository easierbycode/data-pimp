// Normalize OS-specific path separators in the built Fresh server bundle.
//
// `vite build` bakes the host OS's path separator into the `filePath` of each
// registerStaticFile() entry in _fresh/server.js. When the bundle is built on
// Windows those become `client\assets\…`, which fail to resolve when the bundle
// runs on Linux (Deno Deploy) — the static CSS chunks 404. We commit _fresh so
// Deno Deploy (which does not run a build step) can serve the member app, so the
// committed bundle must use portable forward slashes. Forward slashes work on
// both Windows and Linux, so this runs unconditionally after every build.
const serverJs = new URL("../_fresh/server.js", import.meta.url);
const before = await Deno.readTextFile(serverJs);
const after = before.replaceAll("\\\\", "/");
if (after !== before) {
  await Deno.writeTextFile(serverJs, after);
  console.log("fix-static-paths: normalized backslash paths in _fresh/server.js");
} else {
  console.log("fix-static-paths: no backslash paths to normalize");
}
