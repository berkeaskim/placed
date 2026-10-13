import { describe, it, expect } from "vitest";
import { extractDeadline, resolveDeadline } from "@/lib/ingest/deadline";

const REF = new Date("2026-10-01T00:00:00Z");
const d = (text: string, ref = REF) => extractDeadline(text, ref).deadline;

describe("extractDeadline", () => {
  it.each([
    // real phrases from our snapshot that the old regex missed
    ["Closing Date: 1st of November 2026", "2026-11-01"],
    ["Application deadline: 16/10/2026", "2026-10-16"],
    // common UK formats
    ["The closing date for applications is 30 November 2026.", "2026-11-30"],
    ["Applications close on 5th December 2026 at midnight", "2026-12-05"],
    ["Deadline: Nov 14, 2026", "2026-11-14"],
    ["Please apply by 31 October", "2026-10-31"],
    ["Applications will close on Friday 20th November 2026", "2026-11-20"],
    ["Deadline for applications: 2026-12-01", "2026-12-01"],
    ["Applications must be received by 15.11.2026", "2026-11-15"],
    ["Closing date: 10/31/2026", "2026-10-31"], // US order is unambiguous here
    ["We are accepting applications until 1 December 2026", "2026-12-01"],
  ])("%s", (text, want) => expect(d(text)).toBe(want));

  it("infers next year for a yearless date earlier in the calendar than the posting", () => {
    expect(d("Apply by 15 January", REF)).toBe("2027-01-15");
  });

  it.each([
    ["The internship runs from 14 June until 6 August 2027."], // programme dates, no closing phrase
    ["Start date: June 2027. End date: August 2027."],
    ["Closing date: 31 February 2026"], // invalid calendar date
    ["Closing date: 1 March 2026"], // before the posting date: stale
    ["Closing date: 1 March 2029"], // >18 months out: not a close date
    ["We review applications within 10 days. Deadline TBC"],
    ["Our summer analyst programme closes on a rolling basis"],
  ])("returns null for %s", (text) => expect(d(text)).toBeNull());

  it("flags rolling recruitment without inventing a date", () => {
    for (const t of [
      "We recruit on a rolling basis, so apply early.",
      "We reserve the right to close this vacancy early.",
      "This role may close early if we receive a high volume of applications.",
    ]) {
      expect(extractDeadline(t, REF)).toEqual({ deadline: null, source: null, rolling: true });
    }
    expect(extractDeadline("Closing date: 30 November 2026. Applications reviewed on a rolling basis.", REF))
      .toEqual({ deadline: "2026-11-30", source: "text", rolling: true });
  });
});

describe("resolveDeadline", () => {
  it("treats the ATS end date as exclusive unless the text corroborates the exact last day", () => {
    // Barclays pattern: endDate is the day after the stated deadline
    expect(resolveDeadline("2026-11-01", "Closing date: 31 October 2026", REF)).toEqual({ deadline: "2026-10-31", source: "ats", rolling: false });
    // MUFG pattern: endDate equals the stated deadline
    expect(resolveDeadline("2026-11-01", "Closing date: 1 November 2026", REF)).toEqual({ deadline: "2026-11-01", source: "ats", rolling: false });
    // no usable text: one day early, never late
    expect(resolveDeadline("2026-11-01", "Closing date: 5 December 2026", REF)).toEqual({ deadline: "2026-10-31", source: "ats", rolling: false });
    expect(resolveDeadline("2026-11-01", "", REF)).toEqual({ deadline: "2026-10-31", source: "ats", rolling: false });
  });

  it("falls back to text when there is no ATS date", () => {
    expect(resolveDeadline(null, "Closing date: 5 December 2026", REF)).toEqual({ deadline: "2026-12-05", source: "text", rolling: false });
    expect(resolveDeadline(undefined, "nothing here", REF)).toEqual({ deadline: null, source: null, rolling: false });
  });
});
