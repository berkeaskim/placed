import { getDocumentProxy, getResolvedPDFJS } from "unpdf";

/**
 * Task 15 retrofit (A4): the CV is untrusted input. Runs before parseCV and finds
 *  - ATS-HID-01: text a person can't see but software reads (invisible Unicode; in the PDF, <4pt
 *    text, text off the page box, white or near-white fill);
 *  - ATS-INJ-01: instruction-like text aimed at an LLM screener.
 * Rules and copy: docs/research/market-2026/03-ats-ai-screening.md §4.2–4.3.
 *
 * Known limitations (deliberate, to keep false positives low on real CVs):
 *  - White text is only flagged on pages that paint no non-white fill or image before it, because
 *    white-on-navy sidebars and headers are common. White text over a dark box is missed.
 *  - Text render mode 3 (invisible) is ignored: OCR'd scans use it for their whole text layer.
 *  - Opacity (ExtGState /ca), clipping and text hidden under other shapes are not checked.
 *  - pdf.js already drops glyphs that lie wholly off the page from getTextContent (so they never reach
 *    the extracted text either); the off-page check is a guard for other extractors and partial cases.
 *  - The injection lexicon is English-only, and a CV that quotes an injection phrase while
 *    describing security research will be flagged.
 */

export type SafetyIssue = {
  ruleId: "ATS-HID-01" | "ATS-INJ-01";
  /** invisible-char | tiny-font | off-page | white-text | injection */
  kind: string;
  span: string;
  /** 1-based; only for findings from the PDF. */
  page?: number;
  reason: string;
};
/** A raster image drawn on a page, in PDF points (origin bottom-left). Used to spot a photo (CV rule G-39). */
export type SafetyImage = { page: number; x: number; y: number; w: number; h: number; pageW: number; pageH: number };
/** `images` is only present when the PDF itself was scanned (absent on older reports and text-only scans). */
export type SafetyReport = { verdict: "clean" | "flag"; issues: SafetyIssue[]; images?: SafetyImage[] };

export const SAFETY_WARNING =
  "We found text in your CV that a person can't see but software can read. Major ATSs now detect this, and some reject CVs that contain it. It won't help you, so we've left it out of your tailored CV.";

const MIN_FONT_PT = 4;
/** Each RGB channel at or above this counts as "near-white" on a white page. */
const NEAR_WHITE = 240;

// ---------- ATS-HID-01 on text ----------

const INVISIBLE = /[​-‍⁠﻿‪-‮⁦-⁩]+/g;

/** True for a ZWJ/ZWNJ (or leading BOM) that is part of ordinary writing, not hiding anything. */
function isLegitimate(text: string, i: number): boolean {
  const ch = text[i];
  if (ch === "﻿") return i === 0; // a byte-order mark at the very start is an encoding artefact
  const prev = text.codePointAt(i - 1 >= 0 && /[\uDC00-\uDFFF]/.test(text[i - 1]) ? i - 2 : i - 1) ?? 0;
  const next = text.codePointAt(i + 1) ?? 0;
  // ZWJ joins emoji (👩‍💻); FE0F and skin-tone modifiers can sit before it.
  if (ch === "‍") return isEmoji(prev) && isEmoji(next);
  // ZWNJ is part of normal spelling in Persian, Hindi, etc. Only allow it between non-Latin letters.
  if (ch === "‌") return prev >= 0x370 && next >= 0x370;
  return false;
}
const isEmoji = (cp: number) => (cp >= 0x1f000 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf) || cp === 0xfe0f;

/** [start, end) ranges of invisible characters that should be flagged and stripped. */
function invisibleRuns(text: string): [number, number][] {
  const runs: [number, number][] = [];
  for (const m of text.matchAll(INVISIBLE)) {
    for (let i = m.index!; i < m.index! + m[0].length; i++) {
      if (isLegitimate(text, i)) continue;
      const last = runs[runs.length - 1];
      if (last && last[1] === i) last[1] = i + 1;
      else runs.push([i, i + 1]);
    }
  }
  return runs;
}

const removeRanges = (text: string, ranges: [number, number][]) =>
  [...ranges].sort((a, b) => b[0] - a[0]).reduce((t, [s, e]) => t.slice(0, s) + t.slice(e), text);

