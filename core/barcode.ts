import bwipjs from "npm:bwip-js@^4";

// Render a UPC/EAN code as a PNG barcode. The symbology is chosen from the
// digit count — EAN-13 (13), UPC-A (12) — falling back to Code 128 so any
// scanned string still produces a scannable image. Exists so the UPC lookup's
// Google Lens fallback has a public image of the barcode to visually match.
export async function renderBarcodePng(code: string): Promise<Uint8Array<ArrayBuffer>> {
  const digits = code.replace(/\D/g, "");
  let bcid = "code128";
  let text = code;
  if (digits.length === 13) {
    bcid = "ean13";
    text = digits;
  } else if (digits.length === 12) {
    bcid = "upca";
    text = digits;
  }

  const png = await bwipjs.toBuffer({
    bcid,
    text,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: "center",
  });
  // toBuffer yields a Node Buffer; hand back a plain Uint8Array for the Response.
  return new Uint8Array(png);
}
