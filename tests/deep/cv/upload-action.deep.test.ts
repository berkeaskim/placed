import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createElement as h } from "react";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ParsedCV } from "@/lib/types";
import { db } from "@/lib/db/client";
import { cvs, profiles } from "@/lib/db/schema";
import { LOCAL_USER_ID } from "@/lib/auth/local-user";
import { seedCv, withTempDb } from "../../cv/temp-db";

// ---------- module mocks (no network): real temp SQLite + files ----------
const state = vi.hoisted(() => ({
  parseCV: null as unknown as (i: { base64: string; text: string; fixtureKey?: string }) => Promise<unknown>,
  awardXP: null as unknown as (...a: unknown[]) => Promise<unknown>,
}));
vi.mock("@/lib/ai/parseCV", () => ({ parseCV: (i: never) => state.parseCV(i) }));
vi.mock("@/lib/gamify/award", () => ({ awardXP: (...a: unknown[]) => state.awardXP(...a) }));
// The profile row is ensured once by withTempDb; requireUser must not touch the DB while a test hides the profiles table.
vi.mock("@/lib/auth/local-user", async (orig) => {
  const m = await orig<typeof import("@/lib/auth/local-user")>();
  return { ...m, requireUser: async () => ({ user: { id: m.LOCAL_USER_ID, email: m.LOCAL_USER_EMAIL } }) };
});

import { uploadCv } from "@/app/(app)/profile/build/actions";

const tmp = withTempDb();
const U = LOCAL_USER_ID;
type Profile = typeof profiles.$inferSelect;
const allCvs = () => db.select().from(cvs).all();
const profile = () => db.select().from(profiles).where(eq(profiles.user_id, U)).get()!;
const storedFiles = () => {
  const d = path.join(tmp.dir(), "files", "cvs", U);
  return existsSync(d) ? readdirSync(d).filter((f) => !f.endsWith(".content-type")) : [];
};
const trigger = (name: string, sql: string) => db.$client.exec(`CREATE TEMP TRIGGER ${name} ${sql}`);
const BOOM = "BEGIN SELECT RAISE(ABORT, 'boom'); END";

/** Resets the DB and files: optional prior CV rows, the profile, and failure injection. */
async function makeEnv(opts: {
  cvs?: Partial<typeof cvs.$inferInsert>[]; profile?: Partial<Profile>;
  insertError?: boolean; activateError?: boolean; uploadError?: boolean; profileReadError?: boolean;
} = {}) {
  for (const t of ["fail_insert", "fail_update"]) db.$client.exec(`DROP TRIGGER IF EXISTS temp.${t}`);
  db.delete(cvs).run();
  rmSync(path.join(tmp.dir(), "files"), { recursive: true, force: true });
  db.update(profiles).set({ year: "2nd", target_archetype: null, archetypes: [{ key: "consulting", score: 80, why: [] }], skills: ["Excel"], ...opts.profile })
    .where(eq(profiles.user_id, U)).run();
  for (const c of opts.cvs ?? []) seedCv(c);
  if (opts.insertError) trigger("fail_insert", `BEFORE INSERT ON cvs ${BOOM}`);
  if (opts.activateError) trigger("fail_update", `BEFORE UPDATE OF is_active ON cvs WHEN NEW.is_active = 1 ${BOOM}`);
  if (opts.uploadError) { mkdirSync(path.join(tmp.dir(), "files"), { recursive: true }); writeFileSync(path.join(tmp.dir(), "files", "cvs"), "not a dir"); }
  if (opts.profileReadError) db.$client.exec("ALTER TABLE profiles RENAME TO profiles_hidden");
}
afterEach(() => {
  const hidden = db.$client.prepare("select name from sqlite_master where name = 'profiles_hidden'").get();
  if (hidden) db.$client.exec("ALTER TABLE profiles_hidden RENAME TO profiles");
});

// ---------- fixtures ----------
const LINES = [
  "Sam Patel", "sam.patel@example.com | +44 7700 900456 | London",
  "EDUCATION", "University College London — BSc Computer Science, 2025–2028",
  "EXPERIENCE", "Coding Society — Workshop Lead, 2025–present",
  "• Ran fortnightly Python workshops for 40 first-year students and wrote exercises on testing and data structures",
  "• Built a TypeScript and React dashboard used by 300 members to book sessions and track attendance",
  "PROJECTS", "Tube Delay Tracker", "• Built a web app in TypeScript and React showing live TfL delays with a SQL backend",
  "SKILLS", "Python, TypeScript, React, SQL, Git",
];
async function makePdf(pages: string[][]): Promise<Uint8Array> {
  const doc = h(Document, {}, ...pages.map((lines, p) =>
    h(Page, { size: "A4", key: p }, h(View, {}, ...lines.map((l, i) => h(Text, { key: i }, l))))));
  return new Uint8Array(await renderToBuffer(doc));
}
/** Minimal PDF with a Standard-security /Encrypt dict whose /U doesn't match the empty password → pdf.js PasswordException. */
function encryptedPdf(): Uint8Array {
  const hex = (n: number) => Array.from({ length: n }, (_, i) => ((i * 37 + 11) % 256).toString(16).padStart(2, "0")).join("");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
    `<< /Filter /Standard /V 1 /R 2 /O <${hex(32)}> /U <${hex(32)}> /P -44 >>`,
  ];
  let out = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Encrypt 4 0 R /ID [<${hex(16)}><${hex(16)}>] >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
