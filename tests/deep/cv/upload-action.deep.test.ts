import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement as h } from "react";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ParsedCV } from "@/lib/types";

// ---------- module mocks (no network, no real Supabase) ----------
const state = vi.hoisted(() => ({
  supabase: null as unknown,
  admin: null as unknown,
  parseCV: null as unknown as (i: { base64: string; text: string; fixtureKey?: string }) => Promise<unknown>,
  awardXP: null as unknown as (...a: unknown[]) => Promise<unknown>,
}));
vi.mock("@/lib/supabase/server", () => ({
  requireUser: async () => ({ supabase: state.supabase, user: { id: "u1" } }),
  createClient: async () => state.supabase,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => state.admin }));
vi.mock("@/lib/ai/parseCV", () => ({ parseCV: (i: never) => state.parseCV(i) }));
vi.mock("@/lib/gamify/award", () => ({ awardXP: (...a: unknown[]) => state.awardXP(...a) }));

import { uploadCv } from "@/app/(app)/profile/build/actions";

// ---------- in-memory DB ----------
type CvRow = { id: string; user_id: string; storage_path: string; is_active: boolean; [k: string]: unknown };
type Profile = { user_id: string; year: string | null; target_archetype: string | null; archetypes: unknown[]; skills: string[] };
const tick = () => new Promise((r) => setTimeout(r, 0));

