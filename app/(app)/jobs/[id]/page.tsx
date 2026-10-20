import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { universityFor } from "@/lib/profile/university";
import { db } from "@/lib/db/client";
import { applications, profiles } from "@/lib/db/schema";
import { getActiveCv, getJob, getProfile, toStudent } from "@/lib/db/queries";
import { coverageFor } from "@/lib/scoring/coverage";
import { displayLabel, scoreFit } from "@/lib/scoring/fit";
import { cvGradeOf } from "@/lib/scoring/eligibility";
import { hasEligibilityOverride } from "@/lib/feed/overrides";
import { closingLabel, todayLondon } from "@/lib/scoring/dates";
import { FINDABILITY_HINT, FINDABILITY_NOTE, findabilityBand, keywordStuffing, shouldWarnStuffing } from "@/lib/scoring/requirements";
import { clicheDensity } from "@/lib/cv/cliches";
import { env } from "@/lib/env";
import { isUuid } from "@/lib/feed/save-result";
import { applyXp } from "@/lib/feed/rank";
import { EligibilityCheck } from "./eligibility-check";
import { safeHttpUrl } from "@/lib/text/url";
import { CompanyMark } from "@/components/company-mark";
import { CuratedChip } from "@/components/curated-chip";
import { curatedDetail } from "@/lib/jobs/detail";
import { isPastSaved } from "@/lib/tracker/status";
import { FitBadge } from "@/components/fit-badge";
import { SaveButton } from "@/components/save-button";
import { ExplainPanel } from "./explain-panel";
import { ApplyButton } from "./apply-button";
import { TailorPanel } from "./tailor-panel";
import { InterviewPrepPanel } from "./interview-prep-panel";
import { SpringPrepPanel } from "./spring-prep-panel";
import { springPrep } from "@/lib/interview-prep/spring";
import { PlacementPrepPanel } from "./placement-prep-panel";
import { placementPrep } from "@/lib/interview-prep/placement";
import { CoverLetterButton, CoverLetterHost } from "@/components/cover-letter/cover-letter-host";
import { AutopilotHost } from "@/components/autopilot-chat/autopilot-host";
import { AutopilotStartCard } from "@/components/autopilot-chat/autopilot-start-card";
import type { StoredTailoring } from "./actions";
import { isStale } from "@/lib/bank/tailor-context";
import { PeoplePanel } from "@/components/outreach/people-panel";
import { InsideTrack, WriteToSomeoneElse } from "@/components/inside-track/inside-track";
import { OUTREACH_TARGETS } from "@/lib/outreach/targets";
import type { OutreachPurpose } from "@/lib/outreach/draft";

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
  const { user } = await requireUser();
  if (!isUuid(id)) notFound();
  const [job, profile, cv] = await Promise.all([getJob(id), getProfile(user.id), getActiveCv(user.id)]);
  const app = db.select({ status: applications.status, tailored_json: applications.tailored_json }).from(applications)
    .where(and(eq(applications.user_id, user.id), eq(applications.job_id, id))).get();
  if (!job) notFound();

  const today = todayLondon();
  const student = toStudent(profile);
  const coverage = coverageFor(job, cv?.parsed ?? null, student.skills);
  const course = db.select({ course: profiles.course }).from(profiles).where(eq(profiles.user_id, user.id)).get()?.course ?? null;
  const fit = scoreFit(student, job, coverage, today, { cvGrade: cvGradeOf(cv?.parsed), course, overridden: hasEligibilityOverride(user.id, job.id) });
  const band = findabilityBand(coverage);
  const stuffing = cv
    ? shouldWarnStuffing({
      weighted: coverage.weighted,
      clicheSeverity: clicheDensity(cv.rawText ?? "").severity,
      stuffed: keywordStuffing(cv.rawText ?? "", coverage.items.flatMap((c) => c.anyOf?.length ? c.anyOf : [c.skill])),
    })
    : false;
  const status = app?.status ?? null;
  const alreadyApplied = isPastSaved(status);
  const spring = springPrep(user.id, job);
  const placement = placementPrep(user.id, job);
  const stored = (app?.tailored_json ?? null) as StoredTailoring | null;
  const school = universityFor(user.id);
  const detail = curatedDetail(job, env.autopilot);
  // Tracker nudges open the drafter on a preset target and purpose (?target=…&purpose=…#people).
  const drafterStart = {
    initialTarget: OUTREACH_TARGETS.find((t) => t === sp.target),
    initialPurpose: (["intro", "follow_up", "interview_prep"] as OutreachPurpose[]).find((p) => p === sp.purpose),
  };

  return (
    <div className="flex flex-col gap-4">
      <Link href="/feed" className="self-start text-sm font-semibold text-[#5B3DF5] no-underline hover:underline">← Back to your feed</Link>
      {detail.showAutopilot && <AutopilotHost jobId={job.id} />}
      <CoverLetterHost jobId={job.id} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <article className="flex min-w-0 flex-col gap-3 rounded-[20px] border bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <CompanyMark company={job.company} url={job.url} size="lg" />
            {detail.curated && <CuratedChip />}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{job.title}</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            {job.location || "Location not stated"} · <span className="text-[#8A4B00]">{closingLabel(job, today)}</span>
          </p>
          <CoverLetterButton />
          {job.summary && !summaryRepeatsText(job.summary, job.textLines) && <p className="rounded-xl bg-[#F6F6FA] p-3 text-[15px] text-[#4A4A57]">{job.summary}</p>}
          {job.textLines.length ? <JobText lines={job.textLines} /> : <p className="text-muted-foreground">The full description is on the company&apos;s site.</p>}
        </article>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <section className="flex flex-col gap-3 rounded-[20px] border bg-white p-5" aria-label="How you match">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <FitBadge label={displayLabel(fit)} score={fit.global} />
                <span className="chip-xp">+{applyXp()} XP</span>
              </div>
              <SaveButton key={status === null ? "unsaved" : "saved"} jobId={job.id} initiallySaved={status !== null} />
            </div>
            <EligibilityCheck jobId={job.id} gates={fit.gates} />
            {fit.mustCap && <p className="text-sm text-[#7A4100]">{fit.mustCap}, so this reads as a stretch at best.</p>}
            {fit.softFlags.map((f) => <p key={f} className="text-sm text-[#7A4100]">{f}</p>)}
            {fit.notes.map((n) => <p key={n} className="text-sm text-[#5B5B6B]">{n}</p>)}
            <ExplainPanel jobId={job.id}>
              <div className="flex flex-col gap-1 rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">Findability</span>
                  {band
                    ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${BAND_TONE[band]}`}>{band}</span>
                    : !detail.unscoredNote && <span className="text-xs text-muted-foreground">Couldn&apos;t read the requirements</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {band ? FINDABILITY_HINT[band] : detail.unscoredNote ? `${detail.unscoredNote}.` : "This posting doesn't list skills we can match."} How easily a keyword search would surface your CV for this role.{band ? ` ${FINDABILITY_NOTE}` : ""}
                </p>
                {stuffing && (
                  <p className="mt-1 rounded-lg bg-[#FFF1DC] px-2.5 py-2 text-xs font-semibold text-[#7A4100]" role="note">
                    Your CV repeats some keywords many times or leans on stock phrases. Recruiters read CVs too: show each skill once, in a real example.
                  </p>
                )}
              </div>
            </ExplainPanel>
          </section>

          <TailorPanel
            jobId={job.id}
            hasCv={Boolean(cv)}
            original={{ skills: cv?.parsed.skills ?? [], summary: cv?.parsed.summary ?? null }}
            initial={stored?.outcome
              ? {
                outcome: stored.outcome, final: stored.final ?? null,
                bank: stored.v === 2 ? { report: stored.report, stale: isStale(user.id, stored), newCvSuggestions: 0 } : null,
              }
              : null}
          />

          {detail.showAutopilot && <AutopilotStartCard />}

          <section className="flex flex-col gap-2 rounded-[20px] border bg-white p-5">
            <ApplyButton jobId={job.id} url={safeHttpUrl(job.url)} company={job.company} alreadyApplied={alreadyApplied} curated={detail.curated} />
          </section>

          {alreadyApplied ? (
            <>
              <Suspense fallback={<section id="inside-track" className="rounded-[20px] border bg-white p-5 text-sm text-muted-foreground">Finding people at {job.company}…</section>}>
                <InsideTrack company={job.company} title={job.title} jobId={job.id} school={school} />
              </Suspense>
              <WriteToSomeoneElse jobId={job.id} school={school} {...drafterStart} />
            </>
          ) : (
            <PeoplePanel company={job.company} title={job.title} jobId={job.id} school={school} {...drafterStart} />
          )}
        </aside>
      </div>
      {/* Spring weeks get their own prep before applying too: video interviews often land within days of the form. */}
      {spring ? <SpringPrepPanel {...spring} />
        : alreadyApplied && <InterviewPrepPanel jobId={job.id} company={job.company} hasCv={Boolean(cv)} />}
      {/* Placements: local practice (bank, video, STAR stories) alongside the researched pack, before applying too. */}
      {placement && <PlacementPrepPanel {...placement} />}
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
