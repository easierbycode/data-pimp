import { useEffect, useRef } from "preact/hooks";
import { IS_BROWSER } from "fresh/runtime";

interface SvelteCounterProps {
  initial?: number;
  label?: string;
}

/**
 * Preact island wrapper for the Svelte 5 `Counter.svelte` component.
 *
 * Why a wrapper: Fresh ships and hydrates Preact islands. Svelte components
 * have their own runtime, so we render a placeholder `<div>` server-side and
 * `mount()` the Svelte component into it on the client only. Vite (via
 * `@sveltejs/vite-plugin-svelte`) compiles the `.svelte` source into the
 * island's client bundle.
 *
 * Add more Svelte islands by writing another wrapper that imports its own
 * `.svelte` file and calls `mount()` the same way.
 */
export default function SvelteCounter(
  { initial = 0, label = "Svelte counter" }: SvelteCounterProps,
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!IS_BROWSER || !ref.current) return;
    let unmount: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [{ mount, unmount: svelteUnmount }, { default: Counter }] =
        await Promise.all([
          import("svelte"),
          import("../components/Counter.svelte"),
        ]);
      if (cancelled || !ref.current) return;
      const instance = mount(Counter, {
        target: ref.current,
        props: { initial, label },
      });
      unmount = () => svelteUnmount(instance);
    })();

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [initial, label]);

  return <div ref={ref} class="svelte-island-root" />;
}
