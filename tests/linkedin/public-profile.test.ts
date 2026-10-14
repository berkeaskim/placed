import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ParsedCV } from "@/lib/types";
import { parsePublicProfile } from "@/lib/linkedin/parse-public";
import { fetchPublicProfile, LinkedInFetchError, normalizeProfileUrl } from "@/lib/linkedin/fetch-public";
import { sameName } from "@/lib/linkedin-score/run";
import { scoreLinkedIn } from "@/lib/linkedin-score/score";
import type { LiJudgeInput, LiJudgeResult } from "@/lib/ai/judgeLinkedIn";

// Synthetic page for the FICTIONAL demo persona (see the comment inside the fixture).
const HTML = readFileSync(path.join(__dirname, "fixtures", "ayse-synthetic-public.html"), "utf8");
const AYSE_CV = JSON.parse(readFileSync(path.join(process.cwd(), "seed", "demo", "ayse.json"), "utf8")) as ParsedCV;
const URL_ = "https://www.linkedin.com/in/ayse-demir-4b7a91c2";

describe("normalizeProfileUrl", () => {
  it("accepts the common shapes and rebuilds the canonical URL", () => {
    expect(normalizeProfileUrl("linkedin.com/in/ayse-demir-4b7a91c2/")).toBe(URL_);
    expect(normalizeProfileUrl("https://uk.linkedin.com/in/ayse-demir-4b7a91c2?utm_source=share")).toBe(URL_);
    expect(normalizeProfileUrl(" www.linkedin.com/in/ayse-demir-4b7a91c2/details/experience ")).toBe(URL_);
  });
  it("rejects anything that isn't a linkedin.com/in profile", () => {
    for (const bad of ["https://evil.com/in/x", "https://linkedin.com.evil.com/in/abc", "linkedin.com/company/ucl", "not a url", "https://www.linkedin.com/in/"]) {
      expect(() => normalizeProfileUrl(bad), bad).toThrow(LinkedInFetchError);
    }
  });
});

describe("fetchPublicProfile", () => {
  const fake = (status: number, body: string, url = URL_) => (async () => ({ status, ok: status >= 200 && status < 300, url, text: async () => body })) as unknown as typeof fetch;
  it("returns the page when it is a public profile", async () => {
    await expect(fetchPublicProfile(URL_, fake(200, HTML))).resolves.toContain("top-card-layout__title");
  });
  it("reports blocks, auth walls, private profiles and 404s distinctly", async () => {
    const kind = (f: typeof fetch) => fetchPublicProfile(URL_, f).catch((e: LinkedInFetchError) => e.kind);
    expect(await kind(fake(999, ""))).toBe("blocked");
    expect(await kind(fake(200, "<html>join</html>", "https://www.linkedin.com/authwall?trk=x"))).toBe("blocked");
    expect(await kind(fake(200, "<html><body>nothing here</body></html>"))).toBe("private");
    expect(await kind(fake(404, ""))).toBe("not_found");
  });
});

describe("parsePublicProfile", () => {
  const { li, text } = parsePublicProfile(HTML, URL_);
  it("reads the top card, About, websites and education despite '>' inside class attributes", () => {
    expect(li).toMatchObject({ name: "Ayşe Demir", headline: "Student at University College London", location: "London, England, United Kingdom", profileUrl: URL_ });
    expect(li.about).toBe("Passionate and driven Economics student who loves data.");
    expect(li.links).toEqual(["https://github.com/aysedemir"]);
    expect(li.education).toEqual([{ school: "University College London", degree: "Bachelor of Science - BSc Economics", startYear: 2025, endYear: 2028, details: "" }]);
    expect(li.languages).toEqual(["Turkish", "English"]);
  });
  it("reads experience cards with month precision and descriptions", () => {
    expect(li.experience[0]).toMatchObject({ company: "UCL Finance Society", title: "Events Officer", dates: "Sep 2024 - Present", start: { year: 2024, month: 9 }, end: null, location: "London, England, United Kingdom" });
    expect(li.experience[0].description).toBe("Organised weekly society events.\nManaged a £2,000 events budget.");
    expect(li.experience[1]).toMatchObject({ company: "Marlowe Café", title: "Barista", start: { year: 2024, month: null } });
  });
  it("marks the skills list as hidden and renders quotable text", () => {
    expect(li.warnings).toContain("public_view_no_skills");
    expect(text).toContain("Sep 2024 - Present");
    expect(text).toContain("Served customers in a busy café.");
  });
  it("scores end to end: skills rules not applicable, CV contradiction still caught", async () => {
    const naJudge = async (i: LiJudgeInput): Promise<LiJudgeResult> => ({ results: i.rules.map((r) => ({ ruleId: r.id, status: "not_applicable", evidenceLine: null, fix: null })), spellingErrors: [], modelId: "stub", cacheable: false });
    const s = await scoreLinkedIn({ li, rawText: text, cv: AYSE_CV, sector: "data_analytics", year: "2nd", today: new Date("2026-10-14"), judge: naJudge });
    expect(s.results.find((r) => r.ruleId === "LI-DATA_ANALYTICS-03")?.status).toBe("not_applicable");
    expect(s.results.find((r) => r.ruleId === "LI-DATA_ANALYTICS-07")?.status).toBe("pass"); // github link from websites
    expect(s.fixes[0].ruleId).toBe("LI-GEN-01");
  });
});

describe("sameName", () => {
  it("matches the student's own name across accents and order, not someone else's", () => {
    expect(sameName("Ayse Demir", "Ayşe Demir")).toBe(true);
    expect(sameName("Demir Ayşe", "Ayşe Demir")).toBe(true);
    expect(sameName("Ayşe Nur Demir", "Ayşe Demir")).toBe(true);
    expect(sameName("Bill Gates", "Ayşe Demir")).toBe(false);
    expect(sameName("Ayşe Yılmaz", "Ayşe Demir")).toBe(false);
  });
});
