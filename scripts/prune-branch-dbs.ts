#!/usr/bin/env -S deno run -A
// Prune orphaned Deno Deploy per-branch databases.
//
// Deno Deploy provisions an isolated Postgres database for every deployment
// environment: `<app>-production`, `<app>-preview`, `<app>-local`, and one
// `<app>--<branch>` for every git branch it builds. It never deletes the
// per-branch databases — there is no TTL, cleanup, or opt-out
// (https://docs.deno.com/deploy/reference/databases/) — so every pushed branch
// leaves a ~7 MB database behind. That is how this project silently filled
// Neon's 512 MB storage cap with ~60 dead branch copies until writes started
// failing ("could not extend file because project size limit exceeded").
//
// This drops `<app>--<branch>` databases whose git branch no longer exists on
// the remote. It NEVER touches the timeline databases (`-production` /
// `-preview` / `-local` / `--main`) or `neondb` / `postgres`, and it is scoped
// to a single app's prefix (inferred from the database it connects to) so one
// app's pruner can't reach another app's databases. Dry-run by default.
//
// Env:
//   PRUNE_DATABASE_URL  Direct (NON-pooler) connection string to a KEEPER db of
//                       the app being pruned — e.g. `<app>-production`. DROP
//                       DATABASE does not work through the PgBouncer pooler, so
//                       the host must NOT contain `-pooler`.
//   PRUNE_DB_PREFIX     Optional. Override the app prefix instead of inferring
//                       it from the connected database name.
//   PRUNE_GIT_REMOTE    Optional. Remote to read live branches from (default: origin).
//
// Usage:
//   deno run -A scripts/prune-branch-dbs.ts                    # dry-run: report orphans
//   deno run -A scripts/prune-branch-dbs.ts --apply            # drop all orphans
//   deno run -A scripts/prune-branch-dbs.ts --branch claude/x --apply
//                                                              # only branch x's db (if orphaned)
//
// Exit codes: 0 ok, 2 misconfiguration, 1 one or more drops failed.

// ── Pure logic (exported for tests; no I/O) ─────────────────────────────────

