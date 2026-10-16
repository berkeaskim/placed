import type { AppStatus } from "@/lib/types";
import type { OutreachPurpose } from "@/lib/outreach/draft";
import { alumniLabel, alumnusLabel, type OutreachTarget } from "@/lib/outreach/targets";

const DAY = 86_400_000;

export type StepKind = "message" | "apply" | "prep";
export type StepState = "done" | "next" | "upcoming";

export type PlanStep = {
  key: string;
  kind: StepKind;
  title: string;
  why: string;
  target?: OutreachTarget;
  purpose?: OutreachPurpose;
  /** YYYY-MM-DD the step is planned for. */
  due: string;
  state: StepState;
  overdue: boolean;
};

export type PlanInput = {
  status: AppStatus;
  /** The posting's closing date, YYYY-MM-DD, or null for rolling roles. */
  deadline: string | null;
  /** When the card last moved (ISO); for an applied card, roughly when the student applied. */
  updatedAt: string;
  today: string;
  /** Messages for this job; "drafted" ones don't count as sent. */
  outreach: { target: string; status: string }[];
  /** The student's university, or null when Placed doesn't know it yet. */
  school?: string | null;
};

export type Plan = { steps: PlanStep[]; doneCount: number; daysLeft: number | null };

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const at = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** How likely each kind of person is to answer a student, and why to write to them. Used to order the next moves. */
export const REACH: Record<OutreachTarget, { reply: "High" | "Medium"; label: string }> = {
  alumni: { reply: "High", label: "Alumni" },
  recent_joiner: { reply: "High", label: "Recent joiners" },
  team: { reply: "Medium", label: "Someone in the team" },
  recruiter: { reply: "Medium", label: "Early careers recruiter" },
};

/**
 * The networking plan for one application, as dated steps: talk to people before applying (so the application can use
 * what you learned), apply, then a note to the team and a recruiter follow-up. Dates come from the deadline when there
 * is one, otherwise from a one-week run-up. Steps are done when the tracker or the outreach log says so; Placed never
 * contacts anyone itself.
 */
export function buildPlan(i: PlanInput): Plan {
  const today = at(i.today);
  const sent = (t: OutreachTarget) => i.outreach.some((o) => o.target === t && o.status !== "drafted");
  const applied = i.status !== "saved";
  const appliedAt = applied ? Math.min(at(i.updatedAt.slice(0, 10)), today) : null;

  let applyDue: number;
  let alumniDue: number;
  let joinerDue: number;
  if (applied) {
    applyDue = appliedAt!;
    alumniDue = applyDue - 7 * DAY;
    joinerDue = applyDue - 4 * DAY;
  } else if (i.deadline && at(i.deadline) >= today) {
    const span = Math.max(at(i.deadline) - today, 2 * DAY);
    applyDue = at(i.deadline) - Math.min(2 * DAY, Math.round(span * 0.2 / DAY) * DAY);
    alumniDue = today;
    joinerDue = today + Math.round(((applyDue - today) * 0.4) / DAY) * DAY;
  } else {
    alumniDue = today;
    joinerDue = today + 3 * DAY;
    applyDue = today + 7 * DAY;
  }

  const raw: Omit<PlanStep, "state" | "overdue">[] = [
    { key: "alumni", kind: "message", target: "alumni", purpose: "intro", due: iso(alumniDue),
      title: `Message two or three ${i.school ? alumniLabel(i.school) : "alumni from your university"}`, why: "A shared degree is the warmest way in. Ask about the team, not for a referral." },
    { key: "joiner", kind: "message", target: "recent_joiner", purpose: "intro", due: iso(joinerDue),
      title: "Ask a recent joiner about the process", why: "They went through these exact stages last year and remember what mattered." },
    { key: "apply", kind: "apply", due: iso(applyDue),
      title: "Tailor your CV and apply", why: "Apply with what you learned from the conversations; mention it if it fits." },
    { key: "team", kind: "message", target: "team", purpose: "intro", due: iso(applyDue + 2 * DAY),
      title: "Short note to someone in the team", why: "Once you've applied you have something concrete to point to." },
    { key: "recruiter", kind: "message", target: "recruiter", purpose: "follow_up", due: iso(applyDue + 21 * DAY),
      title: "Polite follow-up with the recruiter", why: "Three weeks without news is the normal moment to ask where things stand." },
  ];
  if (i.status === "interview") {
    raw.push({ key: "prep", kind: "prep", target: "alumni", purpose: "interview_prep", due: iso(today),
      title: `Ask ${i.school ? `a ${alumnusLabel(i.school)}` : "an alumnus"} one interview-prep question`, why: "Someone who passed the same interview is the best preparation there is." });
  }

  const isDone = (s: (typeof raw)[number]) =>
    s.kind === "apply" ? applied
      : s.kind === "prep" ? false
      : s.key === "recruiter" ? sent("recruiter") || i.status === "interview" || i.status === "offer"
      : sent(s.target!);

  let nextTaken = false;
  const steps = raw
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((s): PlanStep => {
      const done = isDone(s);
      const state: StepState = done ? "done" : nextTaken ? "upcoming" : ((nextTaken = true), "next");
      return { ...s, state, overdue: !done && s.due < i.today };
    });

  return {
    steps,
    doneCount: steps.filter((s) => s.state === "done").length,
    daysLeft: i.deadline && at(i.deadline) >= today ? Math.round((at(i.deadline) - today) / DAY) : null,
  };
}

/** The open messaging steps, soonest first: what to send this week. */
export function nextMoves(plan: Plan, limit = 3): PlanStep[] {
  return plan.steps.filter((s) => s.state !== "done" && s.target).slice(0, limit);
}
