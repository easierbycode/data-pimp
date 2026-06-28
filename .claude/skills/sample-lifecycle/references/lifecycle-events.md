# Sample-lifecycle Graylog events

The two events this skill writes, and how `graylog-query` reads them back. Both
are emitted by `core/lifecycle.ts` via `sendGelfMessage()` (defined in
`core/graylog.ts`), which sends GELF `version:"1.1"`, `host:"thirsty-store-kiosk"`,
single-`_`-prefixes every field, and drops empty/null values. Graylog strips the
leading underscore, so a field written as `_sample_status` is queried as
`sample_status`.

Design: one JSON-string **container** field per event (lossless round-trip, like
the existing `sample_edit_json`) **plus** flat scalar fields so queries can
filter/range/`--terms` without parsing JSON.

Join key across every stage: **`product_id`** (the sample's `qr_code`). The
Postgres **`sample_id`** is stamped alongside as a reconciliation fallback.

## Event 1 — status change

`short_message`: `thirsty sample status: <name>`

| Field | Type | Notes |
| --- | --- | --- |
| `sample_status_json` | JSON string | `{productId, sampleId, status, previousStatus, qrCode, name, source, note?, updatedAt}` |
| `sample_status` | string | flat, filterable — e.g. `sample_status:cleared_to_sell` |
| `product_id` | string | join key (= `qr_code`) |
| `sample_id` | string | Postgres id (when a row matched) |
| `sample_source` | string | `skill` (who wrote it) |

Status is one of `available`, `checked_out`, `reserved`, `cleared_to_sell`,
`discontinued` (`sold` is rejected — it goes through Event 2).

## Event 2 — sold / resale revenue

`short_message`: `thirsty sample sold: <name> $<price> via <marketplace> → <creator>`

| Field | Type | Notes |
| --- | --- | --- |
| `sample_sold_json` | JSON string | `{productId, sampleId, name, creator, marketplace, salePrice, fees, shipping, costBasis, net, buyer?, orderRef?, soldAt, note?}` |
| `creator` | string | attribution handle — same field/convention the scraper sources use |
| `gmv_num` | number | **gross** sale price (matches affiliate-export `gmv_num`, so existing revenue recipes sum it) |
| `sale_price_num` | number | alias of gross (explicit) |
| `fee_num` / `shipping_num` / `cost_num` | number | the deductions |
| `net_num` | number | `salePrice − fees − shipping − costBasis` |
| `marketplace` | string | `ebay` / `offerup` / `fbmarketplace` / … |
| `product_id` | string | join key |
| `sample_id` | string | Postgres id |
| `sample_status` | string | `sold` |
| `sample_source` | string | `skill-resale` |

Note: affiliate-export's `creator` is an *agency label*, but these resale events
are authored by the skill, so the real `@handle` is stamped directly — resale
revenue attributes more cleanly than affiliate data.

## Read-back recipes (`graylog-query`)

`--terms` only counts; it can't SUM — fetch rows and sum the `*_num` field
client-side. Match handles with both forms: `(creator:"@x" OR creator.keyword:"@x")`.

**All resale sales (any creator), newest first:**
```bash
python3 .../graylog_query.py --all -q 'sample_sold_json:*' \
  --fields creator,product_id,marketplace,gmv_num,net_num --sort timestamp:desc
```

**One creator's resale revenue, by marketplace:**
```bash
python3 .../graylog_query.py --all \
  -q '(creator:"@wizardofdealz" OR creator.keyword:"@wizardofdealz") AND sample_sold_json:*' \
  --terms marketplace
# then fetch rows and sum gmv_num (gross) / net_num (profit)
```

**High-value resales this quarter:**
```bash
python3 .../graylog_query.py --last 90d \
  -q 'sample_sold_json:* AND gmv_num:[50 TO *]' \
  --fields creator,product_id,marketplace,gmv_num,net_num --sort gmv_num:desc
```

**Status history of one sample/product:**
```bash
python3 .../graylog_query.py --all -q 'product_id:"1729..." AND sample_status_json:*' \
  --fields sample_status,sample_status_json --sort timestamp:desc
```

**Full lifecycle thread for a product** — status + sale + the scraper content
(videos/lives) that share the same `product_id`/`creator`:
```bash
python3 .../graylog_query.py --all -q 'product_id:"1729..."' \
  --fields source,creator,sample_status,gmv_num,sample_status_json,sample_sold_json
```

## Lifecycle join — current reach and the gap

`product_id` links: **intake** (`samples.qr_code`) → **status changes**
(Event 1) → **content** (`source:tiktok-bookmarklet-product-analysis` etc.,
which carry `Product ID` + `creator`) → **resale** (Event 2).

The weak link is **order-received** (`source:tiktok-bookmarklet-orders`): those
scrape events carry neither `product_id` nor `creator` (product is matched by
name only), so "order received → which content sold it" can't be joined
automatically yet. Closing that needs the order scraper to capture a productId —
out of scope for this skill. Until then, that hop is matched manually by product
name against the catalog (`/api/products`).
