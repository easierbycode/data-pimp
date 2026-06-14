import { Head } from "fresh/runtime";
import { define } from "../../../../utils.ts";
import { PageHeader } from "../../../../components/PageHeader.tsx";
import AffiliateDashboard from "../../../../islands/AffiliateDashboard.tsx";

/**
 * Port of `apps/web/app/(saas)/app/(account)/affiliate/page.tsx` — Svelte 5
 * island.
 *
 * The Next.js page reads `db.affiliate.findUnique` and branches on the
 * `FULL_AFFILIATE_DASHBOARD` beta flag between the signup, full, and simple
 * dashboards. Those reads and the flag are deferred — our stub user is enrolled,
 * so we always render the simple dashboard (`AffiliateDashboardSimple`) seeded
 * from `islands/affiliate-data.ts`.
 */
export default define.page(function AffiliatePage() {
  return (
    <>
      <Head>
        <title>Affiliate · LifePreneur</title>
      </Head>
      <PageHeader
        title="Affiliate Dashboard"
        subtitle="Track your referrals and earnings"
      />
      <div style={{ paddingTop: "1.5rem", paddingBottom: "1.5rem" }}>
        <AffiliateDashboard />
      </div>
    </>
  );
});
