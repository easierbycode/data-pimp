import { expect } from "@std/expect";
import { lookupProductByLens } from "./samples.ts";

// SerpApi Google Lens returns visual matches across result sets, best-first.
// "Acme Widget Pro" and "...Pro XL" both resolve to the same TikTok listing (so
// they de-dupe to one "tiktok" candidate); "Acme Widget Mini" misses and stays a
// "google_lens" candidate carrying the Lens-supplied image/price/seller.
const LENS_BODY = {
  search_metadata: { status: "Success" },
  exact_matches: [
    {
      title: "Acme Widget Pro - Walmart.com",
      link: "https://walmart.com/x",
      thumbnail: "https://img.example.com/walmart.jpg",
      source: "Walmart",
      price: { value: "$24.99", extracted_value: 24.99, currency: "$" },
    },
  ],
  visual_matches: [
    {
      title: "Acme Widget Pro XL",
      link: "https://amazon.com/xl",
      thumbnail: "https://img.example.com/xl.jpg",
      source: "Amazon",
      price: 27.5,
    },
    {
      title: "Acme Widget Mini",
      link: "https://amazon.com/mini",
      thumbnail: "https://img.example.com/mini.jpg",
      source: "Amazon",
      price: 12.5,
    },
  ],
};

// ScrapeCreators shop/search hit for the "Widget Pro" queries.
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

// Resolve "Widget Pro"/"...Pro XL" to the TikTok listing; everything else is a
// clean miss (empty products → null match → google_lens fallback).
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
      const query = new URL(u).searchParams.get("query")?.toLowerCase() || "";
      if (query.includes("widget pro")) {
        return Promise.resolve(jsonResponse(SEARCH_BODY));
      }
      return Promise.resolve(jsonResponse({ products: [] }));
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

Deno.test("lens lookup is gated on SERPAPI_API_KEY", async () => {
  const prev = Deno.env.get("SERPAPI_API_KEY");
  Deno.env.delete("SERPAPI_API_KEY");
  try {
    const result = await lookupProductByLens("https://img.example.com/a.jpg");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/SERPAPI_API_KEY/);
    expect(result.image).toBe("https://img.example.com/a.jpg");
  } finally {
    if (prev !== undefined) Deno.env.set("SERPAPI_API_KEY", prev);
  }
});

Deno.test("lens lookup ranks UpcMatch candidates, boosting TikTok hits", async () => {
  await withKeys(async () => {
    const counter: Counter = { lens: 0, search: 0 };
    const restore = installFetch(counter);
    try {
      // Unique URL so a persisted KV cache from a prior run can't pre-answer.
      const image = `https://img.example.com/${crypto.randomUUID()}.jpg`;
      const result = await lookupProductByLens(image);

      expect(result.ok).toBe(true);
      expect(result.image).toBe(image);
      expect(result.source).toBe("googlelens");

      // Two "Widget Pro" titles collapse to one TikTok listing; the Mini miss
      // stays a google_lens candidate. TikTok ranks first; match == [0].
      const candidates = result.candidates ?? [];
      expect(candidates.length).toBe(2);
      expect(result.match).toEqual(candidates[0]);

      const top = candidates[0];
      expect(top.source).toBe("tiktok");
      expect(top.productId).toBe("1234567890");
      expect(top.name).toBe("Acme Widget Pro");
      expect(top.price).toBe(24.99);
      expect(top.seller).toBe("Acme Shop");

      const second = candidates[1];
      expect(second.source).toBe("google_lens");
      expect(second.name).toBe("Acme Widget Mini");
      expect(second.price).toBe(12.5); // numeric, from the Lens payload
      expect(second.seller).toBe("Amazon");
      expect(second.sourceUrl).toBe("https://amazon.com/mini");
      expect(second.productId).toBeNull(); // not a TikTok link

      // All three Lens candidates were resolved (within the default cap of 5).
      expect(counter.lens).toBe(1);
      expect(counter.search).toBe(3);
      expect(result.debug).toBeUndefined();

      // Second non-debug call for the same image is served from cache.
      const again = await lookupProductByLens(image);
      expect(again.match?.productId).toBe("1234567890");
      expect(counter.lens).toBe(1);
      expect(counter.search).toBe(3);
    } finally {
      restore();
    }
  });
});

Deno.test("lens lookup returns google_lens candidates when nothing resolves to TikTok", async () => {
  await withKeys(async () => {
    const realFetch = globalThis.fetch;
    // Lens hits, but ScrapeCreators always misses (empty products).
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
        return Promise.resolve(jsonResponse({ products: [] }));
      }
      return Promise.resolve(new Response("unexpected", { status: 404 }));
    }) as typeof fetch;
    try {
      const image = `https://img.example.com/${crypto.randomUUID()}.jpg`;
      const result = await lookupProductByLens(image);

      expect(result.ok).toBe(true);
      const candidates = result.candidates ?? [];
      expect(candidates.length).toBe(3); // all distinct titles survive
      expect(candidates.every((c) => c.source === "google_lens")).toBe(true);
      expect(result.match).toEqual(candidates[0]);
      expect(candidates[0].name).toBe("Acme Widget Pro");
      expect(candidates[0].price).toBe(24.99); // parsed from { extracted_value }
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

Deno.test("lens lookup reports no matches for an image Lens can't place", async () => {
  await withKeys(async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = ((input: string | URL | Request) => {
      const u = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url;
      if (u.includes("serpapi.com") && u.includes("engine=google_lens")) {
        return Promise.resolve(
          jsonResponse({ search_metadata: { status: "Success" } }),
        );
      }
      return Promise.resolve(new Response("unexpected", { status: 404 }));
    }) as typeof fetch;
    try {
      const image = `https://img.example.com/${crypto.randomUUID()}.jpg`;
      const result = await lookupProductByLens(image);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/No product matches/);
      expect(result.candidates).toEqual([]);
      expect(result.match ?? null).toBeNull();
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

Deno.test("lens debug echoes the raw Lens payload and bypasses the cache", async () => {
  await withKeys(async () => {
    const counter: Counter = { lens: 0, search: 0 };
    const restore = installFetch(counter);
    try {
      const image = `https://img.example.com/${crypto.randomUUID()}.jpg`;
      const first = await lookupProductByLens(image, { debug: true });
      expect(first.debug?.[`google_lens:${image}`]).toEqual(LENS_BODY);

      // A second debug call re-runs Lens (cache bypassed), not served from cache.
      await lookupProductByLens(image, { debug: true });
      expect(counter.lens).toBe(2);
    } finally {
      restore();
    }
  });
});
