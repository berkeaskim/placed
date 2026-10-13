import { describe, it, expect } from "vitest";
import { CHECKERS, runCodeChecks, isSpellingVariant } from "@/lib/cv-score/checkers";
import { CHECKER_IDS } from "@/lib/cv-rules/types";
import type { CvContext } from "@/lib/cv-score/context";
import type { CvRule } from "@/lib/cv-rules/types";
import type { ParsedCV } from "@/lib/types";

const cv = (over: Partial<ParsedCV> = {}): ParsedCV => ({
  name: "A", email: "a@b.co", phone: "07700 900123", location: null, links: [], summary: null,
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2024–2027", grade: "Predicted 2:1", details: [] }],
  experience: [{ id: "x0", org: "Finance Society", title: "Events Officer", dates: "2025", location: "", bullets: [
    { id: "x0-b0", text: "Organised weekly society events" }, { id: "x0-b1", text: "Managed a budget of £2,000" }] }],
  projects: [], leadership: [], skills: [{ group: "Skills", items: ["Python", "SQL", "Excel", "Tableau", "R", "Stata", "PowerPoint", "VBA"] }],
  interests: "Running (London 10k 2025), chess", sectionOrder: ["education", "experience", "skills", "interests"], yearGuess: null, archetypes: [], ...over,
});
const ctx = (over: Partial<CvContext> = {}): CvContext => ({
  text: "x".repeat(900), pageTexts: ["x".repeat(900)], pageCount: 1, fileSize: 120_000, cv: cv(), year: "2nd", spellingErrors: [], ...over,
});
const rule = (over: Record<string, unknown>): CvRule => ({ id: "T", sectors: "all", dimension: "ats", statement: "s", check: "code", checker: "text_layer", severity: "major", evidence: "A", citations: [], ...over }) as CvRule;

