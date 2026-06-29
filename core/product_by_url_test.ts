import { expect } from "@std/expect";
import { lookupProductByTiktokUrl, resolveTiktokProductUrl } from "./samples.ts";

const PRODUCT_ID = "1731435940099691085";

// A ScrapeCreators by-URL product response (the happy path: /v1/tiktok/product).
const PRODUCT_BODY = {
  product_info: {
    product_base: {
      title: "Acme Hydro Bottle 32oz",
      price: { min_sku_original_price: 19.99 },
      images: [{ url_list: ["https://img.example.com/bottle.jpg"] }],
    },
    seller: { name: "Acme Shop" },
  },
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function withScKey(fn: () => Promise<void>): Promise<void> {
  const prev = Deno.env.get("SCRAPECREATORS_API_KEY");
  Deno.env.set("SCRAPECREATORS_API_KEY", "test-sc");
  return fn().finally(() => {
    if (prev === undefined) Deno.env.delete("SCRAPECREATORS_API_KEY");
    else Deno.env.set("SCRAPECREATORS_API_KEY", prev);
  });
}

// --- URL id extraction (no network for the full-url forms) -----------------

Deno.test("resolves the id from a shop.tiktok.com /view/product url", async () => {
  const result = await resolveTiktokProductUrl(
    `https://shop.tiktok.com/view/product/${PRODUCT_ID}?source=liveManager&region=us`,
  );
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.productId).toBe(PRODUCT_ID);
});

Deno.test("resolves the id from a www.tiktok.com /shop/pdp/<slug>/<id> url", async () => {
  const result = await resolveTiktokProductUrl(
    `https://www.tiktok.com/shop/pdp/acme-hydro-bottle/${PRODUCT_ID}`,
  );
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.productId).toBe(PRODUCT_ID);
});

Deno.test("resolves the id from a trailing-id url", async () => {
  const result = await resolveTiktokProductUrl(
    `https://shop.tiktok.com/some/other/path/${PRODUCT_ID}`,
  );
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.productId).toBe(PRODUCT_ID);
});

Deno.test("a numeric query value is not mistaken for the id", async () => {
  const result = await resolveTiktokProductUrl(
    `https://shop.tiktok.com/view/product/${PRODUCT_ID}?source=998877665544`,
  );
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.productId).toBe(PRODUCT_ID);
});

Deno.test("rejects a non-TikTok url", async () => {
  const result = await resolveTiktokProductUrl(
    "https://www.amazon.com/dp/B0001234567",
  );
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toMatch(/TikTok/i);
});

Deno.test("rejects a TikTok url with no extractable id", async () => {
  const result = await resolveTiktokProductUrl("https://www.tiktok.com/@someone");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toMatch(/product id/i);
});

Deno.test("rejects empty and malformed urls", async () => {
  expect((await resolveTiktokProductUrl("")).ok).toBe(false);
  expect((await resolveTiktokProductUrl("not a url")).ok).toBe(false);
});

