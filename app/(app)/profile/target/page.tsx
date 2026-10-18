import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { confirmedFacts, cvScores, playbookProgress } from "@/lib/db/schema";
import { scoreTrackFor } from "@/lib/profile/cycle";
import { getActiveCv, getProfile } from "@/lib/db/queries";
import { todayLondon } from "@/lib/scoring/dates";
import { buildTargetView, targetFor, type ProgressRow, type TargetView } from "@/lib/target/view";
import type { DemandJob } from "@/lib/target/market";
import { getFeedJobs } from "@/lib/feed/jobs-cache";
import { lastIngestAt } from "@/lib/ingest/local";
import type { PickedAction } from "@/lib/target/actions";
import { ARCHETYPE_LABELS } from "@/lib/types";
import { ActionCard } from "@/components/target/action-card";
import { SignalCard } from "@/components/target/signal-card";
import { SkillConfirm } from "@/components/target/skill-confirm";
import { CountUp, DrawCircle, GrowBar } from "@/components/agent/reveal";
import { SectorSelect } from "../sector-select";
import { ProfileTabs } from "../tabs";

export const metadata: Metadata = { title: "Target role · Placed" };

const STATUS_CHIP = {
  existing: { text: "On your CV", cls: "bg-[#E3F6EE] text-[#0E6B4A]" },
  supportedByResume: { text: "Hidden on your CV", cls: "bg-[#FFF1DC] text-[#7A4100]" },
  gap: { text: "Not shown yet", cls: "bg-[#F0F0F5] text-[#5B5B6B]" },
} as const;

/** A failed read still renders the page, with no saved progress. */
function loadProgress(userId: string): ProgressRow[] {
  try {
    return db.select({ action_id: playbookProgress.action_id, status: playbookProgress.status, evidence_note: playbookProgress.evidence_note, evidence_url: playbookProgress.evidence_url })
      .from(playbookProgress).where(eq(playbookProgress.user_id, userId)).all();
  } catch (e) {
    console.error("target: playbook_progress read failed", e instanceof Error ? e.message : e);
    return [];
  }
}

function Ring({ pct, label }: { pct: number | null; label: string }) {
  return (
    <div className="flex items-center gap-4">
      <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0" role="img" aria-label={pct === null ? label : `${pct}% — ${label}`}>
        <circle cx="60" cy="60" r="52" fill="none" stroke="#ECECF3" strokeWidth="12" />
        {pct !== null && (
          <g transform="rotate(-90 60 60)"><DrawCircle cx={60} cy={60} r={52} value={pct / 100} stroke="#5B3DF5" strokeWidth={12} /></g>
        )}
        <text x="60" y="68" textAnchor="middle" className="num-quest" fontSize="28" fill="currentColor">{pct === null ? "—" : <><CountUp to={pct} duration={1.1} />%</>}</text>
      </svg>
      <p className="text-sm font-semibold text-[#5B5B6B]">{label}. <span className="font-normal">This isn&apos;t your chance of being hired. It&apos;s how much of what these roles ask for your CV shows.</span></p>
    </div>
  );
}

