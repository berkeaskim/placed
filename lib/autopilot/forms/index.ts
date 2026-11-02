import { FormUnavailableError, PostingClosedError, type Ats, type NormalizedForm } from "./types";
import { greenhouseRef, parseGreenhouse } from "./greenhouse";
import { ashbyRef, parseAshby, ASHBY_QUERY } from "./ashby";
import { leverRef, parseLever } from "./lever";
export { wordLimitOf } from "./limits";

const INIT = { headers: { "user-agent": "PlacedAutopilot/1.0 (+student internship assistant)" }, cache: "no-store" as const };

/** `slug` is the company's board slug, for Greenhouse jobs linked from the company's own careers page. */
export async function fetchForm(job: { url: string; ats: Ats; slug?: string }, fetchImpl: typeof fetch = fetch): Promise<NormalizedForm> {
  const get = async (u: string, init: RequestInit = {}) => {
    const r = await fetchImpl(u, { ...INIT, ...init, headers: { ...INIT.headers, ...(init.headers ?? {}) } }).catch(() => null);
    if (r?.status === 404) throw new PostingClosedError();
    if (!r || !r.ok) throw new FormUnavailableError();
    return r;
  };
  const run = async (read: () => Promise<NormalizedForm>) => {
    try { const form = await read(); if (form.fields.length === 0) throw new FormUnavailableError(); return form; } catch (e) { throw e instanceof FormUnavailableError ? e : new FormUnavailableError(); }
  };
  if (job.ats === "greenhouse") {
    const ref = greenhouseRef(job.url, job.slug); if (!ref) throw new FormUnavailableError();
    return run(async () => parseGreenhouse(await (await get(`https://boards-api.greenhouse.io/v1/boards/${ref.board}/jobs/${ref.id}?questions=true`)).json(), ref.board, ref.id, ref.embed));
  }
  if (job.ats === "ashby") {
    const ref = ashbyRef(job.url); if (!ref) throw new FormUnavailableError();
    const body = JSON.stringify({ operationName: "ApiJobPosting", variables: { organizationHostedJobsPageName: ref.org, jobPostingId: ref.id }, query: ASHBY_QUERY });
    return run(async () => parseAshby(await (await get("https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobPosting", { method: "POST", body, headers: { "content-type": "application/json" } })).json(), ref.org, ref.id));
  }
  const ref = leverRef(job.url); if (!ref) throw new FormUnavailableError();
  return run(async () => parseLever(await (await get(`https://${ref.host}/${ref.site}/${ref.id}/apply`)).text(), ref.site, ref.id, ref.host));
}
