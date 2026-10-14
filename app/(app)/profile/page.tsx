import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/db/queries";
import { scoreCv } from "@/lib/cv-score/run";
import { uploadScoringInFlight } from "@/lib/cv-score/defer";
import { loadCvScorePanel, type CvScorePanelData } from "@/lib/cv-score/panel-data";
import { roleCards } from "@/lib/quiz/view";
import { ARCHETYPES, YEARS, type Archetype, type Year } from "@/lib/types";
import { CvScorePanel } from "@/components/cv-score-panel";
import { MythCard } from "@/components/myth-card";
import { SectorSelect } from "./sector-select";
import { ScoreNowButton } from "./score-now-button";
import { scoreMyCv } from "./actions";

export const metadata: Metadata = { title: "Your profile · Placed" };

function RetryScoreForm({ sector }: { sector: Archetype }) {
  return (
    <form action={scoreMyCv}>
      <input type="hidden" name="sector" value={sector} />
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
  supabase: SupabaseClient; userId: string; cvId: string; sector: Archetype; year: Year; failed: boolean; uploadScoring: boolean;
}) {
  const base = { userId: p.userId, cvId: p.cvId, sector: p.sector, year: p.year };
  let data: CvScorePanelData | null = await loadCvScorePanel(p.supabase, base);
  if (!data && p.uploadScoring && !p.failed) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-3 rounded-[20px] border border-[#E6E6EF] bg-white p-5">
        <h2 className="text-base font-bold">Your CV Score</h2>
        <p className="text-sm font-semibold text-[#3A20C4]">Scoring your CV…</p>
        <p className="text-sm text-[#5B5B6B]">
          This takes up to a minute after an upload.{" "}
          <Link href="/profile" className="font-semibold underline underline-offset-2">Refresh</Link> to see your score.
        </p>
      </div>
    );
  }
  if (!data && !p.failed) {
    try {
      const score = await scoreCv(p.supabase, base);
      data = await loadCvScorePanel(p.supabase, { ...base, score });
    } catch (e) {
      console.error("profile: scoreCv failed", e);
    }
  }
  if (data) {
    return (
      <>
        <CvScorePanel data={data} />
        {data.aiUnavailable && <RetryScoreForm sector={p.sector} />}
      </>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-[#E6E6EF] bg-white p-5">
      <h2 className="text-base font-bold">Your CV Score</h2>
      <p className="text-sm text-[#5B5B6B]">
        {p.failed ? "Scoring didn't finish that time. Give it another go in a moment." : "We couldn't score your CV just now."}
      </p>
      <RetryScoreForm sector={p.sector} />
    </div>
  );
}

function ScoreLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3 rounded-[20px] border border-[#E6E6EF] bg-white p-5">
      <h2 className="text-base font-bold">Your CV Score</h2>
      <p className="text-sm font-semibold text-[#3A20C4]">Scoring your CV against recruiter guidance…</p>
      <div className="h-28 animate-pulse rounded-xl bg-[#F6F6FA] motion-reduce:animate-none" />
    </div>
  );
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ warn?: string; score?: string }> }) {
  const { warn, score } = await searchParams;
  const { supabase, user } = await requireUser();
  const [p, cvRes] = await Promise.all([
    getProfile(supabase, user.id),
    supabase.from("cvs").select("id, uploaded_at").eq("user_id", user.id).eq("is_active", true).maybeSingle<{ id: string; uploaded_at: string | null }>(),
  ]);
  const cv = cvRes.data;
  const roles = roleCards(p.archetypes);
  const target = p.target_archetype && (ARCHETYPES as readonly string[]).includes(p.target_archetype) ? p.target_archetype : null;
  const sector: Archetype = target ?? roles[0]?.key ?? "consulting";
  const year: Year = p.year && (YEARS as readonly string[]).includes(p.year) ? p.year : "2nd";
  const uploadScoring = cv ? uploadScoringInFlight({ uploadedAt: cv.uploaded_at, sector, target }) : false;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
      <aside className="flex min-w-0 flex-col gap-4" aria-label="CV Score">
        {cv ? (
          <Suspense key={`${cv.id}-${sector}`} fallback={<ScoreLoading />}>
            <ScoreSection supabase={supabase} userId={user.id} cvId={cv.id} sector={sector} year={year} failed={score === "failed"} uploadScoring={uploadScoring} />
          </Suspense>
        ) : (
          <div className="card-quest flex flex-col gap-3 p-5">
            <h2 className="text-base font-bold">No CV Score yet</h2>
            <p className="text-sm text-[#5B5B6B]">Upload your CV and we&apos;ll score it against cited recruiter guidance for your sector.</p>
            <Link href="/profile/build" className="btn-quest flex min-h-12 items-center justify-center py-3">Upload your CV</Link>
          </div>
        )}
        <Link href="/profile/linkedin" className="card-quest flex flex-col gap-1 p-5 no-underline hover:bg-[#F8F7FF]">
          <span className="text-base font-bold">Score your LinkedIn</span>
          <span className="text-sm text-[#5B5B6B]">Paste your profile link: we check it matches your CV and how it reads to a recruiter for your sector.</span>
        </Link>
        <MythCard />
      </aside>

      <section className="flex min-w-0 flex-col gap-4" aria-labelledby="roles-h">
        {warn === "image" && (
          <p role="note" className="rounded-2xl border border-[#F5D9A8] bg-[#FFF1DC] px-4 py-3 text-sm font-semibold text-[#7A4100]">
            Your PDF looks like an image, so screening software can&apos;t read it. Export it as a text PDF, or{" "}
            <Link href="/profile/quiz" className="underline underline-offset-2">take the quiz</Link> to keep going.
          </p>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="roles-h" className="text-[28px] font-extrabold tracking-tight">Roles that fit you</h1>
            {roles.length > 0 && <p className="text-sm text-[#5B5B6B]">Ranked by fit with your {cv ? "CV" : "quiz answers"}.</p>}
          </div>
          {cv && <SectorSelect key={sector} value={sector} />}
        </div>

        {roles.length > 0 ? (
          <ol className="flex flex-col gap-3">
            {roles.map((r) => (
              <li key={r.key} className="flex items-start gap-4 rounded-[18px] border border-[#E6E6EF] bg-white p-5">
                <span className="num-quest flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[#EFEBFF] text-lg text-[#3A20C4]" aria-hidden="true">{r.score}%</span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="text-lg font-bold">
                    {r.title}<span className="sr-only"> — {r.score}% match</span>
                  </h2>
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

        <div className="flex flex-wrap gap-3">
          <Link href="/feed" className="btn-quest flex min-h-12 items-center px-6 py-3">See my internships</Link>
          {cv ? (
            <Link href="/profile/build" className="flex min-h-12 items-center rounded-[14px] border-2 px-5 py-3 font-bold">Upload a new CV</Link>
          ) : roles.length > 0 && (
            <Link href="/profile/quiz" className="flex min-h-12 items-center rounded-[14px] border-2 px-5 py-3 font-bold">Retake the quiz</Link>
          )}
        </div>
      </section>
    </div>
  );
}
