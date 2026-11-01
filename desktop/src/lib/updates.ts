/** GitHub release check. Pure apart from the one injected `fetch`, so it runs under vitest too. */

export const RELEASES_API = "https://api.github.com/repos/berkeaskim/placed/releases/latest";
export const RELEASES_PAGE = "https://github.com/berkeaskim/placed/releases/latest";

export interface Release {
  version: string;
  url: string;
  publishedAt: string;
}

export interface UpdateCheckResult {
  status: "current" | "available" | "skipped" | "error";
  latest?: Release;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const VERSION = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?$/;

const parts = (v: string): [number, number, number] | null => {
  const m = VERSION.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
};

/** Semver-ish `x.y.z` (leading `v` and any pre-release suffix ignored): negative, 0 or positive like a sort comparator. */
export function compareVersions(a: string, b: string): number {
  const pa = parts(a) ?? [0, 0, 0];
  const pb = parts(b) ?? [0, 0, 0];
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

// Only ever hand shell.openExternal a GitHub https page.
const safeUrl = (u: unknown) =>
  typeof u === "string" && u.startsWith("https://github.com/berkeaskim/placed/") ? u : RELEASES_PAGE;

/** The latest published release, or null on any failure (offline, rate limit, malformed reply, timeout). */
export async function latestRelease(fetchImpl: FetchLike, current: string, timeoutMs = 10_000): Promise<Release | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetchImpl(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": `placed-desktop/${current}` },
      signal: abort.signal,
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const { tag_name, html_url, published_at } = body as Record<string, unknown>;
    if (typeof tag_name !== "string" || !parts(tag_name)) return null;
    return {
      version: tag_name.trim().replace(/^v/, ""),
      url: safeUrl(html_url),
      publishedAt: typeof published_at === "string" ? published_at : "",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkForUpdates({
  current,
  skipped,
  fetchImpl = globalThis.fetch,
}: {
  current: string;
  skipped?: string;
  fetchImpl?: FetchLike;
}): Promise<UpdateCheckResult> {
  const latest = await latestRelease(fetchImpl, current);
  if (!latest) return { status: "error" };
  if (compareVersions(latest.version, current) <= 0) return { status: "current", latest };
  if (skipped && compareVersions(latest.version, skipped) === 0) return { status: "skipped", latest };
  return { status: "available", latest };
}