// Deno Deploy turns a git branch into the `<app>--<branch>` suffix by lowercasing
// and stripping everything outside [a-z0-9-] (notably the `/` in `claude/foo` ->
// `claudefoo…`), then truncating to fit the database-name length.
export function sanitizeBranch(branch: string): string {
  return branch.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

// Hard keep-list: never drop these regardless of any pattern match.
export function isProtected(datname: string): boolean {
  if (datname === "neondb" || datname === "postgres") return true;
  if (/-(production|preview|local)$/.test(datname)) return true;
  if (/--main$/.test(datname)) return true;
  return false;
}

// App prefix from a database name: `<prefix>-production` (or a `<prefix>--branch`
// / timeline name) -> `<prefix>`. Confines the pruner to one app's databases so
// it can't reach a sibling app that shares the same instance.
export function derivePrefix(db: string): string | null {
  const timeline = db.match(/^(.+)-(?:production|preview|local)$/);
  if (timeline) return timeline[1];
  const branch = db.match(/^(.+?)--/);
  if (branch) return branch[1];
  return null;
}

export function branchPart(prefix: string, datname: string): string {
  return datname.startsWith(prefix + "--") ? datname.slice((prefix + "--").length) : "";
}

// Given the app prefix, every `<prefix>--…` database, and the live branch names,
// return the databases safe to drop. A branch db is KEPT while some live branch's
// sanitized name starts with the db's (possibly truncated) branch part — matching
// by prefix means the exact truncation length never has to be guessed. `onlyBranch`
// restricts the result to the db(s) for a single branch (used on branch deletion).
export function findOrphans(
  prefix: string,
  branchDbs: string[],
  liveBranches: string[],
  onlyBranch: string | null = null,
): string[] {
  const live = liveBranches.map(sanitizeBranch);
  let orphans = branchDbs.filter((d) => {
    if (isProtected(d)) return false;
    const part = branchPart(prefix, d);
    if (!part) return false; // never treat an empty / non-matching name as an orphan
    return !live.some((b) => b.startsWith(part));
  });
  if (onlyBranch) {
    const target = sanitizeBranch(onlyBranch);
    orphans = orphans.filter((d) => target.startsWith(branchPart(prefix, d)));
  }
  return orphans;
}

// ── I/O entrypoint ──────────────────────────────────────────────────────────

async function liveBranchesFromRemote(remote: string): Promise<string[]> {
  const { code, stdout, stderr } = await new Deno.Command("git", {
    args: ["ls-remote", "--heads", remote],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (code !== 0) {
    throw new Error("git ls-remote failed: " + new TextDecoder().decode(stderr));
  }
  return new TextDecoder()
    .decode(stdout)
    .split("\n")
    .map((line) => line.split("\trefs/heads/")[1])
    .filter((b): b is string => Boolean(b));
}

async function main(): Promise<number> {
  const argv = Deno.args;
  const apply = argv.includes("--apply");
  const branchIdx = argv.indexOf("--branch");
  const onlyBranch = branchIdx >= 0 ? argv[branchIdx + 1] ?? null : null;

  const conn = Deno.env.get("PRUNE_DATABASE_URL");
  if (!conn) {
    console.error("PRUNE_DATABASE_URL is not set (direct, non-pooler keeper DB).");
    return 2;
  }
  if (/-pooler\./.test(conn)) {
    console.error(
      "PRUNE_DATABASE_URL points at the pooler host; DROP DATABASE needs the DIRECT host (remove `-pooler`).",
    );
    return 2;
  }
  const remote = Deno.env.get("PRUNE_GIT_REMOTE") || "origin";

  const { Pool } = await import("npm:pg");
  const pool = new Pool({ connectionString: conn, max: 1 });
  let failures = 0;
  try {
    const client = await pool.connect();
    try {
      const currentDb: string =
        (await client.query("select current_database() as db")).rows[0].db;
      const prefix = Deno.env.get("PRUNE_DB_PREFIX") || derivePrefix(currentDb);
      if (!prefix) {
        console.error(
          `Could not infer an app prefix from "${currentDb}". Connect to the ` +
            `app's <prefix>-production database, or set PRUNE_DB_PREFIX.`,
        );
        return 2;
      }

      // This app's per-branch databases only, minus the one we're connected to.
      const { rows } = await client.query(
        "select datname from pg_database where datname like $1 order by datname",
        [prefix + "--%"],
      );
      const branchDbs: string[] = rows
        .map((r: { datname: string }) => r.datname)
        .filter((d: string) => d !== currentDb);

      const live = await liveBranchesFromRemote(remote);
      const orphans = findOrphans(prefix, branchDbs, live, onlyBranch);
      const keepable = branchDbs.filter((d) => !isProtected(d));

      console.log(`Connected to:   ${currentDb}`);
      console.log(`App prefix:     ${prefix}`);
      console.log(`Live branches:  ${live.length}`);
      console.log(
        `Branch dbs:     ${keepable.length} (keep ${keepable.length - orphans.length}, ` +
          `orphan ${orphans.length})` +
          (onlyBranch ? `  [scoped to --branch ${onlyBranch}]` : ""),
      );
      console.log("");

      if (orphans.length === 0) {
        console.log("No orphaned branch databases to drop. ✅");
      } else {
        console.log(`${apply ? "Dropping" : "Would drop"} ${orphans.length} orphaned database(s):`);
        for (const d of orphans) console.log("  - " + d);
        console.log("");
        if (!apply) {
          console.log("Dry run — re-run with --apply to drop them.");
        } else {
          let dropped = 0;
          for (const d of orphans) {
            if (isProtected(d) || d === currentDb) continue; // paranoid re-check
            try {
              // Safe identifier: `d` comes from pg_database and is double-quoted.
              await client.query(`DROP DATABASE IF EXISTS "${d.replace(/"/g, '""')}"`);
              dropped++;
            } catch (err) {
              failures++;
              console.error(`  ! ${d}: ${err instanceof Error ? err.message : err}`);
            }
          }
          console.log(`Dropped ${dropped}, failed ${failures}.`);
        }
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
  return failures > 0 ? 1 : 0;
}

if (import.meta.main) {
  Deno.exit(await main());
}
