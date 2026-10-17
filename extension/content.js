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

  // ---------- Aurora overlay (aurora.js): presentation only; the student's close button lives in it ----------
  // Mounted lazily, AFTER the page has hydrated: Greenhouse's React app re-renders the whole body when it finds a node
  // it did not render during hydration (React #418/#425), which silently deleted an early panel. The overlay sits on
  // <html> in a shadow root, and every update re-attaches it if the page ever removes it.
  // Presentation must never stop the fill: every overlay call goes through quiet()/quietly(), so a UI exception cannot
  // skip a field, the debugger detach or the finish state.
  const quiet = (fn) => { try { return fn(); } catch { return undefined; } };
  const quietly = async (fn) => { try { return await fn(); } catch { return undefined; } };
  const ui = globalThis.PlacedAurora.create();
  const say = (text) => quiet(() => ui.message(text));
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
  quiet(() => ui.start()); // "Reading the form…"
  const readingSince = Date.now();
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
  // The CV goes first (Lever re-parses it on upload, which must not overwrite what we fill afterwards), then the cover letter file.
  const rank = (f) => (f.type !== "file" ? 2 : f.asset === "cover" ? 1 : 0);
  const fields = [...plan.fields].sort((a, b) => rank(a) - rank(b));
  let done = 0, n = 0;
  const theirs = []; // wrappers left to the student, for "k left for you"
  const per = globalThis.PlacedPacing.perFieldMs(fields.length);
  const boxOf = (f) => { try { return fill.box(f); } catch { return null; } };
  const short = (label) => String(label || "this field").replace(/[\s*:?]+$/, "").replace(/\s+/g, " ").slice(0, 48);
  const statusFor = (f) => f.mode !== "fill" ? "Leaving this one for you"
    : f.type === "file" ? (f.asset === "cover" ? "Attaching your cover letter" : "Attaching your CV")
    : ["select", "location", "boolean", "multiselect"].includes(f.type) ? `Choosing “${short(f.label)}”`
    : `Writing “${short(f.label)}”`;
  const wait = 1000 - (Date.now() - readingSince);
  if (wait > 0) await Dom.sleep(wait);
  quiet(() => ui.progress(0, fields.length));

  const needsTrusted = fields.some((f) => f.mode === "fill" && (f.type === "select" || f.type === "location"));
  try {
    // Attach once, before anything is measured, so the debugger infobar cannot shift the page under a click.
    if (needsTrusted) await Dom.prepareTrusted();
    for (const f of fields) {
      const began = Date.now();
      quiet(() => ui.status(statusFor(f)));
      await quietly(() => ui.activate(boxOf(f), Math.round(per * 0.6))); // scroll to it and light it up
      const ctx = { cvFile, coverFile, sourceLabel: f.sourceLabel, armed: false };
      let out;
      try { out = await fill(f, ctx); } catch { out = "select-yourself"; }
      if (f.type === "file" && out === "filled" && ats === "lever") await Dom.sleep(1500);
      const box = boxOf(f);
      quiet(() => ui.clearActive());
      if (box && out !== "missing") {
        box.dataset.placed = out === "filled" ? "filled" : out === "yours" ? "yours" : "select";
        quiet(() => box.appendChild(ui.makeTag(out === "filled" ? f.sourceLabel || "from your setup"
          : out === "yours" ? "Your turn"
          : ctx.armed ? "Your turn · open it and Autopilot picks" : "Your turn · please select this")));
        quiet(() => ui.settle(box));
        if (out !== "filled") theirs.push(box);
      }
      if (out === "filled") done++;
      n++;
      quiet(() => ui.progress(n, fields.length));
      if (box && out === "filled") await quietly(() => ui.reveal(globalThis.PlacedAurora.ringTarget(box), Math.max(0, per - (Date.now() - began)), Math.min(1200, per * 2.5)));
      const rest = per - (Date.now() - began);
      if (rest > 0) await Dom.sleep(rest);
    }
  } finally {
    quiet(() => ui.clearActive());
    Dom.send({ kind: "detach" });
  }

  const submit = [...document.querySelectorAll("button, input[type=submit]")].find((b) => /submit/i.test(b.textContent || b.value || ""))
    || document.querySelector("button[type=submit], input[type=submit], #btn-submit, .ashby-application-form-submit-button");
  if (submit) submit.scrollIntoView({ block: "center", behavior: "smooth" });
  // "{done} of {fields.length} filled" · "Check everything, then press Submit yourself." · "{k} left for you" · "Review answers"
  if (!quiet(() => { ui.finish({ filled: done, total: fields.length, theirs, submit }); return true; })) {
    if (submit) submit.classList.add("placed-submit-hint");
    say(`${done} of ${fields.length} filled. Check everything, then press Submit yourself.`);
  }
})();
