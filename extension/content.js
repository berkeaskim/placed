// Placed Autopilot: fills the form from a one-time pack, marks every field, and stops. The student presses Submit.
(async function () {
  // R5: capture.js took the token out of the URL at document_start; we take it from the shared isolated world once.
  const take = globalThis.__placedTakeToken;
  const token = typeof take === "function" ? take() : null;
  if (!token) return;

  const host = location.host;
  const ats = host.includes("greenhouse") ? "greenhouse" : host.includes("ashbyhq") ? "ashby" : host.includes("lever.co") ? "lever" : null;
  if (!ats) return;
  const Dom = globalThis.PlacedDom;

  // ---------- panel (the student's close button; Autopilot never clicks it) ----------
  // The panel is mounted lazily, AFTER the page has hydrated: Greenhouse's React app re-renders the whole body when it finds
  // a node it did not render during hydration (React #418/#425), which silently deleted an early panel. say() also
  // re-attaches the panel if the page ever removes it.
  const panel = document.createElement("div");
  panel.className = "placed-panel";
  panel.setAttribute("role", "status");
  const body = document.createElement("div");
  const close = document.createElement("button");
  close.type = "button";
  close.className = "placed-panel-close";
  close.setAttribute("aria-label", "Close the Placed panel");
  close.textContent = "×";
  let dismissed = false;
  close.addEventListener("click", () => { dismissed = true; panel.remove(); });
  panel.append(close, body);
  const say = (...parts) => {
    body.textContent = "";
    parts.forEach((p, i) => { if (i) body.appendChild(document.createElement("br")); body.append(p); });
    if (!dismissed && !panel.isConnected) (document.body || document.documentElement).appendChild(panel);
  };
  const settled = async () => {
    if (document.readyState !== "complete") await new Promise((r) => window.addEventListener("load", r, { once: true }));
    await Dom.sleep(1500);
  };

  // ---------- form readiness: the token is single-use, so never claim before the form exists ----------
  const READY = {
    greenhouse: () => document.querySelector("#application-form, form.application--form") || document.querySelector("form #first_name"),
    ashby: () => /\/application\/?$/.test(location.pathname) && document.querySelector(".ashby-application-form-field-entry"),
    lever: () => document.querySelector('form [name="email"]'),
  };
  const formReady = await Dom.waitFor(READY[ats], 50, 200);
  if (formReady) await settled();
  if (!formReady) {
    say("Open the application form first, then click Open & fill again in Placed.");
    return;
  }

  // ---------- claim (R8: done by the service worker) ----------
  say("Placed Autopilot is reading your pack…");
  const res = await Dom.send({ kind: "claim", token });
  const status = res && typeof res.status === "number" ? res.status : -1;
  if (status !== 200) {
    say(status === 410 ? "This link was already used or expired. Re-open from Placed."
      : status === 404 ? "Placed couldn't find this pack. Re-open from Placed."
      : status === 403 ? "Placed didn't accept the extension. Check PLACED_ORIGIN in the extension's config.js."
      : status === 400 ? "This link is broken. Re-open from Placed."
      : status === 0 ? "Couldn't reach Placed. Is the app running?"
      : "Something went wrong at Placed. Re-open from Placed and try again.");
    return;
  }
  const plan = res.plan;

  // Never fill the wrong form: the pack must be for this ATS and this job.
  const wanted = globalThis.PlacedJobMatch.wantedJobId(plan.url);
  if (plan.ats !== ats || !globalThis.PlacedJobMatch.pageMatches(wanted, location.pathname, location.search)) {
    say("This pack is for a different job. Open it from Placed again.");
    return;
  }

  const toFile = (f, fallback) => {
    if (!f || typeof f.base64 !== "string") return null;
    try {
      const bin = atob(f.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new File([bytes], f.name || fallback, { type: f.type || "application/pdf" });
    } catch { return null; }
  };
  const cvFile = toFile(res.cv, "CV.pdf");
  const coverFile = toFile(res.cover, "Cover-Letter.pdf");

  const fill = globalThis.PlacedFillers[ats];
  const s = globalThis.PlacedFillPlan.summarize(plan.fields);
  // The CV goes first (Lever re-parses it on upload, which must not overwrite what we fill afterwards), then the cover letter file.
  const rank = (f) => (f.type !== "file" ? 2 : f.asset === "cover" ? 1 : 0);
  const fields = [...plan.fields].sort((a, b) => rank(a) - rank(b));
  let done = 0, mine = 0, n = 0;
  say(`Placed Autopilot filling… 0/${fields.length}`, `${s.fill} from your pack · ${s.yours + s.select} for you`);

  const needsTrusted = fields.some((f) => f.mode === "fill" && (f.type === "select" || f.type === "location"));
  try {
    // Attach once, before anything is measured, so the debugger infobar cannot shift the page under a click.
    if (needsTrusted) await Dom.prepareTrusted();
    for (const f of fields) {
      const ctx = { cvFile, coverFile, sourceLabel: f.sourceLabel, armed: false };
      let out;
      try { out = await fill(f, ctx); } catch { out = "select-yourself"; }
      if (f.type === "file" && out === "filled" && ats === "lever") await Dom.sleep(1500);
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
  } finally {
    Dom.send({ kind: "detach" });
  }

  say(`✅ ${done}/${fields.length} filled · ${mine} for you`, "Check everything. You press Submit.");
  const submit = [...document.querySelectorAll("button, input[type=submit]")].find((b) => b !== close && /submit/i.test(b.textContent || b.value || ""))
    || document.querySelector("button[type=submit], input[type=submit], #btn-submit, .ashby-application-form-submit-button");
  if (submit) {
    submit.classList.add("placed-submit-hint");
    submit.scrollIntoView({ block: "center" });
  }

  // Never cover the submit button: move the panel to the top, and collapse it if it still overlaps.
  const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  let queued = false;
  const place = () => {
    queued = false;
    if (!submit || !panel.isConnected) return;
    panel.classList.remove("placed-panel--top", "placed-panel--min");
    if (!overlaps(panel.getBoundingClientRect(), submit.getBoundingClientRect())) return;
    panel.classList.add("placed-panel--top");
    if (overlaps(panel.getBoundingClientRect(), submit.getBoundingClientRect())) panel.classList.add("placed-panel--min");
  };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(place); } };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  setTimeout(place, 400);
})();
