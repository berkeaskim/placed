import "server-only";
import { cvBulletIndex, meBlock, themSupported, type DraftInput as AutopilotDraftInput } from "@/lib/autopilot/drafts";
import type { DraftInput } from "./draft";
import { lintLetter } from "./rules";
import { MarkerParser, type Marked } from "./stream-parse";
import type { LintHit, Span } from "./types";

export type VerifyInput = { text: string; sentences: Marked[]; input: DraftInput; ownSpans: Span[] };
export type Verified = { spans: Span[]; lint: LintHit[] };

// ---------------------------------------------------------------- sources

type Sources = {
  bullets: Map<string, string>; // real id → text
  bulletIds: Map<string, string>; // lowercase id → real id (marker refs arrive lowercased)
  answers: Map<string, { id: string; text: string }>; // lowercase id → answered text
  confirmed: Map<string, { id: string; claim: string }>;
  picked: Map<string, { id: string; claim: string }>;
  facts: Map<string, string>; // "fact:<id>" → claim, for meBlock (answers + confirmed facts)
  apInput: AutopilotDraftInput;
  numbers: Set<string>;
  allLines: string[]; // every source line (CV, answers, confirmed and picked facts, job post, role, ref)
  company: string;
};

const lower = (s: string) => s.toLowerCase();
const numberTokens = (t: string): string[] => (t.replace(/(\d),(?=\d{3}\b)/g, "$1").match(/\d+(?:\.\d+)?/g) ?? []);

function sources(i: DraftInput): Sources {
  const bullets = cvBulletIndex(i.cv);
  const answered = i.answers.filter((a): a is typeof a & { text: string } => !!a.text?.trim());
  const facts = new Map<string, string>([
    ...i.confirmedFacts.map((f) => [`fact:${f.id}`, f.claim] as const),
    ...answered.map((a) => [`fact:${a.id}`, a.text] as const),
  ]);
  const cv = i.cv;
  const cvText = [
    cv.summary, cv.interests, ...cv.skills.flatMap((g) => g.items),
    ...cv.education.flatMap((e) => [e.institution, e.degree, e.dates, e.grade, ...e.details.map((d) => d.text)]),
    ...[...cv.experience, ...cv.projects, ...cv.leadership].flatMap((e) => [e.org, e.title, e.dates, e.location, ...e.bullets.map((b) => b.text)]),
  ];
  const allLines = [...cvText, ...answered.map((a) => a.text), ...i.confirmedFacts.map((f) => f.claim), ...i.pickedFacts.map((f) => f.claim), ...i.jdLines, i.role, i.ref]
    .filter((t): t is string => !!t);
  const all = [...allLines, i.company].join("\n");
  return {
    bullets,
    bulletIds: new Map([...bullets.keys()].map((id) => [lower(id), id])),
    answers: new Map(answered.map((a) => [lower(a.id), { id: a.id, text: a.text }])),
    confirmed: new Map(i.confirmedFacts.map((f) => [lower(f.id), f])),
    picked: new Map(i.pickedFacts.map((f) => [lower(f.id), f])),
    facts,
    apInput: { question: "cover letter", company: i.company, jobExtId: "", fieldKey: "", jdLines: i.jdLines, cv: i.cv, facts: [...facts].map(([k, claim]) => ({ id: k.slice(5), claim })) },
    numbers: new Set(numberTokens(all)),
    allLines, company: i.company,
  };
}

/** CL-11 backstop: every number in AI-written text appears somewhere in the sources. */
const numbersSupported = (text: string, src: Sources) => numberTokens(text).every((n) => src.numbers.has(n));

