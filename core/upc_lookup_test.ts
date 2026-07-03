import { expect } from "@std/expect";
import { lookupProductByUpc } from "./samples.ts";

// UPCitemdb resolves the scanned code to a product name.
const UPCITEMDB_BODY = {
  items: [{
    title: "Acme Whey Protein Vanilla",
    brand: "Acme",
    category: "Health & Beauty > Vitamins & Supplements",
  }],
};

// ScrapeCreators shop/search returns several listings for that name. The
// pipeline used to keep only the best; now every result becomes a candidate.
// P_DUP repeats P1's product id (same PDP) and must de-dupe away. P_FREE has no
// parseable price -> it stays a candidate with price 0 (a number, not null) and
// ranks after the priced listings.
const SEARCH_MULTI = {
  products: [
    {
      title: "Acme Whey Protein Vanilla",
      price: 26.99,
      url: "https://www.tiktok.com/shop/pdp/acme-vanilla/1111111111",
      shop_name: "Acme Shop",
      cover: "https://img.example.com/vanilla.jpg",
    },
    {
      title: "Acme Whey Protein Chocolate",
      price: 19.99,
      url: "https://www.tiktok.com/shop/pdp/acme-chocolate/2222222222",
      shop_name: "Acme Shop",
    },
    {
      title: "Generic Protein Scoop",
      url: "https://www.tiktok.com/shop/pdp/generic/3333333333",
      shop_name: "Other Shop",
    },
    {
      title: "Acme Whey Protein Vanilla",
      price: 26.99,
      url: "https://www.tiktok.com/shop/pdp/acme-vanilla/1111111111",
      shop_name: "Acme Shop",
    },
  ],
};

// Google Shopping listings for a code no UPC database indexes. S_DUP repeats
// S1's title+seller (these listings carry no product id) and must de-dupe away.
const SHOPPING_MULTI = {
  shopping_results: [
    {
      title: "Widget A",
      extracted_price: 12.5,
      source: "StoreX",
      thumbnail: "https://img.example.com/a.jpg",
      product_link: "https://store.example.com/a",
    },
    {
      title: "Widget B",
      extracted_price: 8,
      source: "StoreY",
      product_link: "https://store.example.com/b",
    },
    {
      title: "Widget A",
      extracted_price: 12.5,
      source: "StoreX",
      product_link: "https://store.example.com/a-dup",
    },
  ],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

type Routes = {
  upcitemdb?: unknown; // body for the UPCitemdb lookup (default: no items)
  openfoodfacts?: unknown; // body for Open Food Facts (default: not found)
  shopping?: unknown; // body for SerpApi Google Shopping
  search?: unknown; // body for the ScrapeCreators name search
  counter?: { shopping: number; search: number };
};

function installFetch(routes: Routes) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const u = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : input.url;
    if (u.includes("upcitemdb.com")) {
      return Promise.resolve(jsonResponse(routes.upcitemdb ?? { items: [] }));
    }
    if (u.includes("openfoodfacts.org")) {
      return Promise.resolve(
        jsonResponse(routes.openfoodfacts ?? { status: 0 }),
      );
    }
    if (u.includes("serpapi.com") && u.includes("engine=google_shopping")) {
      if (routes.counter) routes.counter.shopping++;
      return Promise.resolve(
        jsonResponse(routes.shopping ?? { shopping_results: [] }),
      );
    }
    if (u.includes("api.scrapecreators.com") && u.includes("/shop/search")) {
      if (routes.counter) routes.counter.search++;
      return Promise.resolve(jsonResponse(routes.search ?? { products: [] }));
    }
    return Promise.resolve(new Response("unexpected", { status: 404 }));
  }) as typeof fetch;
  return () => {
    globalThis.fetch = realFetch;
  };
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

// Unique numeric code per call so a persisted KV cache can't pre-answer.
function freshUpc(): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(12)),
    (b) => String(b % 10),
  ).join("");
}