function parsed(over: Partial<ParsedCV> = {}): ParsedCV {
  return {
    name: "Sam Patel", email: null, phone: null, location: null, links: [], summary: null,
    education: [], experience: [], projects: [], leadership: [], skills: [{ group: "Skills", items: ["python", "React"] }],
    interests: null, sectionOrder: [], yearGuess: "1st",
    archetypes: [{ key: "software_eng", score: 90, why: [] }, { key: "research", score: 0, why: [] }],
    ...over,
  } as ParsedCV;
}
const form = (bytes: Uint8Array | string, name = "cv.pdf", type = "application/pdf") => {
  const fd = new FormData();
  fd.set("cv", new File([bytes as BlobPart], name, { type }));
  return fd;
};
const PRIOR = { id: "00000000-0000-4000-8000-0000000000cc", storage_path: `${LOCAL_USER_ID}/1.pdf`, is_active: true };
const priorOnly = () => expect(allCvs().map((c) => [c.id, c.is_active])).toEqual([[PRIOR.id, true]]);
let textPdf: Uint8Array;
let blankPdf: Uint8Array;

beforeEach(async () => {
  textPdf ??= await makePdf([LINES]);
  blankPdf ??= await makePdf([[]]);
  state.parseCV = vi.fn(async () => parsed());
  state.awardXP = vi.fn(async () => ({ xpGained: 100, newXp: 100, level: 2, levelName: "Applicant", levelUp: true, streakDays: 1, newBadges: [] }));
});

describe("uploadCv — input validation", () => {
  it("rejects a missing file, an empty file and a non-File field", async () => {
    await makeEnv();
    expect(await uploadCv(new FormData())).toEqual({ error: "Choose a PDF first." });
    expect(await uploadCv(form(new Uint8Array(0)))).toEqual({ error: "Choose a PDF first." });
    const fd = new FormData(); fd.set("cv", "%PDF-1.4 not a file");
    expect(await uploadCv(fd)).toEqual({ error: "Choose a PDF first." });
    expect(storedFiles()).toEqual([]);
  });
  it("rejects non-PDF MIME types", async () => {
    await makeEnv();
    for (const t of ["text/plain", "image/png", "application/msword", "", "application/pdf; charset=binary"]) {
      expect(await uploadCv(form(textPdf, "cv.pdf", t))).toEqual({ error: "Please upload a PDF." });
    }
  });
  it("rejects files over 4 MB before reading or parsing them", async () => {
    await makeEnv();
    const big = new Uint8Array(4 * 1024 * 1024 + 1); big.set(new TextEncoder().encode("%PDF-1.4"));
    expect(await uploadCv(form(big))).toEqual({ error: "That file is over 4 MB — export a smaller PDF." });
    expect(state.parseCV).not.toHaveBeenCalled();
    expect(storedFiles()).toEqual([]);
  });
  it("exactly 4 MB passes the size gate (then fails as an unopenable PDF, not as too big)", async () => {
    await makeEnv();
    const four = new Uint8Array(4 * 1024 * 1024); four.set(new TextEncoder().encode("%PDF-1.4\n"));
    const r = await uploadCv(form(four));
    expect(r).toHaveProperty("error");
    expect((r as { error: string }).error).not.toMatch(/over 4 MB/);
  }, 30_000);
  it("rejects a spoofed MIME (application/pdf with non-PDF magic bytes)", async () => {
    await makeEnv();
    for (const body of ["<html><script>alert(1)</script></html>", "PK\u0003\u0004 docx", " %PDF-1.4 leading space"]) {
      expect(await uploadCv(form(body))).toEqual({ error: "That doesn't look like a PDF. Export your CV as PDF and try again." });
    }
    expect(state.parseCV).not.toHaveBeenCalled();
    expect(storedFiles()).toEqual([]);
  });
});

