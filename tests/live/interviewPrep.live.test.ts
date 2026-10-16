import { describe, it, expect } from "vitest";
import { LIVE } from "./_harness";
import { generatePrepPack } from "@/lib/ai/interviewPrep";

describe.skipIf(!LIVE)("interviewPrep live", () => {
  it("finds real, resolved sources and at least one reported question for a well-covered employer", async () => {
    const t = Date.now();
    const r = await generatePrepPack({ company: "Goldman Sachs", jobTitle: "Summer Analyst", roleKey: "investment_banking:internship", jdText: "Investment Banking Division summer analyst programme, London." });
    console.log("interviewPrep ms", Date.now() - t, "sources", r.sources.length, "reported", r.pack.questions.filter((q) => q.reported).length, "of", r.pack.questions.length);
    console.log(JSON.stringify(r.sources.slice(0, 5)), JSON.stringify(r.pack.questions.slice(0, 3)));
    expect(r.grounded).toBe(true);
    expect(r.sources.length).toBeGreaterThan(0);
    expect(r.sources.every((s) => !s.url.includes("vertexaisearch"))).toBe(true);
    expect(r.pack.questions.length).toBeGreaterThanOrEqual(8);
    expect(r.pack.questions.some((q) => q.reported && q.sourceUrl)).toBe(true);
  }, 180_000);
});
