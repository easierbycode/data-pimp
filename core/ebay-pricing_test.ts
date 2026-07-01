import { expect } from "@std/expect";
import {
  computeEbayPrice,
  DEFAULT_MARKDOWN_SCHEDULE,
  type EbayPriceInput,
  markdownLadder,
} from "./ebay-pricing.ts";

// ---------------------------------------------------------------------------
// Reference test matrix (T1..T8) from the design synthesis. Each case has a
// hand-worked expected output; see the STEP 0..9 pipeline in ebay-pricing.ts.
// ---------------------------------------------------------------------------

Deno.test("T1 — multi-comp, fresh, new: undercuts the cheapest credible comp", () => {
  const r = computeEbayPrice({ retail: 40, costBasis: 0, comps: [25, 28, 30], daysListed: 0 });
  expect(r.floor).toBe(3.8);
  expect(r.anchor).toBe(25); // top comp (30) trimmed; median guard passes → 25
  expect(r.anchorSource).toBe("comp");
  expect(r.price).toBe(22.99); // 25 - 1.25 undercut → 23.75 → charm down 22.99
  expect(r.floorHit).toBe(false);
  expect(r.price).toBeLessThan(25); // strictly undercuts the cheapest comp
  expect(r.netAtPrice).toBeGreaterThan(3); // clears the $3 target net
});

Deno.test("T2 — same unit aged 16d prices strictly below the fresh price (monotonic)", () => {
  const base: EbayPriceInput = { retail: 40, costBasis: 0, comps: [25, 28, 30] };
  const fresh = computeEbayPrice({ ...base, daysListed: 0 });
  const aged = computeEbayPrice({ ...base, daysListed: 16 });
  expect(aged.ageFactor).toBe(0.85);
  expect(aged.price).toBe(19.99);
  expect(aged.price).toBeLessThan(fresh.price);
});

Deno.test("T3 — market below break-even: floor wins, we don't list at a loss", () => {
  const r = computeEbayPrice({ retail: 12, costBasis: 0, comps: [4.0, 4.5], daysListed: 25 });
  expect(r.floor).toBe(3.8);
  expect(r.floorHit).toBe(true);
  expect(r.price).toBe(3.8); // floor-bound → exact break-even+margin floor (no charm-up)
  expect(r.price).toBeGreaterThanOrEqual(r.floor);
  expect(r.netAtPrice).toBeGreaterThanOrEqual(3);
});

Deno.test("T4 — agency lot, used, old, no comps, no retail: floor-driven", () => {
  const r = computeEbayPrice({
    costBasis: 8,
    comps: [],
    condition: "used",
    daysListed: 40,
    minMarginAbs: 3,
  });
  expect(r.anchorSource).toBe("floor");
  expect(r.floor).toBe(13.03); // (8+3+0.30)/0.8675
  expect(r.floorHit).toBe(true);
  expect(r.price).toBe(13.03); // floor-driven → the exact floor
  expect(r.unprofitableBelowRetail).toBe(false);
  // netAtPrice is net PROFIT after cost — clears the $3 margin on top of the $8 cost.
  expect(r.netAtPrice).toBeGreaterThanOrEqual(3);
  // Gross retained (price - fees - shipping) covers cost + margin ($11).
  expect(r.netAtPrice + 8).toBeGreaterThanOrEqual(11);
});

Deno.test("T5 — single lowball comp lifted by the median guard; used haircut", () => {
  const r = computeEbayPrice({
    retail: 30,
    costBasis: 0,
    comps: [5, 22, 24, 23],
    condition: "used",
    daysListed: 40,
  });
  expect(r.anchor).toBe(11); // lone $5 lowball lifted to median(5,22,23)*0.5 = 11
  expect(r.ageFactor).toBe(0.65);
  expect(r.price).toBe(4.99);
  expect(r.floorHit).toBe(false);
});

Deno.test("T6 — cost basis so high the floor exceeds the retail ceiling", () => {
  const r = computeEbayPrice({
    retail: 12,
    costBasis: 15,
    comps: [9, 11],
    daysListed: 0,
    minMarginAbs: 3,
  });
  expect(r.floor).toBe(21.1); // (15+3+0.30)/0.8675
  expect(r.floorHit).toBe(true);
  expect(r.unprofitableBelowRetail).toBe(true);
  expect(r.price).toBe(21.1); // floor overrides the retail ceiling
  expect(r.price).toBeGreaterThan(12); // above retail — flagged for review
});

