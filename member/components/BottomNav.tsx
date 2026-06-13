import "./BottomNav.css";
import {
  LinkIcon,
  PlayCircleIcon,
  UserCog2Icon,
  UsersIcon,
} from "./icons.tsx";

interface NavItem {
  label: string;
  href: string;
  Icon: (props: { class?: string }) => preact.JSX.Element;
}

interface BottomNavProps {
  pathname: string;
  hasContentAccess?: boolean;
}

/** Port of `apps/web/modules/saas/shared/components/BottomNav.tsx`. */
export function BottomNav(
  { pathname, hasContentAccess = true }: BottomNavProps,
) {
  const items: NavItem[] = [
    { label: "Community", href: "/member/app/community", Icon: UsersIcon },
    ...(hasContentAccess
      ? [{ label: "Content", href: "/member/app/content", Icon: PlayCircleIcon }]
      : []),
    { label: "Affiliate", href: "/member/app/affiliate", Icon: LinkIcon },
    { label: "Settings", href: "/member/app/settings", Icon: UserCog2Icon },
  ];

  return (
    <nav class="lp-bottom-nav" aria-label="Mobile">
      <div class="lp-bottom-nav__row">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              class={[
                "lp-bottom-nav__link",
                isActive
                  ? "lp-bottom-nav__link--active"
                  : "lp-bottom-nav__link--inactive",
              ].join(" ")}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span class="lp-bottom-nav__indicator" aria-hidden="true" />
              )}
              <item.Icon
                class={[
                  "lp-bottom-nav__icon",
                  isActive ? "" : "lp-bottom-nav__icon--inactive",
                ].filter(Boolean).join(" ")}
              />
              <span class="lp-bottom-nav__label">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
