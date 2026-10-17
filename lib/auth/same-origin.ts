/**
 * True when a request comes from Placed's own pages. There is no auth locally, so another site's page in the user's
 * browser must not be able to start a run: a cross-site Sec-Fetch-Site, or an Origin for another host, is refused, and
 * so is a request that says neither.
 */
export function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return site === "same-origin";
  try {
    return new URL(origin).host === (request.headers.get("host") ?? new URL(request.url).host);
  } catch {
    return false;
  }
}
