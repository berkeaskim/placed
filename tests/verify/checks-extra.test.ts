import { describe, it, expect } from "vitest";
import {
  siblingContamination, qualifierDrop, authorshipLevel, authorshipEscalation, scopedMetrics,
  structuralLoss, temporal, runExtraChecks,
  type SourceBullet, type SourceRole, type TailoredBullet, type TailoredRole, type Issue,
} from "@/lib/verify/checks-extra";
import { TOOL_FAMILIES } from "@/lib/verify/tool-families";
import { TOOL_RELEASE_YEARS } from "@/lib/verify/tool-release-years";

const sb = (id: string, text: string): SourceBullet => ({ id, text });
const tb = (id: string, text: string, sourceRefs: string[] = [id], changeType: TailoredBullet["changeType"] = "rephrased"): TailoredBullet =>
  ({ id, text, sourceRefs, changeType });
const blocks = (issues: Issue[]) => issues.filter((i) => i.severity === "block");
const role = (id: string, bullets: SourceBullet[], end?: string | "present", start = "2020"): SourceRole =>
  ({ id, org: "Org", title: "Intern", dates: { start, end }, bullets });

describe("data tables", () => {
  it("tool families cover the required groups", () => {
    const names = TOOL_FAMILIES.map((f) => f.members.map((m) => m.name));
    for (const group of [["AWS", "GCP", "Azure"], ["PyTorch", "TensorFlow", "JAX", "Keras"], ["React", "Vue", "Angular", "Svelte"],
      ["Tableau", "Power BI", "Looker"], ["Excel", "Google Sheets"], ["PostgreSQL", "MySQL", "SQL Server", "Oracle", "SQLite", "BigQuery", "Snowflake"],
      ["Java", "Kotlin", "Scala"], ["GitHub Actions", "GitLab CI", "Jenkins", "CircleCI"], ["Docker", "Podman"], ["Figma", "Sketch"]]) {
      expect(names.some((n) => group.every((g) => n.includes(g)))).toBe(true);
    }
  });
  it("release-year table has about 40 tools including the anchors", () => {
    expect(TOOL_RELEASE_YEARS.length).toBeGreaterThanOrEqual(35);
    const year = (n: string) => TOOL_RELEASE_YEARS.find((t) => t.name === n)?.year;
    expect(year("LangChain")).toBe(2022);
    expect(year("GPT-4")).toBe(2023);
    expect(year("Docker")).toBe(2013);
  });
});

describe("mandatory fixtures (05 §3)", () => {
  it("(a) 'Helped organise' → 'Led' blocks", () => {
    const src = [sb("b1", "Helped organise 3 society events")];
    const t = tb("b1", "Led 3 society events");
    expect(blocks(authorshipEscalation(t, src)).length).toBeGreaterThan(0);
    expect(blocks(qualifierDrop(t, src)).length).toBeGreaterThan(0);
  });

  it("(b) 'Used Python (pandas)' → 'Built an ML pipeline in PyTorch' blocks (sibling and authorship)", () => {
    const src = [sb("b1", "Used Python (pandas) to clean survey data")];
    const t = tb("b1", "Built an ML pipeline in PyTorch");
    expect(blocks(siblingContamination(t, src)).some((i) => i.evidence === "PyTorch")).toBe(true);
    expect(blocks(authorshipEscalation(t, src)).length).toBeGreaterThan(0);
  });

  it("(c) AWS Lambda → Azure Functions blocks", () => {
    const src = [sb("b1", "Deployed AWS Lambda functions")];
    const issues = siblingContamination(tb("b1", "Deployed Azure Functions"), src);
    expect(blocks(issues)).toHaveLength(1);
    expect(issues[0]).toMatchObject({ check: "siblingContamination", bulletId: "b1", evidence: "Azure" });
  });

  it("(d) dropping 'in a team of 4' blocks", () => {
    const issues = qualifierDrop(tb("b1", "Built a dashboard"), [sb("b1", "Built a dashboard in a team of 4")]);
    expect(blocks(issues)).toHaveLength(1);
    expect(issues[0].evidence).toMatch(/team of 4/i);
  });

  it("(e) 20% → 25% blocks", () => {
    const issues = scopedMetrics(tb("b1", "Increased sign-ups 25% through a referral campaign"),
      [sb("b1", "Increased sign-ups 20% through a referral campaign")], []);
    expect(blocks(issues)).toHaveLength(1);
    expect(issues[0].evidence).toBe("25%");
  });

  it("(f) a number moved from bullet A's context into bullet B's claim blocks", () => {
    const src = [sb("a", "Recruited 30 volunteers for the charity fundraiser"), sb("b", "Mentored students in weekly coding workshops")];
    const t = tb("m1", "Mentored 30 students in weekly coding workshops", ["a", "b"], "merged");
    const issues = scopedMetrics(t, src, []);
    expect(blocks(issues)).toHaveLength(1);
    expect(issues[0].evidence).toBe("30");
  });

  it("(g) pure reorder plus synonym rephrase gives zero block issues", () => {
    const source = [role("r1", [
      sb("r1-b1", "Analysed sales data using Python and SQL to identify 3 pricing trends"),
      sb("r1-b2", "Presented weekly findings to a team of 6 analysts"),
    ], "2025")];
    const tailored: TailoredRole[] = [{ id: "r1", bullets: [
      tb("r1-b2", "Presented weekly insights to a team of 6 analysts", ["r1-b2"], "rephrased"),
      tb("r1-b1", "Examined sales data using Python and SQL to identify 3 pricing trends", ["r1-b1"], "reordered"),
    ] }];
    expect(blocks(runExtraChecks({ sourceRoles: source, tailoredRoles: tailored, confirmedFacts: [] }))).toEqual([]);
  });

  it("(h) 'Used LangChain' in a role that ended 2021 blocks", () => {
    const source = [role("r1", [sb("r1-b1", "Used LangChain to build a chatbot")], "2021", "2020")];
    const tailored: TailoredRole[] = [{ id: "r1", bullets: [tb("r1-b1", "Used LangChain to build a chatbot")] }];
    const issues = temporal(tailored, source);
    expect(blocks(issues)).toHaveLength(1);
    expect(issues[0]).toMatchObject({ check: "temporal", roleId: "r1", evidence: "LangChain" });
  });
});