const codepoints = (s: string) => [...s].map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`).join(" ");

// ---------- ATS-INJ-01 ----------

/** Phrases written to an LLM, not to a recruiter. Each is anchored on words a real CV doesn't put together. */
const INJECTION: RegExp[] = [
  /\bignore\s+(?:all\s+)?(?:of\s+)?(?:the\s+|your\s+|any\s+)?(?:previous|prior|above)\s+instructions?\b/i,
  /\bdisregard\s+(?:all\s+)?(?:of\s+)?(?:the\s+|your\s+|any\s+)?(?:above|previous|prior)\b/i,
  /\bforget\s+(?:everything|all)\s+(?:above|previous|prior)\b/i,
  /\brank\s+(?:this|me)\s+(?:first|top|highest)\b/i,
  /\byou\s+are\s+an?\s+(?:ai|assistant|language\s+model|recruiter|screening)\b/i,
  // A bare "system prompt" is normal on an LLM engineer's CV ("wrote the system prompt for ..."), so
  // only flag it when it is addressed to the reader: "new/ignore/reveal ... system prompt" or "System prompt:".
  /\b(?:new|updated|override|ignore|reveal|follow)\s+(?:your\s+|the\s+|this\s+)?system\s+prompt\b|\bsystem\s+prompt\s*:/i,
  /\bmark\s+(?:this|the)\s+(?:resume|cv|candidate)\s+as\s+(?:qualified|a\s+match|top)\b/i,
  /\bgive\s+(?:this|me)\s+(?:a\s+)?(?:score\s+of\s+)?100\b/i,
  /<\/?(?:system|instructions?)>/i,
];

/** How far a sentence may extend either side of a match; keeps long unpunctuated input linear. */
const SENTENCE_WINDOW = 300;

/** The sentence around [start, end): from after the previous . ! ? or newline to the next one (inclusive), capped at ±SENTENCE_WINDOW. */
function sentenceAt(text: string, start: number, end: number): [number, number] {
  let s = start;
  const sMin = Math.max(0, start - SENTENCE_WINDOW);
  while (s > sMin && !/[.!?\n]/.test(text[s - 1])) s--;
  while (s < start && /[ \t]/.test(text[s])) s++;
  let e = end;
  const eMax = Math.min(text.length, end + SENTENCE_WINDOW);
  while (e < eMax && !/[.!?\n]/.test(text[e])) e++;
  while (e < text.length && /[.!?]/.test(text[e])) e++;
  return [s, e];
}

function injectionSentences(text: string): [number, number][] {
  const hits: [number, number][] = [];
  for (const re of INJECTION) {
    for (const m of text.matchAll(new RegExp(re.source, "gi"))) hits.push(sentenceAt(text, m.index!, m.index! + m[0].length));
  }
  // Merge overlapping sentences (two phrases in one sentence, or windowed runs) into one span each.
  const merged: [number, number][] = [];
  for (const r of hits.sort((a, b) => a[0] - b[0])) {
    const last = merged[merged.length - 1];
    if (last && r[0] < last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

// ---------- ATS-HID-01 on the PDF ----------

type TextItemLike = { str: string; transform: number[]; width: number; height: number };

/** Classifies one pdf.js text item against the page view box [x0, y0, x1, y1]. */
export function hiddenItemKind(item: TextItemLike, view: number[]): "tiny-font" | "off-page" | null {
  const [, , c, d, x, y] = item.transform;
  if (Math.hypot(c, d) < MIN_FONT_PT) return "tiny-font";
  const [x0, y0, x1, y1] = view;
  if (x > x1 || x + item.width < x0 || y > y1 || y + Math.max(item.height, Math.hypot(c, d)) < y0) return "off-page";
  return null;
}

/** Fill set by a pattern, shading or colour space pdf.js didn't turn into RGB: treat as "not white". */
const UNKNOWN_FILL = "unknown";

function isNearWhite(color: unknown): boolean {
  let rgb: number[] | null = null;
  if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  else if (Array.isArray(color) && color.length >= 3) rgb = color.slice(0, 3).map(Number);
  return !!rgb && rgb.every((v) => v >= NEAR_WHITE);
}

/** White or near-white text on pages whose background is still the white page (see limitations above). */
async function whiteTextSpans(page: { getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }> }) {
  const { OPS } = await getResolvedPDFJS();
  const paintOps = new Set<number>([
    OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke,
  ]);
  const imageOps = new Set<number>([
    OPS.shadingFill, OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject,
    OPS.paintInlineImageXObjectGroup, OPS.paintImageXObjectRepeat, OPS.paintImageMaskXObjectGroup,
    OPS.paintSolidColorImageMask, OPS.paintImageMaskXObjectRepeat,
  ]);
  const otherFillOps = new Set<number>([OPS.setFillGray, OPS.setFillCMYKColor, OPS.setFillColor, OPS.setFillColorN, OPS.setFillTransparent]);
  const textOps = new Set<number>([OPS.showText, OPS.showSpacedText, OPS.nextLineShowText, OPS.nextLineSetSpacingShowText]);

  const { fnArray, argsArray } = await page.getOperatorList();
  const spans: string[] = [];
  const stack: unknown[] = [];
  let fill: unknown = "#000000";
  let painted = false; // a non-white fill or image has been drawn, so white text may sit on it
  let buf = "";
  const flush = () => {
    if (buf.trim()) spans.push(buf.trim());
    buf = "";
  };

  fnArray.forEach((fn, i) => {
    const args = argsArray[i] ?? [];
    if (fn === OPS.save) stack.push(fill);
    else if (fn === OPS.restore) fill = stack.length ? stack.pop() : fill;
    else if (fn === OPS.setFillRGBColor) fill = args.length === 1 ? args[0] : args;
    // pdf.js normally converts gray/CMYK to setFillRGBColor; anything left (patterns, gradients) is unknown.
    else if (otherFillOps.has(fn)) fill = typeof args[0] === "string" && args[0].startsWith("#") ? args[0] : UNKNOWN_FILL;
    else if (paintOps.has(fn) || (fn === OPS.constructPath && paintOps.has(args[0] as number))) painted ||= !isNearWhite(fill);
    else if (imageOps.has(fn)) painted = true;
    else if (fn === OPS.beginText || fn === OPS.endText) flush();
    else if (textOps.has(fn)) {
      if (painted || !isNearWhite(fill)) return flush();
      const glyphs = args.find(Array.isArray) as unknown[] | undefined;
      const s = (glyphs ?? []).map((g) => (g && typeof g === "object" && "unicode" in g ? String(g.unicode) : "")).join("");
      buf += buf && s ? ` ${s}` : s;
    }
  });
  flush();
  return spans;
}

type Matrix = [number, number, number, number, number, number];
const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5],
];

/**
 * Raster images on a page with their bounding boxes: an image fills the unit square under the current transform,
 * so tracking save/restore/transform is enough. Only used to spot a likely photo; vector shapes are ignored.
 */
async function pageImages(page: { view: number[]; getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }> }, n: number): Promise<SafetyImage[]> {
  const { OPS } = await getResolvedPDFJS();
  const imageOps = new Set<number>([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageXObjectRepeat]);
  const { fnArray, argsArray } = await page.getOperatorList();
  const [vx0, vy0, vx1, vy1] = page.view;
  const out: SafetyImage[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  fnArray.forEach((fn, i) => {
    const args = argsArray[i] ?? [];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform && args.length >= 6) ctm = mul(args.slice(0, 6).map(Number) as Matrix, ctm);
    else if (fn === OPS.paintFormXObjectBegin && Array.isArray(args[0]) && args[0].length >= 6) {
      stack.push(ctm);
      ctm = mul(args[0].map(Number) as Matrix, ctm);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (imageOps.has(fn)) {
      const xs = [ctm[4], ctm[4] + ctm[0], ctm[4] + ctm[2], ctm[4] + ctm[0] + ctm[2]];
      const ys = [ctm[5], ctm[5] + ctm[1], ctm[5] + ctm[3], ctm[5] + ctm[1] + ctm[3]];
      const x = Math.min(...xs), y = Math.min(...ys);
      out.push({ page: n, x: x - vx0, y: y - vy0, w: Math.max(...xs) - x, h: Math.max(...ys) - y, pageW: vx1 - vx0, pageH: vy1 - vy0 });
    }
  });
  return out;
}

async function scanPdf(bytes: Uint8Array): Promise<{ issues: SafetyIssue[]; images: SafetyImage[] }> {
  // pdf.js may detach the buffer it is given; copy so the caller's bytes stay usable.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const issues: SafetyIssue[] = [];
  const images: SafetyImage[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    if (n === 1) {
      try { images.push(...(await pageImages(page, n))); } catch { /* image boxes are best-effort; never fail the scan */ }
    }
    const { items } = await page.getTextContent();
    for (const it of items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const kind = hiddenItemKind(it, page.view);
      if (kind === "tiny-font") {
        issues.push({ ruleId: "ATS-HID-01", kind, span: it.str, page: n, reason: `Text is under ${MIN_FONT_PT}pt, too small to read.` });
      } else if (kind === "off-page") {
        issues.push({ ruleId: "ATS-HID-01", kind, span: it.str, page: n, reason: "Text is placed outside the visible page." });
      }
    }
    for (const span of await whiteTextSpans(page)) {
      issues.push({ ruleId: "ATS-HID-01", kind: "white-text", span, page: n, reason: "Text is white or near-white on a white page." });
    }
  }
  return { issues, images };
}

// ---------- public API ----------

/** Scans extracted CV text (and the PDF itself when given) for hidden text and LLM-directed instructions. */
export async function scanCvSafety(input: { text: string; pdfBytes?: Uint8Array }): Promise<SafetyReport> {
  const { text } = input;
  const runs = invisibleRuns(text);
  const issues: SafetyIssue[] = runs.map(([s, e]) => ({
    ruleId: "ATS-HID-01",
    kind: "invisible-char",
    span: text.slice(s, e),
    reason: `Invisible character(s) ${codepoints(text.slice(s, e))} inside the text.`,
  }));
  // Look for injections with the invisible characters removed, so "ig​nore" can't dodge the lexicon.
  const visible = removeRanges(text, runs);
  for (const [s, e] of injectionSentences(visible)) {
    issues.push({ ruleId: "ATS-INJ-01", kind: "injection", span: visible.slice(s, e), reason: "Reads like an instruction to an AI screener, not CV content." });
  }
  if (!input.pdfBytes) return { verdict: issues.length ? "flag" : "clean", issues };
  const pdf = await scanPdf(input.pdfBytes);
  issues.push(...pdf.issues);
  return { verdict: issues.length ? "flag" : "clean", issues, images: pdf.images };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Hidden PDF spans shorter than this (non-space characters) are reported but never stripped. */
const MIN_STRIP_CHARS = 4;

/**
 * Removes what the report flagged and leaves every other byte as it was: invisible characters, each
 * injection sentence (with the spaces after it), and one whole-token copy of each hidden PDF span
 * (words matched exactly, with flexible whitespace between them, because the PDF text layer and the
 * extracted text may space words differently).
 */
export function stripFlaggedSpans(text: string, report: SafetyReport): string {
  if (report.verdict === "clean") return text;
  let out = report.issues.some((i) => i.kind === "invisible-char") ? removeRanges(text, invisibleRuns(text)) : text;
  for (const issue of report.issues) {
    if (issue.kind === "invisible-char") continue;
    if (issue.kind === "injection") {
      const at = out.indexOf(issue.span);
      if (at < 0) continue;
      let end = at + issue.span.length;
      while (end < out.length && /[ \t]/.test(out[end])) end++;
      out = out.slice(0, at) + out.slice(end);
      continue;
    }
    const words = issue.span.trim().split(/\s+/);
    if (words.join("").length < MIN_STRIP_CHARS) continue; // too short to remove without risking visible text
    // Built with the RegExp constructor so the u-flag property escapes don't depend on the TS target.
    const m = new RegExp(`(?<![\\p{L}\\p{N}])${words.map(escapeRe).join("\\s+")}(?![\\p{L}\\p{N}])`, "u").exec(out);
    if (m) out = out.slice(0, m.index) + out.slice(m.index + m[0].length);
  }
  return out;
}
