// Deterministic closing-date extraction from job-description text. No LLM: a wrong deadline is worse
// than none, so this only returns a date when a closing phrase is followed closely by a parseable date.

export type DeadlineSource = "ats" | "text";
export type DeadlineResult = { deadline: string | null; source: DeadlineSource | null; rolling: boolean };

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};
const MON = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const ORD = "(\\d{1,2})(?:st|nd|rd|th)?";
const YEAR = "(20\\d\\d)";

// Phrases that introduce a closing date. "until" alone is excluded: "runs from June until August" is a programme date.
const TRIGGER = new RegExp(
  "(application deadline|deadline(?: for applications)?|closing date|closes? on|close date|" +
  "applications? (?:will )?close[sd]?|applications? (?:must be )?(?:received|submitted) by|apply (?:by|before)|" +
  "(?:open|accepting applications) until|no later than|submit (?:your application )?by|posting end date)",
  "gi",
);
const WINDOW = 60; // chars after a trigger in which the date must start

const DATE_PATTERNS: { re: RegExp; parse: (m: RegExpExecArray) => { y: number | null; mo: number; d: number } | null }[] = [
  // 2026-11-01
  { re: new RegExp(`^\\D{0,${WINDOW}}?\\b${YEAR}-(\\d{2})-(\\d{2})\\b`, "i"), parse: (m) => ({ y: +m[1], mo: +m[2], d: +m[3] }) },
  // 1st of November 2026 / 1 Nov 2026 / 1 November (year inferred)
  { re: new RegExp(`^\\D{0,${WINDOW}}?\\b${ORD}(?:\\s+of)?\\s+${MON}(?:,?\\s+${YEAR})?\\b`, "i"), parse: (m) => ({ y: m[3] ? +m[3] : null, mo: MONTHS[m[2].toLowerCase().replace(".", "")], d: +m[1] }) },
  // November 1st, 2026 / Nov 1 2026 / November 1 (year inferred)
  { re: new RegExp(`^\\D{0,${WINDOW}}?\\b${MON}\\s+${ORD}(?:,?\\s+${YEAR})?\\b`, "i"), parse: (m) => ({ y: m[3] ? +m[3] : null, mo: MONTHS[m[1].toLowerCase().replace(".", "")], d: +m[2] }) },
  // 16/10/2026, 16.10.2026, 16-10-26: UK day-first; if the middle part can't be a month, read it as US month-first
  {
    re: new RegExp(`^\\D{0,${WINDOW}}?\\b(\\d{1,2})[/.-](\\d{1,2})[/.-](20\\d\\d|\\d\\d)\\b`, "i"),
    parse: (m) => {
      const a = +m[1], b = +m[2], y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      if (b <= 12) return { y, mo: b, d: a };
      if (a <= 12) return { y, mo: a, d: b };
      return null;
    },
  },
];

const ROLLING = /\b(rolling basis|on a rolling|rolling (recruitment|applications?|deadline|admissions?)|(may|might|will|could) close (early|before)|close (the (vacancy|role|posting|position) )?early|until (the (role|position|vacancy) is )?filled|reserve the right to close)\b/i;

function iso(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Year for "31 October" without a year: the first occurrence on/after the reference day. */
function inferYear(mo: number, d: number, ref: Date): number {
  const y = ref.getUTCFullYear();
  const candidate = Date.UTC(y, mo - 1, d);
  const refDay = Date.UTC(y, ref.getUTCMonth(), ref.getUTCDate());
  return candidate >= refDay ? y : y + 1;
}

/**
 * @param text  plain JD text
 * @param ref   reference time for sanity checks and year inference: the posting date if known, else now
 */
export function extractDeadline(text: string, ref: Date): DeadlineResult {
  const rolling = ROLLING.test(text);
  const lo = ref.getTime() - 3 * 86_400_000; // a deadline before the posting date is a stale or wrong match
  const hi = ref.getTime() + 548 * 86_400_000; // ~18 months: further out is a programme/start date, not a close date
  TRIGGER.lastIndex = 0;
  for (let t = TRIGGER.exec(text); t; t = TRIGGER.exec(text)) {
    const after = text.slice(t.index + t[0].length, t.index + t[0].length + WINDOW + 30);
    for (const p of DATE_PATTERNS) {
      const m = p.re.exec(after);
      if (!m) continue;
      const parts = p.parse(m);
      if (!parts || !parts.mo) continue;
      const y = parts.y ?? inferYear(parts.mo, parts.d, ref);
      const date = iso(y, parts.mo, parts.d);
      if (!date) continue;
      const ms = Date.parse(`${date}T23:59:59Z`);
      if (ms < lo || ms > hi) continue;
      return { deadline: date, source: "text", rolling };
    }
  }
  return { deadline: null, source: null, rolling };
}

const DAY = 86_400_000;
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/**
 * Structured ATS date wins over text, but ATS "end dates" are when the posting comes down, and employers set
 * them inconsistently: measured on 286 Workday postings (2026-10-13), the JD's stated deadline was either the
 * same day (MUFG, LSEG, AIG, Howden) or the day before (Barclays, FTI: endDate = deadline + 1).
 * So: a text date within the 3 days before the ATS date corroborates it and is used as the exact last day;
 * otherwise we show ATS - 1 day. Off by one is then always early, never late; a student never misses it.
 */
export function resolveDeadline(atsDeadline: string | null | undefined, text: string, ref: Date): DeadlineResult {
  const fromText = extractDeadline(text, ref);
  if (!atsDeadline) return fromText;
  const t = fromText.deadline;
  const corroborated = t !== null && t <= atsDeadline && t >= shift(atsDeadline, -3);
  return { deadline: corroborated ? t : shift(atsDeadline, -1), source: "ats", rolling: fromText.rolling };
}
