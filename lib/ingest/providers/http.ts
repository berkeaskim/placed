// JSON-over-HTTP helpers shared by the paged providers (Workday, SmartRecruiters).

const RETRY_STATUS = new Set([429, 502, 503, 504]);
export const RETRY_DELAYS_MS = [1_000, 3_000, 8_000];

const TRANSIENT_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT", "EPIPE", "EAI_AGAIN"]);

/** AbortSignal.timeout fires a TimeoutError; undici reports resets as TypeError("fetch failed") with a coded cause. */
export function isTransient(e: unknown): boolean {
  const err = e as { name?: string; code?: string; cause?: { code?: string } } | null;
  if (!err) return false;
  if (err.name === "TimeoutError" || err.name === "AbortError") return true;
  return TRANSIENT_CODES.has(err.code ?? "") || TRANSIENT_CODES.has(err.cause?.code ?? "");
}

export const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** GET/POST JSON; backs off on 429/5xx (shared ATS hosts rate-limit) instead of failing the board. */
export async function getJson(
  url: string, fetchImpl: typeof fetch, init?: RequestInit, sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(15_000),
        headers: { accept: "application/json", "content-type": "application/json", ...(init?.headers ?? {}) },
      });
    } catch (e) {
      // Timeouts and resets on big boards (GSK, P&G, Marsh) are transient; one failed page would fail the whole board.
      // Anything else (DNS, refused, bad apiHost) fails at once instead of burning the ingest time budget.
      if (isTransient(e) && attempt < RETRY_DELAYS_MS.length) { await sleep(RETRY_DELAYS_MS[attempt]); continue; }
      throw e;
    }
    if (res.ok) return res.json();
    if (RETRY_STATUS.has(res.status) && attempt < RETRY_DELAYS_MS.length) {
      const after = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(after) && after > 0 ? Math.min(after, 30) * 1000 : RETRY_DELAYS_MS[attempt]);
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i]);
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