describe("uploadCv — unreadable PDFs", () => {
  it("corrupt PDF (valid header, garbage body) → friendly error, nothing stored", async () => {
    await makeEnv({ cvs: [{ ...PRIOR }] });
    const r = await uploadCv(form("%PDF-1.7\n\u0000\u0001garbage garbage garbage\n%%EOF"));
    expect(r).toEqual({ error: "We couldn't open this PDF. Try exporting it again, or take the quiz instead." });
    expect(state.parseCV).not.toHaveBeenCalled();
    expect(storedFiles()).toEqual([]);
    priorOnly();
  }, 30_000);
  it("encrypted (password-protected) PDF → friendly error, nothing stored", async () => {
    await makeEnv({ cvs: [{ ...PRIOR }] });
    const { extractPdf } = await import("@/lib/cv/pdf-text");
    await expect(extractPdf(encryptedPdf())).rejects.toMatchObject({ name: "PasswordException" });
    const r = await uploadCv(form(encryptedPdf()));
    expect(r).toEqual({ error: "We couldn't open this PDF. Try exporting it again, or take the quiz instead." });
    expect(storedFiles()).toEqual([]);
    priorOnly();
  }, 30_000);
  it("truncated PDF never throws out of the action", async () => {
    await makeEnv();
    const r = await uploadCv(form(textPdf.slice(0, Math.floor(textPdf.length / 2))));
    expect(r).toBeTypeOf("object");
  }, 30_000);
  it("parseCV failure → friendly error, nothing uploaded or inserted", async () => {
    await makeEnv({ cvs: [{ ...PRIOR }] });
    state.parseCV = vi.fn(async () => { throw new Error("AI timeout"); });
    expect(await uploadCv(form(textPdf))).toEqual({ error: "We couldn't read this CV right now. Try again in a minute, or take the quiz." });
    expect(storedFiles()).toEqual([]);
    priorOnly();
  }, 30_000);
});

describe("uploadCv — image-only / empty CVs keep the prior profile", () => {
  it("detects an image-only PDF and keeps archetypes/skills/target from the quiz", async () => {
    await makeEnv({ profile: { target_archetype: "consulting" } });
    state.parseCV = vi.fn(async () => parsed({ skills: [], archetypes: [{ key: "software_eng", score: 100, why: [] }] }));
    const r = await uploadCv(form(blankPdf));
    expect(r).toMatchObject({ ok: true, imageOnly: true });
    expect(profile().archetypes).toEqual([{ key: "consulting", score: 80, why: [] }]);
    expect(profile().skills).toEqual(["Excel"]);
    expect(profile().target_archetype).toBe("consulting");
    expect(state.awardXP).toHaveBeenCalledWith(U, { type: "cv_uploaded", profileComplete: false });
  }, 30_000);
  it("image-only CV even when the vision parse returns skills does not overwrite the profile", async () => {
    await makeEnv();
    const r = await uploadCv(form(blankPdf));
    expect(r).toMatchObject({ ok: true, imageOnly: true });
    expect(profile().skills).toEqual(["Excel"]);
  }, 30_000);
  it("a text PDF whose parse has no skills/archetypes keeps the prior profile", async () => {
    await makeEnv();
    const fillerPdf = await makePdf([[
      "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua",
      "Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute",
      "Irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat",
    ]]);
    state.parseCV = vi.fn(async () => parsed({ skills: [], archetypes: [{ key: "research", score: 0, why: [] }] }));
    const r = await uploadCv(form(fillerPdf));
    expect(r).toMatchObject({ ok: true, imageOnly: false });
    expect(profile().archetypes).toEqual([{ key: "consulting", score: 80, why: [] }]);
    expect(profile().skills).toEqual(["Excel"]);
  }, 30_000);
  it("a readable CV replaces archetypes (score>0 only) and canonicalises skills, but keeps year & target", async () => {
    await makeEnv({ profile: { target_archetype: "consulting", year: "penultimate" } });
    const r = await uploadCv(form(textPdf));
    expect(r).toMatchObject({ ok: true, imageOnly: false });
    expect(profile().archetypes).toEqual([{ key: "software_eng", score: 90, why: [] }]);
    expect(profile().skills).toEqual(expect.arrayContaining(["Python", "React"]));
    expect(new Set(profile().skills).size).toBe(profile().skills.length);
    expect(profile().target_archetype).toBe("consulting");
    expect(profile().year).toBe("penultimate");
  }, 30_000);
  it("fills target_archetype and year from the CV when the profile had none", async () => {
    await makeEnv({ profile: { target_archetype: null, year: null } });
    await uploadCv(form(textPdf));
    expect(profile().target_archetype).toBe("software_eng");
    expect(profile().year).toBe("1st");
  }, 30_000);

  // Fixed: a failed profile read used to clobber the onboarding year / chosen target.
  it("a failed profile read does not overwrite the onboarding year or chosen target", async () => {
    await makeEnv({ profileReadError: true, profile: { year: "final", target_archetype: "consulting" } });
    state.parseCV = vi.fn(async () => parsed({ yearGuess: null }));
    expect(await uploadCv(form(textPdf))).toMatchObject({ ok: true });
    db.$client.exec("ALTER TABLE profiles_hidden RENAME TO profiles");
    expect(profile().year).toBe("final");
    expect(profile().target_archetype).toBe("consulting");
  }, 30_000);
});

