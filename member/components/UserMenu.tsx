import "./UserMenu.css";

interface UserMenuProps {
  /** Show the user's name beside the avatar — used in the sidebar footer. */
  showUserName?: boolean;
  user: {
    name: string;
    email: string;
    initials: string;
  };
}

/**
 * Stub of `apps/web/modules/saas/shared/components/UserMenu.tsx`.
 *
 * The original is a full Radix dropdown with theme switcher, language switcher,
 * notifications badge, admin link, and sign-out. Port that when porting auth.
 */
export function UserMenu({ showUserName, user }: UserMenuProps) {
  return (
    <button
      type="button"
      class="lp-user-menu"
      aria-label={`Account menu for ${user.name}`}
    >
      <span class="lp-user-menu__avatar" aria-hidden="true">
        {user.initials}
      </span>
      {showUserName && (
        <span class="lp-user-menu__name">
          <span class="lp-user-menu__display-name">{user.name}</span>
          <span class="lp-user-menu__email">{user.email}</span>
        </span>
      )}
    </button>
  );
}
