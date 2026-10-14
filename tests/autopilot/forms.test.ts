import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import gh from "../fixtures/autopilot/greenhouse-monzo.json";
import ashby from "../fixtures/autopilot/ashby-multiverse.json";
import { parseGreenhouse, greenhouseRef } from "@/lib/autopilot/forms/greenhouse";
import { parseAshby, ashbyRef } from "@/lib/autopilot/forms/ashby";
import { parseLever, leverRef } from "@/lib/autopilot/forms/lever";
import { fetchForm, wordLimitOf } from "@/lib/autopilot/forms";
import { FormUnavailableError } from "@/lib/autopilot/forms/types";

const lever = readFileSync("tests/fixtures/autopilot/lever-palantir.html", "utf8");

describe("greenhouse", () => {
  const f = parseGreenhouse(gh, "monzo", "8232726");
  it("normalises Monzo", () => {
    expect(f.url).toBe("https://job-boards.greenhouse.io/monzo/jobs/8232726");
    expect(f.fields.find((x) => x.target === "first_name")).toMatchObject({ type: "text", required: true });
    expect(f.fields.find((x) => x.target === "resume")).toMatchObject({ type: "file" });
    const why = f.fields.find((x) => /excited to work for Monzo/.test(x.label))!;
    expect(why).toMatchObject({ type: "textarea", wordLimit: 250, target: "question_69481992" });
    const rtw = f.fields.find((x) => x.target === "question_69482005")!;
    expect(rtw.type).toBe("select");
    expect(rtw.options[0]).toEqual({ label: "I'm a citizen or have permanent residency", value: "753686453" });
    expect(f.fields.find((x) => x.target === "question_69481997[]")?.type).toBe("multiselect");
    expect(f.fields.some((x) => /latitude|longitude/i.test(x.target))).toBe(false);
    expect(f.fields.find((x) => x.target === "location")?.type).toBe("location");
  });
  it("parses refs", () => {
    expect(greenhouseRef("https://job-boards.greenhouse.io/monzo/jobs/8232726")).toEqual({ board: "monzo", id: "8232726" });
    expect(greenhouseRef("https://boards.greenhouse.io/embed/job_app?for=tide&token=7980213003")).toEqual({ board: "tide", id: "7980213003" });
  });
});

describe("ashby", () => {
  const f = parseAshby(ashby, "multiverse", "b8c115ed-ef0c-47b7-a825-898929059d54");
  it("normalises Multiverse", () => {
    expect(f.url).toBe("https://jobs.ashbyhq.com/multiverse/b8c115ed-ef0c-47b7-a825-898929059d54/application");
    expect(f.fields.find((x) => x.label === "Why Multiverse?")).toMatchObject({ type: "textarea", required: true });
    expect(f.fields.find((x) => x.label === "Resume")).toMatchObject({ type: "file", target: "_systemfield_resume" });
    expect(f.fields.find((x) => /right to work/i.test(x.label))?.options.length).toBeGreaterThan(3);
    expect(f.fields.find((x) => /sponsorship/i.test(x.label))?.type).toBe("boolean");
  });
  it("treats a null posting as unavailable", () => {
    expect(() => parseAshby({ data: { jobPosting: null } }, "x", "y")).toThrow(FormUnavailableError);
  });
  it("parses refs", () => expect(ashbyRef("https://jobs.ashbyhq.com/lendable/e001dc0b-6e0f-46a7-95ba-38a3733db2f4")).toEqual({ org: "lendable", id: "e001dc0b-6e0f-46a7-95ba-38a3733db2f4" }));
});

