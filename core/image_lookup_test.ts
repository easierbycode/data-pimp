import { expect } from "@std/expect";
import { lookupProductByImage } from "./samples.ts";

// SerpApi Google Lens returns two listings for the same product; the second
// already-clean title dedups against the first once retail noise is stripped.
const LENS_BODY = {
  search_metadata: { status: "Success" },
  products: [
    { title: "Acme Widget Pro - Walmart.com", link: "https://walmart.com/x" },
    { title: "Acme Widget Pro", link: "https://amazon.com/y" },
  ],
};

// ScrapeCreators shop/search hit for "Acme Widget Pro".
const SEARCH_BODY = {
  products: [
    {
      title: "Acme Widget Pro",
      price: 24.99,
      url: "https://www.tiktok.com/shop/pdp/acme-widget-pro/1234567890",
      shop_name: "Acme Shop",
      cover: "https://img.example.com/widget.jpg",
    },
  ],
};

type Counter = { lens: number; search: number };

function installFetch(counter: Counter) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const u = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : input.url;
    if (u.includes("serpapi.com") && u.includes("engine=google_lens")) {
      counter.lens++;
      return Promise.resolve(jsonResponse(LENS_BODY));
    }
    if (u.includes("api.scrapecreators.com") && u.includes("/shop/search")) {
      counter.search++;
      return Promise.resolve(jsonResponse(SEARCH_BODY));
    }
    return Promise.resolve(new Response("unexpected", { status: 404 }));
  }) as typeof fetch;
  return () => {
    globalThis.fetch = realFetch;
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function withKeys(fn: () => Promise<void>): Promise<void> {
  const prevSerp = Deno.env.get("SERPAPI_API_KEY");
  const prevSc = Deno.env.get("SCRAPECREATORS_API_KEY");
  Deno.env.set("SERPAPI_API_KEY", "test-serp");
  Deno.env.set("SCRAPECREATORS_API_KEY", "test-sc");
  return fn().finally(() => {
    if (prevSerp === undefined) Deno.env.delete("SERPAPI_API_KEY");
    else Deno.env.set("SERPAPI_API_KEY", prevSerp);
    if (prevSc === undefined) Deno.env.delete("SCRAPECREATORS_API_KEY");
    else Deno.env.set("SCRAPECREATORS_API_KEY", prevSc);
  });
}

Deno.test("image lookup is gated on SERPAPI_API_KEY", async () => {
  const prev = Deno.env.get("SERPAPI_API_KEY");
  Deno.env.delete("SERPAPI_API_KEY");
  try {
    const result = await lookupProductByImage("https://img.example.com/a.jpg");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/SERPAPI_API_KEY/);
  } finally {
    if (prev !== undefined) Deno.env.set("SERPAPI_API_KEY", prev);
  }
});

Deno.test("image lookup resolves Lens candidates to a TikTok match", async () => {
  await withKeys(async () => {
    const counter: Counter = { lens: 0, search: 0 };
    const restore = installFetch(counter);
    try {
      // Unique URL so a persisted KV cache from a prior run can't pre-answer.
      const imageUrl = `https://img.example.com/${crypto.randomUUID()}.jpg`;
      const result = await lookupProductByImage(imageUrl);

      expect(result.ok).toBe(true);
      expect(result.imageUrl).toBe(imageUrl);
      expect(result.source).toBe("googlelens");
      expect(result.candidates).toEqual(["Acme Widget Pro"]);
      expect(result.item?.title).toBe("Acme Widget Pro");
      expect(result.match?.productId).toBe("1234567890");
      expect(result.match?.name).toBe("Acme Widget Pro");
      expect(result.match?.price).toBe(24.99);
      expect(result.match?.seller).toBe("Acme Shop");
      expect(result.debug).toBeUndefined();
      expect(counter.lens).toBe(1);
      expect(counter.search).toBe(1);

      // Second non-debug call for the same image is served from cache.
      const again = await lookupProductByImage(imageUrl);
      expect(again.match?.productId).toBe("1234567890");
      expect(counter.lens).toBe(1);
      expect(counter.search).toBe(1);
    } finally {
      restore();
    }
  });
});

Deno.test("a transient ScrapeCreators failure is not pinned at the positive TTL", async () => {
  await withKeys(async () => {
    // Disable negative-TTL caching so a transient failure isn't cached at all;
    // the next call must re-run and self-heal. Without the errored->negTTL fix,
    // the ok:true/match:null result would be cached at the long positive TTL and
    // the second call would serve match:null from cache.
    const prevNeg = Deno.env.get("LOOKUP_CACHE_NEG_TTL_MS");
    const prevPos = Deno.env.get("LOOKUP_CACHE_TTL_MS");
    Deno.env.set("LOOKUP_CACHE_NEG_TTL_MS", "0");
    Deno.env.set("LOOKUP_CACHE_TTL_MS", "3600000");
    const realFetch = globalThis.fetch;
    let scCalls = 0;
    globalThis.fetch = ((input: string | URL | Request) => {
      const u = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url;
      if (u.includes("serpapi.com") && u.includes("engine=google_lens")) {
        return Promise.resolve(jsonResponse(LENS_BODY));
      }
      if (u.includes("api.scrapecreators.com") && u.includes("/shop/search")) {
        scCalls++;
        // First call: transient 5xx (fetchScrapeCreatorsPriceByName throws,
        // swallowed as a null match). Second call: recovered.
        if (scCalls === 1) {
          return Promise.resolve(new Response("upstream", { status: 500 }));
        }
        return Promise.resolve(jsonResponse(SEARCH_BODY));
      }
      return Promise.resolve(new Response("unexpected", { status: 404 }));
    }) as typeof fetch;
    try {
      const imageUrl = `https://img.example.com/${crypto.randomUUID()}.jpg`;
      const first = await lookupProductByImage(imageUrl);
      expect(first.ok).toBe(true);
      expect(first.match).toBeNull(); // ScrapeCreators 500 swallowed

      const second = await lookupProductByImage(imageUrl);
      expect(second.match?.productId).toBe("1234567890"); // re-ran, self-healed
      expect(scCalls).toBe(2);
    } finally {
      globalThis.fetch = realFetch;
      if (prevNeg === undefined) Deno.env.delete("LOOKUP_CACHE_NEG_TTL_MS");
      else Deno.env.set("LOOKUP_CACHE_NEG_TTL_MS", prevNeg);
      if (prevPos === undefined) Deno.env.delete("LOOKUP_CACHE_TTL_MS");
      else Deno.env.set("LOOKUP_CACHE_TTL_MS", prevPos);
    }
  });
});

Deno.test("debug echoes the raw Lens payload and bypasses the cache", async () => {
  await withKeys(async () => {
    const counter: Counter = { lens: 0, search: 0 };
    const restore = installFetch(counter);
    try {
      const imageUrl = `https://img.example.com/${crypto.randomUUID()}.jpg`;
      const first = await lookupProductByImage(imageUrl, { debug: true });
      expect(first.debug?.[`google_lens:${imageUrl}`]).toEqual(LENS_BODY);

      // A second debug call re-runs Lens (cache bypassed), not served from cache.
      await lookupProductByImage(imageUrl, { debug: true });
      expect(counter.lens).toBe(2);
    } finally {
      restore();
    }
  });
});
