import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db/client";
import { cvs, profiles } from "@/lib/db/schema";
import { ensureProfile } from "@/lib/db/functions";
import { shortSchool, universityFor } from "@/lib/profile/university";
import type { ParsedCV } from "@/lib/types";

const U = "00000000-0000-4000-8000-0000000000aa";

function cvWith(institutions: string[]): ParsedCV {
  return { education: institutions.map((institution, i) => ({ id: `e${i}`, institution, degree: "BSc", dates: "", grade: null, details: [] })) } as unknown as ParsedCV;
}

beforeEach(() => {
  db.delete(cvs).run();
  db.delete(profiles).run();
  ensureProfile(U, "u@test");
});

describe("shortSchool", () => {
  it.each([
    ["University College London", "UCL"],
    ["London School of Economics and Political Science", "LSE"],
    ["Imperial College London", "Imperial"],
    ["University of Bristol", "Bristol"],
    ["Boğaziçi University", "Boğaziçi University"],
  ])("%s → %s", (name, out) => expect(shortSchool(name)).toBe(out));
});

describe("universityFor", () => {
  it("is null when nothing is known", () => {
    expect(universityFor(U)).toBeNull();
  });

  it("reads the first university on the active CV, skipping schools", () => {
    db.insert(cvs).values({ user_id: U, storage_path: "x", file_size: 1, page_count: 1, raw_text: "", parsed_json: cvWith(["Westminster Academy", "University of Bristol"]) }).run();
    expect(universityFor(U)).toBe("University of Bristol");
  });

  it("prefers what the student set", () => {
    db.insert(cvs).values({ user_id: U, storage_path: "x", file_size: 1, page_count: 1, raw_text: "", parsed_json: cvWith(["University of Bristol"]) }).run();
    db.update(profiles).set({ university: "  King's College London " }).run();
    expect(universityFor(U)).toBe("King's College London");
  });
});
