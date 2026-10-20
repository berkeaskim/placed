/**
 * Which application track a job is on (research/spring-weeks/07-cv-rules-design.md §3, research/placement-year/
 * 05-application-content.md §4b). Spring weeks and insight programmes are first-year applications; placements are
 * 9–13 month industrial placements for second-years on sandwich degrees; everything else is the standard track.
 *
 * The track adds an overlay to tailoring (a user-prompt block and a playbook read after the sector playbook). It
 * never edits the sector playbooks: those stay per archetype.
 */
import type { Track } from "@/lib/cv-rules/types";
import type { Archetype, JobForScoring } from "@/lib/types";
import { NEEDS_NUMBER } from "@/lib/ai/prompts";
import type { TailorPlaybookT } from "./playbooks";

export function trackForJob(job: Pick<JobForScoring, "employmentType"> | null | undefined): Track {
  const t = job?.employmentType;
  if (t === "spring_week" || t === "insight") return "spring";
  if (t === "placement") return "placement";
  return "standard";
}

export const SPRING_TAILOR_BLOCK = `SPRING WEEK / INSIGHT MODE. This posting is a 1-5 day insight programme for first-year undergraduates. Screeners do not expect internships. They look for academics, responsibility, reliability and a genuine, evidenced interest in the sector.
- Lead each entry with what the student was trusted with (training others, handling money or customers, organising, captaining), then any concrete detail already in the line.
- Part-time, retail, hospitality, tutoring and volunteering lines are core evidence here, not filler: keep them and surface reliability and customer or team contact the line already shows. Never drop the CV's only job.
- School-era entries (sixth form: head student, prefect, captain, DofE, Young Enterprise, EPQ, competitions) are legitimate. Keep their original titles and school wording. Never rename "Head Girl" to "President", "Prefect" to "Leader", or a school club to a society.
- Interest in the sector: keep every line showing it (insight day, society event, virtual work experience, Bloomberg Market Concepts, stock pitch, competition, reading) and put it first in its entry. Never call a virtual job simulation an "internship" or "work experience at [firm]"; keep "Job Simulation (Forage)" or the original name. Never turn "attended" into "completed", "took part in" into "won", or an insight day into a "spring week".
- Never add a number. First-year lines often have none: rephrase for clarity and use ${NEEDS_NUMBER} only where the original line clearly implies a count the student knows (shifts, customers, people trained).
- Avoid banker vocabulary a first-year can't have earned ("executed", "originated", "deal team", "pitchbook", "client portfolio"). A first-year voice is concrete and plain.
- Summary: keep it null if the CV has none. If one exists, cut it to one factual line or leave it unchanged. Spring screeners read the form and motivation answers for that.
- Skills: put the tools the CV actually shows (Excel, Python, a language with its level) first. Never add finance techniques (DCF, LBO, comps) the CV does not name.`;

export const PLACEMENT_TAILOR_BLOCK = `PLACEMENT YEAR MODE. This posting is a 9–13 month industrial placement for a second-year undergraduate who returns to university afterwards. Screeners expect no prior professional role. They look for first-year academics, relevant modules and projects, technical tools used in context, and evidence for the employer's competencies (teamwork, problem-solving, communicating technical work).
- Treat academic, group and personal projects as primary evidence: lead with the student's own part, the tool or method, then any result already in the line. Never call a coursework project "experience at [company]" or a client project unless the source says it was for a client.
- Map bullets to the advert's stated criteria or competencies using the employer's words only where the line already evidences them.
- Keep part-time and volunteering lines; surface reliability, customers and teamwork the line already shows.
- Keep at most one or two school-era items; never rename school roles.
- Never add a number, a mark, a tool or a module that isn't in the source. Never upgrade "predicted" to achieved.
- Summary: if one exists, you may cut it to one line stating course, year and the placement sought; insert dates only from the AVAILABILITY line when one is given, never invent them.
- Skills: put the tools the advert names and the CV evidences first; group them by type.`;

