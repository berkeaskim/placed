// Shared cover-letter fixtures: a FICTIONAL student ("Alex Morgan") applying to a FICTIONAL firm
// (Northbridge Capital, Summer Analyst – Markets). fixtures/ai/coverLetterDraft/{default,skipped}.txt cite
// the ids defined here, and the e2e spec reuses them for its fixture job.
import { createHash } from "node:crypto";
import type { DraftInput } from "@/lib/cover-letter/draft";
import { MarkerParser } from "@/lib/cover-letter/stream-parse";
import type { Answer, Fact } from "@/lib/cover-letter/types";
import type { ParsedCV } from "@/lib/types";

export const FIXTURE_COMPANY = "Northbridge Capital";
export const FIXTURE_ROLE = "Summer Analyst – Markets";
export const FIXTURE_REF = "SA-MKT-27";

export const FIXTURE_CV = {
  name: "Alex Morgan", email: null, phone: null, location: "London", links: [], summary: null,
  education: [{ id: "ed1", institution: "University College London", degree: "BSc Economics", dates: "2025 – 2028", grade: null,
    details: [{ id: "ed1-d0", text: "Modules: Econometrics, Financial Markets, Statistics" }] }],
  experience: [
    { id: "x1", org: "UCL Investment Society", title: "Trading Desk Lead", dates: "2025 – present", location: "London",
      bullets: [
        { id: "x1-b0", text: "Ran the trading desk of a £50k student investment fund, sizing positions across rates and FX" },
        { id: "x1-b1", text: "Built a rates scenario model in Python that the fund used in weekly investment committee meetings" },
      ] },
    { id: "x2", org: "Cafe Lune", title: "Barista", dates: "2024 – 2025", location: "London",
      bullets: [{ id: "x2-b0", text: "Trained 4 new staff on the till during weekend peak hours" }] },
  ],
  projects: [
    { id: "p1", org: "Warwick Trading Challenge", title: "Team member", dates: "2026", location: "Coventry",
      bullets: [{ id: "p1-b0", text: "Presented the downside case for our team's rates position to the judging panel" }] },
  ],
  leadership: [],
  skills: [{ group: "Technical", items: ["Python", "Excel"] }],
  interests: null, sectionOrder: ["education", "experience", "projects", "skills"], yearGuess: null, archetypes: [],
} as unknown as ParsedCV;

export const FIXTURE_JD_LINES = [
  "Northbridge Capital is hiring for its 2027 Summer Analyst Programme in Markets in London.",
  "Summer analysts rotate across our flow and structured trading desks.",
  "You will own risk analysis from your first week, working alongside traders.",
  "We look for strong analytical skills and the ability to work under time pressure.",
  "Experience with Python or Excel modelling is an advantage.",
];

// Same id scheme as lib/cover-letter/research.ts, applied to fixtures/ai/coverLetterResearch/default.json,
// so the research fixture's facts carry the ids the draft fixture cites.
const factId = (url: string, claim: string) => createHash("sha1").update(`${url}\n${claim}`).digest("hex").slice(0, 10);
const fact = (claim: string, url: string, publisher: string, date: string): Fact => ({ id: factId(url, claim), claim, url, publisher, date });

export const FIXTURE_FACTS: Fact[] = [
  fact("Opened a new European structured-finance desk in Frankfurt, hiring 40 analysts across its markets division.", "https://www.example-news.com/firm-frankfurt-desk", "Example Financial News", "2026-06"),
  fact("Advised on the largest UK renewable-energy infrastructure refinancing of the year.", "https://www.example-deals.com/renewables-refinancing", "Example Deals", "2026-03"),
  fact("Expanded its graduate programme to include a data and technology rotation from autumn 2026.", "https://www.example-careers.com/graduate-rotation", "Example Careers", "2025-12"),
];
export const FIXTURE_RIVALS = ["Rival Capital", "Northgate Partners", "Kestrel & Co"];

export const FIXTURE_ANSWERS: Answer[] = [
  { id: "a1", question: "why_firm", text: "The risk ownership you give summer analysts from the first week is what drew me to Northbridge." },
  { id: "a2", question: "facts", text: null, pickedFactIds: [FIXTURE_FACTS[0].id] },
  { id: "a3", question: "story", text: "I built our rates scenario model and presented the downside case that changed our position size.", cvEntryId: "p1" },
  { id: "a4", question: "touchpoint", text: "At your Spring Insight Day a Markets associate told me analysts rotate across flow and structured desks." },
];

export const SKIPPED_ANSWERS: Answer[] = [
  { id: "a1", question: "why_firm", text: null },
  { id: "a2", question: "facts", text: null, pickedFactIds: [] },
  { id: "a3", question: "story", text: null, cvEntryId: "p1" },
  { id: "a4", question: "touchpoint", text: null },
];

export function fixtureDraftInput(over: Partial<DraftInput> = {}): DraftInput {
  return {
    mode: "full_letter", limit: null, company: FIXTURE_COMPANY, role: FIXTURE_ROLE, ref: FIXTURE_REF,
    cv: FIXTURE_CV, jdLines: FIXTURE_JD_LINES,
    evidence: {
      requirements: [
        { text: "Analysis under time pressure", cvRefs: ["p1-b0", "x1-b1"] },
        { text: "Python or Excel modelling", cvRefs: ["x1-b1"] },
      ],
      storyEntry: { id: "p1", label: "Team member at Warwick Trading Challenge" },
      rivals: FIXTURE_RIVALS, sector: "quant_trading",
    },
    answers: FIXTURE_ANSWERS, facts: FIXTURE_FACTS, pickedFacts: [FIXTURE_FACTS[0]], confirmedFacts: [],
    ...over,
  };
}

export function skippedDraftInput(over: Partial<DraftInput> = {}): DraftInput {
  return fixtureDraftInput({ answers: SKIPPED_ANSWERS, pickedFacts: [], ...over });
}

/** Raw marked model output → the visible text and the closed sentences, as the stream would deliver them. */
export function parseMarked(raw: string) {
  const p = new MarkerParser();
  const r = p.push(raw);
  return { text: r.visible, sentences: [...r.closed, ...p.end()] };
}
