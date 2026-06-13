import { useEffect, useRef } from "preact/hooks";
import { IS_BROWSER } from "fresh/runtime";
import { SELLER_LIVE_PAYLOAD, type SellerLivePayload } from "./seller-data.ts";

interface SellerDashboardProps {
  payload?: SellerLivePayload;
}

/**
 * Preact island wrapper for the Svelte 5 `SellerDashboard.svelte` component.
 * Same `mount()`-on-client pattern as `SvelteCounter`, but the inner
 * component lazy-imports Phaser 4 for the GMV implosion scene — Phaser
 * weighs in over a megabyte and is browser-only, so it must not land in
 * SSR or any non-island bundle.
 */
export default function SellerDashboard(
  { payload = SELLER_LIVE_PAYLOAD }: SellerDashboardProps,
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
          import("../components/SellerDashboard.svelte"),
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