export const SPRING_PLAYBOOK: TailorPlaybookT = {
  recruiterScan: [
    "University, course, expected graduation year and any first-term marks",
    "A-levels (or equivalent) with grades on one line; GCSEs in one summary line",
    "One evidenced sign of interest in the sector",
    "A position of responsibility (university or sixth form)",
    "Any job: reliability, customers, money, training others",
  ],
  leadWith: ["What you were trusted with before what you did", "Interest-in-sector activity first in its entry", "Leadership roles before memberships"],
  summaryFormula: "skip: first-year spring CVs omit a profile; the form and motivation questions do that job.",
  verbs: {
    prefer: ["trained", "organised", "handled", "served", "coordinated", "managed", "tutored", "raised", "represented", "captained", "researched", "presented", "pitched", "completed"],
    avoid: ["executed", "originated", "spearheaded", "leveraged", "passionate", "results-driven", "deal team", "pitchbook"],
  },
  reframes: [
    { from: "worked weekends at X", to: "Sales Assistant, X (weekends, [duration])", onlyIf: "the duration is in the source" },
    { from: "did the JP Morgan Forage thing", to: "Investment Banking Job Simulation (J.P. Morgan, Forage)", onlyIf: "the source names the firm and the platform; never 'internship'" },
    { from: "was a prefect", to: "Prefect: [duty the source states]", onlyIf: "a duty is stated; else keep the title alone" },
  ],
  competencyThemes: ["Reliability", "Teamwork", "Leadership", "Curiosity about markets/the sector", "Numeracy"],
  sectionOrder: ["Education (university, A-levels, GCSE summary)", "Experience (any work, insight days)", "Positions of Responsibility & Activities", "Skills, Languages & Interests"],
  pitfalls: [
    "Inflating a membership into a role", "Calling a virtual simulation an internship", "Listing GCSEs one by one or AS-levels",
    "Two pages", "A generic profile ('hard-working, passionate about finance')", "Minor school awards",
  ],
};

/** Business and finance placements read like a banking CV; everything else (engineering, tech, science) leads with projects. */
const BUSINESS: ReadonlySet<string> = new Set(["finance_banking", "consulting", "marketing_growth"]);

export function placementPlaybook(archetype: Archetype | null | undefined): TailorPlaybookT {
  const business = archetype != null && BUSINESS.has(archetype);
  return {
    recruiterScan: [
      "Course with the placement year and the graduation date that includes it",
      "Year-1 result",
      "3–6 modules relevant to this placement",
      "One project with the tool or method and its outcome",
      "Any job",
      "One leadership or teamwork role",
    ],
    leadWith: ["The student's own part in a project, then the tool or method", "Modules and projects that match the advert's criteria", "Leadership roles before memberships"],
    summaryFormula: "optional: one line with course, year and the placement sought; no adjectives.",
    verbs: {
      prefer: ["designed", "built", "tested", "analysed", "modelled", "programmed", "investigated", "presented", "documented", "coordinated", "organised", "trained"],
      avoid: ["responsible for", "spearheaded", "leveraged", "passionate", "results-driven", "gain invaluable experience"],
    },
    reframes: [
      { from: "group project for module X", to: "[Project title] (group of [n], [module])", onlyIf: "the group size and module are in the source" },
      { from: "used MATLAB in coursework", to: "Modelled [what] in MATLAB ([module])", onlyIf: "the source says what was modelled" },
    ],
    competencyThemes: ["Teamwork", "Problem-solving", "Communicating technical work", "Planning and organising", "Learning quickly"],
    sectionOrder: business
      ? ["Education (with Year-1 result)", "Experience", "Leadership & Activities", "Skills, Languages & Interests"]
      : ["Education (with relevant modules)", "Technical Projects", "Experience", "Technical Skills", "Leadership & Activities", "Interests"],
    pitfalls: [
      "A three-year graduation date on a placement degree", "An unlabelled predicted class", "Module lists without relevance",
      "\"Responsible for\" duty bullets", ...(business ? ["Two pages"] : []), "A long list of school awards",
    ],
  };
}

export function trackPlaybook(track: Track, archetype: Archetype | null | undefined): TailorPlaybookT | null {
  if (track === "spring") return SPRING_PLAYBOOK;
  if (track === "placement") return placementPlaybook(archetype);
  return null;
}

/** The overlay as prompt text, read after the sector playbook. Null on the standard track. */
export function trackOverlayPrompt(track: Track, archetype: Archetype | null | undefined): string | null {
  const p = trackPlaybook(track, archetype);
  if (!p) return null;
  const name = track === "spring" ? "Spring week / insight" : "Placement year";
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");
  return [
    `ROLE PLAYBOOK OVERLAY: ${name}. Where it conflicts with the playbook above, follow this overlay. It shapes emphasis, order and wording only; it is never a source of facts.`,
    `What the screener checks first:\n${list(p.recruiterScan)}`,
    `Lead each entry with:\n${list(p.leadWith)}`,
    `Profile/summary (only if the CV already has one): ${p.summaryFormula}`,
    `Verbs that read well (use one only when the original line describes that action): ${p.verbs.prefer.join(", ")}`,
    `Avoid for this kind of programme: ${p.verbs.avoid.join("; ")}`,
    `Reframes (use only when the condition holds; [brackets] are slots filled from the CV, never invented):\n${p.reframes.map((r) => `- "${r.from}" → "${r.to}" (only if ${r.onlyIf})`).join("\n")}`,
    `Section order screeners expect: ${p.sectionOrder.join(" → ")}`,
    `Reads badly here:\n${list(p.pitfalls)}`,
  ].join("\n");
}

/** The mode block for the user prompt. Null on the standard track. */
export function trackBlock(track: Track): string | null {
  return track === "spring" ? SPRING_TAILOR_BLOCK : track === "placement" ? PLACEMENT_TAILOR_BLOCK : null;
}
