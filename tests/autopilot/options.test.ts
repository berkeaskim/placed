import { describe, it, expect, beforeAll } from "vitest";
import { matchOption, CONFIRM_KEYS } from "@/lib/autopilot/options";
import type { FieldOption } from "@/lib/autopilot/forms/types";
import fs from "fs";
import path from "path";

const opt = (...labels: string[]) => labels.map((l, i) => ({ label: l, value: String(i) }));
const MONZO_RTW = opt("I'm a citizen or have permanent residency", "I have a visa which gives me the permanent right to work",
  "I have a visa which gives me temporary right to work", "I'd need Monzo to sponsor my visa to work in this location");
const ASHBY_RTW = opt("BNO Visa", "British Birth Certificate", "British/Irish Passport", "Graduate Visa", "Skilled Worker Visa");

let ashbyFullOptions: FieldOption[] = [];
beforeAll(() => {
  const fixtureData = JSON.parse(fs.readFileSync(path.join(__dirname, "../fixtures/autopilot/ashby-multiverse.json"), "utf8"));
  const rtwField = fixtureData.data.jobPosting.applicationForm.sections[1].fieldEntries.find((e: any) =>
    e.field.title.includes("right to work")
  );
  ashbyFullOptions = rtwField.field.selectableValues.map((v: any) => ({ label: v.label, value: v.value }));
});

describe("matchOption apostrophes", () => {
  it("matches an option whose apostrophe is curly (U+2019) the same as a straight one", () => {
    const curly = opt("I\u2019m a citizen or have permanent residency", "I\u2019d need Monzo to sponsor my visa to work in this location");
    expect(matchOption("rtw_uk", { rtw_uk: "citizen_or_settled" }, curly)).toMatchObject({ value: "0" });
    expect(matchOption("rtw_uk", { rtw_uk: "needs_sponsorship" }, curly)).toMatchObject({ value: "1" });
    expect(matchOption("university", { university: "King\u2019s College London" } as never, opt("King's College London"))).toMatchObject({ value: "0" });
  });
});

describe("matchOption", () => {
  it("maps each RTW answer to exactly one Monzo option", () => {
    expect(matchOption("rtw_uk", { rtw_uk: "citizen_or_settled" }, MONZO_RTW)).toMatchObject({ value: "0" });
    expect(matchOption("rtw_uk", { rtw_uk: "visa_permanent" }, MONZO_RTW)).toMatchObject({ value: "1" });
    expect(matchOption("rtw_uk", { rtw_uk: "visa_temporary" }, MONZO_RTW)).toMatchObject({ value: "2" });
    expect(matchOption("rtw_uk", { rtw_uk: "needs_sponsorship" }, MONZO_RTW)).toMatchObject({ value: "3" });
  });
  it("is ambiguous on document-type RTW lists instead of guessing", () => {
    expect(matchOption("rtw_uk", { rtw_uk: "citizen_or_settled" }, ASHBY_RTW)).toMatchObject({ ambiguous: true });
  });
  it("maps yes/no and years", () => {
    expect(matchOption("needs_sponsorship", { needs_sponsorship: "no" }, opt("Yes", "No"))).toMatchObject({ value: "1" });
    expect(matchOption("grad_year", { grad_year: "2028" }, opt("2027", "2028", "2029", "2030"))).toMatchObject({ value: "1" });
  });
  it("is ambiguous when nothing matches", () => {
    expect(matchOption("start_date", { start_date: "2027-06-01" }, opt("Start 1st June, finish 20th August 2027", "Start 30th June, finish 17th September 2027"))).toMatchObject({ ambiguous: true });
  });
  it("always confirms RTW and sponsorship", () => {
    expect(CONFIRM_KEYS.has("rtw_uk")).toBe(true);
    expect(CONFIRM_KEYS.has("needs_sponsorship")).toBe(true);
  });
  it("is ambiguous on full 17-option Ashby RTW list for all rtw_uk values", () => {
    expect(ashbyFullOptions.length).toBeGreaterThan(10);
    expect(matchOption("rtw_uk", { rtw_uk: "citizen_or_settled" }, ashbyFullOptions)).toMatchObject({ ambiguous: true });
    expect(matchOption("rtw_uk", { rtw_uk: "visa_permanent" }, ashbyFullOptions)).toMatchObject({ ambiguous: true });
    expect(matchOption("rtw_uk", { rtw_uk: "visa_temporary" }, ashbyFullOptions)).toMatchObject({ ambiguous: true });
    expect(matchOption("rtw_uk", { rtw_uk: "needs_sponsorship" }, ashbyFullOptions)).toMatchObject({ ambiguous: true });
  });
  it("rejects negations in citizen_or_settled matches", () => {
    expect(matchOption("rtw_uk", { rtw_uk: "citizen_or_settled" }, opt("I am not a citizen", "I am a citizen"))).toMatchObject({ value: "1" });
    expect(matchOption("rtw_uk", { rtw_uk: "citizen_or_settled" }, opt("Not a British citizen", "A British citizen"))).toMatchObject({ value: "1" });
    expect(matchOption("rtw_uk", { rtw_uk: "citizen_or_settled" }, opt("Non-EU citizen", "EU citizen"))).toMatchObject({ value: "1" });
  });
  it("handles sponsorship negation patterns correctly", () => {
    expect(matchOption("rtw_uk", { rtw_uk: "needs_sponsorship" },
      opt("Do not require sponsorship", "Would require sponsorship"))).toMatchObject({ value: "1" });
    expect(matchOption("rtw_uk", { rtw_uk: "needs_sponsorship" },
      opt("Without sponsorship", "Need sponsorship"))).toMatchObject({ value: "1" });
    expect(matchOption("rtw_uk", { rtw_uk: "needs_sponsorship" },
      opt("Do not have right to work in UK and would require sponsorship", "Other"))).toMatchObject({ ambiguous: true });
  });
  it("maps negative needs_sponsorship cases", () => {
    expect(matchOption("needs_sponsorship", { needs_sponsorship: "no" }, opt("No"))).toMatchObject({ value: "0" });
    expect(matchOption("needs_sponsorship", { needs_sponsorship: "no" }, opt("Not Sure", "No"))).toMatchObject({ value: "1" });
    expect(matchOption("needs_sponsorship", { needs_sponsorship: "yes" }, opt("Yes"))).toMatchObject({ value: "0" });
  });
  it("returns ambiguous for empty options", () => {
    expect(matchOption("grad_year", { grad_year: "2028" }, [])).toMatchObject({ ambiguous: true, candidates: [] });
  });
  it("uses word-boundary matching for grad_year", () => {
    expect(matchOption("grad_year", { grad_year: "2028" }, opt("2027", "2028", "2029", "2030"))).toMatchObject({ value: "1" });
    expect(matchOption("grad_year", { grad_year: "2028" }, opt("20280101", "2028X", "2028"))).toMatchObject({ value: "2" });
    expect(matchOption("grad_year", { grad_year: "2028" }, opt("20285", "2028Q1"))).toMatchObject({ ambiguous: true });
  });
});
