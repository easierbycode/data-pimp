import { Head } from "fresh/runtime";
import { define } from "../../../../utils.ts";
import { PageHeader } from "../../../../components/PageHeader.tsx";
import Settings from "../../../../islands/Settings.tsx";

/**
 * Port of apps/web/app/(saas)/app/(account)/settings/* — Svelte 5 island.
 *
 * The Next.js settings area is a sidebar layout (`settings/layout.tsx`) over
 * four auth/billing-backed sub-routes (general / security / billing /
 * danger-zone). Here the four sub-pages are rendered as sections inside a
 * single `Settings.svelte` island switched by an internal sidebar — no
 * sub-routes. Auth (Better Auth) and billing (orpc payments) are deferred, so
 * the forms are faithful styled shells with mutating controls disabled; the
 * seed user / accounts / sessions / plan live in `islands/settings-data.ts`.
 */
export default define.page(function SettingsPage() {
  return (
    <>
      <Head>
        <title>Settings · LifePreneur</title>
      </Head>
      <PageHeader
        title="Settings"
        subtitle="Manage your account settings"
      />
      <div style={{ paddingTop: "1.5rem", paddingBottom: "1.5rem" }}>
        <Settings />
      </div>
    </>
  );
});
