import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// The Fresh deno plugin calls path.toFileUrl(id) without stripping ?v=HASH
// first, so @deno/loader receives file:///path?v=HASH and fails with ENOENT
// (Deno treats the query string as part of the filename). This plugin runs
// first (enforce:"pre", listed before fresh()) and intercepts those IDs,
// reading the clean path itself so Fresh's load hook is never reached.
const fixDenoVersionQuery: Plugin = {
  name: "fix-deno-version-query",
  enforce: "pre",
  async load(id: string) {
    if (!id.startsWith("/") || !id.includes("?v=")) return null;
    const filePath = id.split("?")[0];
    try {
      const code = await readFile(filePath, "utf-8");
      return { code };
    } catch {
      return null;
    }
  },
};

export default defineConfig({
  plugins: [
    fixDenoVersionQuery,
    fresh(),
    // Svelte 5 islands. Compiled client-side only; mounted by a thin Preact
    // island wrapper so SSR stays Preact-only and the page works without JS.
    svelte(),
  ],
});