Deno.test("follows a short link server-side then extracts the id", async () => {
  const realFetch = globalThis.fetch;
  // fetch() with redirect:"follow" surfaces the final url on Response.url. That
  // getter can't be passed to the constructor, so shadow it on the instance to
  // simulate the short link having redirected to the final PDP url.
  globalThis.fetch = (() => {
    const res = new Response("", { status: 200 });
    Object.defineProperty(res, "url", {
      value: `https://www.tiktok.com/shop/pdp/acme/${PRODUCT_ID}`,
    });
    return Promise.resolve(res);
  }) as typeof fetch;
  try {
    const result = await resolveTiktokProductUrl("https://vt.tiktok.com/ZSabc123/");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.productId).toBe(PRODUCT_ID);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("follows a www.tiktok.com/t/<code> share link then extracts the id", async () => {
  const realFetch = globalThis.fetch;
  // The in-app share sheet hands out www.tiktok.com/t/ZP96… links: a short-link
  // path on a regular TikTok host. It must be followed server-side just like the
  // vt/vm short-link hosts.
  globalThis.fetch = (() => {
    const res = new Response("", { status: 200 });
    Object.defineProperty(res, "url", {
      value: `https://www.tiktok.com/shop/pdp/acme/${PRODUCT_ID}`,
    });
    return Promise.resolve(res);
  }) as typeof fetch;
  try {
    const result = await resolveTiktokProductUrl(
      "https://www.tiktok.com/t/ZP96abcdef/",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.productId).toBe(PRODUCT_ID);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("a share link that doesn't resolve to an id is a clean miss", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    const res = new Response("", { status: 200 });
    Object.defineProperty(res, "url", { value: "https://www.tiktok.com/foryou" });
    return Promise.resolve(res);
  }) as typeof fetch;
  try {
    const result = await resolveTiktokProductUrl("https://www.tiktok.com/t/ZPbroken/");
    expect(result.ok).toBe(false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("a short link that doesn't resolve to an id is a clean miss", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    const res = new Response("", { status: 200 });
    Object.defineProperty(res, "url", { value: "https://www.tiktok.com/foryou" });
    return Promise.resolve(res);
  }) as typeof fetch;
  try {
    const result = await resolveTiktokProductUrl("https://vm.tiktok.com/ZSxyz/");
    expect(result.ok).toBe(false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// Regression: when the short-link redirect can't be followed (network error /
// timeout), a numeric short-code path must NOT be mis-read as a product id.
Deno.test("an unresolvable short link doesn't mis-read a numeric short code", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.reject(new Error("network"))) as typeof fetch;
  try {
    const result = await resolveTiktokProductUrl("https://vt.tiktok.com/1234567890/");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/short link/i);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// --- ScrapeCreators lookup + UrlMatch mapping ------------------------------

type ScCounter = { product: number; search: number };

// Install a fetch that routes the by-URL product call to `onProduct` and counts
// any name-search call separately — the by-url endpoint must NEVER name-search
// (a search on the bare numeric id binds an arbitrary unrelated listing).
function installScFetch(
  counter: ScCounter,
  onProduct: () => Response,
): () => void {
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const u = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : input.url;
    if (u.includes("api.scrapecreators.com") && u.includes("/v1/tiktok/product")) {
      counter.product++;
      return Promise.resolve(onProduct());
    }
    if (u.includes("api.scrapecreators.com") && u.includes("/shop/search")) {
      counter.search++;
      return Promise.resolve(jsonResponse({ products: [] }));
    }
    return Promise.resolve(new Response("unexpected", { status: 404 }));
  }) as typeof fetch;
  return () => {
    globalThis.fetch = realFetch;
  };
}

Deno.test("lookupProductByTiktokUrl maps the by-URL ScrapeCreators response", async () => {
  await withScKey(async () => {
    const counter: ScCounter = { product: 0, search: 0 };
    const restore = installScFetch(counter, () => jsonResponse(PRODUCT_BODY));
    try {
      const match = await lookupProductByTiktokUrl(PRODUCT_ID);
      expect(match.ok).toBe(true);
      expect(match.productId).toBe(PRODUCT_ID);
      expect(match.name).toBe("Acme Hydro Bottle 32oz");
      expect(match.price).toBe(19.99);
      expect(match.image).toBe("https://img.example.com/bottle.jpg");
      expect(match.seller).toBe("Acme Shop");
      expect(match.source).toBe("tiktok");
      expect(match.product).toEqual(PRODUCT_BODY);
      expect(match.debug).toBeUndefined();
      // Resolved strictly by URL — no name search.
      expect(counter.product).toBe(1);
      expect(counter.search).toBe(0);
    } finally {
      restore();
    }
  });
});

Deno.test("?debug echoes the raw ScrapeCreators payload", async () => {
  await withScKey(async () => {
    const counter: ScCounter = { product: 0, search: 0 };
    const restore = installScFetch(counter, () => jsonResponse(PRODUCT_BODY));
    try {
      const match = await lookupProductByTiktokUrl(PRODUCT_ID, { debug: true });
      expect(match.debug?.scrapecreators).toEqual(PRODUCT_BODY);
    } finally {
      restore();
    }
  });
});

// Regression: an out-of-stock / unmapped-price product still resolves. price 0
// is a valid result, not a "no product" miss, and the raw body is still echoed.
Deno.test("a real product with no parseable price resolves with price 0", async () => {
  await withScKey(async () => {
    const counter: ScCounter = { product: 0, search: 0 };
    const body = {
      product_info: { product_base: { title: "Real Product No Price" } },
    };
    const restore = installScFetch(counter, () => jsonResponse(body));
    try {
      const match = await lookupProductByTiktokUrl(PRODUCT_ID);
      expect(match.ok).toBe(true);
      expect(match.name).toBe("Real Product No Price");
      expect(match.price).toBe(0);
      expect(match.product).toEqual(body);
      expect(counter.search).toBe(0);
    } finally {
      restore();
    }
  });
});

// Regression: a by-URL miss must NOT fall back to a name search on the numeric
// id (which would bind an arbitrary unrelated listing). A hard miss throws.
Deno.test("a by-URL failure never falls back to a name search", async () => {
  await withScKey(async () => {
    const counter: ScCounter = { product: 0, search: 0 };
    const restore = installScFetch(
      counter,
      () => new Response("upstream boom", { status: 500 }),
    );
    try {
      await expect(lookupProductByTiktokUrl(PRODUCT_ID)).rejects.toThrow();
      expect(counter.search).toBe(0);
    } finally {
      restore();
    }
  });
});

// Regression: a real id beginning with "9" must still use the by-URL lookup —
// the "9"-prefix synthetic-id heuristic must not capture a genuine snowflake id.
Deno.test("an id starting with 9 is looked up by URL, not name-searched", async () => {
  await withScKey(async () => {
    const counter: ScCounter = { product: 0, search: 0 };
    const restore = installScFetch(counter, () => jsonResponse(PRODUCT_BODY));
    try {
      const match = await lookupProductByTiktokUrl("9123456789012345678");
      expect(match.ok).toBe(true);
      expect(match.productId).toBe("9123456789012345678");
      expect(counter.product).toBe(1);
      expect(counter.search).toBe(0);
    } finally {
      restore();
    }
  });
});

// Regression: `product` is always present (null, not omitted) on an unresolved
// lookup, so the serialized shape stays stable for the inventory app.
Deno.test("product is null (present) when nothing resolves", async () => {
  await withScKey(async () => {
    const counter: ScCounter = { product: 0, search: 0 };
    // A by-URL body that isn't a product object: no title/price/image, no raw.
    const restore = installScFetch(counter, () => jsonResponse(null));
    try {
      const match = await lookupProductByTiktokUrl(PRODUCT_ID);
      expect(match.ok).toBe(false);
      expect(match.price).toBe(0);
      expect(match.product).toBeNull();
      expect(match.error).toBeTruthy();
    } finally {
      restore();
    }
  });
});
