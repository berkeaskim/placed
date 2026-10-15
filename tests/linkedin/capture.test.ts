import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ParsedCV } from "@/lib/types";
import { CapturePayloadSchema, externalLink, parseCapturedProfile, rejoinSingleItem, type CapturePayload } from "@/lib/linkedin/parse-capture";
import { mintCaptureToken, verifyCaptureToken } from "@/lib/linkedin/capture-token";
import { scoreLinkedIn } from "@/lib/linkedin-score/score";
import type { LiJudgeInput, LiJudgeResult } from "@/lib/ai/judgeLinkedIn";

const AYSE_CV = JSON.parse(readFileSync(path.join(process.cwd(), "seed", "demo", "ayse.json"), "utf8")) as ParsedCV;

// Shapes copied from the logged-in profile layout observed 2026-10-15 (one <p> line per entry), for the FICTIONAL
// demo persona. Item splitting is the extension's (extension/linkedin.js); these are its outputs.
const PAYLOAD: CapturePayload = CapturePayloadSchema.parse({
  profileUrl: "https://www.linkedin.com/in/ayse-demir-4b7a91c2",
  name: "Ayşe Demir",
  top: ["She/Her", "Economics @ UCL | Data analysis in Python & SQL | Seeking 2027 consulting internships", "UCL", "London, England, United Kingdom", "·", "Contact info", "UCL", "500+ connections"],
  about: "Second-year economics student at UCL who likes turning messy data into decisions.\nLast summer I built a pricing dashboard that cut a café chain's weekly reporting from 6 hours to 20 minutes.",
  experience: [
    ["Data Analyst Intern", "Brew & Co · Internship", "Jun 2025 - Aug 2025 · 3 mos", "London, England, United Kingdom · Hybrid", "Built a pricing dashboard in Python and SQL used by 12 store managers.", "Python, SQL and +2 skills"],
    ["Northwind Partners", "Part-time · 1 yr 2 mos", "Research Assistant", "Jan 2025 - Present · 10 mos", "Literature reviews for a market-entry study.", "Student Ambassador", "Part-time", "Oct 2024 - Dec 2024 · 3 mos", "On-site"],
  ],
  education: [
    ["UCL", "BSc Economics", "2024 – 2027", "Grade: First (predicted)", "Econometrics, Microeconomics"],
    ["Robert College", "International Baccalaureate", "Sep 2020 – Jul 2024", "Grade: 38/45", "… more", "Show all 3 educations"],
  ],
  certifications: [["Google Data Analytics", "Google", "Issued Jul 2024"], ["Excel Skills for Business", "Macquarie University", "Issued Aug 2023"]],
  languages: [["English", "Full professional proficiency"], ["Turkish", "Native or bilingual proficiency"]],
  skills: ["Python (Programming Language)", "SQL", "Data Analysis", "Python (Programming Language)"],
  skillsComplete: true,
  links: ["https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fgithub.com%2Fayse-demir&urlhash=x", "https://www.linkedin.com/in/ayse-demir-4b7a91c2/overlay/contact-info/"],
});

