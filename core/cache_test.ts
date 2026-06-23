import { expect } from "@std/expect";
import { cacheGet, cacheSet, hashKey } from "./cache.ts";

Deno.test("hashKey is deterministic and 64 lowercase hex chars", async () => {
  const a = await hashKey("https://example.com/x.jpg");
  const b = await hashKey("https://example.com/x.jpg");
  const c = await hashKey("https://example.com/y.jpg");
  expect(a).toBe(b);
  expect(a).not.toBe(c);
  expect(/^[0-9a-f]{64}$/.test(a)).toBe(true);
});

Deno.test("cacheSet/cacheGet roundtrips a value and misses on unknown keys", async () => {
  const key = "k-" + crypto.randomUUID();
  expect(await cacheGet("test", key)).toBeNull();
  await cacheSet("test", key, { hello: "world", n: 1 }, 60_000);
  expect(await cacheGet("test", key)).toEqual({ hello: "world", n: 1 });
});

Deno.test("cacheSet with a non-positive ttl is a no-op", async () => {
  const key = "k-" + crypto.randomUUID();
  await cacheSet("test", key, { x: 1 }, 0);
  expect(await cacheGet("test", key)).toBeNull();
});
