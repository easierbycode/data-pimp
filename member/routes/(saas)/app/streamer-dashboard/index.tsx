import { Head } from "fresh/runtime";
import { define } from "../../../../utils.ts";
import { PageHeader } from "../../../../components/PageHeader.tsx";
import StreamerDashboard from "../../../../islands/StreamerDashboard.tsx";

/**
 * Demo route for the Svelte 5 streamer dashboard. Renders the stubbed
 * payload from `islands/streamer-data.ts` — the read-side counterpart to
 * `bookmarklet-streamer.js`. When we wire a real Graylog feed
 * (`source:tiktok-bookmarklet-streamer`) later, this page becomes the
 * live view of the seller's own Streamer Compass scrapes.
 */
export default define.page(function StreamerDashboardPage() {
  return (
    <>
      <Head>
        <title>Streamer Compass · LifePreneur</title>
      </Head>
      <PageHeader
        title="Streamer Compass"
        subtitle="The seller's own video performance — KPI tiles, per-video metrics, and trend deltas. Sampled by the Streamer bookmarklet."
      />
      <div style={{ paddingTop: "1rem", paddingBottom: "1.5rem" }}>
        <StreamerDashboard />
      </div>
    </>
  );
});
