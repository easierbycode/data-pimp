import { expect } from "@std/expect";
import { databaseUrlError, getDatabaseUrl } from "./db-url.ts";

const GOOD = "postgresql://user:pass@realhost.neon.tech:5432/neondb";

// Set DATABASE_URL for the duration of fn, restoring it afterward.
function withDbUrl<T>(value: string | undefined, fn: () => T): T {
  const prev = Deno.env.get("DATABASE_URL");
  try {
    if (value === undefined) Deno.env.delete("DATABASE_URL");
    else Deno.env.set("DATABASE_URL", value);
    return fn();
  } finally {
    if (prev === undefined) Deno.env.delete("DATABASE_URL");
    else Deno.env.set("DATABASE_URL", prev);
  }
}

// Common env-UI paste mistakes that previously made pg resolve host "base" — all
// must be repaired back to the original clean URL with no validation error.
const REPAIRED: Array<[string, string]> = [
  ["leading space", " " + GOOD],
  ["trailing whitespace", GOOD + "  "],
  ["wrapped double quotes", `"${GOOD}"`],
  ["wrapped single quotes", `'${GOOD}'`],
  ["DATABASE_URL= prefix", "DATABASE_URL=" + GOOD],
  ["DATABASE_URL: prefix", "DATABASE_URL: " + GOOD],
  ["quotes + whitespace", `  "${GOOD}"  `],
];

for (const [label, raw] of REPAIRED) {
  Deno.test(`getDatabaseUrl repairs ${label}`, () => {
    withDbUrl(raw, () => {
      const url = getDatabaseUrl();
      expect(url).toBe(GOOD);
      expect(databaseUrlError(url!)).toBeNull();
    });
  });
}

// Absent / blank → null, so callers fall back to thin-client proxy mode.
for (const [label, raw] of [
  ["unset", undefined],
  ["empty string", ""],
  ["whitespace only", "   "],
] as Array<[string, string | undefined]>) {
  Deno.test(`getDatabaseUrl treats ${label} as null`, () => {
    withDbUrl(raw, () => expect(getDatabaseUrl()).toBeNull());
  });
}

// Present but not an absolute postgres URL → kept as-is, flagged with a reason.
for (const [label, raw] of [
  ["bare hostname", "realhost.neon.tech"],
  ["scheme typo", "psql://user:pass@host:5432/db"],
] as Array<[string, string]>) {
  Deno.test(`databaseUrlError flags ${label}`, () => {
    withDbUrl(raw, () => {
      const url = getDatabaseUrl();
      expect(url).toBe(raw);
      const err = databaseUrlError(url!);
      expect(err).toContain("postgres://");
    });
  });
}

Deno.test("databaseUrlError accepts a valid URL and a unix socket", () => {
  expect(databaseUrlError(GOOD)).toBeNull();
  expect(databaseUrlError("/var/run/postgresql")).toBeNull();
});
