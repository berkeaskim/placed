// Placed Autopilot: fills the form from a one-time pack, marks every field, and stops. The student presses Submit.
(async function () {
  // R5: capture.js took the token out of the URL at document_start; we take it from the shared isolated world once.
  const take = globalThis.__placedTakeToken;
  const token = typeof take === "function" ? take() : null;
  if (!token) return;

  const host = location.host;
  const ats = host.includes("greenhouse") ? "greenhouse" : host.includes("ashbyhq") ? "ashby" : host.includes("lever.co") ? "lever" : null;
  if (!ats) return;

  const panel = document.createElement("div");
  panel.className = "placed-panel";
  panel.setAttribute("role", "status");
  panel.textContent = "Placed Autopilot is reading your pack…";
  document.body.appendChild(panel);
  const say = (...parts) => {
    panel.textContent = "";
    parts.forEach((p, i) => { if (i) panel.appendChild(document.createElement("br")); panel.append(p); });
  };

  // The claim runs here, from the employer page's origin, which the Placed CORS allowlist accepts.
  let res;
  try {
    res = await fetch(`${globalThis.PLACED_ORIGIN}/api/autopilot/claim`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }), credentials: "omit", cache: "no-store",
    });
  } catch {
    say("Couldn't reach Placed. Is the app running?");
    return;
  }
  if (!res.ok) {
    say(res.status === 410 ? "This link was already used or expired. Re-open from Placed."
      : res.status === 403 ? "Placed can't fill forms on this site."
      : "Placed couldn't find this pack.");
    return;
  }
  const plan = await res.json().catch(() => null);
  if (!plan || !Array.isArray(plan.fields)) { say("Placed sent an unreadable pack. Re-open from Placed."); return; }

  // Never fill the wrong form: the pack must be for this ATS and this job.
  const jobId = String(plan.url || "").match(/\/jobs\/(\d+)|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  const wanted = jobId && (jobId[1] || jobId[2]).toLowerCase();
  const here = (location.pathname + location.search).toLowerCase();
  if (plan.ats !== ats || !wanted || !here.includes(wanted)) {
    say("This pack is for a different job. Open it from Placed again.");
    return;
  }

  let cvFile = null;
  if (plan.cv && plan.cv.url) {
    try {
      const r = await fetch(plan.cv.url, { credentials: "omit", cache: "no-store" });
      if (r.ok) cvFile = new File([await r.blob()], plan.cv.filename || "CV.pdf", { type: "application/pdf" });
    } catch { /* the CV field is left for the student */ }
  }

  const fill = globalThis.PlacedFillers[ats];
  const s = globalThis.PlacedFillPlan.summarize(plan.fields);
  // The CV goes first: Lever re-parses the CV on upload, which must not overwrite what we fill afterwards.
  const fields = [...plan.fields].sort((a, b) => (a.type === "file" ? 0 : 1) - (b.type === "file" ? 0 : 1));
  let done = 0, mine = 0, n = 0;
  say(`Placed Autopilot filling… 0/${fields.length}`, `${s.fill} from your pack · ${s.yours + s.select} for you`);

  for (const f of fields) {
    const ctx = { cvFile, sourceLabel: f.sourceLabel, armed: false };
    let out;
    try { out = await fill(f, ctx); } catch { out = "select-yourself"; }
    if (f.type === "file" && out === "filled" && ats === "lever") await new Promise((r) => setTimeout(r, 1500));
    let box = null;
    try { box = fill.box(f); } catch { box = null; }
    if (box && out !== "missing") {
      box.dataset.placed = out === "filled" ? "filled" : out === "yours" ? "yours" : "select";
      const tag = document.createElement("span");
      tag.className = "placed-tag";
      tag.textContent = out === "filled" ? `Placed · ${f.sourceLabel || "from your setup"}`
        : out === "yours" ? "Your call"
        : ctx.armed ? "Click this box, Autopilot will pick" : "Please select this yourself";
      box.appendChild(tag);
    }
    if (out === "filled") done++; else mine++;
    n++;
    say(`Placed Autopilot filling… ${n}/${fields.length}`);
  }

  globalThis.PlacedDom.send({ kind: "detach" });
  say(`✅ ${done}/${fields.length} filled · ${mine} for you`, "Check everything. You press Submit.");
  const submit = document.querySelector("button[type=submit], input[type=submit], #btn-submit, .ashby-application-form-submit-button");
  const real = [...document.querySelectorAll("button, input[type=submit]")].find((b) => /submit/i.test(b.textContent || b.value || "")) || submit;
  if (real) {
    real.classList.add("placed-submit-hint");
    real.scrollIntoView({ block: "center" });
  }
})();
