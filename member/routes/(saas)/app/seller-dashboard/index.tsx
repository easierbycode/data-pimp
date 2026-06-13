import { Head } from "fresh/runtime";
import { define } from "../../../../utils.ts";
import { PageHeader } from "../../../../components/PageHeader.tsx";
import SellerDashboard from "../../../../islands/SellerDashboard.tsx";

/**
 * Demo route for the Svelte 5 + Phaser 4 seller dashboard. Renders the
 * stubbed live-bookmarklet payload from `islands/seller-data.ts`. When
 * we wire a real Graylog feed later, this page becomes the read-side
 * counterpart to `bookmarklet-live.js`.
 */
export default define.page(function SellerDashboardPage() {
  return (
    <>
      <Head>
        <title>Seller Dashboard · LifePreneur</title>
      </Head>
      <PageHeader
        title="Seller Live Dashboard"
        subtitle="Per-session GMV, traffic mix, performance trends, and the full Product List — sampled by the Live bookmarklet."
      />
      <div style={{ paddingTop: "1rem", paddingBottom: "1.5rem" }}>
        <SellerDashboard />
      </div>
    </>
  );
});
