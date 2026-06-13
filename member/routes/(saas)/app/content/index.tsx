import { Head } from "fresh/runtime";
import { define } from "../../../../utils.ts";
import { PageHeader } from "../../../../components/PageHeader.tsx";
import StreamingLibrary from "../../../../islands/StreamingLibrary.tsx";

/**
 * Port of `apps/web/app/(saas)/app/(account)/content/page.tsx`.
 *
 * The Next.js page checks `hasBetaFeature(ENHANCED_VIDEO_PLAYER)` and reads
 * the catalog from Prisma (`db.contentVideo.findMany`). Both are deferred
 * here — gating happens in the NavBar via the `hasContentAccess` flag, and
 * the catalog lives in `islands/video-data.ts`.
 */
export default define.page(function ContentPage() {
  return (
    <>
      <Head>
        <title>Content · LifePreneur</title>
      </Head>
      <PageHeader
        title="Content Library"
        subtitle="Premium TikTok Shop training content"
      />
      <div style={{ paddingTop: "1.5rem", paddingBottom: "1.5rem" }}>
        <StreamingLibrary />
      </div>
    </>
  );
});
