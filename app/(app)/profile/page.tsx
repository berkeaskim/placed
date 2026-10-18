import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { cvs } from "@/lib/db/schema";
import { getProfile } from "@/lib/db/queries";
import { scoreCv } from "@/lib/cv-score/run";
import { uploadScoringInFlight } from "@/lib/cv-score/defer";
import { loadCvScorePanel, type CvScorePanelData } from "@/lib/cv-score/panel-data";
import { roleCards } from "@/lib/quiz/view";
import { ARCHETYPES, YEARS, type Archetype, type Year } from "@/lib/types";
import { CvScorePanel } from "@/components/cv-score-panel";
import { MythCard } from "@/components/myth-card";
import { LiveScoring, ScoringSteps } from "@/components/cv-score/scoring-agent";
import { rulesFor } from "@/lib/cv-rules";
import { SectorSelect } from "./sector-select";
import type { Track } from "@/lib/cv-rules/types";
import { scoreTrackFor } from "@/lib/profile/cycle";
import { todayLondon } from "@/lib/scoring/dates";
import { ProfileTabs } from "./tabs";
import { ScoreNowButton } from "./score-now-button";
import { scoreMyCv } from "./actions";

export const metadata: Metadata = { title: "Your profile · Placed" };

const llmRuleCount = (sector: Archetype, track: Track = "standard") => rulesFor(sector, track).filter((r) => r.check === "llm").length;

function RetryScoreForm({ sector, track }: { sector: Archetype; track: Track }) {
  return (
    <form action={scoreMyCv}>
      <input type="hidden" name="sector" value={sector} />
      <input type="hidden" name="track" value={track} />
      <ScoreNowButton />
    </form>
  );
}

/**
 * /profile (spec §9 step 4): three role cards plus the CV Score panel. When the active CV has no score
 * for the selected sector yet, it is scored here (ruling C4); if that fails, a "Score my CV" button retries.
 * Within a minute of an upload the upload's own background scoring is still running for the target sector, so
 * the page waits for it instead of making a second live judge call (lib/cv-score/defer.ts).
 */
