import React, { useEffect, useState } from "react";

// Neutral product placeholder (inline SVG) shown only when no image can be resolved.
export const PRODUCT_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>" +
      "<rect width='400' height='400' fill='#f1f5f9'/>" +
      "<g fill='none' stroke='#cbd5e1' stroke-width='14' stroke-linecap='round' stroke-linejoin='round'>" +
      "<path d='M200 92 L300 148 V252 L200 308 L100 252 V148 Z'/>" +
      "<path d='M100 148 L200 204 L300 148'/><path d='M200 204 V308'/>" +
      "</g></svg>",
  );

interface ProductImageProps {
  sample: { id?: string | number; name?: string; picture_url?: string | null };
  className?: string;
}

/**
 * Renders a sample's product image.
 *
 * For older "price-only" records that were saved without a picture_url, it
 * lazily resolves the image from `/api/samples/:id/image` — the server fetches
 * the TikTok Shop product via ScrapeCreators and backfills picture_url — and
 * falls back to a neutral placeholder if nothing can be resolved.
 */
export default function ProductImage({ sample, className = "" }: ProductImageProps) {
  const existing = sample?.picture_url || "";
  const sampleId = sample?.id;
  const [src, setSrc] = useState(existing);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (existing) {
      setSrc(existing);
      return;
    }
    setSrc("");
    if (sampleId == null) return;

    let cancelled = false;
    fetch(`/api/samples/${sampleId}/image`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.picture_url) setSrc(data.picture_url);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [sampleId, existing]);

  return (
    <img
      src={!failed && src ? src : PRODUCT_PLACEHOLDER}
      alt={sample?.name || ""}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
