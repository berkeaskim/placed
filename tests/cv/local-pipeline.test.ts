/**
 * End to end on local SQLite + local files, AI in fixture mode (no network): upload a CV PDF → parse → store under
 * data/files/cvs → activate → score → tailor for a seeded job → tailored PDF on disk → download route streams it →
 * an Autopilot claim hands the extension that same file as a same-origin /api/files path.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement as h } from "react";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import { uploadCv } from "@/app/(app)/profile/build/actions";
import { tailorForJob } from "@/app/(app)/jobs/[id]/actions";
import { GET as downloadTailored } from "@/app/api/tailored/[jobId]/route";
import { scoreCv } from "@/lib/cv-score/run";
import { loadCvScorePanel } from "@/lib/cv-score/panel-data";
import { claimPack } from "@/lib/autopilot/server";
import { mintToken } from "@/lib/autopilot/handoff";
import { db } from "@/lib/db/client";
import { applications, autopilotPacks, cvScores, cvs } from "@/lib/db/schema";
import { LOCAL_USER_ID as U } from "@/lib/auth/local-user";
import { seedJob, withTempDb } from "./temp-db";

const tmp = withTempDb();
const prevMode = process.env.AI_MODE;
beforeAll(() => { process.env.AI_MODE = "fixture"; });
afterAll(() => { if (prevMode === undefined) delete process.env.AI_MODE; else process.env.AI_MODE = prevMode; });

const LINES = [
  "Sam Patel", "sam.patel@example.com | +44 7700 900456 | London",
  "EDUCATION", "University College London — BSc Computer Science, 2025–2028",
  "EXPERIENCE", "Coding Society — Workshop Lead, 2025–present",
  "• Ran fortnightly Python workshops for 40 first-year students and wrote exercises on testing and data structures",
  "• Built a TypeScript and React dashboard used by 300 members to book sessions and track attendance",
  "PROJECTS", "Tube Delay Tracker", "• Built a web app in TypeScript and React showing live TfL delays with a SQL backend",
  "SKILLS", "Python, TypeScript, React, SQL, Git",
];
const pdf = async () => new Uint8Array(await renderToBuffer(h(Document, {}, h(Page, { size: "A4" }, h(View, {}, ...LINES.map((l, i) => h(Text, { key: i }, l)))))));
const file = (rel: string) => path.join(tmp.dir(), "files", rel);

describe("local CV pipeline (fixture AI)", () => {
  it("upload → score → tailor → tailored PDF on disk, downloadable and claimable", async () => {
    const fd = new FormData();
    fd.set("cv", new File([await pdf() as BlobPart], "cv.pdf", { type: "application/pdf" }));
    const up = await uploadCv(fd);
    expect(up).toMatchObject({ ok: true, imageOnly: false });
    const cvId = (up as { cvId: string }).cvId;

    const cv = db.select().from(cvs).where(eq(cvs.id, cvId)).get()!;
    expect(cv.is_active).toBe(true);
    expect(existsSync(file(`cvs/${cv.storage_path}`))).toBe(true);
    expect(cv.parsed_json.name).toBeTruthy();

    const score = await scoreCv({ userId: U, cvId, sector: "software_eng", year: "1st" });
    expect(score.total).toBeGreaterThan(0);
    expect(db.select().from(cvScores).where(eq(cvScores.cv_id, cvId)).all()).toHaveLength(1);
    // Fixture mode has no judge verdicts, so the score is provisional and stays out of the trend line (audit 04#11).
    expect(await loadCvScorePanel({ userId: U, cvId, sector: "software_eng", year: "1st" })).toMatchObject({ cvId, total: score.total, provisional: true, history: [] });

    const job = seedJob({
      title: "Software Engineering Intern", archetype: "software_eng", is_live: true,
      requirements: [
        { text: "Experience with Python", skill: "Python", importance: "critical", section: "must", evidenceTier: "stated" },
        { text: "Familiarity with React", skill: "React", importance: "high", section: "nice", evidenceTier: "stated" },
      ],
      text_lines: ["We are looking for a Software Engineering Intern.", "Experience with Python", "Familiarity with React"],
    });
    const t = await tailorForJob(job.id);
    if ("error" in t) throw new Error(t.error);
    expect(t.pdfUrl).toBe(`/api/tailored/${job.id}`);
    expect(t.signedUrl).toBe(`/api/files/tailored/${U}/${job.id}.pdf?download=CV-tailored.pdf`);

    const app = db.select().from(applications).where(and(eq(applications.user_id, U), eq(applications.job_id, job.id))).get()!;
    expect(app.tailored_cv_path).toBe(`${U}/${job.id}.pdf`);
    const onDisk = readFileSync(file(`tailored/${app.tailored_cv_path}`));
    expect(onDisk.subarray(0, 5).toString()).toBe("%PDF-");

    const res = await downloadTailored(new Request(`http://localhost:3000/api/tailored/${job.id}`), { params: Promise.resolve({ jobId: job.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(onDisk);

    const tok = mintToken();
    db.insert(autopilotPacks).values({
      user_id: U, job_id: job.id, form: { ats: "greenhouse", url: job.url, fields: [] }, status: "ready", token_hash: tok.hash, token_expires_at: tok.expiresAt,
    }).run();
    const claimed = await claimPack(tok.token);
    expect(claimed.status === 200 && claimed.body.cv?.url).toBe(`/api/files/tailored/${U}/${job.id}.pdf`);
  }, 60_000);
});
