/**
 * Sync the shared sample-status list from its single source of truth.
 *
 * The canonical list lives in the tiktok-sample-tracker repo at
 * `src/lib/sample-statuses.json`. This app vendors a byte-identical copy at
 * `core/sample-statuses.json` and derives its status options from it (see
 * `core/sample-status.ts`), so the two apps' status lists cannot silently
 * drift apart.
 *
 * Usage:
 *   deno task sync:statuses            # fetch canonical -> overwrite vendored copy + lock
 *   deno task sync:statuses --check    # fail (exit 1) if the vendored copy / Sample.json
 *                                      # enum no longer match canonical; writes nothing
 *
 * Override the source (e.g. to test against a branch) with STATUS_SOURCE_URL.
 */
import { fromFileUrl } from "https://deno.land/std/path/mod.ts";

const DEFAULT_SOURCE =
  "https://raw.githubusercontent.com/easierbycode/tiktok-sample-tracker/main/src/lib/sample-statuses.json";
const SOURCE_URL = Deno.env.get("STATUS_SOURCE_URL") ?? DEFAULT_SOURCE;

const root = fromFileUrl(new URL("../", import.meta.url));
const VENDORED = `${root}core/sample-statuses.json`;
const LOCK = `${root}core/sample-statuses.lock`;
const SAMPLE_SCHEMA = `${root}Entities/Sample.json`;

const KINDS = new Set(["status", "badge"]);
const APPS = new Set(["tiktok", "datapimp"]);

interface SharedStatusEntry {
  value: string;
  label: string;
  kind: string;
  exclusive: boolean;
  appliesTo: string[];
  icon: string | null;
  palette: string;
  order: number;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Parse + structurally validate the canonical text, throwing on any problem. */
function validate(text: string): SharedStatusEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`canonical is not valid JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("canonical must be a non-empty array of status entries");
  }
  for (const [i, e] of parsed.entries()) {
    const s = e as Record<string, unknown>;
    const ok = s &&
      typeof s.value === "string" &&
      typeof s.label === "string" &&
      typeof s.kind === "string" && KINDS.has(s.kind) &&
      typeof s.exclusive === "boolean" &&
      Array.isArray(s.appliesTo) && s.appliesTo.length > 0 &&
      (s.appliesTo as unknown[]).every((a) => typeof a === "string" && APPS.has(a)) &&
      (s.icon === null || typeof s.icon === "string") &&
      typeof s.palette === "string" &&
      typeof s.order === "number";
    if (!ok) throw new Error(`entry ${i} (${JSON.stringify(s?.value)}) is malformed`);
  }
  return parsed as SharedStatusEntry[];
}

/** The exclusive-status enum this app should expose, derived from canonical. */
function datapimpStatusEnum(entries: SharedStatusEntry[]): string[] {
  return entries
    .filter((s) => s.appliesTo.includes("datapimp") && s.kind === "status")
    .sort((a, b) => a.order - b.order)
    .map((s) => s.value);
}

async function readSampleEnum(): Promise<string[]> {
  const schema = JSON.parse(await Deno.readTextFile(SAMPLE_SCHEMA));
  return schema?.properties?.status?.enum ?? [];
}

const check = Deno.args.includes("--check");

console.log(`${check ? "Checking" : "Syncing"} statuses from ${SOURCE_URL}`);

let canonicalText: string;
try {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  canonicalText = await res.text();
} catch (e) {
  console.error(`✗ could not fetch canonical: ${(e as Error).message}`);
  console.error("  (the canonical file must exist on tiktok-sample-tracker's default branch)");
  Deno.exit(check ? 1 : 2);
}

const entries = validate(canonicalText);
const canonicalSha = await sha256(canonicalText);
const expectedEnum = datapimpStatusEnum(entries);

if (check) {
  const problems: string[] = [];

  let vendored = "";
  try {
    vendored = await Deno.readTextFile(VENDORED);
  } catch {
    problems.push(`vendored copy missing at core/sample-statuses.json`);
  }
  if (vendored && vendored !== canonicalText) {
    problems.push(
      `core/sample-statuses.json is out of sync with canonical — run \`deno task sync:statuses\``,
    );
  }

  const sampleEnum = await readSampleEnum();
  const enumMatches = sampleEnum.length === expectedEnum.length &&
    sampleEnum.every((v: string, i: number) => v === expectedEnum[i]);
  if (!enumMatches) {
    problems.push(
      `Entities/Sample.json status.enum [${sampleEnum.join(", ")}] ` +
        `should be [${expectedEnum.join(", ")}]`,
    );
  }

  if (problems.length) {
    console.error("✗ status drift detected:");
    for (const p of problems) console.error(`  - ${p}`);
    Deno.exit(1);
  }
  console.log(`✓ in sync (${entries.length} statuses, sha ${canonicalSha.slice(0, 12)})`);
  Deno.exit(0);
}

await Deno.writeTextFile(VENDORED, canonicalText);
await Deno.writeTextFile(LOCK, canonicalSha + "\n");
console.log(`✓ vendored ${entries.length} statuses to core/sample-statuses.json`);
console.log(`  lock: ${canonicalSha}`);
console.log(`  Sample.json status.enum should be: [${expectedEnum.join(", ")}]`);
