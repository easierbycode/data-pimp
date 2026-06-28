---
name: sample-e2e
description: >-
  Run the repeatable sample-lifecycle end-to-end test, and/or open the visual
  two-pane workspace. Trigger when the user wants to e2e-test the import/lifecycle
  pipeline, "test these product ids", verify the API + Graylog path, or watch an
  import happen visually. Feed an array of TikTok product IDs (priced and/or
  unpriced); it walks hydrate → import (assign to creator) → Postgres verify →
  Graylog/dropdown verify, and can also show it: Samples-Import replaying the adds
  on the left, Apps/Inventory table on the right.
allowed-tools: Bash, mcp__Claude_in_Chrome__list_connected_browsers, mcp__Claude_in_Chrome__navigate
---

# sample-e2e

Two halves — a scriptable API+Graylog walk, and a visual two-pane workspace. Use
either or both for whatever the user is verifying.

## Part 1 — the repeatable test (script)

`data-pimp/scripts/sample-e2e.ts` (also `deno task e2e:samples`). Feed product
IDs; it walks, per id:
1. **hydrate** `GET /api/product-lookup/:id` → reports PRICED vs unpriced
2. **import** `POST /api/sample-import` → create row + assign to the creator
3. **verify Postgres** `GET /api/samples?id=` → `status=checked_out`, `checked_out_to`
4. **verify Graylog** — the import's `graylog:true` + the creator surfacing in `/api/creators`

```bash
# from the data-pimp repo:
deno task e2e:samples --creator @e2e-test --cleanup 1729587769570529799 9001234567890
# or with the order-scrape variant (needs GELF creds):
deno run -A scripts/sample-e2e.ts --order-scrape \
  --gelf-url https://tok-graylog-gelf.ngrok-free.dev/gelf --gelf-token <token> \
  --cleanup <productId> ...
```

- No product ids → a default priced + unpriced pair, so both paths run out of the box.
- **`--cleanup`** deletes every sample + transaction it created (use it for a CI-style run; omit to leave the rows for inspection in Inventory).
- **`--order-scrape`** posts a synthetic order-detail GELF (display-name creator + `stableProductId`) and confirms it surfaces in `/api/product-creators` `orderCreators` — the order-scrape → dropdown payoff. Gated on `--gelf-url`/`--gelf-token` (or `GRAYLOG_GELF_URL`/`GRAYLOG_TOKEN` env) so no secret is committed.
- Exit code is non-zero if any check fails. Report the pass/fail matrix verbatim.

The order-detail **scraper transform** test (runs the real `scrape-order.js` against a fake order page) lives in tok-scrape: `extension-seller/test-order-scrape.mjs` (`deno run -A`).

## Part 2 — the visual two-pane workspace

Open Thirsty OS with `?workspace=samples-import` to watch it: **Samples-Import
tiles LEFT and auto-replays the import** (each product shown in the order modal),
**Apps/Inventory tiles RIGHT** as a table of the imported rows (edit / enhance via
its "Fetch from API"). Pass the run's ids/creator straight through:

```
https://thirsty.store/?workspace=samples-import&autostart=1&creator=@e2e-test&ids=1729587769570529799,9001234567890
```

Via the Claude-in-Chrome browser skill: `list_connected_browsers` → `navigate` to
that URL. (Without `autostart=1` it just prefills, so the user clicks Start.)

## Typical flow

1. Run Part 1 with the user's product ids (omit `--cleanup` so the rows persist).
2. Open Part 2 with the same `ids`/`creator` so the user sees the adds land and
   can inspect/edit them in the Inventory table.
3. Offer `--cleanup` (or delete via Inventory) when done.

## Guardrails
- Runs against **production** (`thirsty.store`) by default — it creates real
  sample rows. Use `--cleanup`, an obvious test `--creator` (e.g. `@e2e-test`),
  and `--api` to point at a non-prod deployment when available.
- Graylog is append-only: order-scrape test events persist (clearly tagged).
- This skill verifies/visualizes; the actual writes are `sample-lifecycle` /
  `/api/sample-import`. Product research is `scrapecreators-api`.
