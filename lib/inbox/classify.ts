import { z } from "zod";
import { AiError, generateStructured, runAi } from "@/lib/ai/provider";
import { SYSTEM_CLASSIFY_EMAIL, escapeUntrusted } from "@/lib/ai/prompts";
import { safeHttpUrl } from "@/lib/text/url";
import { INBOX_KINDS, type Classification, type RawEmail } from "./types";

export const BODY_CHARS = 2000;

export const EmailClassificationOut = z.object({
  kind: z.enum(INBOX_KINDS),
  company: z.string().nullable(),
  role_hint: z.string().nullable(),
  deadline: z.string().nullable(),
  action_url: z.string().nullable(),
  confidence: z.number(),
});
type Raw = z.infer<typeof EmailClassificationOut>;

export const OTHER: Classification = { kind: "other", company: null, roleHint: null, deadline: null, actionUrl: null, confidence: 0 };

const blank = (s: string | null) => (s && s.trim() ? s.trim() : null);
const YEAR_MS = 366 * 24 * 3600 * 1000;

/** A real calendar date in YYYY-MM-DD within a year of the email; anything else is dropped, never repaired. */
function validDeadline(d: string | null, emailDate: string): string | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = Date.parse(`${d}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== d) return null;
  const sent = Date.parse(emailDate);
  return Number.isNaN(sent) || Math.abs(t - sent) <= YEAR_MS ? d : null;
}

/** The model may only point at a link the email actually contains, and only an http(s) one. */
function validUrl(u: string | null, text: string): string | null {
  const s = blank(u);
  return s && text.includes(s) ? safeHttpUrl(s) : null;
}

export function guardClassification(raw: Raw, email: RawEmail): Classification {
  return {
    kind: raw.kind,
    company: blank(raw.company),
    roleHint: blank(raw.role_hint),
    deadline: validDeadline(raw.deadline, email.date),
    actionUrl: validUrl(raw.action_url, `${email.subject}\n${email.text}`),
    confidence: Math.min(1, Math.max(0, raw.confidence)),
  };
}

export function buildClassifyPrompt(email: RawEmail): string {
  const body = email.text.slice(0, BODY_CHARS);
  return `<email>\nFrom: ${escapeUntrusted(email.from)}\nDate: ${email.date}\nSubject: ${escapeUntrusted(email.subject)}\n\n${escapeUntrusted(body)}\n</email>`;
}

/**
 * Fast tier. Fixture mode looks up fixtures/ai/classifyEmail/<message id>.json; demo emails have no JSON (their
 * deadlines must be relative to today), so their classification arrives as `demoFallback`. Any AI failure is OTHER:
 * a wrong move is worse than no move (spec §2.6).
 */
export async function classifyEmail(email: RawEmail, demoFallback?: Classification): Promise<Classification> {
  try {
    return await runAi({
      fn: "classifyEmail",
      fixtureKey: email.id,
      schema: EmailClassificationOut,
      fromFixture: (raw) => guardClassification(raw, email),
      live: async () => guardClassification(await generateStructured({
        tier: "fast", system: SYSTEM_CLASSIFY_EMAIL, schema: EmailClassificationOut, maxTokens: 2000,
        parts: [{ type: "text", text: buildClassifyPrompt(email) }],
      }), email),
      fallback: () => demoFallback ?? OTHER,
    });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    console.error("classifyEmail: AI failed, treating as other", err.message);
    return OTHER;
  }
}
