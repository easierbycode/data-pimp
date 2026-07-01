# Demos/E2E — eBay pricing formula

A pricing formula for eBay resale listings that **undercuts the competition** and
**moves product fast**, with an inviolable **fee-aware floor** so we never
knowingly list at a loss.

We resell TikTok Shop *free samples* on eBay: a creator gets a free sample, makes
content, then we list the physical unit. This formula turns what we know about a
product into a recommended Buy-It-Now price.

- **Engine (source of truth):** [`core/ebay-pricing.ts`](../../core/ebay-pricing.ts) — pure, deterministic, unit-tested (`core/ebay-pricing_test.ts`).
- **API:** `GET|POST /api/ebay-price` (add `?ladder=1` for the velocity walk-down).
- **CLI demo:** [`ebay-pricing-demo.ts`](./ebay-pricing-demo.ts) — walks the scenario battery and prints a report.
- **Visual demo:** [`ebay-pricing.html`](./ebay-pricing.html) — interactive, served at `/demos/ebay-pricing`.

It replaces the old naive `Math.round(retail * 0.8)` the showcase used to guess a price.

## Run it

```bash
# CLI (deterministic, no network needed):
deno task demo:ebay-pricing
# …or directly, with the raw JSON results:
deno run -A Demos/E2E/ebay-pricing-demo.ts --json
# …and end-to-end against a real TikTok Shop product:
deno task demo:ebay-pricing -- --live 1729587769570529799

# Visual (interactive): start the app, then open the page
deno task start                       # local server (needs DATABASE_URL for the rest of the app)
# → http://localhost:8000/demos/ebay-pricing
```

The visual page calls the same `/api/ebay-price` endpoint that runs the same
`core/ebay-pricing.ts` engine as the CLI — one implementation, two surfaces.

## The formula (STEP 0..9)

A fixed pipeline, run top to bottom. Every input is sanitized first, so it never
throws, never divides by zero, and never returns `NaN` or a below-floor price.

0. **Sanitize** — coerce every input to a finite, sane value; clamp `feePct` into
   `[0, 0.9]` so the gross-up denominator `(1 − feePct)` can never be ≤ 0.
1. **Anchor to the market** — from the *cleaned* comps: drop retail-relative
   absurd values, trim the top outliers, and lift a lone lowball to
   `median × 0.5` so one predatory comp can't drag us to a loss. The cheapest
   surviving credible comp is the anchor. No comps → `retail × 0.30` (the resale
   band). No retail either → the fee floor drives the price.
2. **Undercut** — price `max(anchorPct, anchorAbs)` below the anchor so ours is
   the cheapest credible Buy-It-Now (gentler for a single comp; skipped when
   anchoring off the retail fraction, which already sits below market).
3. **Velocity markdown** — a staged, **monotonically non-increasing** multiplier
   keyed to `daysListed` that walks the price down as the unit sits and saturates
   so it never runs away:

   | days | 0–6 | 7–13 | 14–20 | 21–29 | 30+ |
   |------|-----|------|-------|-------|-----|
   | ×    |1.00 |0.93  |0.85   |0.75   |0.65 |

4. **Fee-aware floor (the load-bearing clamp)** — the smallest gross price whose
   net still clears cost + margin after eBay's fee:

   ```
   floor = (costBasis + max(minMarginAbs, costBasis·minMarginPct) + shipping + fixedFee) / (1 − feePct)
   ```

   The floor **always wins** over the undercut and the markdown: `price = max(candidate, floor)`.
5. **Ceiling** — `retail × 0.95` (new) / `0.80` (used) so we never meet or beat
   true retail. If cost is so high that `floor > ceiling`, the floor wins and an
   `unprofitableBelowRetail` flag is raised for human review.
6. **Charm rounding** — round **down** to the nearest `.99` to preserve the
   undercut. When no `.99` rung sits between the floor and the candidate (a
   floor-bound listing), we ship the exact floor-respecting price rather than
   charming **up** past the anchor — so rounding never breaches the floor, never
   overshoots the market, and never makes an aging unit's price tick back up.

The result carries diagnostics — `floor`, `ceiling`, `anchor`, `anchorSource`,
`ageFactor`, `floorHit`, `unprofitableBelowRetail`, `lowConfidence`, `netAtPrice`,
`undercutFromAnchor`, and a one-line `explanation`.

## Guarantees (enforced by the tests)

- **Never at a loss:** `price ≥ floor` and `netAtPrice ≥ minMarginAbs` (minus a rounding cent) for every input.
- **Move fast:** re-pricing the same unit on a later day is always `≤` the earlier day's price (monotonic in age), bounded below by the floor.
- **Undercut:** with real comps we land strictly below the cheapest credible comp — unless the market has fallen below our break-even, in which case the floor holds and `floorHit` says so.
- **Never crashes:** garbage inputs (NaN, negatives, junk strings, `feePct ≥ 1`) are sanitized; the price is always finite and ≥ a hard minimum.

## Tunable

Everything is an optional parameter with a sensible default (see
`DEFAULT_EBAY_PRICING`). A few worth knowing:

- `minMarginAbs` (default `$3`) — minimum net profit. Set to `0` for a pure
  fee-break-even liquidation profile.
- `undercutPct` / `undercutAbs` — how far below the cheapest comp to sit.
- `markdownSchedule` — the velocity ladder. Pass a custom `[[day, factor], …]`
  (or `{day: factor}`) for a fire-sale or a patient profile; it's re-sanitized to
  stay monotonic and floor-bounded.
