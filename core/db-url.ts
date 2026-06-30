// db-url.ts — read + sanitize DATABASE_URL before it reaches `pg`.
//
// Why this exists: `pg` parses the connection string with pg-connection-string,
// which resolves the value relative to a dummy base URL `postgres://base`. So a
// value that ISN'T recognized as an absolute `postgres://` URL keeps the base's
// host — pg then tries to DNS-resolve the literal host "base" and the first
// query dies with the cryptic `getaddrinfo ENOTFOUND base`.
//
// The usual culprits are paste mistakes in the deployment env UI: a leading
// space, the value wrapped in quotes, or the whole `DATABASE_URL=…` line pasted
// as the value. getDatabaseUrl() repairs those so a stray space/quote no longer
// takes the site down; databaseUrlError() flags anything still malformed with a
// human-readable reason instead of letting it degrade to "ENOTFOUND base".

/**
 * Read DATABASE_URL and repair common paste mistakes: surrounding whitespace, a
 * leading `DATABASE_URL=` prefix, and a single layer of wrapping quotes.
 * Returns null when the var is unset or (after cleaning) blank — callers treat
 * that as "no local DB" (thin-client proxy mode).
 */
export function getDatabaseUrl(): string | null {
  let v = Deno.env.get("DATABASE_URL");
  if (v == null) return null;

  // Trim, then drop an accidental `DATABASE_URL=` / `DATABASE_URL :` prefix
  // (the whole KEY=VALUE line pasted as the value), then trim again.
  v = v.trim().replace(/^DATABASE_URL\s*[=:]\s*/i, "").trim();

  // Strip ONE layer of matching wrapping quotes (e.g. "postgres://…").
  if (
    v.length >= 2 &&
    ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))
  ) {
    v = v.slice(1, -1).trim();
  }

  return v || null;
}

/**
 * Validate a cleaned connection string. A pg connection string must be either an
 * absolute `postgres://`/`postgresql://` URL or a `/unix/socket` path; anything
 * else makes pg-connection-string fall back to host "base". Returns a
 * human-readable error string when invalid, or null when it looks usable.
 * (Returns a string instead of throwing so module init never crashes the
 * isolate — boot stays non-blocking; the error surfaces on first query.)
 */
export function databaseUrlError(v: string): string | null {
  if (v.startsWith("/")) return null; // unix-domain socket path
  if (/^postgres(ql)?:\/\//i.test(v)) return null;
  const head = JSON.stringify(v.slice(0, 16));
  return (
    `DATABASE_URL must start with "postgres://" or "postgresql://" ` +
    `(or be a /socket path); got a value beginning with ${head}. ` +
    `Check the deployment env for a leading space, surrounding quotes, or a ` +
    `"DATABASE_URL=" prefix. Left as-is, pg resolves host "base" ` +
    `(getaddrinfo ENOTFOUND base).`
  );
}
