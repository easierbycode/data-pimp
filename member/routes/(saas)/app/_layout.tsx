import "./_layout.css";
import { define } from "../../../utils.ts";
import { BottomNav } from "../../../components/BottomNav.tsx";
import { MobileHeader } from "../../../components/MobileHeader.tsx";
import { NavBar } from "../../../components/NavBar.tsx";

const STUB_USER = {
  id: "stub-user",
  email: "daniel@easierbycode.com",
  name: "Daniel Nguyen",
  initials: "DN",
};

/**
 * Port of `apps/web/app/(saas)/app/layout.tsx` + `AppWrapper`.
 *
 * The Next.js original calls `getSession()`, `getOrganizationList()`,
 * `getPurchases()` and redirects to `/auth/login`, `/onboarding`,
 * `/new-organization`, or `/choose-plan`. Those depend on Better Auth + Prisma
 * which aren't wired up here yet — replace this stub with real session/billing
 * checks (or a Deno port of `@repo/auth`) when porting auth.
 */
export default define.layout(({ Component, url, state }) => {
  const user = state.user ?? STUB_USER;
  const pathname = url.pathname;

  return (
    <div class="lp-shell">
      {/* SubscriptionStatusBanner — port from @/components/subscription-status-banner */}
      <MobileHeader pathname={pathname} user={user} />
      <NavBar pathname={pathname} user={user} />
      <div class="lp-shell__body">
        <main class="lp-shell__main">
          <div class="lp-shell__container">
            {/* ImpersonationBanner — port from @saas/admin when needed */}
            {/* NotificationBanner — port from @saas/shared when needed */}
            <Component />
          </div>
        </main>
      </div>
      <BottomNav pathname={pathname} />
    </div>
  );
});
