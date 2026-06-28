---
name: ebay-listing
description: >-
  Open eBay's create-listing page in the browser and AUTOFILL it from a sample's
  data — the click-through behind the "eBay draft" in the Samples-Import demo.
  Trigger when the user wants to actually post/draft a sample on eBay — e.g.
  "open the eBay listing and autofill it", "autofill this eBay listing with the
  sample data", "list <product> on eBay", "post the eBay draft for sample 123".
  Drives the Claude-in-Chrome browser tools: navigate to the eBay listing form,
  wait for the user to sign in if needed, then fill title / condition / price /
  description (and the photo when possible) from the product. It does NOT submit
  or publish — it leaves a ready-to-review draft. Pairs with the visual eBay-draft
  snapshot rendered by the Samples-Import app / EbayDraft component.
allowed-tools: mcp__Claude_in_Chrome__navigate, mcp__Claude_in_Chrome__read_page, mcp__Claude_in_Chrome__get_page_text, mcp__Claude_in_Chrome__find, mcp__Claude_in_Chrome__form_input, mcp__Claude_in_Chrome__computer, mcp__Claude_in_Chrome__file_upload, mcp__Claude_in_Chrome__read_console_messages, mcp__f520785f-7c81-4ad1-a212-026d9c945eb7__v1_tiktok_product
---

# ebay-listing

Opens eBay's "Create your listing" page and autofills it from a sample's data
using the **Claude-in-Chrome** browser tools. This is the action behind the
Samples-Import "eBay draft" → "Open in eBay & autofill" button (the draft is a
visual snapshot; this skill does the real autofill).

If the Chrome extension isn't connected, ask the user to install/connect it
(this skill needs `mcp__Claude_in_Chrome__*`); don't fall back to screen control.

## Inputs

The product to list, ideally already on hand from the import/lifecycle context:
`name` (→ title), `price` (→ Buy It Now), condition (default **New** — these are
fresh samples), `description`, an `image` URL, and the `productId`. If you only
have a `productId` / PDP url, hydrate first via `…__v1_tiktok_product` (or
data-pimp `/api/product-lookup/:id`) for the title/price/image.

## Workflow

1. **Open the listing form.** `navigate` to `https://www.ebay.com/sl/sell`
   (eBay's create-listing entry). eBay may route through a "what are you selling"
   prelist step — proceed to the listing form.
2. **Handle sign-in — never type the user's credentials.** If eBay shows a
   sign-in wall, tell the user to log in themselves in that tab, wait, then
   continue. (Treat eBay creds like any secret — the user enters them, not you.)
3. **Locate the fields.** Use `read_page` / `get_page_text` / `find` to identify
   the title input, condition selector, format/price (Buy It Now) input, and the
   description editor. eBay's DOM changes often, so locate by visible label, not
   a hardcoded selector.
4. **Autofill** with `form_input` (or `computer` for rich controls):
   - **Title** ← `name` (trim to eBay's 80-char limit).
   - **Condition** ← `New`.
   - **Price / Buy It Now** ← `price` (the resale ask; default to the product's
     price if no explicit ask).
   - **Description** ← `description` (or a sensible default: "Brand-new, sealed
     TikTok Shop sample. Ships fast from a smoke-free home.").
   - **Photo** ← the `image`: if eBay accepts an image URL or `file_upload` works,
     add it; otherwise leave photos and tell the user to drop the image in.
5. **Stop at a reviewable draft. Do NOT submit/publish.** Leave the form filled
   and tell the user what was populated and what to check (category, item
   specifics, shipping) before they click **List it** themselves.

## Guardrails

- **Never publish or pay.** Don't click "List it" / "Submit" / confirm fees —
  posting a live listing is the user's action. Autofill + hand back.
- **Never enter the user's eBay credentials.** Sign-in is the user's job.
- **Locate by label, verify before typing.** Confirm you're on the right field
  (read the page) before `form_input`; eBay's layout shifts.
- **One listing at a time.** For a batch, confirm each before moving on.
- Read-only product research (reviews/showcase) is the `scrapecreators-api`
  skill; inventory writes (assign/sold/listing events) are `sample-lifecycle`.
  This skill only drives the eBay browser form.
