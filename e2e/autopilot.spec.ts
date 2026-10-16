import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect, chromium, type Page } from "@playwright/test";
import Database from "better-sqlite3";

/**
 * Autopilot end to end on the REAL Monzo Greenhouse form (Associate Data Scientist - Intern).
 * Safety: every greenhouse application/submit request is aborted at the network layer and counted; the test never
 * clicks a submit control and closes the context at the end, discarding the unsent form. Only the FICTIONAL persona
 * Ayşe Demir's values are ever typed.
 *
 * Chromium runs with --headless=new (headless:false + that arg): the old headless mode cannot load extensions, and a headed
 * window is not needed in CI/agent shells. Remove the arg to watch it. The extension is a TEMP COPY (see makeExtensionCopy).
 *
 * It loads a real employer page, so it is opt-in. It writes the fictional persona into the local Vault of the app it
 * runs against (no login: Placed is single-user), so point PLACED_DATA_DIR at a scratch data dir that has the Monzo job seeded.
 * Run: PLACED_E2E_AUTOPILOT=1 NEXT_PUBLIC_AUTOPILOT=1 AI_MODE=fixture E2E_PORT=3100 npx playwright test e2e/autopilot.spec.ts
 * The extension is loaded from a TEMP COPY whose PLACED_ORIGIN points at the e2e port, so the committed extension/
 * (default http://localhost:3000) is never edited.
 */
test.skip(process.env.PLACED_E2E_AUTOPILOT !== "1", "opt-in: loads the real Monzo Greenhouse form (PLACED_E2E_AUTOPILOT=1)");
test.skip(process.env.NEXT_PUBLIC_AUTOPILOT !== "1", "needs NEXT_PUBLIC_AUTOPILOT=1");

const PORT = Number(process.env.E2E_PORT ?? 3100);
const ORIGIN = `http://localhost:${PORT}`;
const MONZO_EXT_ID = "8232726";
/** The Monzo job's local id (ids are generated per install), read from the same SQLite file the dev server uses. */
function monzoJobId(): string | null {
  const file = path.join(path.resolve(process.env.PLACED_DATA_DIR ?? "data"), "placed.db");
  if (!fs.existsSync(file)) return null;
  const sqlite = new Database(file, { readonly: true });
  try {
    const r = sqlite.prepare("select j.id from jobs j join companies c on c.id = j.company_id where c.ats = 'greenhouse' and j.ext_id = ?").get(MONZO_EXT_ID) as { id: string } | undefined;
    return r?.id ?? null;
  } finally {
    sqlite.close();
  }
}
// Every request to any greenhouse.io host (job-boards., boards., boards-api., recruiting.cdn. ...) other than a read is aborted.
const GREENHOUSE_RE = /^https?:\/\/([^/]+\.)?greenhouse\.io\//i;
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Non-read requests tolerated (still aborted) because they are page telemetry, never a submission. Anything else fails the test.
// Observed in a real run: Greenhouse page analytics (Snowplow collector c.spl.greenhouse.io, path /com.snowplowanalytics.snowplow/tp2).
const TELEMETRY_ALLOW = /^https:\/\/c\.spl\.greenhouse\.io\/com\.snowplowanalytics\.snowplow\/tp2(\?|$)/;

function makeExtensionCopy(): string {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "placed-ext-"));
  fs.cpSync(path.join(process.cwd(), "extension"), dest, { recursive: true });
  fs.writeFileSync(path.join(dest, "config.js"), `globalThis.PLACED_ORIGIN = ${JSON.stringify(ORIGIN)};\nglobalThis.PLACED_ORIGINS = ${JSON.stringify([ORIGIN])};\n`);
  return dest; // manifest host_permissions already cover http://localhost/* on any port
}

async function pick(page: Page, selector: string, value: string) {
  const el = page.locator(selector).first();
  if ((await el.evaluate((n) => n.tagName)) === "SELECT") await el.selectOption(value);
  else await el.fill(value);
}