Deno.test("T7 — liquidation profile (minMarginAbs=0): floor collapses to minListPrice", () => {
  const r = computeEbayPrice({
    retail: 25,
    costBasis: 0,
    comps: [],
    daysListed: 7,
    minMarginAbs: 0,
  });
  expect(r.anchorSource).toBe("retail"); // no comps → retail*0.30
  expect(r.floor).toBe(1.0); // (0+0.30)/0.8675 = 0.35 → max(_, minListPrice 1.00)
  expect(r.ageFactor).toBe(0.93);
  expect(r.price).toBe(5.99); // 25*0.30=7.50 → *0.93=6.975 → charm 5.99
});

Deno.test("T8 — fully degenerate inputs never crash and never go below floor/NaN", () => {
  const r = computeEbayPrice({
    retail: NaN,
    costBasis: -5,
    comps: [NaN, -3, 0, "x" as unknown as number, 18],
    condition: "weird",
    daysListed: -4,
    feePct: 1.5, // clamped to 0.90 → (1-fee)=0.10
  });
  expect(Number.isFinite(r.price)).toBe(true);
  expect(r.floor).toBe(33.0); // (3+0.30)/0.10
  expect(r.floorHit).toBe(true);
  expect(r.price).toBe(33.0); // floor-bound → the exact floor
  expect(r.price).toBeGreaterThanOrEqual(r.floor);
  expect(r.condition).toBe("new"); // "weird" → new
  expect(r.daysListed).toBe(0); // negative → 0
});

// ---------------------------------------------------------------------------
// Property / invariant tests — hold across a broad grid of inputs.
// ---------------------------------------------------------------------------

function* grid(): Generator<EbayPriceInput> {
  const retails = [undefined, 5, 12, 40, 89.99, 250];
  const costs = [0, 2, 8, 30];
  const compSets = [[], [7], [9, 11], [25, 28, 30], [5, 22, 23, 24], [1, 2, 999]];
  const conditions = ["new", "used"];
  const ages = [0, 3, 7, 14, 21, 30, 120, 400];
  for (const retail of retails) {
    for (const costBasis of costs) {
      for (const comps of compSets) {
        for (const condition of conditions) {
          for (const daysListed of ages) {
            yield { retail, costBasis, comps, condition, daysListed };
          }
        }
      }
    }
  }
}

Deno.test("invariant: price is always finite, >= floor, and net covers the target margin", () => {
  for (const input of grid()) {
    const r = computeEbayPrice(input);
    expect(Number.isFinite(r.price)).toBe(true);
    expect(r.price).toBeGreaterThanOrEqual(r.floor);
    expect(r.price).toBeGreaterThan(0);
    // Net at the recommended price must cover cost + the insisted margin
    // (minus at most a rounding cent). Default minMarginAbs is 3.00.
    expect(r.netAtPrice).toBeGreaterThanOrEqual(2.99);
  }
});

Deno.test("invariant: velocity markdown is monotonically non-increasing in age", () => {
  for (const base of grid()) {
    let prev = Infinity;
    for (const daysListed of [0, 7, 14, 21, 30, 90, 500]) {
      const r = computeEbayPrice({ ...base, daysListed });
      expect(r.price).toBeLessThanOrEqual(prev + 1e-9);
      prev = r.price;
    }
  }
});

Deno.test("invariant: never priced above the ceiling unless the floor forces it", () => {
  for (const input of grid()) {
    const r = computeEbayPrice(input);
    if (!r.unprofitableBelowRetail) {
      expect(r.price).toBeLessThanOrEqual(r.ceiling + 1e-9);
    } else {
      // floor > ceiling: the floor wins and the flag is raised.
      expect(r.price).toBeGreaterThanOrEqual(r.floor);
    }
  }
});

