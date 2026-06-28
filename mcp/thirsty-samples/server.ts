// thirsty-samples — MCP server for the sample lifecycle.
//
// Thin stdio server that exposes the data-pimp sample-lifecycle HTTP API as MCP
// tools. It owns no Graylog/Postgres logic: every tool is a call to data-pimp
// (default https://thirsty.store), which writes the inventory truth to Postgres
// and the analytics event to Graylog (see core/lifecycle.ts). Runs on Deno —
// matching the repo runtime — so there's no npm install or build step; Deno
// fetches the SDK from the npm: specifier on first run.
//
// Tools:
//   list_samples         — find samples by name/brand/productId (resolve an id)
//   list_sample_statuses — the synced status vocabulary (validate before write)
//   list_creators        — creator handles seen in Graylog (attribution list)
//   update_sample_status — set a sample's status (rejects "sold")
//   mark_sample_sold     — mark sold + attribute resale revenue to a creator
//
// Env: THIRSTY_API_URL (or THIRSTY_API) overrides the API base.

import { Server } from "npm:@modelcontextprotocol/sdk@1.29.0/server/index.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk@1.29.0/server/stdio.js";
import {
  type CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "npm:@modelcontextprotocol/sdk@1.29.0/types.js";

const BASE = (Deno.env.get("THIRSTY_API_URL") || Deno.env.get("THIRSTY_API") ||
  "https://thirsty.store").replace(/\/+$/, "");

// One JSON fetch helper. Surfaces the API's own error message (data-pimp returns
// { error } / { ok:false, error }) rather than a bare status code.
async function api(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<unknown> {
  const hasBody = init?.body !== undefined;
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      accept: "application/json",
      ...(hasBody ? { "content-type": "application/json" } : {}),
    },
    body: hasBody ? JSON.stringify(init!.body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = data && typeof data === "object"
      ? (data as Record<string, unknown>).error ??
        (data as Record<string, unknown>).message ?? `HTTP ${res.status}`
      : `HTTP ${res.status}`;
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${msg}`);
  }
  return data;
}

function asString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}

// Project a raw Postgres samples row down to the fields the model needs to pick
// one and act on it. productId is the qr_code (the cross-lifecycle join key).
function slimSample(row: Record<string, unknown>) {
  return {
    id: row.id ?? null,
    name: asString(row.name),
    brand: asString(row.brand),
    productId: asString(row.qr_code),
    status: asString(row.status),
    currentPrice: row.current_price ?? null,
    soldPrice: row.sold_price ?? null,
    soldAt: asString(row.sold_at),
    soldTo: asString(row.sold_to),
  };
}

const TOOLS = [
  {
    name: "list_samples",
    description:
      "Find samples in the LP Sample Tracker (Postgres) by name, brand, or " +
      "productId/qr_code, so you can resolve which sample to act on. Returns " +
      "id, name, brand, productId, status, and sale details. Use the returned " +
      "id with update_sample_status / mark_sample_sold.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Case-insensitive substring matched against name, brand, " +
            "productId/qr_code, and id. Omit to list recent samples.",
        },
        limit: {
          type: "number",
          description:
            "Max samples to return after filtering (default 25). Filtering is " +
            "client-side over all samples.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_sample_statuses",
    description:
      "The synced sample-status vocabulary (the single source the tracker " +
      "uses). Validate a target status against this before update_sample_status. " +
      "Only kind:'status' values go in a sample's status; 'sold' must go " +
      "through mark_sample_sold.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_creators",
    description:
      "Creator handles seen live in Graylog (scraper sources + prior resale " +
      "events) — the attribution list for mark_sample_sold. Real @-handles " +
      "sort first. Mirrors graylog-query's `--terms creator`.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max handles (default 1000)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "update_sample_status",
    description:
      "Set a sample's status (available / checked_out / reserved / " +
      "cleared_to_sell / discontinued). Writes Postgres + a Graylog status " +
      "event. Rejects 'sold' — use mark_sample_sold so revenue is attributed " +
      "to a creator. Identify the sample by sampleId (preferred) or productId.",
    inputSchema: {
      type: "object",
      properties: {
        sampleId: {
          type: ["string", "number"],
          description: "The sample's Postgres id (from list_samples).",
        },
        productId: {
          type: "string",
          description:
            "The TikTok productId / qr_code. Used if sampleId is omitted; " +
            "may match multiple physical samples.",
        },
        status: {
          type: "string",
          description:
            "Target status. Must be a kind:'status' value from " +
            "list_sample_statuses (not 'sold').",
        },
        note: { type: "string", description: "Optional note recorded on the event." },
      },
      required: ["status"],
      additionalProperties: false,
    },
  },
  {
    name: "mark_sample_sold",
    description:
      "Mark a sample sold and attribute the resale revenue to a creator " +
      "account. Writes the inventory truth to Postgres (status=sold + sale " +
      "columns + a 'sold' transaction) and a Graylog revenue event " +
      "(creator + gmv_num gross + net_num) that the graylog-query skill can " +
      "read per-creator. ALWAYS confirm which creator to attribute to before " +
      "calling. Identify the sample by sampleId (preferred) or productId.",
    inputSchema: {
      type: "object",
      properties: {
        sampleId: { type: ["string", "number"], description: "Sample's Postgres id." },
        productId: {
          type: "string",
          description: "TikTok productId / qr_code (used if sampleId omitted).",
        },
        creator: {
          type: "string",
          description:
            "Creator @handle to attribute revenue to (validate against " +
            "list_creators).",
        },
        salePrice: {
          type: ["number", "string"],
          description: "Gross sale price (recorded as gmv_num).",
        },
        marketplace: {
          type: "string",
          description: "Where it sold: ebay, offerup, fbmarketplace, etc.",
        },
        fees: { type: ["number", "string"], description: "Marketplace fees (optional)." },
        shipping: { type: ["number", "string"], description: "Shipping cost (optional)." },
        costBasis: {
          type: ["number", "string"],
          description: "Cost basis of the sample (optional). net = sale - fees - shipping - cost.",
        },
        buyer: { type: "string", description: "Optional buyer (stored as sold_to)." },
        orderRef: { type: "string", description: "Optional marketplace order/listing ref." },
        note: { type: "string", description: "Optional note." },
        force: {
          type: "boolean",
          description:
            "Re-attribute an already-sold sample on purpose (default false). " +
            "Without it, selling an already-sold sample is refused to avoid " +
            "double-counting the creator's revenue.",
        },
      },
      required: ["creator", "salePrice", "marketplace"],
      additionalProperties: false,
    },
  },
  {
    name: "list_on_marketplace",
    description:
      "Record that a sample has been LISTED for resale on a marketplace " +
      "(eBay/OfferUp/FB Marketplace) — the step between 'how much GMV did my " +
      "content drive' and 'what did it sell for'. Analytics-only: emits a " +
      "Graylog listing event (creator + product_id + ask_price_num); it does " +
      "NOT change the sample's status or mark it sold. Identify the sample by " +
      "sampleId (preferred) or productId.",
    inputSchema: {
      type: "object",
      properties: {
        sampleId: { type: ["string", "number"], description: "Sample's Postgres id." },
        productId: {
          type: "string",
          description: "TikTok productId / qr_code (used if sampleId omitted).",
        },
        creator: {
          type: "string",
          description:
            "Creator @handle the listing is attributed to (validate against " +
            "list_creators).",
        },
        marketplace: {
          type: "string",
          description: "Where it's listed: ebay, offerup, fbmarketplace, etc.",
        },
        askPrice: {
          type: ["number", "string"],
          description: "Listing/ask price (recorded as ask_price_num).",
        },
        listingUrl: { type: "string", description: "Optional URL of the live listing." },
        note: { type: "string", description: "Optional note." },
      },
      required: ["creator", "marketplace", "askPrice"],
      additionalProperties: false,
    },
  },
  {
    name: "bulk_sample_sold",
    description:
      "Mark a BULK lot sold — one marketplace sale spread across several " +
      "samples, each attributed to a creator. Allocates the lot total across " +
      "items (explicit per-item price, else an equal split) and emits one " +
      "sample_sold_json per sample tagged with a shared bulk_id, so the normal " +
      "per-creator / per-marketplace revenue queries include bulk lots. Prefer " +
      "explicit sampleIds. ALWAYS confirm the per-item (or lot) creator(s) first.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description:
            "The samples in the lot. Each: sampleId (preferred) or productId, " +
            "an optional creator (falls back to the lot-level creator), an " +
            "optional explicit price (else the remaining total is split equally).",
          items: {
            type: "object",
            properties: {
              sampleId: { type: ["string", "number"] },
              productId: { type: "string" },
              creator: { type: "string" },
              price: { type: ["number", "string"] },
              note: { type: "string" },
            },
            additionalProperties: false,
          },
        },
        totalPrice: {
          type: ["number", "string"],
          description: "Gross total the whole lot sold for.",
        },
        marketplace: { type: "string", description: "ebay, offerup, fbmarketplace, etc." },
        creator: {
          type: "string",
          description: "Lot-level default creator for items that don't set their own.",
        },
        fees: { type: ["number", "string"], description: "Lot fees (allocated by gross share)." },
        shipping: { type: ["number", "string"], description: "Lot shipping (allocated)." },
        costBasis: { type: ["number", "string"], description: "Lot cost basis (allocated)." },
        buyer: { type: "string", description: "Optional buyer." },
        orderRef: { type: "string", description: "Optional marketplace order/lot ref." },
        note: { type: "string", description: "Optional lot-level note." },
        force: {
          type: "boolean",
          description: "Re-attribute already-sold units in the lot (default false).",
        },
      },
      required: ["items", "totalPrice", "marketplace"],
      additionalProperties: false,
    },
  },
  {
    name: "list_product_creators",
    description:
      "The DERIVED assigned-creator candidate list for a product: creators who " +
      "ordered it (from affiliate-export). Use this to populate the 'which " +
      "creator?' choice for assign_sample. Pass includeAllKnown to also offer " +
      "creators who haven't ordered it. Note: ordered-creator values come from " +
      "affiliate-export where `creator` is the AGENCY label, not necessarily a " +
      "TikTok @handle.",
    inputSchema: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "TikTok productId / qr_code to find creators for.",
        },
        includeAllKnown: {
          type: "boolean",
          description: "Also union in every known creator (default false).",
        },
        limit: { type: "number", description: "Max creators (default 1000)." },
      },
      required: ["productId"],
      additionalProperties: false,
    },
  },
  {
    name: "agency_intake",
    description:
      "Credit a BULK lot of one product to an agency bucket (e.g. admin 'kyle') " +
      "before any creator is assigned — the units sit in 'reserved'. Use " +
      "`productId` + `qty` for a fresh shipment (creates that many reserved " +
      "units), or `sampleIds` to credit existing units. Later, assign_sample " +
      "moves a unit from the bucket to a creator.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "TikTok productId / qr_code." },
        name: { type: "string", description: "Product name (else derived/uses productId)." },
        qty: { type: ["number", "string"], description: "How many units arrived (with productId). Default 1, max 200." },
        sampleIds: {
          type: "array",
          description: "Credit these existing sample ids instead of creating new ones.",
          items: { type: ["string", "number"] },
        },
        agencyBucket: { type: "string", description: "Bucket/admin to credit, e.g. 'kyle'." },
        operator: { type: "string", description: "Who recorded the intake." },
        note: { type: "string", description: "Optional note." },
      },
      required: ["agencyBucket"],
      additionalProperties: false,
    },
  },
  {
    name: "assign_sample",
    description:
      "Assign/fulfill a sample to a creator — moves one unit to CHECKED OUT " +
      "(checked_out_to = creator), pulling from the agency bucket if it's " +
      "reserved, attaching a matched campaign, and returning an enrichment note " +
      "(bundle membership + the campaign's daily-video goal + any promo). " +
      "Confirm the creator against list_product_creators for that product first. " +
      "Prefer a specific sampleId.",
    inputSchema: {
      type: "object",
      properties: {
        sampleId: { type: ["string", "number"], description: "Sample's Postgres id (preferred)." },
        productId: { type: "string", description: "TikTok productId / qr_code (if sampleId omitted)." },
        creator: { type: "string", description: "Creator @handle to assign to." },
        agencyBucket: { type: "string", description: "Bucket it came from (else inferred from a reserved unit)." },
        campaign: { type: "string", description: "Campaign name (else auto-matched from config)." },
        campaignId: { type: "string", description: "Campaign id (optional)." },
        operator: { type: "string", description: "Who performed the assignment." },
        note: { type: "string", description: "Optional note." },
      },
      required: ["creator"],
      additionalProperties: false,
    },
  },
];

const server = new Server(
  { name: "thirsty-samples", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const name = request.params.name;
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  try {
    let result: unknown;

    switch (name) {
      case "list_samples": {
        const rows = (await api("/api/samples")) as Record<string, unknown>[];
        const list = Array.isArray(rows) ? rows : [];
        const q = String(args.query ?? "").trim().toLowerCase();
        const limit = Number(args.limit) > 0 ? Math.trunc(Number(args.limit)) : 25;
        const filtered = q
          ? list.filter((r) =>
            [r.name, r.brand, r.qr_code, r.id]
              .map((v) => String(v ?? "").toLowerCase())
              .some((s) => s.includes(q))
          )
          : list;
        result = {
          count: filtered.length,
          samples: filtered.slice(0, limit).map(slimSample),
        };
        break;
      }

      case "list_sample_statuses": {
        result = await api("/api/sample-statuses");
        break;
      }

      case "list_creators": {
        const limit = Number(args.limit) > 0 ? Math.trunc(Number(args.limit)) : 1000;
        result = await api(`/api/creators?limit=${limit}`);
        break;
      }

      case "update_sample_status": {
        result = await api("/api/sample-status", {
          method: "POST",
          body: {
            sampleId: args.sampleId,
            productId: args.productId,
            status: args.status,
            note: args.note,
            source: "skill",
          },
        });
        break;
      }

      case "mark_sample_sold": {
        result = await api("/api/sample-sold", {
          method: "POST",
          body: {
            sampleId: args.sampleId,
            productId: args.productId,
            creator: args.creator,
            salePrice: args.salePrice,
            marketplace: args.marketplace,
            fees: args.fees,
            shipping: args.shipping,
            costBasis: args.costBasis,
            buyer: args.buyer,
            orderRef: args.orderRef,
            note: args.note,
            force: args.force,
          },
        });
        break;
      }

      case "list_on_marketplace": {
        result = await api("/api/sample-listing", {
          method: "POST",
          body: {
            sampleId: args.sampleId,
            productId: args.productId,
            creator: args.creator,
            marketplace: args.marketplace,
            askPrice: args.askPrice,
            listingUrl: args.listingUrl,
            note: args.note,
          },
        });
        break;
      }

      case "bulk_sample_sold": {
        result = await api("/api/sample-bulk-sold", {
          method: "POST",
          body: {
            items: args.items,
            totalPrice: args.totalPrice,
            marketplace: args.marketplace,
            creator: args.creator,
            fees: args.fees,
            shipping: args.shipping,
            costBasis: args.costBasis,
            buyer: args.buyer,
            orderRef: args.orderRef,
            note: args.note,
            force: args.force,
          },
        });
        break;
      }

      case "list_product_creators": {
        const q = new URLSearchParams({ productId: String(args.productId ?? "") });
        if (args.includeAllKnown) q.set("all", "1");
        if (args.limit) q.set("limit", String(args.limit));
        result = await api(`/api/product-creators?${q.toString()}`);
        break;
      }

      case "agency_intake": {
        result = await api("/api/agency-intake", {
          method: "POST",
          body: {
            productId: args.productId,
            name: args.name,
            qty: args.qty,
            sampleIds: args.sampleIds,
            agencyBucket: args.agencyBucket,
            operator: args.operator,
            note: args.note,
          },
        });
        break;
      }

      case "assign_sample": {
        result = await api("/api/sample-assign", {
          method: "POST",
          body: {
            sampleId: args.sampleId,
            productId: args.productId,
            creator: args.creator,
            agencyBucket: args.agencyBucket,
            campaign: args.campaign,
            campaignId: args.campaignId,
            operator: args.operator,
            note: args.note,
          },
        });
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[thirsty-samples] MCP server ready (API base: ${BASE})`);