function makeEnv(opts: {
  cvs?: CvRow[]; profile?: Partial<Profile>;
  insertError?: boolean; deactivateError?: boolean; uploadError?: boolean; profileReadError?: boolean;
  insertBarrier?: number; // block inserts until this many have arrived (forces the race interleaving)
} = {}) {
  const db = {
    cvs: [...(opts.cvs ?? [])] as CvRow[],
    profile: { user_id: "u1", year: "2nd", target_archetype: null, archetypes: [{ key: "consulting", score: 80, why: [] }], skills: ["Excel"], ...opts.profile } as Profile,
    profileUpdates: [] as Record<string, unknown>[],
    storage: new Map<string, Uint8Array>(),
    uploads: [] as string[],
    removed: [] as string[],
  };
  let nextId = 1;
  let arrived = 0;
  let release!: () => void;
  const barrier = new Promise<void>((r) => (release = r));

  const from = (table: string) => {
    let op = "";
    let payload: Record<string, unknown> = {};
    const eqs: [string, unknown][] = [];
    const neqs: [string, unknown][] = [];
    const b: Record<string, unknown> = {};
    b.select = () => { if (!op) op = "select"; return b; };
    b.insert = (p: Record<string, unknown>) => { op = "insert"; payload = p; return b; };
    b.update = (p: Record<string, unknown>) => { op = "update"; payload = p; return b; };
    b.delete = () => { op = "delete"; return b; };
    b.eq = (c: string, v: unknown) => { eqs.push([c, v]); return b; };
    b.neq = (c: string, v: unknown) => { neqs.push([c, v]); return b; };
    const match = (r: Record<string, unknown>) => eqs.every(([c, v]) => r[c] === v) && neqs.every(([c, v]) => r[c] !== v);
    const exec = async (): Promise<{ data?: unknown; error: { message: string } | null }> => {
      await tick();
      if (table === "cvs" && op === "insert") {
        if (opts.insertError) return { data: null, error: { message: "insert failed" } };
        const row = { ...payload, id: `cv-new-${nextId++}` } as CvRow;
        db.cvs.push(row);
        if (opts.insertBarrier) {
          if (++arrived >= opts.insertBarrier) release();
          await barrier;
        }
        return { data: { id: row.id }, error: null };
      }
      if (table === "cvs" && op === "update") {
        if (opts.deactivateError) return { error: { message: "update failed" } };
        db.cvs.filter(match).forEach((r) => Object.assign(r, payload));
        return { error: null };
      }
      if (table === "cvs" && op === "delete") { db.cvs = db.cvs.filter((r) => !match(r)); return { error: null }; }
      if (table === "profiles" && op === "select") {
        if (opts.profileReadError) return { data: null, error: { message: "timeout" } };
        return { data: { year: db.profile.year, target_archetype: db.profile.target_archetype }, error: null };
      }
      if (table === "profiles" && op === "update") { db.profileUpdates.push(payload); Object.assign(db.profile, payload); return { error: null }; }
      throw new Error(`unexpected ${table}.${op}`);
    };
    b.single = exec;
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => exec().then(res, rej);
    return b;
  };
  // activate_cv (0007): one transaction, serialised per user — modelled as a synchronous swap.
  const rpc = async (name: string, args: { p_cv: string }) => {
    await tick();
    if (name !== "activate_cv") throw new Error(`unexpected rpc ${name}`);
    if (opts.deactivateError) return { data: null, error: { message: "activate failed" } };
    const row = db.cvs.find((r) => r.id === args.p_cv && r.user_id === "u1");
    if (!row) return { data: null, error: { message: "not found" } };
    db.cvs.filter((r) => r.user_id === "u1").forEach((r) => (r.is_active = r.id === args.p_cv));
    return { data: null, error: null };
  };
  state.supabase = { from, rpc };
  state.admin = {
    storage: {
      from: () => ({
        upload: async (path: string, bytes: Uint8Array) => {
          await tick();
          if (opts.uploadError) return { error: { message: "storage down" } };
          db.uploads.push(path); db.storage.set(path, bytes); return { error: null };
        },
        remove: async (paths: string[]) => { db.removed.push(...paths); paths.forEach((p) => db.storage.delete(p)); return { error: null }; },
      }),
    },
  };
  return db;
}

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
const PRIOR: CvRow = { id: "cv-old", user_id: "u1", storage_path: "u1/1.pdf", is_active: true };
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
    const db = makeEnv();
    expect(await uploadCv(new FormData())).toEqual({ error: "Choose a PDF first." });
    expect(await uploadCv(form(new Uint8Array(0)))).toEqual({ error: "Choose a PDF first." });
    const fd = new FormData(); fd.set("cv", "%PDF-1.4 not a file");
    expect(await uploadCv(fd)).toEqual({ error: "Choose a PDF first." });
    expect(db.uploads).toEqual([]);
  });
  it("rejects non-PDF MIME types", async () => {
    makeEnv();
    for (const t of ["text/plain", "image/png", "application/msword", "", "application/pdf; charset=binary"]) {
      expect(await uploadCv(form(textPdf, "cv.pdf", t))).toEqual({ error: "Please upload a PDF." });
    }
  });
  it("rejects files over 5 MB before reading or parsing them", async () => {
    const db = makeEnv();
    const big = new Uint8Array(5 * 1024 * 1024 + 1); big.set(new TextEncoder().encode("%PDF-1.4"));
    expect(await uploadCv(form(big))).toEqual({ error: "That file is over 5 MB — export a smaller PDF." });
    expect(state.parseCV).not.toHaveBeenCalled();
    expect(db.uploads).toEqual([]);
  });
  it("exactly 5 MB passes the size gate (then fails as an unopenable PDF, not as too big)", async () => {
    makeEnv();
    const five = new Uint8Array(5 * 1024 * 1024); five.set(new TextEncoder().encode("%PDF-1.4\n"));
    const r = await uploadCv(form(five));
    expect(r).toHaveProperty("error");
    expect((r as { error: string }).error).not.toMatch(/over 5 MB/);
  }, 30_000);
  it("rejects a spoofed MIME (application/pdf with non-PDF magic bytes)", async () => {
    const db = makeEnv();
    for (const body of ["<html><script>alert(1)</script></html>", "PK\u0003\u0004 docx", " %PDF-1.4 leading space"]) {
      expect(await uploadCv(form(body))).toEqual({ error: "That doesn't look like a PDF. Export your CV as PDF and try again." });
    }
    expect(state.parseCV).not.toHaveBeenCalled();
    expect(db.uploads).toEqual([]);
  });
});

describe("uploadCv — unreadable PDFs", () => {
  it("corrupt PDF (valid header, garbage body) → friendly error, nothing stored", async () => {
    const db = makeEnv({ cvs: [{ ...PRIOR }] });
    const r = await uploadCv(form("%PDF-1.7\n\u0000\u0001garbage garbage garbage\n%%EOF"));
    expect(r).toEqual({ error: "We couldn't open this PDF. Try exporting it again, or take the quiz instead." });
    expect(state.parseCV).not.toHaveBeenCalled();
    expect(db.uploads).toEqual([]);
    expect(db.cvs).toEqual([PRIOR]);
  }, 30_000);
  it("encrypted (password-protected) PDF → friendly error, nothing stored", async () => {
    const db = makeEnv({ cvs: [{ ...PRIOR }] });
    const { extractPdf } = await import("@/lib/cv/pdf-text");
    await expect(extractPdf(encryptedPdf())).rejects.toMatchObject({ name: "PasswordException" });
    const r = await uploadCv(form(encryptedPdf()));
    expect(r).toEqual({ error: "We couldn't open this PDF. Try exporting it again, or take the quiz instead." });
    expect(db.uploads).toEqual([]);
    expect(db.cvs.filter((c) => c.is_active).map((c) => c.id)).toEqual(["cv-old"]);
  }, 30_000);
  it("truncated PDF never throws out of the action", async () => {
    makeEnv();
    const r = await uploadCv(form(textPdf.slice(0, Math.floor(textPdf.length / 2))));
    expect(r).toBeTypeOf("object");
  }, 30_000);
  it("parseCV failure → friendly error, nothing uploaded or inserted", async () => {
    const db = makeEnv({ cvs: [{ ...PRIOR }] });
    state.parseCV = vi.fn(async () => { throw new Error("AI timeout"); });
    expect(await uploadCv(form(textPdf))).toEqual({ error: "We couldn't read this CV right now. Try again in a minute, or take the quiz." });
    expect(db.uploads).toEqual([]);
    expect(db.cvs).toEqual([PRIOR]);
  }, 30_000);
});

