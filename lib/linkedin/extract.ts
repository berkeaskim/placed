import { getDocumentProxy } from "unpdf";
import type { LiLine } from "./parse-export";

type Item = { str: string; transform: number[]; height?: number; width?: number };

/**
 * PDF → positioned lines for parseLinkedInExport. Items on the same baseline are joined unless a wide gap
 * separates them (sidebar and main column share baselines), so each column yields its own lines.
 */
export async function extractLinkedInLines(bytes: Uint8Array): Promise<{ lines: LiLine[]; text: string; pageCount: number }> {
  const pdf = await getDocumentProxy(bytes);
  const lines: LiLine[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as Item[]).filter((i) => typeof i.str === "string" && i.str.trim() !== "");
    // Bucket by baseline (2pt tolerance), top to bottom.
    const rows = new Map<number, Item[]>();
    for (const it of items) {
      const y = Math.round(it.transform[5] / 2) * 2;
      rows.set(y, [...(rows.get(y) ?? []), it]);
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const row = rows.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
      let cur: { parts: string[]; x: number; end: number; size: number } | null = null;
      const flush = () => { if (cur) lines.push({ text: cur.parts.join("").replace(/\s+/g, " ").trim(), page: p, x: cur.x, size: cur.size }); };
      for (const it of row) {
        const x = it.transform[4];
        const size = Math.abs(it.transform[3]) || it.height || 0;
        if (cur && x - cur.end > 40) { flush(); cur = null; }
        if (!cur) cur = { parts: [], x, end: x, size };
        const gap = x - cur.end;
        cur.parts.push((cur.parts.length && gap > 1 ? " " : "") + it.str);
        cur.end = x + (it.width ?? it.str.length * size * 0.5);
        cur.size = Math.max(cur.size, size);
      }
      flush();
    }
  }
  return { lines, text: lines.map((l) => l.text).join("\n"), pageCount: pdf.numPages };
}
