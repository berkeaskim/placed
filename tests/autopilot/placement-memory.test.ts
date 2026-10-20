import { describe, expect, it } from "vitest";
import { classify } from "@/lib/autopilot/classify";
import { firmGuard, firmRuleFor } from "@/lib/autopilot/firm-guard";
import { memoryRule, NEWS_STALE_DAYS, offerPrevious } from "@/lib/autopilot/memory";
import { matchOption } from "@/lib/autopilot/options";
import { CoreSchema, placementWindow, vaultValue } from "@/lib/autopilot/vault";

const NOW = new Date("2026-10-20T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("memoryRule", () => {
  it.each([
    "Why Barclays?",
    "Why do you want to work at Goldman Sachs?",
    "Why do you want to join us?",
    "What attracts you to our firm?",
    "Why have you chosen this company?",
  ])("never reuses a why-firm answer: %s", (label) => {
    expect(memoryRule(label)).toEqual({ kind: "never_reuse" });
  });
  it.each([
    "Tell us about a recent deal you have followed",
    "Describe a recent news story that interested you and its impact on markets",
    "What's happening in the markets right now?",
    "Demonstrate your commercial awareness",
  ])("expires a recent-news answer: %s", (label) => {
    expect(memoryRule(label)).toEqual({ kind: "expires", days: NEWS_STALE_DAYS });
  });
  it.each([
    "Tell us about a time you led a team",
    "Why do you want to work in finance?",
    "Why do you want to do a placement year?",
  ])("reuses everything else: %s", (label) => {
    expect(memoryRule(label)).toEqual({ kind: "reuse" });
  });
});

describe("offerPrevious", () => {
  it("never offers a why-firm answer", () => {
    expect(offerPrevious("Why Barclays?", daysAgo(1), NOW)).toBeNull();
  });
  it("offers a news answer plainly inside the window and with a note after it", () => {
    expect(offerPrevious("Tell us about a recent deal you have followed", daysAgo(NEWS_STALE_DAYS), NOW)).toEqual({ staleNote: null });
    const old = offerPrevious("Tell us about a recent deal you have followed", daysAgo(70), NOW);
    expect(old?.staleNote).toMatch(/^You wrote this 10 weeks ago/);
  });
  it("offers a competency story at any age", () => {
    expect(offerPrevious("Tell us about a time you led a team", daysAgo(400), NOW)).toEqual({ staleNote: null });
  });
});

describe("firmGuard", () => {
  const others = [
    { company: "Deloitte LLP", title: "Audit Placement 2027", status: "applied" },
    { company: "Barclays", title: "Spring Insight: Markets", status: "interview" },
    { company: "HSBC", title: "Spring Insight", status: "saved" },
  ];
  it("warns on a second application to a one-at-a-time employer, on any track", () => {
    const w = firmGuard({ company: "Deloitte", track: "placement", others });
    expect(w).toContain("Audit Placement 2027");
    expect(w).toContain("Deloitte considers one application per candidate at a time.");
    expect(firmGuard({ company: "Deloitte", track: "standard", others })).not.toBeNull();
  });
  it("warns about spring-week division caps for any firm", () => {
    expect(firmGuard({ company: "Barclays", track: "spring", others })).toMatch(/one or two spring-week divisions/);
  });
  it("ignores saved jobs, other firms and standard-track duplicates at firms with no rule", () => {
    expect(firmGuard({ company: "HSBC", track: "spring", others })).toBeNull();
    expect(firmGuard({ company: "Morgan Stanley", track: "spring", others })).toBeNull();
    expect(firmGuard({ company: "Barclays", track: "standard", others })).toBeNull();
  });
  it("matches firm names loosely but not by substring", () => {
    expect(firmRuleFor("PwC UK")?.employer).toBe("PwC");
    expect(firmRuleFor("Bank of England")?.employer).toBe("Bank of England");
    expect(firmRuleFor("Deloitte Digital")?.employer).toBe("Deloitte");
    expect(firmRuleFor("Nationwide")).toBeNull();
  });
});

describe("placement vault facts", () => {
  it.each([
    ["What date are you available from?", "date", "available_from"],
    ["Latest end date for your placement", "date", "available_to"],
    ["Will you be returning to full-time study after the placement?", "boolean", "returning_to_study"],
    ["What is the length of the placement you can undertake?", "text", "placement_duration"],
    ["Does your course include a placement year?", "select", "placement_included"],
    ["Is your degree a sandwich course?", "boolean", "placement_included"],
    ["What was your first-year average?", "text", "year1_result"],
    ["Predicted degree classification", "select", "predicted_class"],
    ["Are you willing to relocate?", "boolean", "relocation"],
    ["What is your university's minimum number of weeks for a placement?", "text", "placement_min_weeks"],
    ["Which academic year will your placement be in?", "text", "placement_academic_year"],
  ])("classifies %s", (label, type, key) => {
    expect(classify(label, type as never)).toEqual({ kind: "vault", key });
  });
  it("keeps non-placement questions where they were", () => {
    expect(classify("Earliest start date", "date")).toEqual({ kind: "vault", key: "start_date" });
    expect(classify("Length of the internship", "text")).toEqual({ kind: "vault", key: "internship_length" });
  });
  it("validates and renders the new facts", () => {
    const core = CoreSchema.partial().parse({
      placement_included: "yes", returning_to_study: "yes", available_from: "2027-06-01", available_to: "2028-08-31", placement_min_weeks: "36",
      placement_academic_year: "2027–28",
    });
    expect(vaultValue(core, "placement_included")).toBe("Yes");
    expect(vaultValue(core, "placement_min_weeks")).toBe("36 weeks");
    expect(placementWindow(core)).toBe("1 Jun 2027 to 31 Aug 2028");
    expect(vaultValue(core, "placement_window")).toBe("1 Jun 2027 to 31 Aug 2028");
    expect(placementWindow({ available_from: "2027-06-01" })).toBeNull();
    expect(CoreSchema.shape.placement_academic_year.safeParse("next year").success).toBe(false);
    expect(matchOption("returning_to_study", core, [{ label: "Yes", value: "1" }, { label: "No", value: "0" }])).toEqual({ value: "1", label: "Yes" });
  });
  it("never stores residency or nationality: the schema strips unknown keys", () => {
    const parsed = CoreSchema.partial().parse({ nationality: "British", uk_residency_years: "5", placement_included: "yes" } as Record<string, string>);
    expect(parsed).toEqual({ placement_included: "yes" });
  });
});
