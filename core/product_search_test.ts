import { expect } from "@std/expect";
import { lookupProductsByKeyword } from "./samples.ts";

// ScrapeCreators shop/search hit: one priced and one unpriced listing for the
// same query, so we can assert the priced listing ranks first.
const SEARCH_BODY = {
  products: [
    {
      title: "Acme Widget Mini",
      price: 0,
      url: "https://www.tiktok.com/shop/pdp/acme-widget-mini/1111111111",
      shop_name: "Mini Shop",
      cover: "https://img.example.com/mini.jpg",
    },
    {
      title: "Acme Widget Pro",
      price: 24.99,
      url: "https://www.tiktok.com/shop/pdp/acme-widget-pro/1234567890",
      shop_name: "Acme Shop",
      cover: "https://img.example.com/widget.jpg",
    },
  ],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// Mock fetch for the ScrapeCreators TikTok Shop search; `makeBody` is called per
// request so a test can count calls or vary the response.
function installSearchFetch(makeBody: () => unknown) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const u = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : input.url;
    if (u.includes("api.scrapecreators.com") && u.includes("/shop/search")) {
      return Promise.resolve(jsonResponse(makeBody()));
    }
    return Promise.resolve(new Response("unexpected", { status: 404 }));
  }) as typeof fetch;
  return () => {
    globalThis.fetch = realFetch;
  };
}

// Run with a ScrapeCreators key set (and API_KEY cleared so the fallback can't
// mask an unset SCRAPECREATORS_API_KEY), restoring the prior environment after.
function withScKey(fn: () => Promise<void>): Promise<void> {
  const prevSc = Deno.env.get("SCRAPECREATORS_API_KEY");
  const prevApi = Deno.env.get("API_KEY");
  Deno.env.set("SCRAPECREATORS_API_KEY", "test-sc");
  Deno.env.delete("API_KEY");
  return fn().finally(() => {
    if (prevSc === undefined) Deno.env.delete("SCRAPECREATORS_API_KEY");
    else Deno.env.set("SCRAPECREATORS_API_KEY", prevSc);
    if (prevApi === undefined) Deno.env.delete("API_KEY");
    else Deno.env.set("API_KEY", prevApi);
  });
}

Deno.test("product search requires a non-empty query", async () => {
  await expect(lookupProductsByKeyword("   ")).rejects.toThrow(/query is required/);
});

Deno.test("product search is gated on SCRAPECREATORS_API_KEY", async () => {
  const prevSc = Deno.env.get("SCRAPECREATORS_API_KEY");
  const prevApi = Deno.env.get("API_KEY");
  Deno.env.delete("SCRAPECREATORS_API_KEY");
  Deno.env.delete("API_KEY");
  try {
    const result = await lookupProductsByKeyword("acme widget");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/SCRAPECREATORS_API_KEY/);
  } finally {
    if (prevSc !== undefined) Deno.env.set("SCRAPECREATORS_API_KEY", prevSc);
    if (prevApi !== undefined) Deno.env.set("API_KEY", prevApi);
  }
});

Deno.test("product search returns ranked TikTok candidates and caches", async () => {
  await withScKey(async () => {
    let calls = 0;
    const restore = installSearchFetch(() => {
      calls++;
      return SEARCH_BODY;
    });
    try {
      // Unique query so a persisted KV cache from a prior run can't pre-answer.
      const q = `acme ${crypto.randomUUID()}`;
      const result = await lookupProductsByKeyword(q);

      expect(result.ok).toBe(true);
      expect(result.query).toBe(q);
      expect(result.source).toBe("tiktok");
      expect(result.candidates?.length).toBe(2);
      // The priced listing ranks ahead of the unpriced one, and is the match.
      expect(result.match?.productId).toBe("1234567890");
      expect(result.candidates?.[0].name).toBe("Acme Widget Pro");
      expect(result.candidates?.[0].price).toBe(24.99);
      expect(result.candidates?.[0].seller).toBe("Acme Shop");
      expect(result.candidates?.[1].productId).toBe("1111111111");
      // The raw upstream `product` blob is stripped from search candidates (kept
      // small so the cached value stays under Deno KV's 64 KiB limit).
      expect(result.candidates?.[0].product).toBeUndefined();
      expect(result.debug).toBeUndefined();
      expect(calls).toBe(1);

      // A second non-debug call for the same query is served from cache.
      const again = await lookupProductsByKeyword(q);
      expect(again.match?.productId).toBe("1234567890");
      expect(calls).toBe(1);
    } finally {
      restore();
    }
  });
});

Deno.test("product search returns ok with no candidates on an empty result", async () => {
  await withScKey(async () => {
    const restore = installSearchFetch(() => ({ products: [] }));
    try {
      const q = `nomatch ${crypto.randomUUID()}`;
      const result = await lookupProductsByKeyword(q);
      expect(result.ok).toBe(true);
      expect(result.candidates).toEqual([]);
      expect(result.match).toBeNull();
    } finally {
      restore();
    }
  });
});

Deno.test("product search clamps the limit", async () => {
  await withScKey(async () => {
    const restore = installSearchFetch(() => SEARCH_BODY);
    try {
      const q = `acme ${crypto.randomUUID()}`;
      const result = await lookupProductsByKeyword(q, { limit: 1 });
      expect(result.candidates?.length).toBe(1);
      expect(result.candidates?.[0].productId).toBe("1234567890");
    } finally {
      restore();
    }
  });
});

Deno.test("product search debug echoes the raw payload and bypasses cache", async () => {
  await withScKey(async () => {
    let calls = 0;
    const restore = installSearchFetch(() => {
      calls++;
      return SEARCH_BODY;
    });
    try {
      const q = `acme ${crypto.randomUUID()}`;
      const first = await lookupProductsByKeyword(q, { debug: true });
      expect(first.debug?.scrapecreators).toEqual(SEARCH_BODY);

      // A second debug call re-runs the search (cache bypassed).
      await lookupProductsByKeyword(q, { debug: true });
      expect(calls).toBe(2);
    } finally {
      restore();
    }
  });
});

Deno.test("product search throws on a ScrapeCreators failure (-> 502)", async () => {
  await withScKey(async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = ((input: string | URL | Request) => {
      const u = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url;
      if (u.includes("api.scrapecreators.com") && u.includes("/shop/search")) {
        return Promise.resolve(new Response("upstream", { status: 500 }));
      }
      return Promise.resolve(new Response("unexpected", { status: 404 }));
    }) as typeof fetch;
    try {
      // Unique query so the failure can't be served from a cached result.
      await expect(
        lookupProductsByKeyword(`fail ${crypto.randomUUID()}`),
      ).rejects.toThrow();
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
