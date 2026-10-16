import { peopleToReach, type OutreachTarget } from "@/lib/outreach/targets";
import { shortSchool } from "@/lib/profile/school-name";

export type ContactState = "none" | "sent" | "replied";

const LINE: Record<ContactState, { stroke: string; width: number; dash?: string }> = {
  none: { stroke: "#C9C9D6", width: 1.5, dash: "5 5" },
  sent: { stroke: "#7F77DD", width: 3 },
  replied: { stroke: "#12A150", width: 4 },
};
const NODE: Record<ContactState, { fill: string; stroke: string; text: string }> = {
  none: { fill: "#FFFFFF", stroke: "#DCDCE6", text: "#4A4A57" },
  sent: { fill: "#EEEAFE", stroke: "#7F77DD", text: "#3A20C4" },
  replied: { fill: "#E6F6EC", stroke: "#12A150", text: "#0B6B35" },
};

/** Where each kind of person sits: bridges in the middle (warm, likely to reply), people closer to the hire on the right. */
const POS: Record<OutreachTarget, { x: number; y: number; title: string; sub: string }> = {
  alumni: { x: 190, y: 40, title: "Alumni", sub: "warmest path" },
  recent_joiner: { x: 190, y: 150, title: "Recent joiners", sub: "know the process" },
  team: { x: 380, y: 40, title: "The team", sub: "the work itself" },
  recruiter: { x: 380, y: 150, title: "Recruiter", sub: "timelines, stages" },
};
const W = 120;
const H = 46;

/**
 * Who you can reach at this company and how far you've got with each. Every node opens a LinkedIn people search; Placed
 * never names or looks up anyone. Line weight shows progress: dashed = not yet, purple = messaged, green = replied.
 */
export function ReachMap({ company, title, state, school }: {
  company: string; title: string; state: Record<OutreachTarget, ContactState>; school: string | null;
}) {
  const people = Object.fromEntries(peopleToReach(company, title, school).map((p) => [p.key, p])) as unknown as Record<OutreachTarget, { url: string; why: string }>;
  const youX = 50;
  const youY = 118;
  const edge = (from: { x: number; y: number }, to: OutreachTarget, s: ContactState) => {
    const p = POS[to];
    const x2 = p.x;
    const y2 = p.y + H / 2;
    const mid = (from.x + x2) / 2;
    return <path key={`${from.x}-${to}`} d={`M${from.x} ${from.y} C${mid} ${from.y},${mid} ${y2},${x2} ${y2}`} fill="none"
      stroke={LINE[s].stroke} strokeWidth={LINE[s].width} strokeDasharray={LINE[s].dash} strokeLinecap="round" />;
  };
  const bridgeOut = (b: OutreachTarget) => ({ x: POS[b].x + W, y: POS[b].y + H / 2 });
  return (
    <svg viewBox="0 0 520 220" className="h-auto w-full" role="img" aria-label={`Who you can reach at ${company}`}>
      {edge({ x: youX + 26, y: youY }, "alumni", state.alumni)}
      {edge({ x: youX + 26, y: youY }, "recent_joiner", state.recent_joiner)}
      {edge(bridgeOut("alumni"), "team", state.team)}
      {edge(bridgeOut("recent_joiner"), "recruiter", state.recruiter)}
      <circle cx={youX} cy={youY} r={26} fill="#1A1A2E" />
      <text x={youX} y={youY} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="13" fontWeight="700">You</text>
      {(Object.keys(POS) as OutreachTarget[]).map((k) => {
        const p = k === "alumni" && school ? { ...POS[k], title: `${shortSchool(school).slice(0, 12)} alumni` } : POS[k];
        const s = NODE[state[k]];
        return (
          <a key={k} href={people[k].url} target="_blank" rel="noopener noreferrer" aria-label={`${p.title}: search LinkedIn`}>
            <title>{people[k].why}</title>
            <rect x={p.x} y={p.y} width={W} height={H} rx={12} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} />
            <text x={p.x + W / 2} y={p.y + 18} textAnchor="middle" fill={s.text} fontSize="13" fontWeight="700">{p.title}</text>
            <text x={p.x + W / 2} y={p.y + 34} textAnchor="middle" fill="#6B6B7B" fontSize="11">
              {state[k] === "replied" ? "replied ✓" : state[k] === "sent" ? "messaged" : p.sub}
            </text>
          </a>
        );
      })}
    </svg>
  );
}