describe("uploadCv — active-CV swap", () => {
  it("success: exactly one active CV (the new one); prior is deactivated, other users untouched", async () => {
    const other = { id: "00000000-0000-4000-8000-0000000000dd", user_id: "u2", storage_path: "u2/1.pdf", is_active: true };
    await makeEnv({ cvs: [{ ...PRIOR }, other] });
    const r = await uploadCv(form(textPdf));
    expect(r).toMatchObject({ ok: true });
    const id = (r as { cvId: string }).cvId;
    expect(allCvs().filter((c) => c.user_id === U && c.is_active).map((c) => c.id)).toEqual([id]);
    expect(allCvs().find((c) => c.id === other.id)!.is_active).toBe(true);
    const row = allCvs().find((c) => c.id === id)!;
    expect(row).toMatchObject({ user_id: U, page_count: 1, file_size: textPdf.length });
    expect(new Uint8Array(readFileSync(path.join(tmp.dir(), "files", "cvs", row.storage_path)))).toEqual(textPdf);
  }, 30_000);
  it("storage write failure → error and no DB row", async () => {
    await makeEnv({ cvs: [{ ...PRIOR }], uploadError: true });
    expect(await uploadCv(form(textPdf))).toEqual({ error: "Upload failed — try again." });
    priorOnly();
  }, 30_000);
  it("insert failure → orphaned file is removed and the prior CV stays active", async () => {
    await makeEnv({ cvs: [{ ...PRIOR }], insertError: true });
    expect(await uploadCv(form(textPdf))).toEqual({ error: "Couldn't save your CV — try again." });
    expect(storedFiles()).toEqual([]);
    priorOnly();
  }, 30_000);
  it("activate failure → new row rolled back, file removed, prior remains the single active CV", async () => {
    await makeEnv({ cvs: [{ ...PRIOR }], activateError: true });
    expect(await uploadCv(form(textPdf))).toEqual({ error: "Couldn't save your CV — try again." });
    priorOnly();
    expect(storedFiles()).toEqual([]);
    expect(state.awardXP).not.toHaveBeenCalled();
  }, 30_000);
  it("two concurrent uploads leave exactly one active CV and two distinct files", async () => {
    await makeEnv({ cvs: [{ ...PRIOR }] });
    const rs = await Promise.all([uploadCv(form(textPdf)), uploadCv(form(textPdf))]);
    expect(rs.every((r) => "ok" in r)).toBe(true);
    expect(allCvs().filter((c) => c.user_id === U && c.is_active)).toHaveLength(1);
    expect(storedFiles()).toHaveLength(2);
  }, 30_000);
});

describe("uploadCv — filenames and awards", () => {
  it("never uses the client filename in the storage path (path traversal / XSS names)", async () => {
    for (const name of ["../../../etc/passwd.pdf", "..\\..\\x.pdf", "<img src=x onerror=alert(1)>.pdf", "a/b/c.pdf", "%2e%2e%2f.pdf", "‮fdp.exe"]) {
      await makeEnv();
      const r = await uploadCv(form(textPdf, name));
      expect(r).toMatchObject({ ok: true });
      expect(storedFiles()).toHaveLength(1);
      expect(allCvs()[0].storage_path).toMatch(new RegExp(`^${U}/\\d+-[0-9a-f]{8}\\.pdf$`));
      expect(JSON.stringify(allCvs())).not.toContain(name);
    }
  }, 60_000);
  it("passes the PDF to parseCV as base64 with a content-derived fixture key", async () => {
    await makeEnv();
    await uploadCv(form(textPdf));
    const arg = (state.parseCV as ReturnType<typeof vi.fn>).mock.calls[0][0] as { base64: string; text: string; fixtureKey: string };
    expect(Buffer.from(arg.base64, "base64")).toEqual(Buffer.from(textPdf));
    expect(arg.text).toContain("Sam Patel");
    expect(arg.fixtureKey).toMatch(/^[0-9a-f]{12}$/);
  }, 30_000);

  // Fixed: an XP failure after the CV is committed used to reject the whole action.
  it("an awardXP failure after a successful save still resolves ok (award: null)", async () => {
    await makeEnv();
    state.awardXP = vi.fn(async () => { throw new Error("awardXP: incrementing xp failed: timeout"); });
    const r = await uploadCv(form(textPdf));
    expect(r).toMatchObject({ ok: true, award: null });
    expect(allCvs().filter((c) => c.is_active)).toHaveLength(1);
  }, 30_000);
});
