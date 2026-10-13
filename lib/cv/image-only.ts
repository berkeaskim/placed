/** Pure, dependency-free: true when the PDF's text layer is too thin to be a real CV (scanned / image-only). */
export function isImageOnly(pageTexts: string[]): boolean {
  const chars = pageTexts.reduce((n, p) => n + p.replace(/\s/g, "").length, 0);
  return chars / Math.max(1, pageTexts.length) < 200;
}