test("Autopilot fills the real Monzo form and never submits", async () => {
  test.setTimeout(Number(process.env.E2E_TIMEOUT ?? 240_000));
  const jobId = monzoJobId();
  test.skip(!jobId, `the Monzo job (ext_id ${MONZO_EXT_ID}) is not in the local database`);
  const extDir = makeExtensionCopy();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "placed-e2e-ext-profile-"));
  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: [
      "--headless=new", // new headless supports extensions; drop this line (or run --headed) to watch it
      `--disable-extensions-except=${extDir}`,
      `--load-extension=${extDir}`,
      "--window-size=1280,1000",
    ],
    viewport: { width: 1280, height: 1000 },
  });
  const blocked: { method: string; url: string }[] = [];
  try {
    await ctx.route(GREENHOUSE_RE, (route) => {
      const r = route.request();
      if (READ_METHODS.has(r.method())) return route.continue();
      blocked.push({ method: r.method(), url: r.url() });
      return route.abort(); // a submission could never leave the machine
    });
    // Belt and braces: also observe every request the context makes, independent of the route handler.
    const seenWrites: string[] = [];
    ctx.on("request", (r) => { if (GREENHOUSE_RE.test(r.url()) && !READ_METHODS.has(r.method())) seenWrites.push(`${r.method()} ${r.url()}`); });

    const page = await ctx.newPage();

    // Vault: fictional persona only. Fields that are already saved are simply overwritten with the same persona values.
    await page.goto(`${ORIGIN}/autopilot/setup`);
    const text: Record<string, string> = {
      first_name: "Ayşe", last_name: "Demir", email: "ayse.demir.demo@example.com", phone: "+44 7700 900123",
      country: "United Kingdom", city: "London", university: "University College London", degree: "BSc Economics",
      grad_year: "2028", start_date: "2027-06-01", heard_about: "Placed",
    };
    for (const [name, value] of Object.entries(text)) await pick(page, `#${name}`, value);
    await page.locator("#year_of_study").selectOption("2nd");
    await page.locator("#grad_month").selectOption("June");
    await page.locator("#rtw_uk").selectOption({ index: 1 });
    await page.locator("#needs_sponsorship").selectOption("no");
    await page.getByRole("button", { name: "Save my answers" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Autopilot unlocked/ })).toBeVisible({ timeout: 30_000 });

    // Pack on the real Monzo job
    await page.goto(`${ORIGIN}/jobs/${jobId}`);
    await page.getByRole("button", { name: /Autopilot this application/ }).click();
    await expect(page.getByRole("region", { name: "Application pack" })).toBeVisible({ timeout: 60_000 });

    // ask + confirm rows: choose a value where empty, then Save/Confirm/Update
    for (const group of ["ask", "confirm"]) {
      const rows = page.locator(`[data-autopilot-group=${group}] > div`);
      const n = await rows.count();
      for (let i = 0; i < n; i++) {
        const row = rows.nth(i);
        const sel = row.locator("select");
        if (await sel.count()) {
          if (!(await sel.first().inputValue())) await sel.first().selectOption({ index: 1 });
        } else if (await row.locator('input[type=checkbox]').count()) {
          if (!(await row.locator("input[type=checkbox]:checked").count())) await row.locator("input[type=checkbox]").first().check();
        } else {
          const t = row.locator("input").first();
          if (!(await t.inputValue())) await t.fill("Placed");
        }
        const btn = row.getByRole("button", { name: /^(Save|Confirm)$/ });
        if (await btn.count()) { await btn.click(); await expect(row.getByText(/^(Saved|Confirmed)$/)).toBeVisible({ timeout: 15_000 }); }
      }
    }
    // drafts: approve if Autopilot wrote one; otherwise the "Write this one yourself" state is accepted
    const approve = page.getByRole("button", { name: "This is my answer" });
    if ((await approve.count()) && (await approve.first().isEnabled())) await approve.first().click();
    // a draft approved in an earlier run stays approved, so judge by the page, not by whether the button was clickable
    const approvedNote = page.getByText(/Approved\. Autopilot will fill this/);
    await approvedNote.first().waitFor({ timeout: 5_000 }).catch(() => undefined);
    const draftState = (await approvedNote.count()) > 0 ? "approved" : "write-yourself";
    console.log(`DRAFT_STATE=${draftState}`);

    const openBtn = page.getByRole("button", { name: /Open & fill/ });
    await expect(openBtn).toBeEnabled();
    const [form] = await Promise.all([ctx.waitForEvent("page"), openBtn.click()]);

    // The form must be the real Monzo posting; the one-time token is stripped from the URL
    await expect(form.locator("#first_name")).toBeVisible({ timeout: 60_000 });
    await expect(form.locator(".placed-panel")).toContainText(/\d+\/\d+ filled/, { timeout: 120_000 });
    console.log(`PANEL=${(await form.locator(".placed-panel").innerText()).replace(/\n/g, " | ")}`);

    await expect(form.locator("#first_name")).toHaveValue("Ayşe");
    await expect(form.locator("#last_name")).toHaveValue("Demir");
    await expect(form.locator("#email")).toHaveValue(/@/);
    await expect(form.locator("#question_69481992")).toHaveCount(1); // "Why Monzo?" exists; filled only if approved
    if (draftState === "approved") await expect(form.locator("#question_69481992")).not.toHaveValue("");
    else await expect(form.locator("#question_69481992")).toHaveValue("");
    // CV: Greenhouse swaps the file input for a filename readout once a file is attached. The local user must have an active CV.
    const readCv = () => form.evaluate<string>(`((document.querySelector(".file-upload__filename") || {}).textContent || "").trim()`);
    await expect.poll(readCv, { timeout: 15_000, message: "Greenhouse shows no CV filename: the CV was not attached (upload a CV in Placed first)" }).toMatch(/\.pdf/i);
    console.log(`CV_FILENAME=${JSON.stringify(await readCv())}`);
    expect(form.url()).not.toContain("placed=");

    // Per-field audit: state, the tag text the student sees, and (for react-selects Autopilot could not fill) why.
    type Row = { state: string; id: string; kind: string; shown: string; tag: string; why: string };
    const audit: Row[] = await form.evaluate(`[...document.querySelectorAll("[data-placed]")].map((el) => {
      const inner = el.querySelector("input,textarea,select");
      return {
        state: el.dataset.placed,
        id: (inner && inner.id) || el.id || String(el.className).slice(0, 30),
        kind: el.querySelector(".select__control") ? "react-select" : "plain",
        shown: ((el.querySelector(".select__single-value") || {}).textContent || "").slice(0, 40),
        tag: ((el.querySelector(":scope > .placed-tag") || {}).textContent || ""),
        why: (inner && inner.getAttribute("data-placed-why")) || "",
      };
    })`);
    for (const r of audit) console.log(`AUDIT ${r.state.padEnd(6)} ${r.id.padEnd(30)} ${r.kind.padEnd(12)} shown=${JSON.stringify(r.shown)} tag=${JSON.stringify(r.tag)}${r.why ? ` why=${r.why}` : ""}`);
    const count = (st: string) => audit.filter((r) => r.state === st).length;
    console.log(`AUDIT_TOTAL filled=${count("filled")} select=${count("select")} yours=${count("yours")}`);
    const panelFilled = Number(((await form.locator(".placed-panel").innerText()).match(/(\d+)\/\d+ filled/) ?? [])[1] ?? 0);
    expect(panelFilled, "panel's filled count (the CV counts too)").toBeGreaterThanOrEqual(10);
    expect(count("filled"), "filled floor").toBeGreaterThanOrEqual(10);

    // The demo's key moment: Right to Work and sponsorship are confirmed in the pack and must be filled on the form.
    // KNOWN_GAP lists keys that genuinely cannot be filled (explain each); it is empty because both fill.
    const KNOWN_GAP: Record<string, string> = {};
    for (const [id, what] of [["question_69482005", "Right to work (UK)"], ["question_69482001", "Visa sponsorship"]] as const) {
      const row = audit.find((r) => r.id === id);
      if (KNOWN_GAP[id]) { console.log(`KNOWN_GAP ${id}: ${KNOWN_GAP[id]}`); continue; }
      expect(row, `${what} (${id}) is in the audit`).toBeTruthy();
      expect(row?.state, `${what} (${id}) filled; tag=${row?.tag} why=${row?.why}`).toBe("filled");
      expect(row?.shown, `${what} shows a chosen option`).not.toBe("");
    }
    // Autopilot never ticks consent and never fills diversity answers
    expect(await form.evaluate(`document.querySelectorAll("input[type=checkbox][id*=consent]:checked, input[type=checkbox][name*=consent]:checked").length`)).toBe(0);
    expect(audit.filter((r) => r.state === "yours" && r.shown), "fields left to the student stay empty").toEqual([]);
    await form.waitForTimeout(3000);
    const selectGaps = audit.filter((r) => r.state === "select").map((r) => r.id);
    console.log(`REACT_SELECT_PATH: ${selectGaps.length === 0 ? "every single select filled via the trusted click" : `amber (select-yourself): ${selectGaps.join(", ")}`}`);
    console.log(`NETWORK non-read greenhouse requests (all aborted): ${JSON.stringify(blocked)}`);
    console.log(`NETWORK observed non-read greenhouse requests: ${JSON.stringify(seenWrites)}`);
    const unexplained = blocked.filter((b) => !TELEMETRY_ALLOW.test(b.url));
    expect(unexplained, "no non-read request to greenhouse.io other than allow-listed telemetry (a form submission would land here)").toEqual([]);
    expect(seenWrites.length, "observer and route handler agree").toBe(blocked.length);
  } finally {
    await ctx.close(); // discards the unsent form
    fs.rmSync(extDir, { recursive: true, force: true });
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
});