describe("siblingContamination", () => {
  it("passes when the same tool is in the cited source", () => {
    expect(siblingContamination(tb("b1", "Shipped serverless APIs on AWS Lambda"), [sb("b1", "Deployed AWS Lambda functions")])).toEqual([]);
  });
  it("accepts vocab aliases in the source via canonicalize (EC2 → AWS)", () => {
    expect(siblingContamination(tb("b1", "Ran AWS workloads"), [sb("b1", "Managed EC2 instances")])).toEqual([]);
  });
  it("only looks at cited sources, not other bullets", () => {
    const src = [sb("b1", "Built a React front end"), sb("b2", "Wrote Vue components")];
    expect(blocks(siblingContamination(tb("b1", "Built Vue components", ["b1"]), src))).toHaveLength(1);
  });
  it("does not treat 'react to' or 'excel at' as tools", () => {
    expect(siblingContamination(tb("b1", "Learned to react to customer feedback and excel at service"), [sb("b1", "Handled customer feedback")])).toEqual([]);
  });
  it("distinguishes Keras from TensorFlow although vocab collapses them", () => {
    expect(blocks(siblingContamination(tb("b1", "Trained CNNs in TensorFlow"), [sb("b1", "Trained CNNs in Keras")]))).toHaveLength(1);
  });
});