describe("lever", () => {
  const f = parseLever(lever, "palantir", "774cf5c9-bf6a-4d77-bf60-d50ef1beb1a0");
  it("normalises Palantir", () => {
    expect(f.url).toBe("https://jobs.lever.co/palantir/774cf5c9-bf6a-4d77-bf60-d50ef1beb1a0/apply");
    for (const t of ["name", "email", "phone", "resume", "urls[LinkedIn]"]) expect(f.fields.some((x) => x.target === t)).toBe(true);
    const lang = f.fields.find((x) => /Language Skill/.test(x.label))!;
    expect(lang).toMatchObject({ type: "multiselect", required: true });
    expect(lang.target).toMatch(/^cards\[a69a985a-eae9-4c14-90fb-b5a4b891523e\]\[field\d+\]$/);
  });
  it("parses refs", () => expect(leverRef("https://jobs.lever.co/palantir/774cf5c9-bf6a-4d77-bf60-d50ef1beb1a0")).toEqual({ site: "palantir", id: "774cf5c9-bf6a-4d77-bf60-d50ef1beb1a0" }));
});

describe("fetchForm", () => {
  it("dispatches to greenhouse with the questions URL", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(gh)));
    const form = await fetchForm({ url: "https://job-boards.greenhouse.io/monzo/jobs/8232726", ats: "greenhouse" }, f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledWith("https://boards-api.greenhouse.io/v1/boards/monzo/jobs/8232726?questions=true", expect.anything());
    expect(form.fields.length).toBeGreaterThan(15);
  });
  it("throws FormUnavailableError on 404", async () => {
    const f = vi.fn(async () => new Response("nope", { status: 404 }));
    await expect(fetchForm({ url: "https://job-boards.greenhouse.io/monzo/jobs/1", ats: "greenhouse" }, f as unknown as typeof fetch)).rejects.toThrow(FormUnavailableError);
  });
  it("reads word limits", () => {
    expect(wordLimitOf("Why us? (250 word limit)")).toBe(250);
    expect(wordLimitOf("Tell us in max 150 words")).toBe(150);
    expect(wordLimitOf("Why us?")).toBeUndefined();
  });
  const gj = { url: "https://job-boards.greenhouse.io/monzo/jobs/1", ats: "greenhouse" as const };
  const ok = (b: string) => vi.fn(async () => new Response(b)) as unknown as typeof fetch;
  it("wraps a non-JSON 200 body", async () => {
    await expect(fetchForm(gj, ok("<html>captcha</html>"))).rejects.toThrow(FormUnavailableError);
    await expect(fetchForm({ url: "https://jobs.ashbyhq.com/x/e001dc0b-6e0f-46a7-95ba-38a3733db2f4", ats: "ashby" }, ok("<html>"))).rejects.toThrow(FormUnavailableError);
  });
  it("wraps network failure", async () => {
    const f = vi.fn(async () => { throw new Error("down"); }) as unknown as typeof fetch;
    await expect(fetchForm(gj, f)).rejects.toThrow(FormUnavailableError);
  });
  it("wraps malformed shapes", async () => {
    await expect(fetchForm(gj, ok(JSON.stringify({ questions: [{ label: "x", required: true }] })))).resolves.toMatchObject({ fields: [] });
    await expect(fetchForm(gj, ok(JSON.stringify({ questions: null })))).rejects.toThrow(FormUnavailableError);
    await expect(fetchForm({ url: "https://jobs.ashbyhq.com/x/e001dc0b-6e0f-46a7-95ba-38a3733db2f4", ats: "ashby" }, ok(JSON.stringify({ data: { jobPosting: { applicationForm: { sections: [null] } } } })))).resolves.toMatchObject({ fields: [] });
  });
});

describe("malformed inputs", () => {
  it("greenhouse prefers the file field", () => {
    const f = parseGreenhouse({ questions: [{ label: "CV", required: true, fields: [{ name: "a", type: "input_text" }, { name: "resume", type: "input_file" }] }] }, "b", "1");
    expect(f.fields[0].target).toBe("resume");
  });
  it("lever skips malformed cards and dedupes", () => {
    const html = '<input name="email"><input name="email"><input value="(trimmed)" name="cards[a69a985a-eae9-4c14-90fb-b5a4b891523e][baseTemplate]"><input type="text" name="urls[X]"><input type="text" name="urls[X]">';
    const f = parseLever(html, "s", "i");
    expect(f.fields.map((x) => x.target)).toEqual(["email", "urls[X]"]);
  });
});