async function ScoreSection(p: {
  userId: string; cvId: string; sector: Archetype; year: Year; track: Track; failed: boolean; uploadScoring: boolean;
}) {
  const base = { userId: p.userId, cvId: p.cvId, sector: p.sector, year: p.year, track: p.track };
  let data: CvScorePanelData | null = await loadCvScorePanel(base);
  if (!data && p.uploadScoring && !p.failed) {
    return <LiveScoring llmRules={llmRuleCount(p.sector, p.track)} />;
  }
  if (!data && !p.failed) {
    try {
      const score = await scoreCv(base);
      data = await loadCvScorePanel({ ...base, score });
    } catch (e) {
      console.error("profile: scoreCv failed", e);
    }
  }
  if (data) {
    return (
      <>
        <CvScorePanel data={data} />
        {data.aiUnavailable && <RetryScoreForm sector={p.sector} track={p.track} />}
      </>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-[#E6E6EF] bg-white p-5">
      <h2 className="text-base font-bold">Your CV Score</h2>
      <p className="text-sm text-[#5B5B6B]">
        {p.failed ? "Scoring didn't finish that time. Give it another go in a moment." : "We couldn't score your CV just now."}
      </p>
      <RetryScoreForm sector={p.sector} track={p.track} />
    </div>
  );
}

function ScoreLoading({ sector, track }: { sector: Archetype; track: Track }) {
  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-[#E6E6EF] bg-white p-5">
      <h2 className="text-base font-bold">Your CV Score</h2>
      <ScoringSteps llmRules={llmRuleCount(sector, track)} />
    </div>
  );
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ warn?: string; score?: string; track?: string }> }) {
  const { warn, score, track: trackParam } = await searchParams;
  const { user } = await requireUser();
  const p = await getProfile(user.id);
  const cv = db.select({ id: cvs.id, uploaded_at: cvs.uploaded_at }).from(cvs).where(and(eq(cvs.user_id, user.id), eq(cvs.is_active, true))).get();
  const roles = roleCards(p.archetypes);
  const target = p.target_archetype && (ARCHETYPES as readonly string[]).includes(p.target_archetype) ? p.target_archetype : null;
  const sector: Archetype = target ?? roles[0]?.key ?? "consulting";
  const year: Year = p.year && (YEARS as readonly string[]).includes(p.year) ? p.year : "2nd";
  // Spring-week-eligible students are scored as spring applicants by default; either can switch (?track=).
  const defaultTrack = scoreTrackFor({ year, gradYear: p.grad_year }, todayLondon());
  const track: Track = trackParam === "spring" || trackParam === "standard" ? trackParam : defaultTrack;
  // Upload-time scoring only ever runs the default track.
  const uploadScoring = cv && track === defaultTrack ? uploadScoringInFlight({ uploadedAt: cv.uploaded_at, sector, target }) : false;

  return (
    <>
    <ProfileTabs active="/profile" />
    <div className="flex flex-col gap-8">
      {warn === "image" && (
        <p role="note" className="rounded-2xl border border-[#F5D9A8] bg-[#FFF1DC] px-4 py-3 text-sm font-semibold text-[#7A4100]">
          Your PDF looks like an image, so screening software can&apos;t read it. Export it as a text PDF, or{" "}
          <Link href="/profile/quiz" className="underline underline-offset-2">take the quiz</Link> to keep going.
        </p>
      )}

      <section className="flex flex-col gap-4" aria-label="CV Score">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight">Your CV, scored</h1>
            <p className="text-sm text-[#5B5B6B]">Checked against cited recruiter guidance. Fix the top one first.</p>
          </div>
          {cv && <SectorSelect key={sector} value={sector} />}
        </div>
        {cv && defaultTrack === "spring" && (
          <nav aria-label="Score for" className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-[#5B5B6B]">Score for:</span>
            {(["spring", "standard"] as const).map((t) => (
              <Link key={t} href={`/profile?track=${t}`} aria-current={track === t ? "true" : undefined}
                className={`rounded-full border px-3 py-1.5 font-semibold no-underline ${track === t ? "border-foreground bg-foreground text-white" : "bg-white text-foreground"}`}>
                {t === "spring" ? "Spring weeks" : "Internships"}
              </Link>
            ))}
          </nav>
        )}
        {cv ? (
          <Suspense key={`${cv.id}-${sector}-${track}`} fallback={<ScoreLoading sector={sector} track={track} />}>
            <ScoreSection userId={user.id} cvId={cv.id} sector={sector} year={year} track={track} failed={score === "failed"} uploadScoring={uploadScoring} />
          </Suspense>
        ) : (
          <div className="card-quest flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold">No CV Score yet</h2>
              <p className="text-sm text-[#5B5B6B]">Upload your CV and we&apos;ll score it against cited recruiter guidance for your sector.</p>
            </div>
            <Link href="/profile/build" className="btn-quest flex min-h-12 items-center justify-center px-6 py-3">Upload your CV</Link>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="roles-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="roles-h" className="text-xl font-extrabold tracking-tight">Roles that fit you</h2>
            {roles.length > 0 && <p className="text-sm text-[#5B5B6B]">Ranked by fit with your {cv ? "CV" : "quiz answers"}.</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            {cv ? (
              <Link href="/profile/build" className="flex min-h-12 items-center rounded-[14px] border-2 px-5 py-3 font-bold">Upload a new CV</Link>
            ) : roles.length > 0 && (
              <Link href="/profile/quiz" className="flex min-h-12 items-center rounded-[14px] border-2 px-5 py-3 font-bold">Retake the quiz</Link>
            )}
            <Link href="/feed" className="btn-quest flex min-h-12 items-center px-6 py-3">See my internships</Link>
          </div>
        </div>

        {roles.length > 0 ? (
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((r, i) => (
              <li key={r.key} className={`flex items-start gap-4 rounded-[18px] border bg-white p-5 ${i === 0 ? "border-[#CFC4FF] shadow-[0_2px_0_#E4DDFF]" : "border-[#E6E6EF]"}`}>
                <span className="num-quest flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[#EFEBFF] text-lg text-[#3A20C4]" aria-hidden="true">{r.score}%</span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-base font-bold leading-snug">
                    {r.title}<span className="sr-only"> — {r.score}% match</span>
                  </h3>
                  {r.why.length > 0 && (
                    <ul className="flex flex-col gap-0.5 text-sm text-[#5B5B6B]">{r.why.map((w) => <li key={w}>{w}</li>)}</ul>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="card-quest flex flex-col gap-3 p-5">
            <p className="font-bold">We don&apos;t know your roles yet</p>
            <p className="text-sm text-[#5B5B6B]">Upload a CV, or answer six quick questions about what you enjoy.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/profile/quiz" className="btn-quest flex min-h-12 items-center px-5 py-3">Take the 1-minute quiz</Link>
              {!cv && <Link href="/profile/build" className="flex min-h-12 items-center rounded-[14px] border-2 px-5 py-3 font-bold">Upload a CV</Link>}
            </div>
          </div>
        )}
      </section>

      <MythCard />
    </div>
    </>
  );
}