describe("parseCapturedProfile", () => {
  const { li, text } = parseCapturedProfile(PAYLOAD, PAYLOAD.profileUrl);

  it("reads name, headline and location from the top card, skipping pronouns and chrome", () => {
    expect(li.name).toBe("Ayşe Demir");
    expect(li.headline).toMatch(/^Economics @ UCL/);
    expect(li.location).toBe("London, England, United Kingdom");
  });
  it("reads single roles and roles grouped under one company", () => {
    expect(li.experience.map((e) => [e.title, e.company])).toEqual([
      ["Data Analyst Intern", "Brew & Co"],
      ["Research Assistant", "Northwind Partners"],
      ["Student Ambassador", "Northwind Partners"],
    ]);
    const [intern, ra, amb] = li.experience;
    expect(intern).toMatchObject({ start: { year: 2025, month: 6 }, end: { year: 2025, month: 8 }, location: "London, England, United Kingdom" });
    expect(intern.description).toBe("Built a pricing dashboard in Python and SQL used by 12 store managers.");
    expect(ra).toMatchObject({ end: null, description: "Literature reviews for a market-entry study." });
    expect(amb).toMatchObject({ start: { year: 2024, month: 10 }, location: null, description: "" });
  });
  it("reads education with years and details", () => {
    expect(li.education[0]).toMatchObject({ school: "UCL", degree: "BSc Economics", startYear: 2024, endYear: 2027 });
    expect(li.education[0].details).toContain("Grade: First");
    expect(li.education[1]).toMatchObject({ school: "Robert College", startYear: 2020, endYear: 2024, details: "Grade: 38/45" });
  });
  it("keeps the full skills list (deduped), certifications, languages and only external links", () => {
    expect(li.topSkills).toEqual(["Python (Programming Language)", "SQL", "Data Analysis"]);
    expect(li.warnings).not.toContain("public_view_no_skills");
    expect(li.certifications).toEqual(["Google Data Analytics (Google)", "Excel Skills for Business (Macquarie University)"]);
    expect(li.languages[1]).toBe("Turkish (Native or bilingual proficiency)");
    expect(li.links).toEqual(["https://github.com/ayse-demir"]);
    expect(text).toContain("Top Skills\nPython (Programming Language)");
  });
  it("flags a partial skills list instead of pretending it is complete", () => {
    expect(parseCapturedProfile({ ...PAYLOAD, skillsComplete: false }, PAYLOAD.profileUrl).li.warnings).toContain("skills_partial");
    expect(parseCapturedProfile({ ...PAYLOAD, skills: [] }, PAYLOAD.profileUrl).li.warnings).toContain("public_view_no_skills");
  });
  it("scores end to end with the CV comparison", async () => {
    const naJudge = async (i: LiJudgeInput): Promise<LiJudgeResult> => ({ results: i.rules.map((r) => ({ ruleId: r.id, status: "not_applicable", evidenceLine: null, fix: null })), spellingErrors: [], modelId: "stub", cacheable: false });
    const s = await scoreLinkedIn({ li, rawText: text, cv: AYSE_CV, sector: "data_analytics", year: "2nd", today: new Date("2026-10-15"), judge: naJudge });
    // Skills are read now, so skills rules are judged rather than "not public"; the GitHub link counts.
    expect(s.results.find((r) => r.ruleId === "LI-DATA_ANALYTICS-03")?.status).not.toBe("not_applicable");
    expect(s.results.find((r) => r.ruleId === "LI-DATA_ANALYTICS-07")?.status).toBe("pass");
    expect(s.assessed).toBeGreaterThan(0);
  });
});

describe("rejoinSingleItem", () => {
  const isDate = (l: string) => /\d{4}\s*[-–]\s*(\d{4}|Present)/.test(l);
  it("rejoins one item that the DOM split into blocks", () => {
    expect(rejoinSingleItem([["Analyst", "Acme · Full-time"], ["Jan 2024 - Present · 9 mos"], ["Did things."]], isDate))
      .toEqual([["Analyst", "Acme · Full-time", "Jan 2024 - Present · 9 mos", "Did things."]]);
  });
  it("leaves real multi-item lists alone", () => {
    const two = [["A", "X", "2023 - 2024"], ["B", "Y", "2024 - Present"]];
    expect(rejoinSingleItem(two, isDate)).toBe(two);
  });
});

describe("externalLink", () => {
  it("unwraps LinkedIn redirects and drops LinkedIn's own pages", () => {
    expect(externalLink("https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fayse.dev")).toBe("https://ayse.dev");
    expect(externalLink("https://www.linkedin.com/in/x/")).toBeNull();
    expect(externalLink("mailto:a@b.c")).toBeNull();
    expect(externalLink("https://github.com/x")).toBe("https://github.com/x");
  });
});

describe("capture token", () => {
  const prev = process.env.LINKEDIN_CAPTURE_SECRET;
  beforeEach(() => { process.env.LINKEDIN_CAPTURE_SECRET = "test-secret"; });
  afterEach(() => { process.env.LINKEDIN_CAPTURE_SECRET = prev; });
  const now = Date.parse("2026-10-15T12:00:00Z");

  it("round-trips the claims and expires after 10 minutes", () => {
    const t = mintCaptureToken({ userId: "u1", sector: "consulting", year: "2nd" }, now);
    expect(verifyCaptureToken(t, now + 60_000)).toMatchObject({ userId: "u1", sector: "consulting", year: "2nd" });
    expect(verifyCaptureToken(t, now + 11 * 60_000)).toBeNull();
  });
  it("rejects tampered claims, bad signatures and other secrets", () => {
    const t = mintCaptureToken({ userId: "u1", sector: "consulting", year: "2nd" }, now);
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), userId: "u2" })).toString("base64url");
    expect(verifyCaptureToken(`${forged}.${sig}`, now)).toBeNull();
    expect(verifyCaptureToken(`${body}.${"A".repeat(43)}`, now)).toBeNull();
    expect(verifyCaptureToken("nope", now)).toBeNull();
    process.env.LINKEDIN_CAPTURE_SECRET = "other";
    expect(verifyCaptureToken(t, now)).toBeNull();
  });
});