describe("qualifierDrop", () => {
  it("passes when 'co-founded' is kept", () => {
    const src = [sb("b1", "Co-founded the UCL Fintech Society and ran its launch event")];
    const t = tb("b1", "Co-founded UCL's Fintech Society and ran its launch event");
    expect(runExtraChecks({ sourceRoles: [role("r1", src, "present")], tailoredRoles: [{ id: "r1", bullets: [t] }], confirmedFacts: [] })).toEqual([]);
  });
  it("blocks when 'co-' is dropped", () => {
    expect(blocks(qualifierDrop(tb("b1", "Founded the UCL Fintech Society"), [sb("b1", "Co-founded the UCL Fintech Society")]))).toHaveLength(1);
  });
  it("allows swapping qualifiers within a group (helped → assisted)", () => {
    expect(qualifierDrop(tb("b1", "Assisted with 3 open days"), [sb("b1", "Helped run 3 open days")])).toEqual([]);
  });
  it("blocks dropping 'university project' / 'as part of'", () => {
    expect(blocks(qualifierDrop(tb("b1", "Built a trading bot"), [sb("b1", "Built a trading bot as a university project")]))).toHaveLength(1);
    expect(blocks(qualifierDrop(tb("b1", "Designed the onboarding flow"), [sb("b1", "Designed the onboarding flow as part of a product squad")]))).toHaveLength(1);
  });
  it("warns (not blocks) when a hedge is dropped", () => {
    const issues = qualifierDrop(tb("b1", "Cut processing time by 30%"), [sb("b1", "Cut processing time by up to 30%")]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warn");
    const approx = qualifierDrop(tb("b1", "Served 200 customers daily"), [sb("b1", "Served ~200 customers daily")]);
    expect(approx.map((i) => i.severity)).toEqual(["warn"]);
  });
});

describe("authorshipLevel / authorshipEscalation", () => {
  it("maps the verb ladder", () => {
    expect(authorshipLevel("familiar")).toBe(0);
    expect(authorshipLevel("Learnt")).toBe(0);
    expect(authorshipLevel("used")).toBe(1);
    expect(authorshipLevel("helping")).toBe(1);
    expect(authorshipLevel("Built")).toBe(2);
    expect(authorshipLevel("implemented")).toBe(2);
    expect(authorshipLevel("led")).toBe(3);
    expect(authorshipLevel("Co-founded")).toBe(3);
    expect(authorshipLevel("spearheaded")).toBe(3);
    expect(authorshipLevel("organised")).toBe(2);
    expect(authorshipLevel("analysed")).toBeNull();
  });
  it("blocks used → built on the same object", () => {
    expect(blocks(authorshipEscalation(tb("b1", "Built Tableau dashboards for sales reporting"), [sb("b1", "Used Tableau dashboards for sales reporting")]))).toHaveLength(1);
  });
  it("passes when the verb stays level or goes down", () => {
    expect(authorshipEscalation(tb("b1", "Developed a budgeting app in Swift"), [sb("b1", "Built a budgeting app in Swift")])).toEqual([]);
    expect(authorshipEscalation(tb("b1", "Used Excel to model cash flow"), [sb("b1", "Built an Excel cash-flow model")])).toEqual([]);
  });
  it("in a merge, compares against the source about the same object", () => {
    const src = [sb("a", "Led the society's marketing team of 5"), sb("b", "Helped build the society website")];
    expect(blocks(authorshipEscalation(tb("m", "Led the society website build", ["a", "b"], "merged"), src))).toHaveLength(1);
  });
  it("handles British spelling as the same object", () => {
    const issues = runExtraChecks({
      sourceRoles: [role("r1", [sb("r1-b1", "Organised a team of 5 to analyse customer behaviour data")], "2024")],
      tailoredRoles: [{ id: "r1", bullets: [tb("r1-b1", "Organized a team of 5 to analyze customer behavior data")] }],
      confirmedFacts: [],
    });
    expect(issues).toEqual([]);
  });
});

describe("scopedMetrics", () => {
  it("passes a number present in a cited source sharing a content word", () => {
    expect(scopedMetrics(tb("b1", "Grew membership by 40% via Instagram campaigns"), [sb("b1", "Ran Instagram campaigns that grew membership 40%")], [])).toEqual([]);
  });
  it("normalises thousands separators and k suffixes", () => {
    expect(scopedMetrics(tb("b1", "Managed a £5k events budget"), [sb("b1", "Managed an events budget of £5,000")], [])).toEqual([]);
  });
  it("accepts confirmed facts", () => {
    expect(scopedMetrics(tb("b1", "Raised £2,500 for the charity fundraiser"), [sb("b1", "Raised money for the charity fundraiser")], ["Raised £2500 at the 2025 fundraiser"])).toEqual([]);
  });
  it("blocks a percent that was a plain count in the source", () => {
    expect(blocks(scopedMetrics(tb("b1", "Grew sign-ups 20%"), [sb("b1", "Gained 20 sign-ups")], []))).toHaveLength(1);
  });
  it("blocks an invented multiplier and range", () => {
    expect(blocks(scopedMetrics(tb("b1", "Made report generation 3x faster for 4-6 analysts"), [sb("b1", "Automated report generation for analysts")], []))).toHaveLength(2);
  });
  it("ignores version numbers and years", () => {
    expect(scopedMetrics(tb("b1", "Built a GPT-4 summariser in Python 3 during 2024"), [sb("b1", "Built a GPT-4 summariser")], [])).toEqual([]);
  });
});

describe("structuralLoss", () => {
  const source = [role("r1", [sb("r1-b1", "A one"), sb("r1-b2", "B two"), sb("r1-b3", "C three")], "2024")];
  it("passes when every source bullet is covered or explicitly dropped", () => {
    const tailored: TailoredRole[] = [{ id: "r1", bullets: [
      tb("m", "A and B", ["r1-b1", "r1-b2"], "merged"),
      { id: "r1-b3", text: "C three", sourceRefs: ["r1-b3"], changeType: "dropped", dropReason: "Not relevant to the JD" },
    ] }];
    expect(structuralLoss(tailored, source)).toEqual([]);
  });
  // audit 05 #21: one silent drop per entry warns; two or more block (|b′| ≥ |b|−1)
  it("blocks when two or more bullets go missing silently", () => {
    const issues = structuralLoss([{ id: "r1", bullets: [tb("r1-b1", "A one")] }], source);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ check: "structuralLoss", severity: "block", roleId: "r1" });
    expect(issues[0].evidence).toBe("r1-b2, r1-b3");
  });
  it("warns when exactly one bullet goes missing silently", () => {
    const issues = structuralLoss([{ id: "r1", bullets: [tb("r1-b1", "A one"), tb("r1-b2", "B two")] }], source);
    expect(issues[0]).toMatchObject({ check: "structuralLoss", severity: "warn", roleId: "r1", evidence: "r1-b3" });
  });
  it("blocks when a whole role disappears", () => {
    expect(structuralLoss([], source)[0]).toMatchObject({ severity: "block", roleId: "r1" });
  });
});

