import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getActiveCv, getJob, getProfile, toStudent } from "@/lib/db/queries";
import { coverageFor } from "@/lib/scoring/coverage";
import { scoreFit } from "@/lib/scoring/fit";
import { closingLabel, todayLondon } from "@/lib/scoring/dates";
import { FINDABILITY_HINT, findabilityBand, keywordStuffing, shouldWarnStuffing } from "@/lib/scoring/requirements";
import { clicheDensity } from "@/lib/cv/cliches";
import { env } from "@/lib/env";
import { isUuid } from "@/lib/feed/save-result";
import { applyXp } from "@/lib/feed/rank";
import { safeHttpUrl } from "@/lib/text/url";
import { CompanyMark } from "@/components/company-mark";
import { isPastSaved } from "@/lib/tracker/status";
import { FitBadge } from "@/components/fit-badge";
import { SaveButton } from "@/components/save-button";
import { ExplainPanel } from "./explain-panel";
import { ApplyButton } from "./apply-button";
import { TailorPanel } from "./tailor-panel";
import { AutopilotPanel } from "./autopilot-panel";
import { InterviewPrepPanel } from "./interview-prep-panel";
import type { StoredTailoring } from "./actions";
import { PeoplePanel } from "@/components/outreach/people-panel";
import { OUTREACH_TARGETS } from "@/lib/outreach/targets";
import type { OutreachPurpose } from "@/lib/outreach/draft";

// Interview prep's first generation runs a grounded web search (~40-60 s).
export const maxDuration = 120;

const BAND_TONE = {
  Strong: "bg-[#E3F6EE] text-[#0B6B49]", Good: "bg-[#E6EEFF] text-[#2340A8]",
  Partial: "bg-[#FFF1DC] text-[#7A4100]", Limited: "bg-[#EEEEF2] text-[#3F3F4C]",
} as const;

/** Job text is scraped data: rendered from text_lines as plain React text (escaped), never as HTML. */
function JobText({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col gap-2 text-[15px] leading-relaxed">
      {lines.map((l, i) =>
        l.startsWith("## ") ? <h2 key={i} className="mt-3 text-lg font-bold">{l.slice(3)}</h2>
          : l.startsWith("- ") ? <p key={i} className="pl-4 before:-ml-4 before:mr-2 before:content-['•']">{l.slice(2)}</p>
            : <p key={i}>{l}</p>)}
    </div>
  );
}

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ target?: string; purpose?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user } = await requireUser();
  if (!isUuid(id)) notFound();
  const [job, profile, cv, { data: app }] = await Promise.all([
    getJob(supabase, id), getProfile(supabase, user.id), getActiveCv(supabase, user.id),
    supabase.from("applications").select("status, tailored_json").eq("user_id", user.id).eq("job_id", id).maybeSingle(),
  ]);
  if (!job) notFound();

  const today = todayLondon();
  const student = toStudent(profile);
  const coverage = coverageFor(job, cv?.parsed ?? null, student.skills);
  const fit = scoreFit(student, job, coverage, today);
  const band = findabilityBand(coverage);
  const stuffing = cv
    ? shouldWarnStuffing({
      weighted: coverage.weighted,
      clicheSeverity: clicheDensity(cv.rawText ?? "").severity,
      stuffed: keywordStuffing(cv.rawText ?? "", coverage.items.flatMap((c) => c.anyOf?.length ? c.anyOf : [c.skill])),
    })
    : false;
  const status = (app?.status as string | undefined) ?? null;
  const alreadyApplied = isPastSaved(status);
  const stored = (app?.tailored_json ?? null) as StoredTailoring | null;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/feed" className="self-start text-sm font-semibold text-[#5B3DF5] no-underline hover:underline">← Back to your feed</Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <article className="flex min-w-0 flex-col gap-3 rounded-[20px] border bg-white p-5 sm:p-6">
          <CompanyMark company={job.company} url={job.url} size="lg" />
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{job.title}</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            {job.location || "Location not stated"} · <span className="text-[#8A4B00]">{closingLabel(job, today)}</span>
          </p>
          {job.summary && !summaryRepeatsText(job.summary, job.textLines) && <p className="rounded-xl bg-[#F6F6FA] p-3 text-[15px] text-[#4A4A57]">{job.summary}</p>}
          {job.textLines.length ? <JobText lines={job.textLines} /> : <p className="text-muted-foreground">The full description is on the company&apos;s site.</p>}
        </article>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <section className="flex flex-col gap-3 rounded-[20px] border bg-white p-5" aria-label="How you match">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <FitBadge label={fit.label} score={fit.global} />
                <span className="chip-xp">+{applyXp(fit.label)} XP</span>
              </div>
              <SaveButton key={status === null ? "unsaved" : "saved"} jobId={job.id} initiallySaved={status !== null} />
            </div>
            {fit.gates.filter((g) => !g.passed).map((g) => (
              <p key={g.key} className="rounded-xl bg-[#FFF1DC] px-3 py-2 text-sm font-semibold text-[#7A4100]">{g.reason}</p>
            ))}
            {fit.softFlags.map((f) => <p key={f} className="text-sm text-[#7A4100]">{f}</p>)}
            <ExplainPanel jobId={job.id}>
              <div className="flex flex-col gap-1 rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">Findability</span>
                  {band
                    ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${BAND_TONE[band]}`}>{band}</span>
                    : <span className="text-xs text-muted-foreground">Couldn&apos;t read the requirements</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {band ? FINDABILITY_HINT[band] : "This posting doesn't list skills we can match."} How easily a keyword search would surface your CV for this role.
                </p>
                {stuffing && (
                  <p className="mt-1 rounded-lg bg-[#FFF1DC] px-2.5 py-2 text-xs font-semibold text-[#7A4100]" role="note">
                    Your CV matches almost every keyword, but it reads as keyword-heavy or full of stock phrases. Recruiters read CVs too: show each skill once, in a real example.
                  </p>
                )}
              </div>
            </ExplainPanel>
          </section>

          <TailorPanel
            jobId={job.id}
            hasCv={Boolean(cv)}
            original={{ skills: cv?.parsed.skills ?? [], summary: cv?.parsed.summary ?? null }}
            initial={stored?.v === 1 && stored.outcome ? { outcome: stored.outcome, final: stored.final ?? null } : null}
          />

          {env.autopilot && <AutopilotPanel jobId={job.id} />}

          <section className="flex flex-col gap-2 rounded-[20px] border bg-white p-5">
            <ApplyButton jobId={job.id} url={safeHttpUrl(job.url)} company={job.company} alreadyApplied={alreadyApplied} />
          </section>

          <PeoplePanel
            company={job.company} title={job.title} jobId={job.id}
            initialTarget={OUTREACH_TARGETS.find((t) => t === sp.target)}
            initialPurpose={(["intro", "follow_up", "interview_prep"] as OutreachPurpose[]).find((p) => p === sp.purpose)}
          />
        </aside>
      </div>
      {alreadyApplied && <InterviewPrepPanel jobId={job.id} company={job.company} hasCv={Boolean(cv)} />}
    </div>
  );
}

/** Many summaries are just the posting's opening words cut short: showing them above the full text repeats it. */
function summaryRepeatsText(summary: string, lines: string[]): boolean {
  const norm = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();
  const head = norm(lines.slice(0, 5).join(" "));
  const s = norm(summary).replace(/[.…\s]+$/, "");
  return s.length > 0 && head.includes(s);
}
