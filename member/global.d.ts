/// <reference types="vite/client" />
/// <reference types="svelte" />

declare module "*.svelte" {
  // Svelte 5 components are functions; the precise type comes from `svelte`.
  // Re-export the public Component type so callers get autocomplete on props.
  import type { Component } from "svelte";
  const component: Component<Record<string, unknown>>;
  export default component;
}