describe("checkers", () => {
  it("text_layer fails image-only PDFs", () => {
    expect(CHECKERS.text_layer(ctx({ pageTexts: [""], text: "" }), rule({})).status).toBe("fail");
    expect(CHECKERS.text_layer(ctx(), rule({})).status).toBe("pass");
  });
  it("page_count respects maxPages and flags spillover as partial", () => {
    expect(CHECKERS.page_count(ctx({ pageCount: 2 }), rule({ params: { maxPages: 1 } })).status).toBe("partial");
    expect(CHECKERS.page_count(ctx({ pageCount: 3 }), rule({ params: { maxPages: 2 } })).status).toBe("fail");
  });
  it("quantified_bullets uses year-adjusted thresholds and reports the first unquantified bullet", () => {
    const r = rule({ params: { threshold: 0.4 }, yearAdjust: { "1st": { threshold: 0.2 } } });
    const out = CHECKERS.quantified_bullets(ctx(), r); // 1 of 2 = 50%
    expect(out.status).toBe("pass");
    const strict = CHECKERS.quantified_bullets(ctx(), rule({ params: { threshold: 0.8 } }));
    expect(strict.status).toBe("partial");
    expect(strict.evidenceLine).toBe("Organised weekly society events");
  });
  it("uk_personal_details flags DOB/nationality", () => {
    expect(CHECKERS.uk_personal_details(ctx({ text: "Date of Birth: 01/01/2005" }), rule({})).status).toBe("fail");
  });
  it("uk_grades passes with a stated classification", () => {
    expect(CHECKERS.uk_grades(ctx(), rule({})).status).toBe("pass");
    expect(CHECKERS.uk_grades(ctx({ cv: cv({ education: [{ id: "e0", institution: "UCL", degree: "BSc", dates: "", grade: null, details: [] }] }) }), rule({})).status).toBe("fail");
  });
  it("skill_rating_glyphs catches bars and x/10", () => {
    expect(CHECKERS.skill_rating_glyphs(ctx({ text: "Python ●●●●○  Excel 8/10" }), rule({})).status).toBe("fail");
  });
  it("spelling: na without data, fail at 3+", () => {
    expect(CHECKERS.spelling(ctx({ spellingErrors: null }), rule({})).status).toBe("not_applicable");
    expect(CHECKERS.spelling(ctx({ spellingErrors: ["teh", "recieve", "managment"] }), rule({})).status).toBe("fail");
  });
  it("generic_interests flags vague hobbies but accepts specific ones", () => {
    expect(CHECKERS.generic_interests(ctx({ cv: cv({ interests: "Reading, travelling, socialising" }) }), rule({})).status).toBe("fail");
    expect(CHECKERS.generic_interests(ctx(), rule({})).status).toBe("pass");
  });
  it("runCodeChecks only runs code rules and skips year-skipped rules", () => {
    const results = runCodeChecks([
      rule({ id: "A1", checker: "text_layer" }),
      rule({ id: "A2", check: "llm" }),
      rule({ id: "A3", checker: "github_link", yearAdjust: { "2nd": { skip: true } } }),
    ], ctx());
    expect(results.map((r) => r.ruleId)).toEqual(["A1", "A3"]);
    expect(results[1].status).toBe("not_applicable");
  });
  it("experience_present: any experience entry (incl. volunteering) passes; none fails", () => {
    expect(CHECKERS.experience_present(ctx(), rule({})).status).toBe("pass");
    expect(CHECKERS.experience_present(ctx({ cv: cv({ experience: [] }) }), rule({})).status).toBe("fail");
  });
  it("skills_evidenced: share of skills in bullets, reports unevidenced", () => {
    const c = ctx({ cv: cv({
      experience: [{ id: "x0", org: "O", title: "T", dates: "2025", location: "", bullets: [{ id: "b", text: "Built dashboards in Python and SQL" }] }],
      skills: [{ group: "S", items: ["Python", "SQL", "Tableau", "Stata"] }] }) });
    const out = CHECKERS.skills_evidenced(c, rule({ params: { threshold: 0.5 } }));
    expect(out.status).toBe("pass");
    expect(out.detail).toContain("Tableau");
    expect(CHECKERS.skills_evidenced(c, rule({ params: { threshold: 0.8 } })).status).not.toBe("pass");
    expect(CHECKERS.skills_evidenced(ctx({ cv: cv({ skills: [] }) }), rule({})).status).toBe("not_applicable");
  });
  it("read_time: key facts in first third of page 1", () => {
    const front = "A  Events Officer  2025  UCL  " + "x".repeat(600);
    expect(CHECKERS.read_time(ctx({ pageTexts: [front] }), rule({})).status).toBe("pass");
    const late = "x".repeat(600) + " A Events Officer 2025 UCL";
    expect(CHECKERS.read_time(ctx({ pageTexts: [late] }), rule({})).status).not.toBe("pass");
    expect(CHECKERS.read_time(ctx({ pageTexts: [] }), rule({})).status).toBe("not_applicable");
  });
  it("cliche_density / hidden_text / prompt_injection are pending cv-modules (not_applicable)", () => {
    for (const id of ["cliche_density", "hidden_text", "prompt_injection"] as const) {
      const out = CHECKERS[id](ctx(), rule({}));
      expect(out.status).toBe("not_applicable");
      expect(out.detail).toBe("pending cv-modules");
    }
  });
  it("every CheckerId has an implementation", () => {
    for (const id of CHECKER_IDS) expect(typeof CHECKERS[id]).toBe("function");
  });
  it("spelling: UK/US variants are not errors", () => {
    expect(CHECKERS.spelling(ctx({ spellingErrors: ["colour", "organise", "analyze", "programme"] }), rule({})).status).toBe("pass");
    expect(CHECKERS.spelling(ctx({ spellingErrors: ["teh", "recieve", "managment"] }), rule({})).status).toBe("fail");
    expect(CHECKERS.spelling(ctx({ spellingErrors: ["centre", "licence", "travelled", "catalogue", "optimisation"] }), rule({})).status).toBe("pass");
  });
  it("isSpellingVariant recognises variant families only", () => {
    for (const w of ["colour", "organise", "organization", "analyse", "analyzing", "centre", "center", "catalog", "defence", "traveled", "program"]) expect(isSpellingVariant(w)).toBe(true);
    for (const w of ["teh", "recieve", "managment"]) expect(isSpellingVariant(w)).toBe(false);
  });
  it("runCodeChecks applies year-adjusted threshold", () => {
    const r = rule({ id: "Q", checker: "quantified_bullets", params: { threshold: 0.8 }, yearAdjust: { "2nd": { threshold: 0.3 } } });
    expect(runCodeChecks([r], ctx())[0].status).toBe("pass");
  });
});
