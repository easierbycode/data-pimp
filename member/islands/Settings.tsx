import { useEffect, useRef } from "preact/hooks";
import { IS_BROWSER } from "fresh/runtime";
import { SETTINGS_DATA, type SettingsData } from "./settings-data.ts";

interface SettingsProps {
  data?: SettingsData;
}

/**
 * Port of apps/web/app/(saas)/app/(account)/settings/* — Preact island wrapper.
 *
 * Same `mount()`-on-client pattern as `SvelteCounter` / `SellerDashboard`:
 * Fresh renders the placeholder `<div>` server-side and the Svelte 5
 * `Settings.svelte` component is mounted into it on the client only. The stub
 * user / accounts / sessions / plan come from `settings-data.ts` because the
 * original auth + billing backend (Better Auth, orpc payments) is deferred.
 */
export default function Settings(
  { data = SETTINGS_DATA }: SettingsProps,
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!IS_BROWSER || !ref.current) return;
    let unmount: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [
        { mount, unmount: svelteUnmount },
        { default: SettingsComponent },
      ] = await Promise.all([
        import("svelte"),
        import("../components/Settings.svelte"),
      ]);
      if (cancelled || !ref.current) return;
      const instance = mount(SettingsComponent, {
        target: ref.current,
        props: { data },
      });
      unmount = () => svelteUnmount(instance);
    })();

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [data]);

  return <div ref={ref} class="svelte-island-root" />;
}
