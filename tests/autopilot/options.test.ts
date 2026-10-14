import { describe, it, expect } from "vitest";
import { matchOption, CONFIRM_KEYS } from "@/lib/autopilot/options";

const opt = (...labels: string[]) => labels.map((l, i) => ({ label: l, value: String(i) }));
const MONZO_RTW = opt("I'm a citizen or have permanent residency", "I have a visa which gives me the permanent right to work",
  "I have a visa which gives me temporary right to work", "I'd need Monzo to sponsor my visa to work in this location");
const ASHBY_RTW = opt("BNO Visa", "British Birth Certificate", "British/Irish Passport", "Graduate Visa", "Skilled Worker Visa");

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
});
