import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, resetDbForTests } from "@/lib/db/client";
import { activateCv, awardXp } from "@/lib/db/functions";
import { companies, cvs, ingestState, jobs, profiles, xpEvents } from "@/lib/db/schema";
import { getUser, LOCAL_USER_ID, requireUser } from "@/lib/auth/local-user";
import { deleteFile, fileUrl, getFile, putFile } from "@/lib/files";
import { getSecret, getSetting, setSecret, setSetting } from "@/lib/settings/store";
import { openVault, sealVault } from "@/lib/autopilot/vault-crypto";

let dir: string;
const prevDir = process.env.PLACED_DATA_DIR;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "placed-db-"));
  process.env.PLACED_DATA_DIR = dir;
  resetDbForTests();
});

afterAll(() => {
  resetDbForTests();
  process.env.PLACED_DATA_DIR = prevDir;
  rmSync(dir, { recursive: true, force: true });
});

const newCv = (over: Partial<typeof cvs.$inferInsert> = {}) =>
  db.insert(cvs).values({ user_id: LOCAL_USER_ID, storage_path: "u/cv.pdf", file_size: 1, page_count: 1, raw_text: "x", parsed_json: {} as never, ...over })
    .returning().get();

describe("migrations", () => {
  it("creates the schema with foreign keys on and the ingest_state row", () => {
    expect(db.$client.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(db.$client.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(db.select().from(ingestState).get()).toMatchObject({ id: 1, cursor: 0 });
  });

  it("round-trips json, boolean and default columns", () => {
    const c = db.insert(companies).values({ slug: "acme", name: "Acme", ats: "greenhouse" }).returning().get();
    const j = db.insert(jobs).values({ company_id: c.id, ext_id: "1", title: "Intern", url: "https://x", year_eligibility: ["final"], remote: true }).returning().get();
    expect(j.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(j).toMatchObject({ year_eligibility: ["final"], remote: true, requirements: [], tag_status: "pending", rolling: false });
    expect(() => db.insert(companies).values({ slug: "x", name: "X", ats: "nope" as never }).run()).toThrow(/CHECK/);
  });

  it("is idempotent on reopen", () => {
    resetDbForTests();
    expect(db.select().from(companies).all()).toHaveLength(1);
  });
});

describe("local user", () => {
  it("ensures the profile row once", async () => {
    const { user } = await getUser();
    await requireUser();
    expect(user.id).toBe(LOCAL_USER_ID);
    const rows = db.select().from(profiles).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: LOCAL_USER_ID, xp: 0, level: 1, onboarded: false, skills: [], location_pref: [] });
  });
});

describe("award_xp / activate_cv", () => {
  it("awardXp adds atomically and returns the new total; null without a profile", () => {
    expect(awardXp(LOCAL_USER_ID, 25)).toBe(25);
    expect(awardXp(LOCAL_USER_ID, 10)).toBe(35);
    expect(awardXp("someone-else", 10)).toBeNull();
  });

  it("xp_events once-per-user index blocks a second onboarding award", () => {
    db.insert(xpEvents).values({ user_id: LOCAL_USER_ID, type: "onboarding_complete", xp: 50 }).run();
    expect(() => db.insert(xpEvents).values({ user_id: LOCAL_USER_ID, type: "onboarding_complete", xp: 50 }).run()).toThrow(/UNIQUE/);
  });

  it("activateCv leaves exactly one active CV and rejects foreign ids", () => {
    const a = newCv({ is_active: true });
    const b = newCv({ is_active: false });
    activateCv(LOCAL_USER_ID, b.id);
    const active = db.select({ id: cvs.id }).from(cvs).where(and(eq(cvs.user_id, LOCAL_USER_ID), eq(cvs.is_active, true))).all();
    expect(active).toEqual([{ id: b.id }]);
    expect(() => activateCv(LOCAL_USER_ID, "missing")).toThrow(/not found/);
    // the failed call rolled back: b is still the active one
    expect(db.select().from(cvs).where(eq(cvs.id, b.id)).get()?.is_active).toBe(true);
    expect(db.select().from(cvs).where(eq(cvs.id, a.id)).get()?.is_active).toBe(false);
  });
});

describe("files", () => {
  it("puts, gets and deletes", async () => {
    await putFile("cvs", `${LOCAL_USER_ID}/cv.pdf`, Buffer.from("%PDF-1"));
    expect(await getFile("cvs", `${LOCAL_USER_ID}/cv.pdf`)).toEqual({ bytes: Buffer.from("%PDF-1"), contentType: "application/pdf" });
    await putFile("tailored", "a/b.bin", new Uint8Array([1, 2]), "application/x-test");
    expect((await getFile("tailored", "a/b.bin"))?.contentType).toBe("application/x-test");
    expect(fileUrl("cvs", "u/my cv.pdf")).toBe("/api/files/cvs/u/my%20cv.pdf");
    await deleteFile("cvs", `${LOCAL_USER_ID}/cv.pdf`);
    expect(await getFile("cvs", `${LOCAL_USER_ID}/cv.pdf`)).toBeNull();
    await deleteFile("cvs", "never/existed.pdf");
  });

  it("rejects traversal, absolute paths and unknown buckets", async () => {
    for (const bad of ["../secret.key", "a/../../x", "/etc/passwd", "a//b", "./a", "a\\..\\b", ""]) {
      await expect(putFile("cvs", bad, Buffer.from("x"))).rejects.toThrow(/invalid path/);
      await expect(getFile("cvs", bad)).rejects.toThrow(/invalid path/);
    }
    await expect(putFile("other" as never, "a.pdf", Buffer.from("x"))).rejects.toThrow(/unknown bucket/);
  });
});

describe("settings", () => {
  it("stores and deletes plain settings", () => {
    expect(getSetting("ai.provider")).toBeNull();
    setSetting("ai.provider", "ollama");
    setSetting("ai.provider", "gemini");
    expect(getSetting("ai.provider")).toBe("gemini");
    setSetting("ai.provider", null);
    expect(getSetting("ai.provider")).toBeNull();
  });

  it("encrypts secrets at rest with a 0600 local key", () => {
    setSecret("ai.anthropic.key", "sk-test-123");
    expect(getSecret("ai.anthropic.key")).toBe("sk-test-123");
    const raw = getSetting("secret.ai.anthropic.key")!;
    expect(raw).toMatch(/^v1\./);
    expect(raw).not.toContain("sk-test");
    expect(statSync(path.join(dir, "secret.key")).mode & 0o777).toBe(0o600);
    setSecret("ai.anthropic.key", null);
    expect(getSecret("ai.anthropic.key")).toBeNull();
  });

  it("vault falls back to the local key when VAULT_ENC_KEY is unset", () => {
    const prev = process.env.VAULT_ENC_KEY;
    delete process.env.VAULT_ENC_KEY;
    try {
      const sealed = sealVault("core", LOCAL_USER_ID, { email: "a@b.c" });
      expect(openVault("core", LOCAL_USER_ID, sealed)).toEqual({ email: "a@b.c" });
    } finally {
      process.env.VAULT_ENC_KEY = prev;
    }
  });
});