Deno.test("UPC lookup returns ranked TikTok candidates with match === candidates[0]", async () => {
  await withKeys(async () => {
    const restore = installFetch({
      upcitemdb: UPCITEMDB_BODY,
      search: SEARCH_MULTI,
    });
    try {
      const result = await lookupProductByUpc(freshUpc());

      expect(result.ok).toBe(true);
      expect(result.source).toBe("upcitemdb");

      // Four search results -> three candidates (the duplicate PDP de-dupes).
      const candidates = result.candidates ?? [];
      expect(candidates.length).toBe(3);

      // Ranked best-first: priced listings ahead of the price-less one, and the
      // top is the highest-scoring priced listing the legacy `match` would pick.
      expect(candidates[0].productId).toBe("1111111111");
      expect(candidates[0].name).toBe("Acme Whey Protein Vanilla");
      expect(candidates[0].price).toBe(26.99);
      expect(candidates[0].seller).toBe("Acme Shop");
      expect(candidates[0].image).toBe("https://img.example.com/vanilla.jpg");
      expect(candidates[0].sourceUrl).toBe(
        "https://www.tiktok.com/shop/pdp/acme-vanilla/1111111111",
      );

      // match is candidates[0] (kept for back-compat).
      expect(result.match).toEqual(candidates[0]);

      // Every candidate is fully shaped: source set, price a number (0, not
      // null, when unknown).
      for (const candidate of candidates) {
        expect(candidate.source).toBe("tiktok");
        expect(typeof candidate.price).toBe("number");
      }
      const priceless = candidates.find((c) => c.productId === "3333333333");
      expect(priceless?.price).toBe(0);
    } finally {
      restore();
    }
  });
});

Deno.test("UPC lookup surfaces Google Shopping listings as candidates when the databases miss", async () => {
  await withKeys(async () => {
    const counter = { shopping: 0, search: 0 };
    const restore = installFetch({
      // UPCitemdb + Open Food Facts both miss -> Google Shopping answers.
      shopping: SHOPPING_MULTI,
      search: { products: [] }, // no TikTok match for the shopping title
      counter,
    });
    try {
      const result = await lookupProductByUpc(freshUpc());

      expect(result.ok).toBe(true);
      expect(result.source).toBe("googleshopping");
      expect(counter.shopping).toBe(1);

      // Three shopping results -> two candidates (same title+seller de-dupes).
      const candidates = result.candidates ?? [];
      expect(candidates.length).toBe(2);
      expect(candidates.map((c) => c.source)).toEqual([
        "google_shopping",
        "google_shopping",
      ]);
      expect(candidates[0].name).toBe("Widget A");
      expect(candidates[0].price).toBe(12.5);
      expect(candidates[0].seller).toBe("StoreX");
      expect(candidates[0].image).toBe("https://img.example.com/a.jpg");
      expect(candidates[0].sourceUrl).toBe("https://store.example.com/a");
      expect(candidates[0].productId).toBeNull();
      expect(result.match).toEqual(candidates[0]);
    } finally {
      restore();
    }
  });
});

Deno.test("UPC lookup with no listings yields candidates: [] and match: null", async () => {
  await withKeys(async () => {
    const restore = installFetch({
      upcitemdb: UPCITEMDB_BODY,
      search: { products: [] }, // a resolved item, but nothing to match
    });
    try {
      const result = await lookupProductByUpc(freshUpc());

      expect(result.ok).toBe(true);
      expect(result.candidates).toEqual([]);
      expect(result.match ?? null).toBeNull();
    } finally {
      restore();
    }
  });
});

Deno.test("debug=1 echoes the raw SerpApi payload and still returns candidates", async () => {
  await withKeys(async () => {
    const counter = { shopping: 0, search: 0 };
    const restore = installFetch({
      shopping: SHOPPING_MULTI,
      search: { products: [] },
      counter,
    });
    try {
      const upc = freshUpc();
      const result = await lookupProductByUpc(upc, { debug: true });

      expect(result.debug?.[`google_shopping:${upc}`]).toEqual(SHOPPING_MULTI);
      expect((result.candidates ?? []).length).toBe(2);

      // A second debug call re-runs the pipeline (cache bypassed).
      await lookupProductByUpc(upc, { debug: true });
      expect(counter.shopping).toBe(2);
    } finally {
      restore();
    }
  });
});
