import "./NavBar.css";
import { Logo } from "./Logo.tsx";
import { UserMenu } from "./UserMenu.tsx";
import {
  LayoutIcon,
  LinkIcon,
  PlayCircleIcon,
  UserCog2Icon,
  UsersIcon,
} from "./icons.tsx";

interface MenuItem {
  label: string;
  href: string;
  Icon: (props: { class?: string }) => preact.JSX.Element;
  badge?: number;
}

interface NavBarProps {
  pathname: string;
  user: { name: string; email: string; initials: string };
  /**
   * Mirrors `useBetaFeature(BETA_FEATURE_IDS.ENHANCED_VIDEO_PLAYER)` from the
   * Next.js NavBar. Hardcoded true for now — wire to real beta gating with auth.
   */
  hasContentAccess?: boolean;
  /**
   * Mirrors `unreadAnnouncements` count from the Next.js NavBar (orpc query).
   * Stubbed at 0 until the orpc client is ported.
   */
  unreadAnnouncements?: number;
}

/**
 * Port of `apps/web/modules/saas/shared/components/NavBar.tsx` — sidebar layout
 * only. The original supports a horizontal-tab fallback gated on
 * `config.ui.saas.useSidebarLayout`; that branch is omitted here since the
 * production config uses sidebar mode.
 */
export function NavBar(
  {
    pathname,
    user,
    hasContentAccess = true,
    unreadAnnouncements = 0,
  }: NavBarProps,
) {
  const menuItems: MenuItem[] = [
    {
      label: "Dashboard",
      href: "/member/app/dashboard",
      Icon: LayoutIcon,
      badge: 0,
    },
    {
      label: "Community",
      href: "/member/app/community",
      Icon: UsersIcon,
      badge: unreadAnnouncements,
    },
    ...(hasContentAccess
      ? [{
        label: "Content",
        href: "/member/app/content",
        Icon: PlayCircleIcon,
        badge: 0,
      }]
      : []),
    {
      label: "Affiliate",
      href: "/member/app/affiliate",
      Icon: LinkIcon,
      badge: 0,
    },
    {
      label: "Settings",
      href: "/member/app/settings",
      Icon: UserCog2Icon,
      badge: 0,
    },
  ];

  return (
    <nav class="lp-nav" aria-label="Primary">
      <div class="lp-nav__inner">
        <a href="/member/app" class="lp-nav__logo-link">
          <Logo />
        </a>

        <div class="lp-nav__divider" />

        <ul class="lp-nav__list">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  class={[
                    "lp-nav__link",
                    isActive ? "lp-nav__link--active" : "lp-nav__link--inactive",
                  ].join(" ")}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.Icon
                    class={[
                      "lp-nav__icon",
                      isActive ? "lp-nav__icon--active" : "",
                    ].filter(Boolean).join(" ")}
                  />
                  <span class="lp-nav__label">{item.label}</span>
                  {(item.badge ?? 0) > 0 && (
                    <span class="lp-nav__badge">
                      {(item.badge ?? 0) > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>

        <div class="lp-nav__footer">
          <UserMenu user={user} showUserName />
        </div>
      </div>
    </nav>
  );
}
