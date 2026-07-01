import { expect } from "@std/expect";
import {
  ebaySoldSearchUrl,
  fetchEbaySoldComps,
  parseEbaySoldPrices,
} from "./ebay-comps.ts";

// A representative slice of an eBay SOLD-search results page.
const FIXTURE = `
<ul class="srp-results">
  <li class="s-item s-item__pl-on-bottom"><div class="s-item__info">
    <span role="heading" class="s-item__title">Shop on eBay</span>
    <span class="s-item__price">$20.00</span></div></li>
  <li class="s-item"><div class="s-item__info">
    <span class="s-item__title">Ninja AF101 Air Fryer 4qt</span>
    <span class="s-item__price">$54.99</span></div></li>
  <li class="s-item"><span class="s-item__price">$62.00</span></li>
  <li class="s-item"><span class="s-item__price">$1,024.50</span></li>
  <li class="s-item"><span class="s-item__price">$10.00 to $30.00</span></li>
  <li class="s-item"><span class="s-item__price"><span aria-hidden="true">$48.25</span></span></li>
</ul>`;

Deno.test("parseEbaySoldPrices extracts sold prices (ranges take the low end, commas parsed)", () => {
  const prices = parseEbaySoldPrices(FIXTURE);
  // The generic "Shop on eBay" promo card's $20.00 placeholder is excluded.
  expect(prices).toEqual([54.99, 62, 1024.5, 10, 48.25]);
});

Deno.test("the 'Shop on eBay' promo placeholder is not treated as a real comp", () => {
  const prices = parseEbaySoldPrices(FIXTURE);
  expect(prices).not.toContain(20);
});

Deno.test("parseEbaySoldPrices drops values wildly off a known retail", () => {
  const prices = parseEbaySoldPrices(FIXTURE, { retail: 60 });
  expect(prices).not.toContain(1024.5); // > retail*3
  expect(prices).toContain(54.99);
  expect(prices).toContain(62);
});

Deno.test("parseEbaySoldPrices is safe on junk/empty input", () => {
  expect(parseEbaySoldPrices("")).toEqual([]);
  expect(parseEbaySoldPrices("<html>no prices here</html>")).toEqual([]);
  expect(parseEbaySoldPrices(null as unknown as string)).toEqual([]);
});

Deno.test("ebaySoldSearchUrl builds the sold + completed filter", () => {
  const url = ebaySoldSearchUrl("ninja air fryer af101");
  expect(url).toContain("_nkw=ninja+air+fryer+af101");
  expect(url).toContain("LH_Sold=1");
  expect(url).toContain("LH_Complete=1");
});

Deno.test("fetchEbaySoldComps returns parsed comps on a 200, then serves from cache", async () => {
  const query = "unit-test-widget-" + Math.floor(performance.now());
  let calls = 0;
  const fetchImpl = ((_url: string) => {
    calls++;
    return Promise.resolve(new Response(FIXTURE, { status: 200 }));
  }) as unknown as typeof fetch;

  const first = await fetchEbaySoldComps({ query, retail: 60, fetchImpl });
  expect(first.source).toBe("ebay-sold");
  expect(first.comps).toContain(54.99);
  expect(first.comps).not.toContain(1024.5);
  expect(calls).toBe(1);

  const second = await fetchEbaySoldComps({ query, retail: 60, fetchImpl });
  expect(second.source).toBe("cache");
  expect(second.comps).toEqual(first.comps);
  expect(calls).toBe(1); // served from cache, no second fetch
});

Deno.test("cache is retail-independent: a later call with a higher retail sees the full comps", async () => {
  const query = "retail-key-widget-" + Math.floor(performance.now());
  let calls = 0;
  const fetchImpl = (() => {
    calls++;
    return Promise.resolve(new Response(FIXTURE, { status: 200 }));
  }) as unknown as typeof fetch;

  // First call with a LOW retail filters out the high $1024.50 sold price.
  const low = await fetchEbaySoldComps({ query, retail: 60, fetchImpl });
  expect(low.source).toBe("ebay-sold");
  expect(low.comps).not.toContain(1024.5);

  // Second call, same title but a HIGH retail, must still see $1024.50 — the
  // cache stores raw prices, so the earlier low-retail filter isn't baked in.
  const high = await fetchEbaySoldComps({ query, retail: 900, fetchImpl });
  expect(high.source).toBe("cache");
  expect(high.comps).toContain(1024.5);
  expect(calls).toBe(1); // still one network fetch
});

Deno.test("fetchEbaySoldComps degrades gracefully on a 403 (never throws)", async () => {
  const fetchImpl = (() =>
    Promise.resolve(new Response("blocked", { status: 403 }))) as unknown as typeof fetch;
  const r = await fetchEbaySoldComps({ query: "blocked-" + Math.floor(performance.now()), fetchImpl });
  expect(r.comps).toEqual([]);
  expect(r.source).toBe("none");
  expect(r.reason).toBe("http 403");
});

Deno.test("fetchEbaySoldComps degrades gracefully when fetch throws", async () => {
  const fetchImpl = (() => Promise.reject(new Error("network down"))) as unknown as typeof fetch;
  const r = await fetchEbaySoldComps({ query: "boom-" + Math.floor(performance.now()), fetchImpl });
  expect(r.comps).toEqual([]);
  expect(r.source).toBe("none");
  expect(r.reason).toContain("network down");
});

Deno.test("fetchEbaySoldComps with no query is a no-op", async () => {
  const r = await fetchEbaySoldComps({ query: "  " });
  expect(r.comps).toEqual([]);
  expect(r.source).toBe("none");
  expect(r.reason).toBe("no query");
});
