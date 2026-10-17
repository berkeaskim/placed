import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, resetDbForTests } from "@/lib/db/client";
import { companies, jobs } from "@/lib/db/schema";
import { heuristicTagJob } from "@/lib/ai/heuristics";
import { runIngest } from "@/lib/ingest/local";
import { fetchJobs as liveFetchJobs, type CompanySeed } from "@/lib/ingest/providers";
import { isChallenge, resetStealthForTests, scraperInstalled, stealthFetch } from "@/lib/ingest/stealth";
import { setSetting } from "@/lib/settings/store";

const FAKE = `${process.execPath} ${path.resolve("tests/fixtures/fake-sidecar.mjs")}`;
const prev = { cmd: process.env.PLACED_SCRAPER_CMD, exitOn: process.env.FAKE_SIDECAR_EXIT_ON, mode: process.env.AI_MODE };

beforeAll(() => { process.env.AI_MODE = "fixture"; });
beforeEach(() => {
  resetStealthForTests();
  process.env.PLACED_SCRAPER_CMD = FAKE;
  delete process.env.FAKE_SIDECAR_EXIT_ON;
});
afterEach(() => { resetStealthForTests(); });
afterAll(() => {
  for (const [k, v] of [["PLACED_SCRAPER_CMD", prev.cmd], ["FAKE_SIDECAR_EXIT_ON", prev.exitOn], ["AI_MODE", prev.mode]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("isChallenge", () => {
  it("isChallenge detects Cloudflare, Turnstile, Akamai, PerimeterX and passes a normal JSON body", () => {
    expect(isChallenge(403, { "cf-mitigated": "challenge" }, "")).toBe(true);
    expect(isChallenge(503, { "content-type": "text/html" }, "<html><head><title>Just a moment...</title></head></html>")).toBe(true);
    expect(isChallenge(200, { "content-type": "text/html" }, '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>')).toBe(true);
    expect(isChallenge(403, { "content-type": "text/html" },
      "<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD><BODY>You don't have permission to access this server.<P>Reference&#32;&#35;18&#46;abc</BODY></HTML>")).toBe(true);
    expect(isChallenge(403, { "content-type": "text/html" }, '<div id="px-captcha"></div><script>window._pxCaptcha = 1</script>')).toBe(true);
    expect(isChallenge(200, { "content-type": "text/html" }, "<p>Press &amp; Hold to confirm you are a human</p>")).toBe(true);
    expect(isChallenge(200, { "content-type": "application/json" }, '{"jobs":[{"id":1,"title":"Access Denied analyst"}]}')).toBe(false);
  });
});

describe("stealthFetch", () => {
  it("stealthFetch returns the sidecar's JSON as a Response", async () => {
    const res = await stealthFetch("https://boards.example/api/jobs", { method: "POST", headers: { "x-test": "1" }, body: '{"q":1}' });
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(await res.json()).toMatchObject({ ok: true, url: "https://boards.example/api/jobs", method: "POST", body: '{"q":1}', headers: { "x-test": "1" } });
    // the long-lived process serves the next call too
    expect(await (await stealthFetch("https://boards.example/second")).json()).toMatchObject({ url: "https://boards.example/second", method: "GET" });
  });

  it("a challenge response fails with blocked", async () => {
    await expect(stealthFetch("https://boards.example/challenge")).rejects.toThrow(/blocked/);
  });

  it("a sidecar error fails that request", async () => {
    await expect(stealthFetch("https://boards.example/broken")).rejects.toThrow(/navigation failed/);
  });

  it("missing install gives the setup hint", async () => {
    process.env.PLACED_SCRAPER_CMD = path.resolve("scraper/.venv-does-not-exist/bin/python");
    expect(await scraperInstalled()).toBe(false);
    await expect(stealthFetch("https://boards.example/api")).rejects.toThrow(/npm run scraper:setup/);
  });

  it("fetch.py never enables solve_cloudflare", () => {
    const src = readFileSync("scraper/fetch.py", "utf8");
    expect(src).toContain("solve_cloudflare=False");
    expect(src).not.toMatch(/solve_cloudflare\s*=\s*True/);
  });
});

describe("sidecar crash mid-run", () => {
  beforeAll(() => {
    resetDbForTests();
    db.insert(companies).values([
      { slug: "stealthy", name: "Stealthy", ats: "smartrecruiters", transport: "stealth" },
      { slug: "plain", name: "Plain", ats: "greenhouse" },
    ]).run();
  });
  afterAll(() => { setSetting("ingest.lock", null); resetDbForTests(); });

  it("sidecar crash mid-run fails that board only", async () => {
    // Request 1 (the SmartRecruiters listing) succeeds; the sidecar dies on request 2 (the posting detail).
    process.env.FAKE_SIDECAR_EXIT_ON = "2";
    const plainFetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (!url.includes("boards-api.greenhouse.io/v1/boards/plain/")) throw new Error(`plain fetch used for ${url}`);
      return Response.json({ jobs: [{ id: 7, title: "Data Analyst Intern", absolute_url: "https://plain.example/7", location: { name: "London" }, content: "<ul><li>SQL</li></ul>" }] });
    }) as typeof fetch;
    const lines: string[] = [];
    const s = await runIngest({
      fetchJobs: (c: CompanySeed) => liveFetchJobs(c, plainFetch),
      tagJob: async (i) => heuristicTagJob(i),
      onProgress: (p) => lines.push(`${p.slug}: ${p.line}`),
    });
    expect(s).toMatchObject({ companies: 2, failed: 1 });
    expect(lines.find((l) => l.startsWith("stealthy:"))).toMatch(/ERROR .*sidecar/);
    const plainId = db.select().from(companies).where(eq(companies.slug, "plain")).get()!.id;
    expect(db.select().from(jobs).where(eq(jobs.company_id, plainId)).all().map((j) => j.ext_id)).toEqual(["7"]);

    // the next call starts a fresh sidecar
    delete process.env.FAKE_SIDECAR_EXIT_ON;
    expect((await stealthFetch("https://boards.example/after")).status).toBe(200);
  });
});
