import { useEffect, useRef } from "preact/hooks";
import { IS_BROWSER } from "fresh/runtime";
import { AFFILIATE_STATS, type AffiliateStats } from "./affiliate-data.ts";

/**
 * Port of `apps/web/modules/saas/affiliate/components/affiliate-dashboard-simple.tsx`
 * — Preact island wrapper.
 *
 * Stubbed/deferred: the Prisma `db.affiliate` read, the Rewardful sync
 * (`orpcClient.users.affiliate.refreshStats`/`getDashboardLink`), PostHog
 * events, and the `sonner` toasts are all gone. Stats come from
 * `islands/affiliate-data.ts`; the real UI lives in
 * `components/AffiliateDashboard.svelte`, mounted on the client only (same
 * `mount()`-on-client pattern as `SvelteCounter`/`SellerDashboard`).
 */

interface AffiliateDashboardProps {
  stats?: AffiliateStats;
}

export default function AffiliateDashboard(
  { stats = AFFILIATE_STATS }: AffiliateDashboardProps,
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
          import("../components/AffiliateDashboard.svelte"),
        ]);
      if (cancelled || !ref.current) return;
      const instance = mount(Dashboard, {
        target: ref.current,
        props: { stats },
      });
      unmount = () => svelteUnmount(instance);
    })();

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [stats]);

  return <div ref={ref} class="svelte-island-root" />;
}