describe("temporal", () => {
  it("passes a current role and a tool released before the end year", () => {
    const source = [role("r1", [sb("r1-b1", "Used LangChain")], "present"), role("r2", [sb("r2-b1", "Built Docker images")], "2019")];
    const tailored: TailoredRole[] = [{ id: "r1", bullets: [tb("r1-b1", "Used LangChain")] }, { id: "r2", bullets: [tb("r2-b1", "Built Docker images")] }];
    expect(temporal(tailored, source)).toEqual([]);
  });
  it("blocks GPT-4 in a 2022 role and parses month-year end dates", () => {
    const source = [role("r1", [sb("r1-b1", "Prompted models")], "Aug 2022")];
    expect(blocks(temporal([{ id: "r1", bullets: [tb("r1-b1", "Prompted GPT-4 models")] }], source))).toHaveLength(1);
  });
  it("ignores dropped bullets", () => {
    const source = [role("r1", [sb("r1-b1", "Used LangChain")], "2021")];
    expect(temporal([{ id: "r1", bullets: [{ ...tb("r1-b1", "Used LangChain"), changeType: "dropped", dropReason: "x" }] }], source)).toEqual([]);
  });
});

describe("runExtraChecks", () => {
  it("returns block issues first, with roleId filled in", () => {
    const source = [role("r1", [sb("r1-b1", "Cut costs by up to 10%"), sb("r1-b2", "Deployed AWS Lambda functions")], "2024")];
    const tailored: TailoredRole[] = [{ id: "r1", bullets: [tb("r1-b1", "Cut costs by 10%"), tb("r1-b2", "Deployed Azure Functions")] }];
    const issues = runExtraChecks({ sourceRoles: source, tailoredRoles: tailored, confirmedFacts: [] });
    expect(issues[0].severity).toBe("block");
    expect(issues.at(-1)?.severity).toBe("warn");
    expect(issues.every((i) => i.roleId === "r1")).toBe(true);
  });
  it("skips per-bullet checks on dropped bullets", () => {
    const source = [role("r1", [sb("r1-b1", "Helped run events in a team of 4")], "2024")];
    const tailored: TailoredRole[] = [{ id: "r1", bullets: [{ id: "r1-b1", text: "", sourceRefs: ["r1-b1"], changeType: "dropped", dropReason: "space" }] }];
    expect(runExtraChecks({ sourceRoles: source, tailoredRoles: tailored, confirmedFacts: [] })).toEqual([]);
  });
});

describe("extractMetrics edge cases", () => {
  it("reads percent ranges, currency suffixes and word numbers", async () => {
    const { extractMetrics } = await import("@/lib/verify/checks-extra");
    expect(extractMetrics("Cut costs 15-20% across 12 stores").map((m) => `${m.kind}:${m.value}`)).toEqual(["range:15-20%", "plain:12"]);
    expect(extractMetrics("Raised £1.2m for three charities").map((m) => `${m.kind}:${m.value}`)).toEqual(["currency:1200000", "plain:3"]);
    expect(extractMetrics("Served 1,200 customers in 2023 using Next.js 13.4")).toHaveLength(1);
  });
});

