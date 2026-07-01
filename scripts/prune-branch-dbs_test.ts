import { assertEquals } from "jsr:@std/assert@^1";
import {
  branchPart,
  derivePrefix,
  findOrphans,
  isProtected,
  sanitizeBranch,
} from "./prune-branch-dbs.ts";

Deno.test("sanitizeBranch strips slashes and lowercases like Deno Deploy", () => {
  assertEquals(sanitizeBranch("claude/fix-sample-details"), "claudefix-sample-details");
  assertEquals(sanitizeBranch("feat/add-deno-seed-task-11"), "featadd-deno-seed-task-11");
  assertEquals(sanitizeBranch("Fix/Graylog_Size.1"), "fixgraylogsize1");
});

Deno.test("derivePrefix reads the app id from timeline and branch db names", () => {
  assertEquals(derivePrefix("d7223c-production"), "d7223c");
  assertEquals(derivePrefix("84b419-preview"), "84b419");
  assertEquals(derivePrefix("d7223c--main"), "d7223c");
  assertEquals(derivePrefix("neondb"), null);
});

Deno.test("isProtected shields every timeline / main / system database", () => {
  for (
    const keep of [
      "neondb",
      "postgres",
      "d7223c-production",
      "d7223c-preview",
      "d7223c-local",
      "d7223c--main",
      "84b419-production",
      "84b419--main",
    ]
  ) assertEquals(isProtected(keep), true, keep);
  for (const drop of ["d7223c--claudefix-sample-details", "84b419--featbarcode-intake-kiosk"]) {
    assertEquals(isProtected(drop), false, drop);
  }
});

Deno.test("branchPart returns the text after <prefix>--", () => {
  assertEquals(branchPart("d7223c", "d7223c--claudefoo"), "claudefoo");
  assertEquals(branchPart("d7223c", "d7223c-production"), ""); // single dash, not a branch db
});

Deno.test("findOrphans keeps live branches (incl. truncated names) and main", () => {
  const prefix = "d7223c";
  const branchDbs = [
    "d7223c--main", // protected
    "d7223c--claudefix-sample-details", // live below -> keep
    "d7223c--claudecheckout-cart-savin", // TRUNCATED name of a live branch -> keep
    "d7223c--claudeold-dead-branch", // no live branch -> orphan
  ];
  const live = [
    "main",
    "claude/fix-sample-details",
    "claude/checkout-cart-saving-flow", // sanitizes to a superstring of the truncated db
  ];
  assertEquals(findOrphans(prefix, branchDbs, live), ["d7223c--claudeold-dead-branch"]);
});

Deno.test("findOrphans with --branch scopes to one branch's db", () => {
  const prefix = "d7223c";
  const branchDbs = [
    "d7223c--claudeold-dead-branch",
    "d7223c--claudeanother-dead-one",
  ];
  // No live branches -> both are orphans, but scope to just the one we name.
  assertEquals(
    findOrphans(prefix, branchDbs, [], "claude/old-dead-branch"),
    ["d7223c--claudeold-dead-branch"],
  );
});

// Regression against the real fleet that filled the cap: with none of these
// branches alive, every one is an orphan; with `--main` present it stays kept.
Deno.test("real dropped fleet: all 59 flagged, main untouched", () => {
  const prefix = "d7223c";
  const realDbs = [
    "d7223c--main",
    "d7223c--claudeadd-deno-build-task",
    "d7223c--claudeaudit-catalog-inclu",
    "d7223c--claudebulk-sample-sold",
    "d7223c--fixgraylog-message-size-e",
    "d7223c--featseed-from-kiosk-produ",
    "d7223c--tiktok-affiliate-link-1075",
  ];
  const orphans = findOrphans(prefix, realDbs, ["main"]); // only main is alive
  assertEquals(orphans.includes("d7223c--main"), false);
  assertEquals(orphans.length, realDbs.length - 1);
});
