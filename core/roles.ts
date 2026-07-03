/**
 * Role-based access control for Thirsty OS — a config-driven map of team
 * members ("roles") to capability flags.
 *
 * `core/roles.json` is the SINGLE SOURCE OF TRUTH: adding a team member or
 * changing what they can see is a config edit, never a code change. The OS
 * shell (static/os.js) enforces the flags client-side — it filters the desktop
 * folders/apps a role may open and picks their boot layout. The server exposes
 * the same config verbatim at `/api/roles` and injects it into the OS shell as
 * `window.THIRSTY_RBAC` so the browser and the backend read one list.
 *
 * IMPORTANT: this is per-device UX gating, NOT a security boundary. The OS has
 * no auth/session (see static/os.js), so a role only decides which launchers a
 * given browser shows — it cannot protect a same-origin URL that someone types
 * directly. Treat it like a "kiosk profile", not like server-enforced authz.
 *
 * Flag resolution (see `roleHasFlag`): an explicit per-role value wins; a
 * wildcard `"*"` supplies the default for any flag the role doesn't list; an
 * unknown role or unlisted flag with no wildcard denies by default.
 */
import config from "./roles.json" with { type: "json" };

export interface FlagDef {
  id: string;
  label: string;
}

export interface Role {
  id: string;
  name: string;
  /** Boot-layout key the OS shell branches on (e.g. "default", "warehouse"). */
  boot: string;
  /** Per-flag grants; `"*": true` grants every flag not explicitly overridden. */
  flags: Record<string, boolean>;
}

export interface RolesConfig {
  defaultRole: string;
  flags: FlagDef[];
  roles: Role[];
}

// Two-step cast: the JSON import infers narrow literal flag keys (with the
// wildcard `"*"`), which don't structurally match `Record<string, boolean>`.
const CONFIG = config as unknown as RolesConfig;

/** The configured fallback role id (used when a stored role is unknown). */
export const DEFAULT_ROLE_ID: string = CONFIG.defaultRole;

/** Every known capability flag, in declaration order. */
export const FLAGS: FlagDef[] = CONFIG.flags;

/** All roles, in declaration order. */
export function listRoles(): Role[] {
  return CONFIG.roles;
}

/** Look up a role by id, or null if it isn't configured. */
export function getRole(id: string): Role | null {
  const key = String(id ?? "").trim();
  return CONFIG.roles.find((r) => r.id === key) ?? null;
}

/**
 * Resolve one flag against a role's grant map. Explicit per-flag value wins;
 * otherwise a wildcard `"*"` supplies the default; otherwise (unlisted flag, no
 * wildcard) access is denied. Kept as a standalone pure fn so the precedence —
 * including "explicit `false` beats `"*": true`" — is unit-testable independent
 * of the config, and so static/os.js's `roleAllows` can mirror it exactly.
 */
export function resolveFlag(
  flags: Record<string, boolean>,
  flag: string,
): boolean {
  const explicit = flags[flag];
  if (typeof explicit === "boolean") return explicit;
  return flags["*"] === true;
}

/**
 * Does `roleId` hold `flag`? An unknown role is denied every flag; otherwise the
 * role's grant map is resolved via `resolveFlag`.
 */
export function roleHasFlag(roleId: string, flag: string): boolean {
  const role = getRole(roleId);
  if (!role) return false;
  return resolveFlag(role.flags, flag);
}

/**
 * The minimal, browser-safe view of the config injected into the OS shell as
 * `globalThis.THIRSTY_RBAC` and served from `/api/roles`. Same shape both places
 * so the client and any external consumer read one contract.
 */
export function rolesClientConfig(): {
  defaultRole: string;
  flags: FlagDef[];
  roles: Role[];
} {
  return {
    defaultRole: DEFAULT_ROLE_ID,
    flags: FLAGS,
    roles: CONFIG.roles,
  };
}
