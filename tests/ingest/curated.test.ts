import { describe, it, expect, vi } from "vitest";
import { loadProgrammes, visibleProgrammes, programmeToRawJob, curatedEmployers, type Programme } from "@/lib/ingest/curated";

const row = (o: Record<string, string | number> = {}) => {
  const r = { employer: "deloitte", name: "Deloitte", title: "Audit & Assurance Graduate Programme", url: "https://example.com/p",
    location: "London, UK", opens: "2026-09", season: 2027, kind: "graduate", description: "A scheme.", ...o };
  return "- " + Object.entries(r).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n  ");
};
const prog = (o: Partial<Programme> = {}): Programme => loadProgrammes(row(o as Record<string, string | number>))[0]!;

describe("curated programmes", () => {
  it("skips rows with missing url or bad opens", () => {
    const warn = vi.fn();
    const noUrl = row().replace(/\n  url:.*/, "");
    const yml = [row(), noUrl, row({ opens: "Sept" })].join("\n");
    expect(loadProgrammes(yml, warn)).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(2);
  });
  it("returns [] and warns once for a non-array top level", () => {
    const warn = vi.fn();
    expect(loadProgrammes("a: 1", warn)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it("rejects non-http urls, bad closes, bad kind, non-integer season", () => {
    const warn = vi.fn();
    const yml = [row({ url: "javascript:alert(1)" }), row({ closes: "30/11/2026" }), row({ kind: "gap-year" }), row({ season: 2027.5 })].join("\n");
    expect(loadProgrammes(yml, warn)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(4);
  });
  it("hides a programme after closes", () => {
    const p = prog({ closes: "2026-11-30" });
    expect(visibleProgrammes([p], "2026-12-01")).toHaveLength(0);
    expect(visibleProgrammes([p], "2026-11-30")).toHaveLength(1);
  });
  it("hides after 1 June of season when no closes", () => {
    const p = prog();
    expect(visibleProgrammes([p], "2027-06-01")).toHaveLength(0);
    expect(visibleProgrammes([p], "2027-05-31")).toHaveLength(1);
  });
  it("stable extId", () => {
    const a = programmeToRawJob(prog());
    expect(programmeToRawJob(prog()).extId).toBe(a.extId);
    expect(a.extId).toBe("deloitte:2027:graduate:audit-and-assurance-graduate-programme");
  });
  it("opensOn is the first of the month; deadline null without closes", () => {
    const j = programmeToRawJob(prog({ opens: "2026-09" }));
    expect(j.opensOn).toBe("2026-09-01");
    expect(j.deadline).toBeNull();
    expect(j.remote).toBe(false);
    expect(j.postedAt).toBeNull();
    expect(programmeToRawJob(prog({ closes: "2026-11-30" })).deadline).toBe("2026-11-30");
  });
  it("keeps an already-open programme with no closes visible and opensOn in the past", () => {
    const p = prog({ opens: "2026-01" });
    expect(visibleProgrammes([p], "2026-10-17")).toHaveLength(1);
    expect(programmeToRawJob(p).opensOn).toBe("2026-01-01");
  });
  it("escapes description html", () => {
    const j = programmeToRawJob(prog({ description: `<script>alert("x")</script> & 'y'` }));
    expect(j.html).toBe("<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;</p>");
  });
  it("curatedEmployers is unique in first-seen order", () => {
    const yml = [row(), row({ kind: "internship" }), row({ employer: "kpmg", name: "KPMG" })].join("\n");
    expect(curatedEmployers(loadProgrammes(yml))).toEqual([{ slug: "deloitte", name: "Deloitte" }, { slug: "kpmg", name: "KPMG" }]);
  });
});
