import { useEffect, useRef } from "preact/hooks";
import { IS_BROWSER } from "fresh/runtime";

/**
 * Preact island wrapper for the Svelte 5 `MemberDashboardV2.svelte` component.
 * Same `mount()`-on-client pattern as `SvelteCounter` / `SellerDashboard`:
 * Fresh ships and hydrates Preact, so we render a placeholder `<div>`
 * server-side and `mount()` the Svelte component into it on the client only.
 * The component imports its stub data (islands/dashboard-data.ts) directly,
 * so no props are threaded through here.
 */
export default function MemberDashboardV2() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!IS_BROWSER || !ref.current) return;
    let unmount: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [{ mount, unmount: svelteUnmount }, { default: Dashboard }] =
        await Promise.all([
          import("svelte"),
          import("../components/MemberDashboardV2.svelte"),
        ]);
      if (cancelled || !ref.current) return;
      const instance = mount(Dashboard, { target: ref.current });
      unmount = () => svelteUnmount(instance);
    })();

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, []);

  return <div ref={ref} class="svelte-island-root" />;
}