/** Free AI text with no specific citation (courtesy lines, words around a quoted answer): judged against the whole CV and the student's answers. */
function freeTextReason(text: string, src: Sources): string | null {
  if (!/[a-z]/i.test(text)) return null;
  const all = [...src.bullets.keys(), ...src.facts.keys()];
  return meBlock(text, all, src.apInput, src.bullets, src.facts, true)
    ?? (numbersSupported(text, src) ? null : "unsupported number")
    // Names and claim words ("largest", "first") must be in some source; the sentence's first word is just capitalised.
    ?? (themSupported(text.trim().replace(/^\p{Lu}/u, (c) => c.toLowerCase()), src.allLines, src.company) ? null : "not on your CV");
}

function meReason(text: string, refs: string[], src: Sources): string | null {
  if (!refs.length) return freeTextReason(text, src);
  const resolved: string[] = [];
  for (const r of refs) {
    const id = src.bulletIds.get(r) ?? (src.answers.has(r) ? `fact:${src.answers.get(r)!.id}` : src.confirmed.has(r) ? `fact:${src.confirmed.get(r)!.id}` : null);
    if (!id) return "not on your CV";
    resolved.push(id);
  }
  return meBlock(text, resolved, src.apInput, src.bullets, src.facts) ?? (numbersSupported(text, src) ? null : "unsupported number");
}

const FIRST_PERSON = /\b(?:I|I'm|I've|I'd|I'll|my|me|myself|mine)\b/;
const GENERIC_STOP = new Set(("about also because been being both could does from have here into just like make many more most much only other over same some such than that them then there these they this those very want were what when where which while will with would your yours ours their our firm company team people work working role roles value values").split(" "));
const contentWords = (t: string) => new Set((t.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []).filter((w) => !GENERIC_STOP.has(w)));

function themReason(text: string, refs: string[], i: DraftInput, src: Sources): string | null {
  if (!refs.length) return "not in the job post or your research";
  const lines: string[] = [];
  for (const r of refs) {
    if (r === "jd") lines.push(...i.jdLines);
    else if (src.picked.has(r)) lines.push(src.picked.get(r)!.claim);
    else return "not a fact you picked";
  }
  if (FIRST_PERSON.test(text)) {
    // The student's part of an employer sentence is judged against the whole CV, as in drafts.ts.
    const clause = text.split(/,|;|\band\b/).filter((c) => FIRST_PERSON.test(c)).join(", ");
    const mine = meBlock(clause, [...src.bullets.keys(), ...src.facts.keys()], src.apInput, src.bullets, src.facts, true);
    if (mine) return mine;
  }
  const known = [...lines, i.role, ...(i.ref ? [i.ref] : [])];
  if (!themSupported(text, known, i.company)) return refs.includes("jd") && refs.length === 1 ? "not in the job post" : "not in the job post or your research";
  const said = contentWords(text);
  const cited = contentWords(known.join(" "));
  const namesFirm = lower(text).includes(lower(i.company));
  if (!namesFirm && ![...said].some((w) => cited.has(w))) return "would work for any firm";
  return null;
}

// ---------------------------------------------------------------- locked answers

/** Lowercased, whitespace-collapsed, quote-normalised text with a map back to original offsets. */
function normalise(s: string): { n: string; at: number[] } {
  let n = "";
  const at: number[] = [];
  for (let k = 0; k < s.length; k++) {
    let c = s[k].toLowerCase();
    if (/\s/.test(c)) {
      if (n.endsWith(" ") || n === "") continue;
      c = " ";
    } else if (c === "‘" || c === "’") c = "'";
    else if (c === "“" || c === "”") c = '"';
    n += c;
    at.push(k);
  }
  if (n.endsWith(" ")) { n = n.slice(0, -1); at.pop(); }
  return { n, at };
}

