import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/client";
import { linkedinScores } from "@/lib/db/schema";
import { mintCaptureToken } from "@/lib/linkedin/capture-token";
import { loadLatestLinkedInScore } from "@/lib/linkedin-score/run";
import { LI_SECTOR_IMPORTANCE } from "@/lib/linkedin-rules";
import type { LiJudgeInput, LiJudgeResult } from "@/lib/ai/judgeLinkedIn";
import { U, withTempDb } from "../gamify/temp-db";

vi.mock("@/lib/ai/judgeLinkedIn", async (orig) => ({
  ...(await orig<object>()),
  judgeLinkedIn: async (i: LiJudgeInput): Promise<LiJudgeResult> => ({
    results: i.rules.map((r) => ({ ruleId: r.id, status: "not_applicable", evidenceLine: null, fix: null })), spellingErrors: [], modelId: "stub", cacheable: false,
  }),
}));

const { POST, OPTIONS } = await import("@/app/api/linkedin/capture/route");

withTempDb(() => { db.delete(linkedinScores).run(); });
const prev = process.env.LINKEDIN_CAPTURE_SECRET;
beforeAll(() => { process.env.LINKEDIN_CAPTURE_SECRET = "test-secret"; });
afterAll(() => { process.env.LINKEDIN_CAPTURE_SECRET = prev; });

const EXT = `chrome-extension://${"a".repeat(32)}`;
const profile = {
  profileUrl: "https://www.linkedin.com/in/ayse-demir-4b7a91c2", name: "Ayşe Demir",
  top: ["Economics @ UCL", "London, England, United Kingdom"],
  experience: [["Data Analyst Intern", "Brew & Co · Internship", "Jun 2025 - Aug 2025 · 3 mos"]],
};
const post = (body: unknown, headers: Record<string, string> = { origin: EXT, host: "localhost:3000" }) =>
  POST(new Request("http://localhost:3000/api/linkedin/capture", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));

describe("POST /api/linkedin/capture", () => {
  it("scores and stores a capture once per ticket", async () => {
    const token = mintCaptureToken({ userId: U, sector: "consulting", year: "2nd" });
    const res = await post({ token, profile });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
    expect(await res.json()).toMatchObject({ ok: true, saved: true });
    const rows = db.select().from(linkedinScores).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].meta).toMatchObject({ captureNonce: expect.any(String), source: "extension" });
    expect(await loadLatestLinkedInScore(U, "consulting", LI_SECTOR_IMPORTANCE.consulting)).toMatchObject({ sector: "consulting", saved: true });
    expect(await loadLatestLinkedInScore(U, "data_analytics", LI_SECTOR_IMPORTANCE.data_analytics)).toBeNull();

    expect((await post({ token, profile })).status).toBe(410);
    expect(db.select().from(linkedinScores).all()).toHaveLength(1);
  });

  it("refuses foreign origins, non-loopback hosts, and bad tickets", async () => {
    const token = mintCaptureToken({ userId: U, sector: "consulting", year: "2nd" });
    expect((await post({ token, profile }, { origin: "https://evil.example", host: "localhost:3000" })).status).toBe(403);
    expect((await post({ token, profile }, { origin: EXT, host: "evil.example" })).status).toBe(403);
    expect((await post({ token: "nope", profile })).status).toBe(410);
    expect((await post({ token, profile: { name: 1 } })).status).toBe(400);
    expect(db.select().from(linkedinScores).all()).toHaveLength(0);
  });

  it("answers the preflight only for the extension", async () => {
    const pre = (origin: string) => OPTIONS(new Request("http://localhost:3000/api/linkedin/capture", { method: "OPTIONS", headers: { origin } }));
    expect((await pre(EXT)).headers.get("access-control-allow-origin")).toBe(EXT);
    expect((await pre("https://evil.example")).headers.get("access-control-allow-origin")).toBeNull();
  });
});