describe("uploadCv — image-only / empty CVs keep the prior profile", () => {
  it("detects an image-only PDF and keeps archetypes/skills/target from the quiz", async () => {
    const db = makeEnv({ profile: { target_archetype: "consulting" } });
    state.parseCV = vi.fn(async () => parsed({ skills: [], archetypes: [{ key: "software_eng", score: 100, why: [] }] }));
    const r = await uploadCv(form(blankPdf));
    expect(r).toMatchObject({ ok: true, imageOnly: true });
    expect(db.profile.archetypes).toEqual([{ key: "consulting", score: 80, why: [] }]);
    expect(db.profile.skills).toEqual(["Excel"]);
    expect(db.profile.target_archetype).toBe("consulting");
    expect(db.profileUpdates[0]).not.toHaveProperty("archetypes");
    expect(db.profileUpdates[0]).not.toHaveProperty("skills");
    expect(state.awardXP).toHaveBeenCalledWith(expect.anything(), "u1", { type: "cv_uploaded", profileComplete: false });
  }, 30_000);
  it("image-only CV even when the vision parse returns skills does not overwrite the profile", async () => {
    const db = makeEnv();
    const r = await uploadCv(form(blankPdf));
    expect(r).toMatchObject({ ok: true, imageOnly: true });
    expect(db.profile.skills).toEqual(["Excel"]);
  }, 30_000);
  it("a text PDF whose parse has no skills/archetypes keeps the prior profile", async () => {
    const db = makeEnv();
    const fillerPdf = await makePdf([[
      "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua",
      "Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute",
      "Irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat",
    ]]);
    state.parseCV = vi.fn(async () => parsed({ skills: [], archetypes: [{ key: "research", score: 0, why: [] }] }));
    const r = await uploadCv(form(fillerPdf));
    expect(r).toMatchObject({ ok: true, imageOnly: false });
    expect(db.profile.archetypes).toEqual([{ key: "consulting", score: 80, why: [] }]);
    expect(db.profile.skills).toEqual(["Excel"]);
  }, 30_000);
  it("a readable CV replaces archetypes (score>0 only) and canonicalises skills, but keeps year & target", async () => {
    const db = makeEnv({ profile: { target_archetype: "consulting", year: "penultimate" } });
    const r = await uploadCv(form(textPdf));
    expect(r).toMatchObject({ ok: true, imageOnly: false });
    expect(db.profile.archetypes).toEqual([{ key: "software_eng", score: 90, why: [] }]);
    expect(db.profile.skills).toEqual(expect.arrayContaining(["Python", "React"]));
    expect(new Set(db.profile.skills).size).toBe(db.profile.skills.length);
    expect(db.profile.target_archetype).toBe("consulting");
    expect(db.profile.year).toBe("penultimate");
  }, 30_000);
  it("fills target_archetype and year from the CV when the profile had none", async () => {
    const db = makeEnv({ profile: { target_archetype: null, year: null } });
    await uploadCv(form(textPdf));
    expect(db.profile.target_archetype).toBe("software_eng");
    expect(db.profile.year).toBe("1st");
  }, 30_000);

  // Fixed: a failed profile read used to clobber the onboarding year / chosen target.
  it("a failed profile read does not overwrite the onboarding year or chosen target", async () => {
    const db = makeEnv({ profileReadError: true, profile: { year: "final", target_archetype: "consulting" } });
    state.parseCV = vi.fn(async () => parsed({ yearGuess: null }));
    await uploadCv(form(textPdf));
    expect(db.profile.year).toBe("final");
    expect(db.profile.target_archetype).toBe("consulting");
  }, 30_000);
});