const TERMINAL = /[.!?…]+["')”’]*$/;

/** Where `answer` sits inside `sentence` (modulo whitespace and case), as offsets into `sentence`; "all" if the sentence is a verbatim part of the answer. */
function findAnswer(sentence: string, answer: string): { start: number; end: number } | "all" | null {
  const core = answer.trim().replace(TERMINAL, "");
  const tail = answer.trim().slice(core.length);
  const s = normalise(sentence);
  const a = normalise(core).n;
  if (!a) return null;
  const k = s.n.indexOf(a);
  if (k >= 0) {
    const start = s.at[k];
    let end = s.at[k + a.length - 1] + 1;
    if (tail && sentence.startsWith(tail, end)) end += tail.length;
    return { start, end };
  }
  // The model may split a multi-sentence answer: accept a whole sentence of it, never a fragment that could flip its meaning.
  const bare = normalise(sentence.trim().replace(TERMINAL, "")).n;
  const whole = normalise(answer).n;
  if (!bare) return null;
  for (let k = whole.indexOf(bare); k >= 0; k = whole.indexOf(bare, k + 1)) {
    const startsSentence = k === 0 || /[.!?…]["')”’]* $/.test(whole.slice(0, k));
    const after = whole.slice(k + bare.length);
    const endsSentence = after === "" || /^[.!?…]/.test(after);
    if (startsSentence && endsSentence) return "all";
  }
  return null;
}

// ---------------------------------------------------------------- letter furniture

// No digits or sentence punctuation, so a claim can never pass as a greeting or a signature.
const SALUTATION = /^(dear|hi|hello)\b[^.!?\d\n]*$/i;
const NAME_LINE = /^\p{Lu}[\p{L}'’.-]*(?:\s+\p{Lu}[\p{L}'’.-]*){0,3}$/u;
const SIGNOFF = /^(yours (sincerely|faithfully)|kind regards|best wishes|best regards|regards|many thanks|best)\b[,.]?[ \t]*$/i;
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** Lengths of a leading salutation line and of a trailing sign-off block (sign-off line plus at most two short name lines). */
function furniture(text: string): { lead: number; trail: number } {
  const lines = text.split("\n");
  let lead = 0;
  if (SALUTATION.test(lines[0].trim()) && words(lines[0]) <= 8) lead = lines[0].length + (lines.length > 1 ? 1 : 0);
  let trail = 0;
  for (let k = lines.length - 1; k >= 0 && k >= lines.length - 3; k--) {
    if (SIGNOFF.test(lines[k].trim())) {
      const rest = lines.slice(k + 1);
      if (rest.length <= 2 && rest.every((l) => NAME_LINE.test(l.trim()))) trail = lines.slice(k).join("\n").length + (k > 0 ? 1 : 0);
      break;
    }
  }
  if (lead + trail > text.length) trail = Math.max(0, text.length - lead);
  return { lead, trail };
}

// ---------------------------------------------------------------- spans

type Located = { m: Marked; start: number; end: number; index: number };

/** Each closed sentence's position in the visible text, in order. Sentences that cannot be found are left out (the gap check covers their text). */
function locate(text: string, sentences: Marked[]): Located[] {
  const out: Located[] = [];
  let cursor = 0;
  sentences.forEach((m, index) => {
    if (!m.text) return;
    const at = text.indexOf(m.text, cursor);
    if (at < 0) return;
    out.push({ m, start: at, end: at + m.text.length, index });
    cursor = at + m.text.length;
  });
  return out;
}

const trimRange = (text: string, start: number, end: number) => {
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return { start, end };
};

const covered = (own: Span[], start: number, end: number) => own.some((s) => s.kind === "theirs" && s.start <= start && s.end >= end);

export function verifyOutput(v: VerifyInput): Verified {
  const { text, input: i } = v;
  const src = sources(i);
  const spans: Span[] = [];
  const notes: LintHit[] = [];
  const own = v.ownSpans.filter((s) => s.kind === "theirs");
  const ai = (start: number, end: number, refs: string[], flag: string | null) => {
    const r = trimRange(text, start, end);
    if (r.end > r.start) spans.push({ ...r, kind: "ai", refs, ...(flag ? { flag } : {}) });
  };

  const units = locate(text, v.sentences);
  const whyFirmGiven = i.answers.some((a) => a.question === "why_firm" && a.text?.trim());
  let firstPara: number | null = null;
  const jdOnly: { start: number; end: number; para: number }[] = [];
  const paraOf = (pos: number) => (text.slice(0, pos).match(/\n[ \t]*\n/g) ?? []).length;

  for (const u of units) {
    const f = furniture(u.m.text);
    const start = u.start + f.lead;
    const end = u.end - f.trail;
    if (f.lead) ai(u.start, start, [], null);
    if (f.trail) ai(end, u.end, [], null);
    const r = trimRange(text, start, end);
    if (r.end <= r.start || covered(own, r.start, r.end)) continue;
    const body = text.slice(r.start, r.end);
    const refs = u.m.refs;
    firstPara ??= paraOf(r.start);

    if (u.m.about === "you") {
      const theirs: { start: number; end: number; ref: string }[] = [];
      for (const ref of refs) {
        const ans = src.answers.get(ref);
        if (!ans) continue;
        const hit = findAnswer(body, ans.text);
        // The sentence is one whole sentence of a longer answer: all of it is theirs.
        if (hit === "all") { theirs.splice(0, theirs.length, { start: 0, end: body.length, ref: ans.id }); break; }
        if (hit) theirs.push({ ...hit, ref: ans.id });
      }
      if (!theirs.length) { ai(r.start, r.end, refs, "changed your words"); continue; }
      theirs.sort((a, b) => a.start - b.start);
      let pos = 0;
      for (const t of theirs) {
        if (t.start < pos) continue;
        const gap = body.slice(pos, t.start);
        if (/[a-z0-9]/i.test(gap)) ai(r.start + pos, r.start + t.start, [], freeTextReason(gap, src));
        spans.push({ start: r.start + t.start, end: r.start + t.end, kind: "theirs", refs: [t.ref] });
        pos = t.end;
      }
      const rest = body.slice(pos);
      if (/[a-z0-9]/i.test(rest)) ai(r.start + pos, r.end, [], freeTextReason(rest, src));
      continue;
    }
    if (u.m.about === "me") { ai(r.start, r.end, refs, meReason(body, refs, src)); continue; }
    if (u.m.about === "them") {
      const reason = themReason(body, refs, i, src);
      ai(r.start, r.end, refs, reason);
      if (!reason && refs.every((x) => x === "jd") && paraOf(r.start) !== firstPara) jdOnly.push({ start: r.start, end: r.end, para: paraOf(r.start) });
      continue;
    }
    ai(r.start, r.end, refs, "no source");
  }

  // CL-12: with no reason from the student, the why-them part rests on the job post only. One amber note on the
  // last paragraph (after the opening) whose firm sentences cite only the job post; it never blocks.
  if (!whyFirmGiven && jdOnly.length) {
    const para = jdOnly.at(-1)!.para;
    const inPara = jdOnly.filter((x) => x.para === para);
    notes.push({ ruleId: "CL-12", label: "Add your own reason", severity: "med", start: inPara[0].start, end: inPara.at(-1)!.end, scope: "ai" });
  }

  // Every other piece of text (unmarked or unlocatable) is AI-written with no source, unless it is letter furniture.
  const taken = [...spans, ...own].sort((a, b) => a.start - b.start);
  let pos = 0;
  const gap = (from: number, to: number) => {
    if (!/[a-z0-9]/i.test(text.slice(from, to))) return;
    const f = furniture(text.slice(from, to));
    if (f.lead) ai(from, from + f.lead, [], null);
    if (f.trail) ai(to - f.trail, to, [], null);
    const inner = text.slice(from + f.lead, to - f.trail);
    if (/[a-z0-9]/i.test(inner)) ai(from + f.lead, to - f.trail, [], "no source");
  };
  for (const s of taken) {
    if (s.start > pos) gap(pos, s.start);
    pos = Math.max(pos, s.end);
  }
  if (pos < text.length) gap(pos, text.length);

  for (const s of own) if (!spans.includes(s)) spans.push(s);
  spans.sort((a, b) => a.start - b.start);

  const pastEmployers = [...i.cv.experience, ...i.cv.projects, ...i.cv.leadership].map((e) => lower(e.org.trim())).filter(Boolean);
  const otherEmployers = [...new Set(i.evidence.rivals)].filter((r) => r.trim() && !pastEmployers.some((p) => p === lower(r.trim())));
  const lint = lintLetter(text, { mode: i.mode, limit: i.limit, company: i.company, role: i.role, otherEmployers, ownSpans: spans.filter((s) => s.kind === "theirs") });
  return { spans, lint: [...lint, ...notes].sort((a, b) => a.start - b.start) };
}

// ---------------------------------------------------------------- repair

type Target = { start: number; end: number; reason: string };

/** Flagged AI sentences, plus AI sentences carrying a block or high lint hit (spec: high → auto-repair, then amber). */
function repairTargets(v: Verified): Target[] {
  const out: Target[] = [];
  for (const s of v.spans) {
    if (s.kind !== "ai") continue;
    const hit = v.lint.find((h) => h.scope === "ai" && (h.severity === "block" || h.severity === "high") && h.start >= s.start && h.start < s.end);
    const reason = s.flag ?? hit?.label;
    if (reason) out.push({ start: s.start, end: s.end, reason });
  }
  return out;
}

/** A rewrite may carry its own marker; otherwise the sentence keeps its old source. */
function parseRewrite(raw: string): { text: string; marked: Marked | null } {
  const p = new MarkerParser();
  const r = p.push(raw);
  const closed = [...r.closed, ...p.end()].filter((m) => m.about);
  return { text: r.visible.trim(), marked: closed.length === 1 ? closed[0] : null };
}

/** Rewrites only the flagged AI sentences, re-verifies, and stops after `rounds`. Text the student owns is never sent for rewriting. */
export async function repair(
  i: VerifyInput, verified: Verified, rewrite: (sentence: string, reason: string) => Promise<string>, rounds = 2,
): Promise<{ text: string; spans: Span[]; lint: LintHit[] }> {
  let cur = i;
  let v = verified;
  for (let round = 0; round < rounds; round++) {
    const targets = repairTargets(v).sort((a, b) => b.start - a.start);
    if (!targets.length) break;
    let text = cur.text;
    const sentences = cur.sentences.map((m) => ({ ...m }));
    let own = cur.ownSpans.map((s) => ({ ...s }));
    const located = locate(text, sentences);
    for (const t of targets) {
      const before = text.slice(t.start, t.end);
      const out = parseRewrite(await rewrite(before, t.reason));
      let end = t.end;
      if (!out.text && text[end] === " ") end++;
      const delta = out.text.length - (end - t.start);
      text = text.slice(0, t.start) + out.text + text.slice(end);
      own = own.map((s) => (s.start >= end ? { ...s, start: s.start + delta, end: s.end + delta } : s));
      const u = located.find((l) => l.start <= t.start && l.end >= t.end);
      if (u) {
        const m = sentences[u.index];
        m.text = (m.text.slice(0, t.start - u.start) + out.text + m.text.slice(t.end - u.start)).trim();
        if (out.marked && t.start === u.start && t.end === u.end) { m.about = out.marked.about; m.refs = out.marked.refs; }
      } else if (out.marked && out.text) {
        // Unmarked text that came back with a source: insert it as a sentence in text order.
        const after = located.filter((l) => l.end <= t.start).at(-1);
        sentences.splice(after ? after.index + 1 : 0, 0, { text: out.text, about: out.marked.about, refs: out.marked.refs });
      }
    }
    cur = { ...cur, text, sentences: sentences.filter((m) => m.text), ownSpans: own };
    v = verifyOutput(cur);
  }
  return { text: cur.text, spans: v.spans, lint: v.lint };
}
