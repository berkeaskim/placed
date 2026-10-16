import { ARCHETYPE_LABELS } from "@/lib/types";
import type { LiDimension } from "@/lib/linkedin-rules/types";
import type { LiFix } from "@/lib/linkedin-score/aggregate";
import type { LiPanelData } from "@/lib/linkedin-score/run";
import { barColor, rulesPassedLabel, sourceChip } from "@/lib/cv-score/present";

/**
 * LinkedIn Score panel (playbook §3.7). Pure presentation: rendered from the upload result on the client and
 * from the latest saved row on the server. Order: sector banner → caps → risks → next fix → score → more fixes →
 * presence tips (unscored) → what we read.
 */

const DIMS: Exclude<LiDimension, "presence">[] = ["integrity", "proof", "findability", "narrative", "polish"];
export const LI_DIM_LABEL: Record<LiDimension, string> = {
  integrity: "Matches your CV", proof: "Proof of work", findability: "Findability", narrative: "About & story", polish: "Polish", presence: "Presence",
};
const LEVEL_LABEL = { low: "Low", "medium-low": "Medium-low", medium: "Medium", high: "High" } as const;
const LABEL_STYLE: Record<LiPanelData["label"], { bg: string; fg: string }> = {
  Ready: { bg: "#E3F6EE", fg: "#0B6B49" }, "Nearly there": { bg: "#E6EEFF", fg: "#2340A8" },
  "Needs work": { bg: "#FFF1DC", fg: "#7A4100" }, Starter: { bg: "#FDE7E1", fg: "#9A2E0B" },
};
const RING = 327;
const PARSE_WARNING: Record<string, string> = {
  top_card_guessed: "We guessed where your name and headline are. Check the headline below is right.",
  no_headline: "We couldn't find your headline.",
  no_experience_section: "We couldn't find an Experience section on your profile.",
  no_education_section: "We couldn't find an Education section on your profile.",
  experience_unparsed: "We found an Experience section but couldn't read its dates.",
};

