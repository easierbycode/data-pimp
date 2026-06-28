---
name: sample-lifecycle
description: >-
  Update a sample's status, or mark a sample SOLD and attribute the resale
  revenue to a creator account, in the LP Sample Tracker (thirsty.store /
  admin.thirsty.store). Trigger whenever the user wants to change a sample's
  state or log a resale — e.g. "mark <product> as sold", "this sold on eBay for
  $40", "set <product> to cleared to sell", "reserve sample 42", "discontinue
  this one", "log a resale", "attribute this sale to @wizardofdealz". Each action
  writes the inventory truth to Postgres AND a Graylog event, so a creator's
  resale revenue is immediately queryable. For READ-ONLY questions about the data
  ("how much resale revenue did @x make", "which samples sold this month", "what's
  in Graylog") use the graylog-query skill instead — this skill only WRITES.
allowed-tools: mcp__thirsty-samples__list_samples, mcp__thirsty-samples__list_sample_statuses, mcp__thirsty-samples__list_creators, mcp__thirsty-samples__update_sample_status, mcp__thirsty-samples__mark_sample_sold
---

# sample-lifecycle

Mutates a sample's lifecycle state through the **thirsty-samples** MCP server,
which calls data-pimp's sample endpoints. Every action writes to **two** places:

- **Postgres** (`public.samples` + `inventory_transactions`) — the inventory
  source of truth, shared with the tracker UI.
- **Graylog** — the durable analytics spine. Status changes and sales become
  GELF events keyed by `product_id` (the sample's `qr_code`, the join key across
  the whole lifecycle) so they can be read back by the `graylog-query` skill.

This skill is **write-only**. Reading the data back (revenue reports, "who sold
what") is the `graylog-query` skill's job — see *Reading it back* below.

## Workflow 1 — Update a sample's status

1. **Resolve the sample.** If the user named a product, call `list_samples` with
   a `query` to find the row and its `id`. Prefer acting by `id`. If several
   samples share a name/productId, show the matches and ask which one.
2. **Validate the target status.** Call `list_sample_statuses` and confirm the
   requested status is one of the exclusive lifecycle statuses — `available`,
   `checked_out`, `reserved`, `cleared_to_sell`, `discontinued`. (`sold` is also
   `kind:"status"` but is rejected here — route sales through Workflow 2.) Map
   the user's words to the canonical `value` (e.g. "clear it to sell" →
   `cleared_to_sell`).
3. **Write it.** Call `update_sample_status` with `sampleId` (or `productId`),
   `status`, and an optional `note`.
4. **Report honestly.** Echo the result's `message`. The result shows what
   persisted (`postgres.updated`, `graylog`). If `graylog` is `false`, say the
   Graylog event did **not** write — don't report unqualified success.

> "Sold" is **not** a plain status here. `update_sample_status` rejects it on
> purpose, because a sale must attribute revenue to a creator → use Workflow 2.

## Workflow 2 — Mark a sample SOLD (with creator attribution)

This is the revenue path. The creator-attribution prompt is mandatory.

1. **Resolve the sample** (as above, via `list_samples`). For a sale, prefer a
   specific `sampleId` so you mark the right physical unit; if only a productId
   is given and multiple unsold units match, ask which one.
2. **Ask which creator gets the revenue.** This is the load-bearing step the
   user asked for. Call `list_creators` and ask:
   *"Which creator account should this resale revenue be attributed to?"*
   Offer the @-handles it returns (real handles sort first). If the intended
   handle isn't listed, confirm the exact spelling before proceeding — a typo
   silently fragments that creator's revenue. Do not guess.
3. **Gather the sale details.** Required: `salePrice` (gross) and `marketplace`
   (`ebay`, `offerup`, `fbmarketplace`, …). Optional, for net profit:
   `fees`, `shipping`, `costBasis` (net = sale − fees − shipping − cost), plus
   `buyer`, `orderRef`, `note`. Ask for what's missing rather than assuming.
4. **Write it.** Call `mark_sample_sold`. It sets the sample to `sold` with the
   sale columns + a `sold` inventory transaction in Postgres, and emits the
   Graylog revenue event (`creator` + `gmv_num` gross + `net_num`).
5. **Report honestly.** Echo `message`, the computed `net`, and the attributed
   `creator`. If `graylog` is `false`, the revenue event did **not** record —
   flag it clearly (the sale won't show up for the creator until it's re-sent).
   The `message` also warns if the Postgres audit transaction wasn't written.

> **Re-selling is refused by default.** Marking an already-sold sample sold again
> would double-count the creator's revenue (Graylog events are append-only). If
> the user genuinely needs to re-attribute, confirm first, then pass
> `force: true` to `mark_sample_sold`.

## Reading it back — composing with `graylog-query`

These events are written using `graylog-query`'s own conventions, so that
read-only skill surfaces resale revenue **with no changes**. After a sale,
revenue questions go to `graylog-query` (it lives in the `tok-scrape-main`
project; run its script directly if it isn't loaded). Key recipes:

**A creator's resale revenue (ever):**
```bash
python3 .../graylog-query/scripts/graylog_query.py --all \
  -q '(creator:"@wizardofdealz" OR creator.keyword:"@wizardofdealz") AND sample_sold_json:*' \
  --fields product_id,marketplace,gmv_num,net_num,sample_sold_json --sort timestamp:desc
```
`--terms` can't SUM — sum `gmv_num` (gross) or `net_num` (profit) client-side.
Add `--terms marketplace` for a per-channel breakdown.

**Everything that happened to one product (the lifecycle thread):**
```bash
python3 .../graylog_query.py --all -q 'product_id:"1729..."' \
  --fields source,creator,sample_status,gmv_num,sample_status_json,sample_sold_json
```
This stitches the sample's status changes and its sale alongside the scraper
sources (videos/lives) that share the same `product_id` + `creator`.

Full field/query reference: [references/lifecycle-events.md](references/lifecycle-events.md).

## Guardrails

- **Write-only.** This skill never reads/aggregates — that's `graylog-query`.
- **Never fake success.** A Graylog write can fail silently (the API returns
  `graylog:false`); always reflect what actually persisted.
- **Confirm the creator.** Don't attribute revenue to an unconfirmed handle.
- **Writes hit production.** The endpoints are open (no auth, by design) and
  `THIRSTY_API_URL` defaults to `https://thirsty.store`. Treat status/sold
  writes as real inventory changes; confirm ambiguous targets before writing.
- **Join key is `product_id` = `qr_code`.** A `qr_code` holding a barcode (not a
  real TikTok productId) still works for status/sold, but won't join to scraper
  content. `sample_id` is stamped on every event as the reconciliation fallback.
