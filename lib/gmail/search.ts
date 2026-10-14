import { BODY_CHARS } from "@/lib/inbox/classify";
import type { RawEmail } from "@/lib/inbox/types";

/**
 * Senders that carry application news: ATS platforms and assessment vendors. A starting list (2026-10-14); extend it
 * from real demo inboxes, never from guesses about a vendor's domain.
 */
export const SENDER_DOMAINS = [
  "greenhouse.io", "greenhouse-mail.io", "ashbyhq.com", "lever.co", "hire.lever.co", "myworkday.com", "myworkdayjobs.com",
  "smartrecruiters.com", "successfactors.com", "oraclecloud.com", "hirevue.com", "shl.com", "arcticshores.com",
  "pymetrics.com", "pymetrics.ai", "sova.co.uk", "cappfinity.com", "codility.com", "hackerrank.com", "talogy.com",
] as const;

const MAX_COMPANIES = 30;
const GMAIL_TIMEOUT_MS = 15_000;
const MAX_HTML = 200_000;

export function buildGmailQuery(companies: string[]): string {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const c of companies) {
    const clean = c.replace(/"/g, "").replace(/\s+/g, " ").trim();
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    names.push(`"${clean}"`);
    if (names.length === MAX_COMPANIES) break;
  }
  const from = `from:(${SENDER_DOMAINS.join(" OR ")})`;
  return `newer_than:60d (${[from, ...names].join(" OR ")})`;
}

export type GmailPayload = { mimeType?: string; body?: { data?: string }; parts?: GmailPayload[]; headers?: { name: string; value: string }[] };

const decode = (d?: string) => (d ? Buffer.from(d, "base64url").toString("utf8") : "");

function findPart(p: GmailPayload, mime: string): GmailPayload | null {
  if (p.mimeType === mime && p.body?.data) return p;
  for (const c of p.parts ?? []) { const f = findPart(c, mime); if (f) return f; }
  return null;
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/** HTML → text. Link targets are kept beside their text, because the assessment link is often only in an href. */
function htmlToText(html: string): string {
  const capped = html.slice(0, MAX_HTML);
  return capped
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m])
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

export function extractText(p: GmailPayload): string {
  const plain = findPart(p, "text/plain");
  if (plain) return decode(plain.body?.data).trim();
  const html = findPart(p, "text/html");
  return html ? htmlToText(decode(html.body?.data)) : "";
}

export function toRawEmail(msg: { id: string; internalDate?: string; payload?: GmailPayload }): RawEmail {
  const h = (n: string) => msg.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
  const ms = Number(msg.internalDate);
  return {
    id: msg.id, from: h("from"), subject: h("subject"),
    date: new Date(Number.isFinite(ms) && ms > 0 ? ms : Date.now()).toISOString(),
    text: msg.payload ? extractText(msg.payload).slice(0, BODY_CHARS) : "",
  };
}

export class GmailAuthError extends Error {}

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmail<T>(token: string, path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(GMAIL_TIMEOUT_MS) });
  if (r.status === 401) throw new GmailAuthError("Gmail rejected the access token");
  if (!r.ok) throw new Error(`Gmail ${path.split("?")[0]} failed: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

/**
 * Newest first, at most `max`; message bodies fetched 8 at a time. Ids in `skipIds` (messages a sync already recorded)
 * are dropped after the list call, so their bodies are never downloaded again.
 */
export async function fetchRecentEmails(token: string, query: string, max = 100, skipIds?: ReadonlySet<string>): Promise<RawEmail[]> {
  const list = await gmail<{ messages?: { id: string }[] }>(token, `/messages?maxResults=${max}&q=${encodeURIComponent(query)}`);
  const ids = (list.messages ?? []).map((m) => m.id).filter((id) => !skipIds?.has(id));
  const out: RawEmail[] = [];
  for (let i = 0; i < ids.length; i += 8) {
    const batchIds = ids.slice(i, i + 8);
    const results = await Promise.allSettled(batchIds.map((id) => gmail<{ id: string; internalDate?: string; payload?: GmailPayload }>(token, `/messages/${id}?format=full`)));
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") {
        out.push(toRawEmail(r.value));
      } else if (r.reason instanceof GmailAuthError) {
        throw r.reason;
      } else {
        const id = batchIds[j];
        const status = r.reason instanceof Error && r.reason.message.includes("HTTP") ? r.reason.message.match(/HTTP \d+/)?.[0] : "unknown";
        console.error(`Gmail message ${id} fetch failed: ${status}`);
      }
    }
  }
  return out;
}