function Source({ fix }: { fix: LiFix }) {
  const chip = sourceChip(fix);
  const pill = "inline-flex items-center gap-1 rounded-lg bg-[#F2F2F7] px-2.5 py-1 text-xs font-semibold text-[#3F3F4C]";
  if (!chip.href) return <span className={`${pill} self-start`}>{chip.label}</span>;
  return (
    <a href={chip.href} target="_blank" rel="noopener noreferrer" title={fix.citation?.title} className={`${pill} self-start no-underline hover:bg-[#E9E9F1]`}>
      {chip.label}<span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function FixBody({ fix }: { fix: LiFix }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-[#5B5B6B]">{LI_DIM_LABEL[fix.dimension]}</span>
        {(fix.evidence === "C" || fix.evidence === "D") && (
          <span className="rounded-full border border-[#DCDCE6] px-2 py-0.5 text-[11px] font-semibold text-[#5B5B6B]" title="Evidence C or D: widely given advice rather than measured">Convention</span>
        )}
        {fix.lostPoints > 0 && <span className="chip-xp ml-auto">+{fix.lostPoints} pts</span>}
      </div>
      {fix.evidenceLine && (
        <blockquote className="rounded-xl border-l-4 border-[#5B3DF5] bg-[#F6F6FA] px-3 py-2 text-sm leading-snug break-words">“{fix.evidenceLine}”</blockquote>
      )}
      <p className="text-sm leading-snug">{fix.statement}</p>
      <Source fix={fix} />
      {fix.fix && <p className="rounded-xl bg-[#EFEBFF] px-3 py-2 text-sm font-medium leading-snug break-words"><span className="font-semibold">Try this: </span>{fix.fix}</p>}
    </>
  );
}

export function LinkedInScorePanel({ data }: { data: LiPanelData }) {
  const label = ARCHETYPE_LABELS[data.sector];
  const risks = data.fixes.filter((f) => f.risk);
  const others = data.fixes.filter((f) => !f.risk);
  const [next, ...rest] = others;
  const style = LABEL_STYLE[data.label];
  const dash = Math.round((Math.min(100, Math.max(0, data.total)) / 100) * RING);

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="rounded-2xl bg-[#F6F6FA] px-4 py-3 text-sm text-[#3F3F4C]">
        <b>How much LinkedIn matters for {label}: {LEVEL_LABEL[data.importance.level]}.</b> {data.importance.note}
      </p>

      {data.capsApplied.map((c) => (
        <p key={c} role="note" className="rounded-2xl border border-[#F5D9A8] bg-[#FFF1DC] px-4 py-3 text-sm font-semibold text-[#7A4100]">{c}</p>
      ))}

      {risks.length > 0 && (
        <section aria-labelledby="li-risk-h" className="flex flex-col gap-3 rounded-[20px] border-2 border-[#F2B8A6] bg-[#FFF6F3] p-5">
          <h3 id="li-risk-h" className="text-base font-bold text-[#9A2E0B]">Fix these first</h3>
          <p className="text-sm text-[#5B5B6B]">These could actively cost you an offer if a recruiter compares your profile with your application.</p>
          <ol className="flex flex-col gap-3">
            {risks.map((f) => <li key={f.ruleId} className="flex flex-col gap-2 border-t border-[#F5D5CB] pt-3 first:border-t-0 first:pt-0"><FixBody fix={f} /></li>)}
          </ol>
        </section>
      )}

      {next && (
        <section aria-labelledby="li-next-h" className="card-quest flex flex-col gap-3 p-5">
          <h3 id="li-next-h" className="text-base font-bold">Next best fix</h3>
          <FixBody fix={next} />
        </section>
      )}

      <section aria-labelledby="li-score-h" className="flex flex-col gap-4 rounded-[20px] border border-[#E6E6EF] bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 id="li-score-h" className="text-base font-bold">Your LinkedIn Score</h2>
          <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: style.bg, color: style.fg }}>{data.label}</span>
        </div>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="flex shrink-0 flex-col items-center gap-1">
            <svg width="112" height="112" viewBox="0 0 120 120" role="img" aria-label={`LinkedIn score ${data.total} out of 100 for ${label}`}>
              <circle cx="60" cy="60" r="52" fill="none" stroke="#ECECF3" strokeWidth="12" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="#0A66C2" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} ${RING}`} transform="rotate(-90 60 60)" />
              <text x="60" y="66" textAnchor="middle" fontSize="34" fontWeight="700" fill="#16161D" style={{ fontFamily: "var(--font-quest)" }}>{data.total}</text>
              <text x="60" y="84" textAnchor="middle" fontSize="12" fontWeight="600" fill="#5B5B6B">/100</text>
            </svg>
            <p className="text-center text-sm font-semibold"><span className="num-quest">{data.total}/100</span> for {label}</p>
          </div>
          <div className="flex w-full flex-1 flex-col gap-2 text-xs">
            {DIMS.map((d) => {
              const v = data.dimensions[d];
              return (
                <div key={d} className="flex flex-col gap-0.5">
                  <div className="flex justify-between"><span>{LI_DIM_LABEL[d]}</span><b>{v ?? "—"}</b></div>
                  <div className="h-[5px] rounded-full bg-[#ECECF3]">{v !== null && <div className="h-[5px] rounded-full" style={{ width: `${v}%`, background: barColor(v) }} />}</div>
                </div>
              );
            })}
          </div>
        </div>
        {data.aiUnavailable && (
          <p role="status" className="rounded-xl bg-[#FFF1DC] px-3 py-2 text-sm text-[#7A4100]"><b>AI review unavailable — showing the automatic checks only.</b> Upload again in a moment for the full review.</p>
        )}
        {!data.hasCv && <p className="rounded-xl bg-[#F6F6FA] px-3 py-2 text-sm text-[#3F3F4C]">Upload your CV too and we&apos;ll check your LinkedIn says the same thing. Mismatches are what recruiters notice.</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5B5B6B]">
          <span className="font-semibold text-[#16161D]">{rulesPassedLabel(data.passed, data.assessed)}</span>
          {data.notCovered > 0 && <span>{data.notCovered} need a screenshot, not counted</span>}
          {data.couldNotAssess > 0 && <span>{data.couldNotAssess} couldn&apos;t assess</span>}
        </div>
        <p className="text-xs leading-snug text-[#5B5B6B]">
          Measures how your profile comes across when a recruiter or contact looks you up. Recruiters may look you up; LinkedIn rarely decides UK graduate applications on its own.
        </p>
      </section>

      {rest.length > 0 && (
        <section aria-labelledby="li-more-h" className="flex flex-col gap-3 rounded-[20px] border border-[#E6E6EF] bg-white p-5">
          <h3 id="li-more-h" className="text-sm font-bold">More fixes</h3>
          <ol className="flex flex-col gap-3">
            {rest.slice(0, 6).map((f) => <li key={f.ruleId} className="flex flex-col gap-2 border-t border-[#ECECF3] pt-3 first:border-t-0 first:pt-0"><FixBody fix={f} /></li>)}
          </ol>
        </section>
      )}

      {data.tips.length > 0 && (
        <section aria-labelledby="li-tips-h" className="flex flex-col gap-2 rounded-[20px] border border-dashed border-[#DCDCE6] bg-white p-5">
          <h3 id="li-tips-h" className="text-sm font-bold">Presence tips <span className="font-normal text-[#5B5B6B]">· these don&apos;t affect your score</span></h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-[#3F3F4C]">{data.tips.map((t) => <li key={t.ruleId}>{t.statement}</li>)}</ul>
        </section>
      )}

      <details className="rounded-[20px] border border-[#E6E6EF] bg-white">
        <summary className="flex min-h-11 cursor-pointer items-center px-5 py-3 text-sm font-semibold">What we read from your profile</summary>
        <div className="flex flex-col gap-2 px-5 pb-5 text-sm">
          {data.parseWarnings.map((w) => <p key={w} className="rounded-xl bg-[#FFF1DC] px-3 py-2 text-[#7A4100]">{PARSE_WARNING[w] ?? w}</p>)}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="font-semibold">Headline</dt><dd className="break-words">{data.profile.headline ?? "—"}</dd>
            <dt className="font-semibold">Location</dt><dd>{data.profile.location ?? "—"}</dd>
            <dt className="font-semibold">Top skills</dt><dd>{data.profile.topSkills.join(", ") || "—"}</dd>
            <dt className="font-semibold">Entries</dt><dd>{data.profile.experience} experience, {data.profile.education} education</dd>
          </dl>
          <p className="text-xs text-[#5B5B6B]">Your email, name and profile link were removed before the AI read your profile.{data.saved ? "" : " This result isn't saved yet."}</p>
        </div>
      </details>
    </div>
  );
}
