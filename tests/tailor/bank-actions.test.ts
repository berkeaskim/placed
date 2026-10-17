import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
vi.mock("@/lib/auth/local-user", async (orig) => {
  const m = await orig<typeof import("@/lib/auth/local-user")>();
  return { ...m, requireUser: async () => ({ user: { id: m.LOCAL_USER_ID, email: m.LOCAL_USER_EMAIL } }) };
});
const spy = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@/lib/ai/tailorCV", async (orig) => {
  const m = await orig<typeof import("@/lib/ai/tailorCV")>();
  return { ...m, tailorCV: (...a: Parameters<typeof m.tailorCV>) => { spy.calls++; return m.tailorCV(...a); } };
});
import { LOCAL_USER_ID as U } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { applications } from "@/lib/db/schema";
import { insertEntry } from "@/lib/bank/store";
import { finalizeTailoredCv, swapBankItem, tailorForJob, type StoredTailoring } from "@/app/(app)/jobs/[id]/actions";
import type { ParsedCV, TailoredCV } from "@/lib/types";
import { seedCv, seedJob, withTempDb } from "../cv/temp-db";

const tmp = withTempDb();

const activeCv = (): ParsedCV => ({
  name: "Ada Student", email: "ada@example.com", phone: "07700 900000", location: "London", links: [], summary: null,
  education: [{ id: "ed0", institution: "University College London", degree: "BSc Mathematics", dates: "2024 - 2027", grade: "First", details: [] }],
  experience: [{ id: "x0", org: "Marlowe Cafe", title: "Barista", dates: "2024 - 2025", location: "London", bullets: [
    { id: "x0-b0", text: "Served 150 customers per shift and kept the till accurate" },
    { id: "x0-b1", text: "Trained 3 new staff on the opening routine" },
  ] }],
  projects: [], leadership: [], skills: [{ group: "Technical", items: ["Excel"] }], interests: null,
  sectionOrder: ["education", "experience", "skills"], yearGuess: null, archetypes: [],
});

const saved = process.env.AI_MODE;
let jobId = "";
let projectId = "";
const stored = () => db.select().from(applications).where(and(eq(applications.user_id, U), eq(applications.job_id, jobId))).get()!;
const tj = () => stored().tailored_json as StoredTailoring;
const v2 = () => { const s = tj(); if (s.v !== 2) throw new Error("expected v2"); return s; };
const entryIds = (cv: ParsedCV) => [cv.experience, cv.projects, cv.leadership].flat().map((e) => e.id);

describe("tailoring from the bank (server actions)", () => {
  beforeAll(async () => {
    process.env.AI_MODE = "fixture";
    seedCv({ is_active: true, parsed_json: activeCv() as never, raw_text: "Marlowe Cafe Barista Served 150 customers per shift" });
    jobId = seedJob({ title: "Data Analyst Intern", text_lines: ["## Requirements", "- Python", "- SQL", "## Nice to have", "- Tableau"] }).id;
  });
  afterAll(() => { if (saved === undefined) delete process.env.AI_MODE; else process.env.AI_MODE = saved; });

  it("tailorForJob stores v: 2 and reports the on-topic project as added", async () => {
    // First call bootstraps the bank from the CV; then add an extra on-topic project to the bank.
    const { ensureBank } = await import("@/lib/bank/import");
    await ensureBank(U);
    projectId = insertEntry(U, {
      section: "projects", org: "London Rent Tracker", title: "Personal project", dates: "2025", startYm: "2025-01", endYm: "2025-06", location: "",
      pinned: false, hidden: false, sourceIds: ["manual"],
      bullets: [
        { text: "Used Python and SQL to collect and clean 1,200 rental listings", position: 0, pinned: false, hidden: false, sourceIds: ["manual"], sourceText: null },
        { text: "Built Tableau charts comparing rents across 12 boroughs", position: 1, pinned: false, hidden: false, sourceIds: ["manual"], sourceText: null },
      ],
    }).id;
    const r = await tailorForJob(jobId);
    expect("error" in r ? r.error : null).toBeNull();
    const s = v2();
    expect(s.v).toBe(2);
    expect(entryIds(s.base)).toContain(projectId);
    expect(s.report.added.map((a) => a.id)).toContain(projectId);
    expect(s.bankStamp).toMatch(/\|[0-9a-f]{40}$/);
    if (!("error" in r)) expect(r.bank?.report.added.map((a) => a.id)).toContain(projectId);
  });

  it("swapBankItem(remove) makes no AI call and drops the project from the stored base", async () => {
    const before = spy.calls;
    const r = await swapBankItem(jobId, projectId, "remove");
    expect("error" in r ? r.error : null).toBeNull();
    expect(spy.calls).toBe(before);
    const s = v2();
    expect(entryIds(s.base)).not.toContain(projectId);
    expect(s.overrides.excluded).toContain(projectId);
    expect(entryIds(s.base)).toHaveLength(1);
  });

  it("swapBankItem(add) puts it back untailored, still with no AI call", async () => {
    const before = spy.calls;
    const r = await swapBankItem(jobId, projectId, "add");
    expect("error" in r ? r.error : null).toBeNull();
    expect(spy.calls).toBe(before);
    const s = v2();
    expect(entryIds(s.base)).toContain(projectId);
    const proj = s.outcome.tailored.projects.find((e) => e.id === projectId)!;
    expect(proj.bullets.every((b) => b.untailored === true && b.changeType === "kept")).toBe(true);
    expect(s.overrides).toEqual({ pinned: [projectId], excluded: [] });
  });

  it("a 2-page final version is refused with 3 removal candidates and nothing stored", async () => {
    const s = v2();
    const pdfPath = stored().tailored_cv_path!;
    const pdfBefore = readFileSync(path.join(tmp.dir(), "files", "tailored", pdfPath));
    const t = s.outcome.tailored;
    const long: TailoredCV = {
      ...t,
      experience: t.experience.map((e) => ({
        ...e,
        bullets: Array.from({ length: 40 }, (_, k) => e.bullets.map((b) => ({ ...b, id: k === 0 ? b.id : `${b.id}-r${k}`, sourceRefs: [...b.sourceRefs] }))).flat(),
      })),
    };
    const r = await finalizeTailoredCv(jobId, long);
    expect("error" in r && r.error).toBe("overflow");
    if (!("error" in r) || r.error !== "overflow" || !("remove" in r)) throw new Error("expected overflow");
    expect(r.remove).toHaveLength(3);
    expect(r.pages).toBeGreaterThan(1);
    expect(r.message).toMatch(/^This is \d+\.\d pages — remove one of these$/);
    expect(stored().tailored_cv_path).toBe(pdfPath);
    expect(readFileSync(path.join(tmp.dir(), "files", "tailored", pdfPath)).equals(pdfBefore)).toBe(true);
    expect(v2().final).toBeNull();
  });
});
