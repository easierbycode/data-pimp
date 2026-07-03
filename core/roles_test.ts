import { expect } from "@std/expect";
import {
  DEFAULT_ROLE_ID,
  FLAGS,
  getRole,
  listRoles,
  resolveFlag,
  roleHasFlag,
  rolesClientConfig,
} from "./roles.ts";

Deno.test("the configured default role exists in the role list", () => {
  expect(getRole(DEFAULT_ROLE_ID)).not.toBeNull();
});

Deno.test("listRoles returns every configured role, in order", () => {
  const ids = listRoles().map((r) => r.id);
  expect(ids).toContain("dj");
  expect(ids).toContain("ka");
});

Deno.test("getRole trims and misses unknown roles", () => {
  expect(getRole("  dj  ")?.id).toBe("dj");
  expect(getRole("nobody")).toBeNull();
  expect(getRole("")).toBeNull();
});

Deno.test("wildcard role grants every flag", () => {
  // DJ is `"*": true` — every declared flag resolves true.
  for (const f of FLAGS) {
    expect(roleHasFlag("dj", f.id)).toBe(true);
  }
  // ...even a flag that isn't declared at all.
  expect(roleHasFlag("dj", "some.future.flag")).toBe(true);
});

Deno.test("explicit per-role false overrides the wildcard default", () => {
  // Karl can open Inventory/Kiosk but not the Demos/Member folders.
  expect(roleHasFlag("ka", "app.inventory")).toBe(true);
  expect(roleHasFlag("ka", "app.kiosk")).toBe(true);
  expect(roleHasFlag("ka", "folder.demos")).toBe(false);
  expect(roleHasFlag("ka", "folder.member")).toBe(false);
  expect(roleHasFlag("ka", "app.productAnalysis")).toBe(false);
});

Deno.test("a role without a wildcard denies flags it doesn't list", () => {
  // Karl has no `"*"`, so an unlisted flag is denied by default.
  expect(roleHasFlag("ka", "some.unlisted.flag")).toBe(false);
});

Deno.test("resolveFlag: explicit false beats a wildcard grant (precedence)", () => {
  // The design's headline promise: `"*": true` grants all, but an explicit
  // `false` denies that one flag. No configured role currently has BOTH, so this
  // pins the precedence directly against the resolver — a regression that
  // consulted `"*"` before the explicit value would flip this to true.
  const flags = { "*": true, "app.locked": false };
  expect(resolveFlag(flags, "app.locked")).toBe(false); // explicit wins
  expect(resolveFlag(flags, "app.anything")).toBe(true); // wildcard default
});

Deno.test("resolveFlag: explicit true beats an absent/false wildcard", () => {
  expect(resolveFlag({ "app.x": true }, "app.x")).toBe(true);
  expect(resolveFlag({ "*": false, "app.x": true }, "app.x")).toBe(true);
  expect(resolveFlag({ "app.x": true }, "app.y")).toBe(false); // no wildcard → deny
});

Deno.test("unknown roles are denied every flag", () => {
  expect(roleHasFlag("nobody", "app.inventory")).toBe(false);
});

Deno.test("rolesClientConfig is a stable, browser-safe view", () => {
  const cfg = rolesClientConfig();
  expect(cfg.defaultRole).toBe(DEFAULT_ROLE_ID);
  expect(Array.isArray(cfg.roles)).toBe(true);
  expect(Array.isArray(cfg.flags)).toBe(true);
  // Every role carries the fields the OS shell needs to render + gate.
  for (const r of cfg.roles) {
    expect(typeof r.id).toBe("string");
    expect(typeof r.name).toBe("string");
    expect(typeof r.boot).toBe("string");
    expect(typeof r.flags).toBe("object");
  }
});
