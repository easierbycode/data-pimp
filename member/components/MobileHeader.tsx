import "./MobileHeader.css";
import { Logo } from "./Logo.tsx";
import { UserMenu } from "./UserMenu.tsx";

interface MobileHeaderProps {
  pathname: string;
  user: { name: string; email: string; initials: string };
}

const ROUTE_TITLES: { prefix: string; label: string }[] = [
  { prefix: "/member/app/community", label: "Community" },
  { prefix: "/member/app/content", label: "Content" },
  { prefix: "/member/app/affiliate", label: "Affiliate" },
  { prefix: "/member/app/notifications", label: "Notifications" },
  { prefix: "/member/app/settings", label: "Settings" },
];

function getPageTitle(pathname: string): string {
  return ROUTE_TITLES.find((r) => pathname.startsWith(r.prefix))?.label ??
    "Dashboard";
}

/** Port of `apps/web/modules/saas/shared/components/MobileHeader.tsx`. */
export function MobileHeader({ pathname, user }: MobileHeaderProps) {
  return (
    <header class="lp-mobile-header">
      <a href="/member/app" class="lp-mobile-header__logo">
        <Logo withLabel={false} />
      </a>
      <span class="lp-mobile-header__title">{getPageTitle(pathname)}</span>
      <div class="lp-mobile-header__actions">
        {/* UserNotificationsDropdown — port when notifications backend lands */}
        <UserMenu user={user} />
      </div>
    </header>
  );
}
