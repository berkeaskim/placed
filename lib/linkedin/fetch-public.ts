/**
 * Fetches the student's OWN public LinkedIn profile from a pasted link. Only linkedin.com/in/<slug> URLs are
 * accepted and the request URL is rebuilt from the slug, so a pasted link can never point the server elsewhere.
 *
 * LinkedIn often answers logged-out or datacenter traffic with an auth wall (HTTP 999, or a redirect to
 * /authwall or /login); students can also hide their public profile. Both are reported as typed errors so the
 * page can offer the PDF upload instead. LinkedIn's User Agreement restricts automated access: this makes one
 * request per user action, for the user's own profile, and never stores the HTML.
 */

export type LinkedInFetchErrorKind = "invalid_url" | "blocked" | "not_found" | "private" | "network";
export class LinkedInFetchError extends Error {
  constructor(public kind: LinkedInFetchErrorKind, message: string) { super(message); }
}

/** LinkedIn shows logged-out visitors the same sign-in wall for a blocked read and a link that doesn't exist. */
const BLOCKED_COPY = "LinkedIn didn't show us that profile. Check the link is yours and your public profile is on, or upload the PDF below.";

const SLUG_RE = /^[A-Za-z0-9\-_%.]{3,100}$/;

/** "linkedin.com/in/jane-doe-123/?utm=x", "https://uk.linkedin.com/in/jane-doe" → "https://www.linkedin.com/in/jane-doe-123". */
export function normalizeProfileUrl(input: string): string {
  const raw = input.trim();
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { throw new LinkedInFetchError("invalid_url", "That isn't a link."); }
  const host = u.hostname.toLowerCase();
  if (!(host === "linkedin.com" || host.endsWith(".linkedin.com"))) throw new LinkedInFetchError("invalid_url", "Paste a linkedin.com/in/… profile link.");
  const m = u.pathname.match(/^\/in\/([^/]+)\/?/);
  if (!m || !SLUG_RE.test(m[1])) throw new LinkedInFetchError("invalid_url", "Paste your profile link, which looks like linkedin.com/in/your-name.");
  return `https://www.linkedin.com/in/${m[1]}`;
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export async function fetchPublicProfile(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const canonical = normalizeProfileUrl(url);
  let res: Response;
  try {
    res = await fetchImpl(canonical, {
      headers: { "user-agent": UA, "accept-language": "en-GB,en;q=0.9", accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
  } catch {
    throw new LinkedInFetchError("network", "We couldn't reach LinkedIn just now.");
  }
  const finalUrl = res.url || canonical;
  if (res.status === 404) throw new LinkedInFetchError("not_found", "We couldn't find that profile. Check the link.");
  if (res.status === 999 || res.status === 429 || res.status === 403 || /\/(authwall|login|uas\/login|checkpoint)/.test(new URL(finalUrl).pathname)) {
    throw new LinkedInFetchError("blocked", BLOCKED_COPY);
  }
  if (!res.ok) throw new LinkedInFetchError("network", `LinkedIn answered ${res.status}.`);
  const html = await res.text();
  if (/authwall|join-form|sign-in-modal__outlet/.test(html) && !/top-card-layout__title|"@type":"Person"/.test(html)) {
    throw new LinkedInFetchError("blocked", BLOCKED_COPY);
  }
  if (!/top-card-layout__title|"@type":\s*"Person"/.test(html)) {
    throw new LinkedInFetchError("private", "This profile isn't public. Turn on your public profile, or upload the PDF instead.");
  }
  return html;
}