function Section({ id, title, sub, children }: { id: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div>
        <h2 id={id} className="text-xl font-extrabold tracking-tight">{title}</h2>
        {sub && <p className="text-sm text-[#5B5B6B]">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function builds(v: TargetView, a: PickedAction) {
  const s = v.signals.find((x) => a.signals.includes(x.id));
  return s ? (s.text.length > 110 ? `${s.text.slice(0, 107)}…` : s.text) : null;
}

function Steps({ v, role }: { v: TargetView; role: string }) {
  const { visible, bullets, gaps } = v.plan;
  const titleOf = new Map([...v.actions, ...v.topUp].map((a) => [a.id, a.title]));
  let n = 0;
  return (
    <ol className="flex flex-col gap-5">
      {visible.length > 0 && (
        <li className="flex flex-col gap-2">
          <h3 className="font-bold"><span className="num-quest mr-2 text-[#3A20C4]">{++n}.</span>Show what you already have</h3>
          <p className="text-sm text-[#5B5B6B]">Your CV already has evidence for these. Recruiters and screening software just can&apos;t see it where it is now.</p>
          <ul className="flex flex-col gap-2">
            {visible.map((s) => (
              <li key={s.skill} className="rounded-[14px] border border-[#E6E6EF] bg-white p-3 text-sm">
                <span className="font-bold">{s.skill}</span> <span className="text-[#5B5B6B]">· in {s.jobs} of {s.n} roles{s.section === "must" ? ", usually a must-have" : ""}</span>
                <p className="mt-1">{s.text}</p>
              </li>
            ))}
          </ul>
        </li>
      )}
      {bullets.length > 0 && (
        <li className="flex flex-col gap-2">
          <h3 className="font-bold"><span className="num-quest mr-2 text-[#3A20C4]">{++n}.</span>Sharpen these bullets</h3>
          <p className="text-sm text-[#5B5B6B]">Steps marked <em>only if true</em> are questions: never add a tool or a number you can&apos;t back up. Tailoring checks every claim against your CV and the facts you&apos;ve confirmed, and asks you to confirm every number.</p>
          <ul className="flex flex-col gap-2">
            {bullets.map((b) => (
              <li key={b.bulletId} className="flex flex-col gap-2 rounded-[14px] border border-[#E6E6EF] bg-white p-3">
                <p className="text-xs font-semibold text-[#5B5B6B]">{b.entryLabel}</p>
                <blockquote className="border-l-4 border-[#E6E6EF] pl-3 text-sm">{b.text}</blockquote>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {b.tips.map((t) => (
                    <li key={t.kind} className="flex gap-2">
                      <span aria-hidden="true" className="text-[#3A20C4]">→</span>
                      <span>{t.ask && <span className="mr-1.5 rounded-full bg-[#FFF1DC] px-1.5 py-0.5 text-xs font-bold text-[#7A4100]">only if true</span>}{t.text}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </li>
      )}
      {gaps.length > 0 && (
        <li className="flex flex-col gap-2">
          <h3 className="font-bold"><span className="num-quest mr-2 text-[#3A20C4]">{++n}.</span>Skills {role} roles want that your CV doesn&apos;t show</h3>
          <ul className="flex flex-col gap-2">
            {gaps.map((g) => {
              const ways = (v.actionsFor[g.skill] ?? []).map((id) => ({ id, title: titleOf.get(id) })).filter((w) => w.title);
              return (
                <li key={g.skill} className="flex flex-col gap-2 rounded-[14px] border border-[#E6E6EF] bg-white p-3 text-sm">
                  <p>
                    <span className="font-bold">{g.skill}</span> <span className="text-[#5B5B6B]">· in {g.jobs} of {g.n} roles{g.section === "must" ? ", usually a must-have" : ""}</span>
                    {g.status === "confirmed" && <span className="ml-2 rounded-full bg-[#E3F6EE] px-2 py-0.5 text-xs font-bold text-[#0E6B4A]">You confirmed it</span>}
                  </p>
                  <p>{g.text}</p>
                  {g.status === "gap" && <SkillConfirm options={g.options} />}
                  {g.status === "gap" && ways.length > 0 && (
                    <p className="text-[#5B5B6B]">Ways to get it: {ways.map((w, k) => <span key={w.id}>{k > 0 && ", "}<a href={`#${w.id}`} className="font-semibold text-[#3A20C4] underline underline-offset-2">{w.title}</a></span>)}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      )}
      {n === 0 && <li className="text-sm text-[#5B5B6B]">Your CV already shows everything these roles ask for most. Keep tailoring it for each application.</li>}
    </ol>
  );
}

export default async function TargetRolePage() {
  const { user } = await requireUser();
  const today = todayLondon();

  const [p, cv] = await Promise.all([getProfile(user.id), getActiveCv(user.id)]);
  const progress = loadProgress(user.id);
  const facts = db.select({ claim: confirmedFacts.claim }).from(confirmedFacts).where(eq(confirmedFacts.user_id, user.id)).all();
  const { sector, year } = targetFor(p);
  // The cached feed jobs already carry parsed JD skills; reading up to 1000 raw rows (with text_lines) and re-parsing them made every visit slow.
  const feedJobs = await getFeedJobs(today, lastIngestAt()).catch((e: unknown) => { console.error("target: jobs read failed", e); return []; });
  const score = cv
    ? db.select({ total: cvScores.total }).from(cvScores)
      .where(and(eq(cvScores.user_id, user.id), eq(cvScores.cv_id, cv.id), eq(cvScores.sector, sector),
        eq(cvScores.track, scoreTrackFor({ year, gradYear: p.grad_year }, today)))).get() ?? null
    : null;
  const jobs: DemandJob[] = feedJobs.filter((j) => j.archetype === sector)
    .map((j) => ({ id: j.id, archetype: j.archetype, is_live: true, deadline: j.deadline, skills: j.jdSkills }));

  const v = buildTargetView({
    sector, year, today, cv: cv?.parsed ?? null, profileSkills: p.skills ?? [], progress,
    jobs, confirmedClaims: facts.map((f) => f.claim),
  });
  const role = ARCHETYPE_LABELS[sector];

  return (
    <>
      <ProfileTabs active="/profile/target" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">How strong is your CV for {role}?</h1>
          <p className="text-sm text-[#5B5B6B]">From the live roles we scan and cited employer guidance. Nothing here changes your CV for you.</p>
        </div>
        <SectorSelect key={sector} value={sector} label="I want to work in" />
      </div>
      {v.source === "profile" && (
        <p role="note" className="mb-4 rounded-2xl border border-[#F5D9A8] bg-[#FFF1DC] px-4 py-3 text-sm font-semibold text-[#7A4100]">
          Based on your quiz. <Link href="/profile/build" className="underline underline-offset-2">Upload a CV</Link> for a sharper picture and bullet-by-bullet steps.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="flex min-w-0 flex-col gap-4" aria-label="Readiness">
          <div className="card-quest flex flex-col gap-3 p-5">
            <h2 className="text-base font-bold">Readiness</h2>
            <Ring pct={v.pct} label={v.readinessLabel} />
            {v.plan.projected !== null && (
              <p className="rounded-xl bg-[#EFEBFF] px-3 py-2 text-sm font-semibold text-[#3A20C4]">
                {v.plan.projected}% once you add what you already have (step 1) and the skills you&apos;ve confirmed.
              </p>
            )}
          </div>
          {cv && (
            <Link href="/profile" className="flex items-center justify-between rounded-[18px] border border-[#E6E6EF] bg-white p-4 font-bold hover:bg-[#F6F6FA]">
              <span>{score ? <>CV Score <span className="num-quest">{score.total}/100</span> for {role}</> : <>Get your CV Score for {role}</>}</span>
              <span aria-hidden="true">→</span>
            </Link>
          )}
          {(v.guidance.line || v.guidance.dated.length > 0) && (
            <div className="rounded-[18px] border border-[#E6E6EF] bg-white p-4 text-sm">
              <h2 className="mb-1 font-bold">For your year</h2>
              {v.guidance.line && <p>{v.guidance.line}</p>}
              {v.guidance.dated.map((d) => <p key={d} className="mt-1.5">{d}</p>)}
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-8">
          <Section id="ask-h" title={`What ${role} internships ask for`}
            sub={v.demand.n === 0 ? `No live ${role} roles on the job boards we scan right now.`
              : v.demand.smallSample ? `Only ${v.demand.n} live ${role} roles on the job boards we scan right now, so no percentages.`
              : `Across ${v.demand.n} live, open roles on the job boards we scan.`}>
            {v.demand.items.length > 0 && (
              <ul className="flex flex-col gap-2">
                {v.demand.items.map((d, i) => {
                  const st = STATUS_CHIP[v.status[d.skill] ?? "gap"];
                  return (
                    <li key={d.skill} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {d.skill}
                        {d.section === "must" && <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs">must-have</span>}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${st.cls}`}>{st.text}</span>
                      </span>
                      <span className="text-xs text-[#5B5B6B]">in {d.jobs} of {v.demand.n} roles</span>
                      {!v.demand.smallSample && (
                        <div className="col-span-2 h-2 overflow-hidden rounded-full bg-[#ECECF3]" aria-hidden="true">
                          <GrowBar value={Math.round(d.share * 100) / 100} delay={Math.min(i, 8) * 0.05} className="h-full rounded-full bg-[#5B3DF5]" />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section id="steps-h" title="Make your CV stronger, step by step" sub="Most useful first. Each step either uses what your CV already proves or asks you; we never add anything for you.">
            <Steps v={v} role={role} />
          </Section>

          <Section id="get-h" title={v.fallback ? "Strengthen your profile" : "Not yet? How to get it"}
            sub="From our Role Playbook, filtered for your year. Marking one done asks what you did, in your own words.">
            {v.actions.length > 0 && (
              <ul className="flex flex-col gap-3">
                {v.actions.map((a) => <ActionCard key={a.id} action={a} builds={builds(v, a)} planned={v.planned.includes(a.id)} />)}
              </ul>
            )}
            {v.topUp.length > 0 && (
              <>
                <h3 className="mt-2 font-bold">Also worth doing</h3>
                <ul className="flex flex-col gap-3">
                  {v.topUp.map((a) => <ActionCard key={a.id} action={a} builds={builds(v, a)} planned={v.planned.includes(a.id)} />)}
                </ul>
              </>
            )}
          </Section>

          <Section id="signals-h" title="What employers look for" sub="Each with its evidence grade. Tap a source to read the exact quote.">
            <ul className="flex flex-col gap-2">{v.signals.map((s) => <SignalCard key={s.id} signal={s} />)}</ul>
          </Section>

          {v.done.length > 0 && (
            <details className="rounded-[18px] border border-[#E6E6EF] bg-white p-4">
              <summary className="cursor-pointer font-bold">You&apos;ve done {v.done.length}</summary>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {v.done.map((d) => (
                  <li key={d.id}><span className="font-semibold">{d.title}</span>{d.note && <span className="text-[#5B5B6B]"> — “{d.note}”</span>}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
