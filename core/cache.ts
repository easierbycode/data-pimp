// Best-effort TTL cache for the cost-bearing lookups (UPC + image), so the same
// scanned barcode or product image doesn't re-spend SerpApi / ScrapeCreators
// credits on every request. Prefers Deno KV -- it persists across instances and
// restarts on Deno Deploy and expires entries natively via `expireIn` -- and
// falls back to a process-local Map (manual TTL sweep) when KV is unavailable
// (older runtimes, or local `deno run` without KV). The cache is purely an
// optimization: every read/write is wrapped so a cache fault degrades to a live
// lookup rather than failing the request.

const KV_PREFIX = "lookup-cache";

// Minimal surface of Deno KV we use. Typed locally (rather than via Deno.Kv) so
// this module compiles without the `deno.unstable` lib -- KV is resolved at
// runtime and absence is handled gracefully.
interface KvLike {
  get<T>(key: unknown[]): Promise<{ value: T | null }>;
  set(
    key: unknown[],
    value: unknown,
    opts?: { expireIn?: number },
  ): Promise<unknown>;
}
const denoOpenKv =
  (Deno as unknown as { openKv?: () => Promise<KvLike> }).openKv;

// One shared KV handle, opened lazily. Resolves to null when KV isn't available
// so callers transparently fall back to the in-memory map.
let kvPromise: Promise<KvLike | null> | null = null;
function openKv(): Promise<KvLike | null> {
  if (kvPromise) return kvPromise;
  kvPromise = (async () => {
    try {
      if (typeof denoOpenKv !== "function") return null;
      return await denoOpenKv();
    } catch {
      return null; // no KV (e.g. missing --unstable-kv) -> use the memory map
    }
  })();
  return kvPromise;
}

// Process-local fallback store. Bounded so a long-running instance with KV
// disabled can't grow it without limit; oldest-inserted entries are evicted.
type MemEntry = { value: unknown; expiresAt: number };
const mem = new Map<string, MemEntry>();
const MEM_MAX_ENTRIES = 1000;

function memKey(namespace: string, key: string): string {
  return JSON.stringify([namespace, key]);
}

function memGet(namespace: string, key: string): unknown {
  const k = memKey(namespace, key);
  const hit = mem.get(k);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    mem.delete(k);
    return null;
  }
  return hit.value;
}

function memSet(namespace: string, key: string, value: unknown, ttlMs: number) {
  const k = memKey(namespace, key);
  // Refresh insertion order on overwrite so the eviction below stays FIFO.
  mem.delete(k);
  mem.set(k, { value, expiresAt: Date.now() + ttlMs });
  while (mem.size > MEM_MAX_ENTRIES) {
    const oldest = mem.keys().next().value;
    if (oldest === undefined) break;
    mem.delete(oldest);
  }
}

// Return the cached value for (namespace, key), or null on a miss / any fault.
export async function cacheGet<T>(
  namespace: string,
  key: string,
): Promise<T | null> {
  const kv = await openKv();
  if (kv) {
    try {
      const res = await kv.get<T>([KV_PREFIX, namespace, key]);
      // KV honors `expireIn`, so a present value is still live.
      return res.value ?? null;
    } catch {
      // fall through to the memory map
    }
  }
  return (memGet(namespace, key) as T | null) ?? null;
}

// Cache `value` under (namespace, key) for ttlMs. Best-effort: a KV failure
// (e.g. value over the 64 KiB limit) silently falls back to the memory map.
export async function cacheSet(
  namespace: string,
  key: string,
  value: unknown,
  ttlMs: number,
): Promise<void> {
  if (!(ttlMs > 0)) return;
  const kv = await openKv();
  if (kv) {
    try {
      await kv.set([KV_PREFIX, namespace, key], value, { expireIn: ttlMs });
      return;
    } catch {
      // fall through to the memory map
    }
  }
  memSet(namespace, key, value, ttlMs);
}

// Stable, length-bounded cache key for arbitrary strings (e.g. image URLs that
// can exceed KV's per-key-part size limit). SHA-256 hex of the input.
export async function hashKey(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
