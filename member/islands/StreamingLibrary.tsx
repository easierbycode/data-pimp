import { useEffect, useRef } from "preact/hooks";
import { IS_BROWSER } from "fresh/runtime";
import { type Video, VIDEOS } from "./video-data.ts";

interface StreamingLibraryProps {
  /** Optional override for the seed catalog — used for tests and fixtures. */
  initialVideos?: Video[];
}

/**
 * Preact island wrapper for the Svelte 5 `StreamingLibrary.svelte` component.
 * Same `mount()`-on-client pattern as `SvelteCounter` / `SellerDashboard`:
 * Fresh renders a placeholder `<div>` server-side, and we `mount()` the Svelte
 * component into it on the client only.
 */
export default function StreamingLibrary(
  { initialVideos = VIDEOS }: StreamingLibraryProps,
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!IS_BROWSER || !ref.current) return;
    let unmount: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [{ mount, unmount: svelteUnmount }, { default: Library }] =
        await Promise.all([
          import("svelte"),
          import("../components/StreamingLibrary.svelte"),
        ]);
      if (cancelled || !ref.current) return;
      const instance = mount(Library, {
        target: ref.current,
        props: { initialVideos },
      });
      unmount = () => svelteUnmount(instance);
    })();

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [initialVideos]);

  return <div ref={ref} class="svelte-island-root" />;
}
