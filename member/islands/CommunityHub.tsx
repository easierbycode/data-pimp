import { useEffect, useRef } from "preact/hooks";
import { IS_BROWSER } from "fresh/runtime";
import {
  type Announcement,
  ANNOUNCEMENTS,
  CAN_CONNECT_DISCORD,
  type Platform,
  PLATFORMS,
} from "./community-data.ts";

/**
 * Port of apps/web/modules/saas/community/components/community-hub.tsx —
 * Preact wrapper for the Svelte 5 `CommunityHub.svelte` component.
 *
 * Same `mount()`-on-client pattern as `SvelteCounter` / `SellerDashboard`.
 * The Next.js component pulled platforms + announcements from orpc/Prisma,
 * gated Discord on the user's purchases, and ran a Discord OAuth flow; all
 * of that is deferred. We pass the stub data from `community-data.ts` as
 * props and the Svelte component persists read state to localStorage.
 */

interface CommunityHubProps {
  canConnectDiscord?: boolean;
  platforms?: Platform[];
  announcements?: Announcement[];
}

export default function CommunityHub(
  {
    canConnectDiscord = CAN_CONNECT_DISCORD,
    platforms = PLATFORMS,
    announcements = ANNOUNCEMENTS,
  }: CommunityHubProps,
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!IS_BROWSER || !ref.current) return;
    let unmount: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [{ mount, unmount: svelteUnmount }, { default: Hub }] =
        await Promise.all([
          import("svelte"),
          import("../components/CommunityHub.svelte"),
        ]);
      if (cancelled || !ref.current) return;
      const instance = mount(Hub, {
        target: ref.current,
        props: { canConnectDiscord, platforms, announcements },
      });
      unmount = () => svelteUnmount(instance);
    })();

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [canConnectDiscord, platforms, announcements]);

  return <div ref={ref} class="svelte-island-root" />;
}
