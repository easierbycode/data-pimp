import { useEffect, useRef } from "preact/hooks";
import { IS_BROWSER } from "fresh/runtime";
import { STREAMER_PAYLOAD, type StreamerPayload } from "./streamer-data.ts";

interface StreamerDashboardProps {
  payload?: StreamerPayload;
}

/**
 * Preact island wrapper for the Svelte 5 `StreamerDashboard.svelte`
 * component. Same `mount()`-on-client pattern as `SvelteCounter` /
 * `SellerDashboard` — Svelte runtime is dynamic-imported so it never
 * lands in SSR or non-island bundles.
 */
export default function StreamerDashboard(
  { payload = STREAMER_PAYLOAD }: StreamerDashboardProps,
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!IS_BROWSER || !ref.current) return;
    let unmount: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [{ mount, unmount: svelteUnmount }, { default: Dashboard }] =
        await Promise.all([
          import("svelte"),
          import("../components/StreamerDashboard.svelte"),
        ]);
      if (cancelled || !ref.current) return;
      const instance = mount(Dashboard, {
        target: ref.current,
        props: { payload },
      });
      unmount = () => svelteUnmount(instance);
    })();

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [payload]);

  return <div ref={ref} class="svelte-island-root" />;
}
