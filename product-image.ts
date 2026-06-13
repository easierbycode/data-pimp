// product-image.ts
// Product image resolution via ScrapeCreators (TikTok Shop product API).
//
// Older "price-only" samples were saved without a picture_url. Given a sample's
// TikTok Shop PDP url (its tiktok_affiliate_link, or one built from the numeric
// qr_code product id), we fetch the product via ScrapeCreators and pull the
// first product image. Shared by main.ts (the /api/samples/:id/image endpoint)
// and scripts/verify-product-image.ts.

export const SCRAPECREATORS_API_KEY = Deno.env.get("SCRAPECREATORS_API_KEY") || "";
export const SCRAPECREATORS_PRODUCT_URL = "https://api.scrapecreators.com/v1/tiktok/product";

export function firstUrlFromImages(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  for (const img of images) {
    const url = (img as any)?.url_list?.[0] ??
      (img as any)?.thumb_url_list?.[0] ??
      (typeof img === "string" ? img : null);
    if (typeof url === "string" && url) return url;
  }
  return null;
}

export function extractProductImage(data: unknown): string | null {
  // ScrapeCreators returns product_base at the top level; each images[] entry
  // has url_list[] (full-res) and thumb_url_list[]. The other paths are
  // defensive fallbacks in case the response shape changes.
  const d = data as any;
  return (
    firstUrlFromImages(d?.product_base?.images) ||
    firstUrlFromImages(d?.product_info?.product_base?.images) ||
    firstUrlFromImages(d?.product?.images) ||
    firstUrlFromImages(d?.images) ||
    null
  );
}

export function pdpUrlForSample(sample: Record<string, unknown>): string | null {
  const link = sample.tiktok_affiliate_link;
  if (typeof link === "string" && link.includes("/shop/pdp/")) return link;
  const code = sample.qr_code;
  if (typeof code === "string" && /^\d+$/.test(code)) {
    return `https://www.tiktok.com/shop/pdp/product/${code}`;
  }
  return null;
}

// Calls ScrapeCreators for a PDP url and returns the first product image, or
// null if the key is missing / the request fails / no image is present.
export async function fetchProductImage(pdpUrl: string): Promise<string | null> {
  if (!SCRAPECREATORS_API_KEY) {
    console.warn("SCRAPECREATORS_API_KEY not set; cannot resolve product image");
    return null;
  }
  const endpoint = new URL(SCRAPECREATORS_PRODUCT_URL);
  endpoint.searchParams.set("url", pdpUrl);
  endpoint.searchParams.set("region", "US");
  try {
    const res = await fetch(endpoint, {
      headers: { "x-api-key": SCRAPECREATORS_API_KEY },
    });
    if (!res.ok) {
      console.error(`ScrapeCreators ${res.status} ${res.statusText} for ${pdpUrl}`);
      return null;
    }
    return extractProductImage(await res.json());
  } catch (err) {
    console.error("ScrapeCreators fetch failed:", err);
    return null;
  }
}