Deno.test("with real comps we either undercut the cheapest credible comp or hit the floor", () => {
  // Broaden the grid with cost bases that push the floor to sit between charm
  // rungs just under a comp — the exact shape that can defeat a naive charm.
  const extra: EbayPriceInput[] = [
    { comps: [9.88], costBasis: 4.75 },
    { comps: [8.5], costBasis: 4 },
    { retail: 20, comps: [6.2], costBasis: 3 },
  ];
  for (const input of [...grid(), ...extra]) {
    const r = computeEbayPrice(input);
    if (r.anchorSource === "comp" && r.anchor !== null) {
      // When the floor doesn't bind, we MUST land strictly below the cheapest
      // credible comp; when it binds we may sit at/above it (won't list at a loss).
      if (!r.floorHit) expect(r.price).toBeLessThan(r.anchor);
      else expect(r.price).toBeGreaterThanOrEqual(r.floor);
    }
  }
});

Deno.test("markdownLadder previews a non-increasing, floor-bounded price walk", () => {
  const rows = markdownLadder({ retail: 60, costBasis: 0, comps: [30, 32, 35] });
  expect(rows.length).toBe(DEFAULT_MARKDOWN_SCHEDULE.length);
  expect(rows[0].day).toBe(0);
  let prev = Infinity;
  for (const row of rows) {
    expect(row.price).toBeLessThanOrEqual(prev + 1e-9);
    expect(row.price).toBeGreaterThan(0);
    prev = row.price;
  }
});

Deno.test("string/dollar-formatted inputs are coerced", () => {
  const r = computeEbayPrice({
    retail: "$40.00",
    comps: ["$25", "28", "$30.00"],
    daysListed: "0",
  });
  expect(r.price).toBe(22.99);
});

Deno.test("charm rounding: recommended prices end in .99 unless a hard cap intervenes", () => {
  for (const input of grid()) {
    const r = computeEbayPrice(input);
    const cents = Math.round((r.price - Math.floor(r.price)) * 100);
    const atCeiling = Math.abs(r.price - r.ceiling) < 1e-9;
    // When the floor sits between two charm rungs and it did NOT bind, the exact
    // undercut price (just above the floor) is kept rather than charmed above the
    // anchor — allow that narrow floor band too.
    const nextCharm = Math.ceil(r.floor - 0.99) + 0.99;
    const inFloorBand = r.price >= r.floor - 1e-9 && r.price <= nextCharm + 1e-9;
    expect(cents === 99 || atCeiling || inFloorBand).toBe(true);
  }
});

Deno.test("single comp with no charm rung above the floor still undercuts (not above the comp)", () => {
  // Regression: comps=[9.88], costBasis=4.75 → floor 9.28, undercut 9.38. The only
  // charm rungs are 8.99 (below floor) and 9.99 (above the comp); we must keep the
  // exact 9.38 rather than jump to 9.99 above the sole comp.
  const r = computeEbayPrice({ comps: [9.88], costBasis: 4.75 });
  expect(r.anchor).toBe(9.88);
  expect(r.floorHit).toBe(false);
  expect(r.price).toBeGreaterThanOrEqual(r.floor);
  expect(r.price).toBeLessThan(9.88); // strictly undercuts the sole comp
  expect(r.netAtPrice).toBeGreaterThanOrEqual(3);
});

Deno.test("a velocity schedule rung > 1 is capped so the ladder only marks DOWN", () => {
  // A caller-supplied factor > 1 must not inflate the price above the anchor.
  const r = computeEbayPrice({
    retail: 40,
    costBasis: 0,
    comps: [25, 28, 30],
    daysListed: 0,
    markdownSchedule: [[0, 1.5]],
  });
  expect(r.ageFactor).toBeLessThanOrEqual(1);
  expect(r.floorHit).toBe(false);
  expect(r.price).toBeLessThan(25); // still undercuts the cheapest credible comp
});

Deno.test("custom fire-sale schedule is honored and stays floor-bounded", () => {
  const r30 = computeEbayPrice({
    retail: 50,
    comps: [30],
    daysListed: 30,
    markdownSchedule: [[0, 1], [4, 0.85], [8, 0.7], [12, 0.55], [16, 0.45]],
  });
  expect(r30.ageFactor).toBe(0.45); // saturates at the terminal rung
  expect(r30.price).toBeGreaterThanOrEqual(r30.floor);
});
