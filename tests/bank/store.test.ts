import { describe, expect, it } from "vitest";
import { LOCAL_USER_ID } from "@/lib/auth/local-user";
import { withTempDb } from "../cv/temp-db";
import { appendBulletSource, getBank, insertEntry, updateBullet, upsertSource } from "@/lib/bank/store";

withTempDb();

const entry = (org: string, bullets: { text: string; position: number }[]) => ({
  section: "experience" as const, org, title: "Analyst", dates: "2025", startYm: "2025-01", endYm: null, location: "London",
  pinned: false, hidden: false, sourceIds: [],
  bullets: bullets.map((b) => ({ ...b, pinned: false, hidden: false, sourceIds: ["s1"], sourceText: b.text })),
});

describe("bank store", () => {
  it("getBank returns entries with bullets in position order", () => {
    insertEntry(LOCAL_USER_ID, entry("Acme", [{ text: "b", position: 1 }, { text: "a", position: 0 }]));
    const e = getBank(LOCAL_USER_ID).entries.find((x) => x.org === "Acme")!;
    expect(e.bullets.map((b) => b.position)).toEqual([0, 1]);
  });

  it("upsertSource is idempotent on (kind, ref)", () => {
    const a = upsertSource(LOCAL_USER_ID, "cv", "cv-1", "x");
    const b = upsertSource(LOCAL_USER_ID, "cv", "cv-1", "x");
    expect(b.id).toBe(a.id);
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
  });

  it("updateBullet text edit records manual provenance and keeps source_text", () => {
    const e = insertEntry(LOCAL_USER_ID, entry("Prov", [{ text: "orig", position: 0 }]));
    const id = e.bullets[0].id;
    updateBullet(LOCAL_USER_ID, id, { text: "edited" });
    const b = getBank(LOCAL_USER_ID).entries.find((x) => x.id === e.id)!.bullets[0];
    expect(b.text).toBe("edited");
    expect(b.sourceIds).toEqual(["s1", "manual"]);
    expect(b.sourceText).toBe("orig");
    appendBulletSource(LOCAL_USER_ID, id, "s2");
    appendBulletSource(LOCAL_USER_ID, id, "s2");
    expect(getBank(LOCAL_USER_ID).entries.find((x) => x.id === e.id)!.bullets[0].sourceIds).toEqual(["s1", "manual", "s2"]);
  });

  it("queries are user-scoped", () => {
    insertEntry("other", entry("OtherCo", [{ text: "z", position: 0 }]));
    expect(getBank(LOCAL_USER_ID).entries.some((x) => x.org === "OtherCo")).toBe(false);
    expect(getBank("other").entries.map((x) => x.org)).toEqual(["OtherCo"]);
    const s = upsertSource("other", "cv", "cv-1", "y");
    expect(s.created).toBe(true);
  });
});
