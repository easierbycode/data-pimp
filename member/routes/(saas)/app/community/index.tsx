import { Head } from "fresh/runtime";
import { define } from "../../../../utils.ts";
import { PageHeader } from "../../../../components/PageHeader.tsx";
import CommunityHub from "../../../../islands/CommunityHub.tsx";

/**
 * Port of apps/web/app/(saas)/app/(account)/community/page.tsx —
 * Svelte 5 island.
 *
 * The Next.js page read purchases + announcements from Prisma, resolved
 * Discord connection state from Better-Auth, and computed `canConnectDiscord`
 * from the user's plan. All of that is stubbed in `islands/community-data.ts`.
 * The `<TikTokBetaSection>` from the original is skipped — it renders null
 * without the TikTok beta flag, so there is nothing to port.
 */
export default define.page(function CommunityPage() {
  return (
    <>
      <Head>
        <title>Community · LifePreneur</title>
      </Head>
      <PageHeader
        title="Community Hub"
        subtitle="Connect with platforms and stay updated with announcements"
      />
      <div style={{ paddingTop: "1rem", paddingBottom: "1.5rem" }}>
        <CommunityHub />
      </div>
    </>
  );
});
