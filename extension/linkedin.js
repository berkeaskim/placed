// Placed LinkedIn Score: reads the student's OWN profile in their logged-in tab, only when Placed asked for it.
//
// Does nothing unless the service worker holds a ticket from the Placed page AND this tab is the student's own profile
// (LinkedIn adds ?isSelfProfile=true when /in/me redirects there). Reads the profile page, then /details/skills/ for
// the full skills list, and hands both to the service worker, which posts them to Placed. Never types or edits anything
// on LinkedIn (its only clicks expand "… more" text in place), and never reads contact info (email, phone, birthday).
//
// LinkedIn's logged-in layout (2026-10) has obfuscated class names, so cards are found by their ids
// ("com.linkedin.sdui.profile.card…") and headings, and each card is split into items by its <p> lines. The server
// (lib/linkedin/parse-capture.ts) interprets the lines.
(async function () {
  const CARD = '[id^="com.linkedin.sdui.profile.card"]';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const send = (m) => new Promise((r) => chrome.runtime.sendMessage(m, (x) => r(chrome.runtime.lastError ? { ok: false } : x || { ok: false })));
  // /in/me loads as its own document, then LinkedIn swaps the URL to /in/<slug>/?isSelfProfile=true without a reload,
  // so this script would otherwise only ever see "/in/me". Wait for the swap.
  const ME = /^\/in\/me\/?$/;
  for (let i = 0; i < 60 && ME.test(location.pathname); i++) await sleep(250);
  if (ME.test(location.pathname)) return;
  const slug = (location.pathname.match(/^\/in\/([^/]+)/) || [])[1];
  if (!slug) return;
  const onSkills = /^\/in\/[^/]+\/details\/skills\/?$/.test(location.pathname);
  const self = !onSkills && new URLSearchParams(location.search).get("isSelfProfile") === "true";

  // The Placed page arms the ticket a moment after it opens this tab, so ask a few times before giving up.
  let claim = { ok: false };
  for (let i = 0; i < (self ? 6 : 1) && !claim.ok; i++) {
    claim = await send({ kind: "liClaim", self });
    if (!claim.ok && self) await sleep(1000);
  }
  if (!claim.ok) return;

  // ---------- panel ----------
  const panel = document.createElement("div");
  panel.setAttribute("role", "status");
  panel.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;max-width:320px;padding:14px 16px;border-radius:16px;background:#5B3DF5;color:#fff;font:600 14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)";
  const say = (t) => { panel.textContent = t; if (!panel.isConnected) document.body.appendChild(panel); };

  // ---------- reading ----------
  const lines = (el) => String(el.innerText || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const heading = (c) => ((c.querySelector("h2") || {}).innerText || "").trim();
  const cards = () => Array.from(document.querySelectorAll(CARD));
  const card = (re) => cards().find((c) => re.test(heading(c)));
  const SECTION_TITLE = /^(about|experience|education|skills|licenses & certifications|certifications|projects|honors & awards|languages)$/i;
  // Items are the children of the lowest element that holds every <p> of the card (outside its heading). When one of
  // two children is just the section's title drawn as a <p> (the skills page does this), drop it and look inside the list.
  function items(c) {
    if (!c) return [];
    const h = c.querySelector("h2");
    let ps = Array.from(c.querySelectorAll("p")).filter((p) => (!h || !h.contains(p)) && lines(p).length);
    for (let depth = 0; ps.length && depth < 5; depth++) {
      let lca = ps[0].parentElement;
      while (lca && !ps.every((p) => lca.contains(p))) lca = lca.parentElement;
      const groups = new Map();
      for (const p of ps) {
        let x = p;
        while (x.parentElement && x.parentElement !== lca) x = x.parentElement;
        if (!groups.has(x)) groups.set(x, []);
        groups.get(x).push(p);
      }
      const gs = Array.from(groups.values());
      const head = gs.find((g) => g.length === 1 && SECTION_TITLE.test(lines(g[0]).join(" ")));
      if (gs.length === 2 && head) { ps = gs.find((g) => g !== head); continue; }
      return gs.slice(0, 40).map((g) => g.flatMap(lines));
    }
    return [];
  }
  // LinkedIn cuts long descriptions at "… more" (the rest isn't in the page until expanded). These buttons only
  // expand text in place; nothing else on LinkedIn is ever clicked.
  async function expandMore(cs) {
    const more = cs.filter(Boolean).flatMap((c) => Array.from(c.querySelectorAll("button")).filter((b) => /^…?\s*(see )?more$/i.test(b.innerText.trim())));
    for (const b of more) { try { globalThis.PlacedGuard.safeClick(b); } catch { /* refused: leave that text cut */ } }
    if (more.length) await sleep(1200);
  }
  const links = (els) => els.filter(Boolean).flatMap((el) => Array.from(el.querySelectorAll("a[href]")).map((a) => a.href))
    .filter((h) => /^https?:/.test(h) && (!/linkedin\.com/.test(new URL(h).hostname) || /\/redir\/redirect/.test(h))).slice(0, 20);

  async function loadAllCards() {
    const scrollers = Array.from(document.querySelectorAll("main, body")).concat([document.scrollingElement]);
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      for (const s of scrollers) if (s) s.scrollBy(0, 1400);
      window.scrollBy(0, 1400);
      await sleep(450);
      if (card(/^Experience/) && card(/^Education/) && card(/^Skills/)) break;
    }
    for (const s of scrollers) if (s) s.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }

  async function readProfile() {
    const deadline = Date.now() + 10_000;
    while (!card(/./) && Date.now() < deadline) await sleep(300);
    await loadAllCards();
    await expandMore([card(/^About$/), card(/^Experience/), card(/^Education/), card(/^Licenses/), card(/^Projects/), card(/^Honors/)]);
    const top = cards().find((c) => /Topcard$/.test(c.id)) || cards()[0];
    const about = card(/^About$/);
    let aboutLines = about ? lines(about).filter((l) => l !== "About" && !/^…?see more$/i.test(l)) : [];
    const cut = aboutLines.findIndex((l) => /^top skills$/i.test(l)); // the About card can end with a "Top skills" row
    if (cut >= 0) aboutLines = aboutLines.slice(0, cut);
    return {
      profileUrl: `https://www.linkedin.com/in/${slug}`,
      name: top ? heading(top) : "",
      top: top ? Array.from(top.querySelectorAll("p")).flatMap(lines).slice(0, 30) : [],
      about: aboutLines.join("\n"),
      experience: items(card(/^Experience/)),
      education: items(card(/^Education/)),
      certifications: items(card(/^Licenses/)),
      honors: items(card(/^Honors/)),
      languages: items(card(/^Languages/)),
      projects: items(card(/^Projects/)),
      skills: items(card(/^Skills/)).map((g) => g[0]).filter(Boolean),
      skillsComplete: false,
      links: links([top, about]),
    };
  }

  async function readSkills() {
    const deadline = Date.now() + 10_000;
    let c = null;
    while (!(c = cards().find((x) => /SkillDetails$/.test(x.id))) && Date.now() < deadline) await sleep(300);
    if (!c) return [];
    // the list streams in: wait until its length stops changing
    for (let n = -1, i = 0; i < 10; i++) { const m = c.querySelectorAll("p").length; if (m === n && m > 1) break; n = m; await sleep(500); }
    return items(c).map((g) => g[0]).filter((s) => s && s !== "Skills").slice(0, 150);
  }

  async function submit(extra) {
    say("Placed is scoring your profile… (about 20 seconds)");
    const r = await send({ kind: "liSubmit", ...extra });
    say(r.ok ? `Done. Your LinkedIn Score is in Placed${r.total != null ? `: ${r.total}/100` : ""}.` : `Placed couldn't score this: ${r.error || "try again from Placed."}`);
  }

  if (claim.phase === "read" && !onSkills) {
    say("Placed is reading your profile. Don't close this tab.");
    const profile = await readProfile();
    const stashed = await send({ kind: "liStash", profile });
    if (!stashed.ok) return say("Placed couldn't continue. Press the button in Placed again.");
    if (card(/^Skills/)) {
      say("Placed is reading your full skills list…");
      location.assign(`https://www.linkedin.com/in/${slug}/details/skills/`);
    } else {
      await submit({});
    }
  } else if (claim.phase === "skills" && onSkills) {
    say("Placed is reading your full skills list…");
    await submit({ skills: await readSkills() });
  }
})();