describe("uploadCv — active-CV swap", () => {
  it("success: exactly one active CV (the new one); prior is deactivated, other users untouched", async () => {
    const other: CvRow = { id: "cv-other", user_id: "u2", storage_path: "u2/1.pdf", is_active: true };
    const db = makeEnv({ cvs: [{ ...PRIOR }, other] });
    const r = await uploadCv(form(textPdf));
    expect(r).toMatchObject({ ok: true, cvId: "cv-new-1" });
    expect(db.cvs.filter((c) => c.user_id === "u1" && c.is_active).map((c) => c.id)).toEqual(["cv-new-1"]);
    expect(db.cvs.find((c) => c.id === "cv-other")!.is_active).toBe(true);
    const row = db.cvs.find((c) => c.id === "cv-new-1")!;
    expect(row).toMatchObject({ user_id: "u1", page_count: 1, file_size: textPdf.length });
    expect(db.storage.get(row.storage_path)).toEqual(textPdf);
  }, 30_000);
  it("storage upload failure → error and no DB row", async () => {
    const db = makeEnv({ cvs: [{ ...PRIOR }], uploadError: true });
    expect(await uploadCv(form(textPdf))).toEqual({ error: "Upload failed — try again." });
    expect(db.cvs).toEqual([PRIOR]);
  }, 30_000);
  it("insert failure → orphaned storage object is removed and the prior CV stays active", async () => {
    const db = makeEnv({ cvs: [{ ...PRIOR }], insertError: true });
    expect(await uploadCv(form(textPdf))).toEqual({ error: "Couldn't save your CV — try again." });
    expect(db.removed).toEqual(db.uploads);
    expect(db.storage.size).toBe(0);
    expect(db.cvs).toEqual([PRIOR]);
  }, 30_000);
  it("activate failure → new row rolled back, storage removed, prior remains the single active CV", async () => {
    const db = makeEnv({ cvs: [{ ...PRIOR }], deactivateError: true });
    expect(await uploadCv(form(textPdf))).toEqual({ error: "Couldn't save your CV — try again." });
    expect(db.cvs.filter((c) => c.is_active).map((c) => c.id)).toEqual(["cv-old"]);
    expect(db.storage.size).toBe(0);
    expect(state.awardXP).not.toHaveBeenCalled();
  }, 30_000);

  // Fixed: insert-then-deactivate-others used to leave zero active CVs on a double submit.
  it("two concurrent uploads leave exactly one active CV", async () => {
    const db = makeEnv({ cvs: [{ ...PRIOR }], insertBarrier: 2 });
    const rs = await Promise.all([uploadCv(form(textPdf)), uploadCv(form(textPdf))]);
    expect(rs.every((r) => "ok" in r)).toBe(true);
    expect(db.cvs.filter((c) => c.user_id === "u1" && c.is_active)).toHaveLength(1);
  }, 30_000);
});

describe("uploadCv — filenames and awards", () => {
  it("never uses the client filename in the storage path (path traversal / XSS names)", async () => {
    for (const name of ["../../../etc/passwd.pdf", "..\\..\\x.pdf", "<img src=x onerror=alert(1)>.pdf", "a/b/c.pdf", "%2e%2e%2f.pdf", "‮fdp.exe"]) {
      const db = makeEnv();
      const r = await uploadCv(form(textPdf, name));
      expect(r).toMatchObject({ ok: true });
      expect(db.uploads).toHaveLength(1);
      expect(db.uploads[0]).toMatch(/^u1\/\d+\.pdf$/);
      expect(JSON.stringify(db.cvs)).not.toContain(name);
    }
  }, 60_000);
  it("passes the PDF to parseCV as base64 with a content-derived fixture key", async () => {
    makeEnv();
    await uploadCv(form(textPdf));
    const arg = (state.parseCV as ReturnType<typeof vi.fn>).mock.calls[0][0] as { base64: string; text: string; fixtureKey: string };
    expect(Buffer.from(arg.base64, "base64")).toEqual(Buffer.from(textPdf));
    expect(arg.text).toContain("Sam Patel");
    expect(arg.fixtureKey).toMatch(/^[0-9a-f]{12}$/);
  }, 30_000);

  // Fixed: an XP failure after the CV is committed used to reject the whole action.
  it("an awardXP failure after a successful save still resolves ok (award: null)", async () => {
    const db = makeEnv();
    state.awardXP = vi.fn(async () => { throw new Error("awardXP: incrementing xp failed: timeout"); });
    const r = await uploadCv(form(textPdf));
    expect(r).toMatchObject({ ok: true, award: null });
    expect(db.cvs.filter((c) => c.is_active)).toHaveLength(1);
  }, 30_000);
});
