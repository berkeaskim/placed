export function wordLimitOf(label: string): number | undefined {
  const m = label.match(/(\d{2,4})\s*(?:-|\s)?\s*words?\b/i) ?? label.match(/max(?:imum)?\.?\s*(\d{2,4})\s*words?/i);
  return m ? Number(m[1]) : undefined;
}
