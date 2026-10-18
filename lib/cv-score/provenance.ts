/**
 * Was this PDF made by Placed's tailor? (audit 2026-10-18, 04#28: self-preference.) lib/pdf/cv-document.tsx, which
 * only renders tailored CVs, stamps Creator and Producer "Placed" in the PDF Info dictionary. When such a file is
 * uploaded as the CV, the score comes from the same AI family that rewrote it, and LLM judges favour their own
 * writing (Panickssery et al. 2024, arXiv 2404.13076; Xu et al. 2025, arXiv 2509.00462). The panel says so, and the
 * trend line never mixes tailored and original CVs. A tailored PDF re-saved by another app loses the stamp, so this
 * can miss some; it never labels a CV Placed didn't render.
 */

/** A PDF Info string by key, written either inline (`/Creator (x)`) or as an indirect object (`/Creator 15 0 R`). */
function infoString(pdf: string, key: "Creator" | "Producer"): string | null {
  const direct = pdf.match(new RegExp(`/${key}\\s*\\(([^)]*)\\)`));
  if (direct) return direct[1];
  const ref = pdf.match(new RegExp(`/${key}\\s+(\\d+)\\s+(\\d+)\\s+R\\b`));
  if (!ref) return null;
  const obj = pdf.match(new RegExp(`(?:^|[\\s>])${ref[1]}\\s+${ref[2]}\\s+obj\\s*\\(([^)]*)\\)`));
  return obj ? obj[1] : null;
}

export function madeByPlacedTailor(bytes: Uint8Array | null | undefined): boolean {
  if (!bytes || bytes.length < 8) return false;
  const s = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
  if (!s.startsWith("%PDF")) return false;
  return infoString(s, "Creator") === "Placed" && infoString(s, "Producer") === "Placed";
}