describe("review regressions", () => {
  const run = (src: string, after: string, end: string | "present" = "present") => runExtraChecks({
    sourceRoles: [role("r1", [sb("r1-b1", src)], end)],
    tailoredRoles: [{ id: "r1", bullets: [tb("r1-b1", after)] }], confirmedFacts: [],
  });
  it("blocks an inflated team size even before a stopword or punctuation", () => {
    expect(blocks(run("Led a team of 5 to deliver the app", "Led a team of 8 to deliver the app"))).toHaveLength(1);
    expect(blocks(run("Managed a team of 4.", "Managed a team of 12."))).toHaveLength(1);
    expect(blocks(run("Ran a 5-person squad for the hackathon", "Ran a 9-person squad for the hackathon"))).toHaveLength(1);
    expect(blocks(run("Taught 20 students at weekend workshops", "Taught 40 students at weekend workshops"))).toHaveLength(1);
  });
  it("keeps an unchanged team size and treats team-of-N and N-person as the same count", () => {
    expect(run("Led a team of 5 to deliver the app", "Led a 5-person team to deliver the app")).toEqual([]);
  });
  it("does not flag honest UK rephrasings", () => {
    expect(run("Co-ordinated a 30-person charity gala", "Coordinated a 30-person charity gala")).toEqual([]);
    expect(run("Co-operated with partner charities on fundraising", "Cooperated with partner charities on fundraising")).toEqual([]);
    expect(run("Supported 3 module leaders with marking", "Supported 3 course leaders with marking")).toEqual([]);
    expect(run("Built a payments module in TypeScript", "Built a payments component in TypeScript")).toEqual([]);
    expect(run("Answered student queries on the Help Desk", "Answered student queries on the service desk")).toEqual([]);
  });
  it("still treats module coursework and verb 'help' as qualifiers", () => {
    expect(blocks(run("Built a pricing model as module coursework", "Built a pricing model"))).toHaveLength(1);
    expect(blocks(run("Help run weekly coding sessions", "Run weekly coding sessions")).filter((i) => i.check === "qualifierDrop")).toHaveLength(1);
  });
  it("covers the extended authorship ladder", () => {
    expect(authorshipLevel("ran")).toBe(2);
    expect(authorshipLevel("organised")).toBe(2);
    expect(authorshipLevel("co-ordinated")).toBe(2);
    expect(authorshipLevel("pioneered")).toBe(3);
    expect(authorshipLevel("drove")).toBe(3);
    expect(blocks(run("Used React for an internal dashboard", "Pioneered a React internal dashboard"))).toHaveLength(1);
  });
  it("does not read sentence-initial 'Excel at' as the tool, but still reads tool contexts", () => {
    expect(siblingContamination(tb("b1", "Excel at explaining data to clients"), [sb("b1", "Explained data to clients")])).toEqual([]);
    expect(blocks(siblingContamination(tb("b1", "Built models in Excel with VBA"), [sb("b1", "Built models in Google Sheets")]))).toHaveLength(1);
  });
  it("treats 'Node' as Node.js", () => {
    expect(siblingContamination(tb("b1", "Built a Node.js API"), [sb("b1", "Built a Node API")])).toEqual([]);
  });
  it("release-year alternations are grouped (k8s only matches as a word)", () => {
    const k8s = TOOL_RELEASE_YEARS.find((t) => t.name === "Kubernetes")!.pattern;
    expect(k8s.test("ak8sx")).toBe(false);
    expect(k8s.test("Kubernetesy")).toBe(false);
    expect(k8s.test("Deployed on k8s")).toBe(true);
  });
});

// audit 05 #18: programming-language swaps
describe("language families", () => {
  it("blocks Python → R", () => {
    expect(blocks(siblingContamination(tb("b1", "Used R to analyse ticket sales"), [sb("b1", "Used Python to analyse ticket sales")]))[0]?.evidence).toBe("R");
  });
  it("blocks R → MATLAB and JavaScript → TypeScript", () => {
    expect(blocks(siblingContamination(tb("b1", "Modelled demand in MATLAB"), [sb("b1", "Modelled demand in R")]))).toHaveLength(1);
    expect(blocks(siblingContamination(tb("b1", "Built a TypeScript app"), [sb("b1", "Built a JavaScript app")]))).toHaveLength(1);
  });
  it("does not read R&D, 'R.' initials or a grade C as languages", () => {
    expect(siblingContamination(tb("b1", "Worked with R&D on a survey"), [sb("b1", "Worked with the research team on a survey")])).toEqual([]);
    expect(siblingContamination(tb("b1", "Achieved a C grade in maths"), [sb("b1", "Studied maths")])).toEqual([]);
  });
  it("passes R kept", () => expect(siblingContamination(tb("b1", "Analysed survey data in R"), [sb("b1", "Used R to analyse survey data")])).toEqual([]));
});
