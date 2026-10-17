# Cover Letter Playbook (master)

Compiled 2026-10-17 from six research files (01–06 in this folder, about 190 sources). This is the document the Cover Letter Writer is built from. Machine-readable rules and the lint lexicon live in `cover-letter-rules.json`; each rule there cites the research file that motivated it.

Audience: UK university students applying for spring weeks, internships, placements and graduate schemes.

---

## 1. The ten things that matter

1. **The first decision is the format.** Many UK employers don't want a letter at all. PwC UK and Bain London say so outright. Big-tech early-careers forms usually have no letter field. Jane Street says it does not need one. Startups want a short note, and AI labs ask "Why X?" essays. Goldman wants about 300 words. Choosing the wrong format wastes the application. (03, 04, 06)
2. **Letters get skimmed first.** About two-thirds of hiring staff say they spend under 30 seconds on a letter at first screen (vendor survey, 01). So the first two sentences must name the role and the company and give the strongest proof point.
3. **Tailored beats generic, and generic barely beats nothing.** In a vendor field experiment with 7,287 applications, tailored letters got about +53% callbacks vs no letter and about +31% vs a generic letter, while generic letters got only about +17% vs none (01). **A mode that writes a generic letter is never worth offering.**
4. **AI-generated tailoring has lost most of its signal.** On Freelancer.com, after an AI letter tool launched, the link between how well a letter matched the job and getting a callback fell by about 51%. Employers moved to signals that are hard to fake (01, 05, STRONG). What still counts is **specific, verifiable content from the user's own history**: real projects, real numbers, real people met, a real reason.
5. **Polishing the user's words helps; generating generic text doesn't.** Writing help that only fixed errors and readability raised hires by 8% and wages by 10% in a randomised trial of about 480k jobseekers (05, STRONG). Letters improved with ChatGPT scored higher but did *not* get more interviews (01). Suspected AI use lowers ratings (05). **Build from the user's material and edit it, rather than generating from nothing.**
6. **"Why this firm" is the hardest part and the one recruiters weigh most.** It must pass the **swap test**: if the sentence still works after swapping in a rival's name, it is generic. The candidate's own touchpoints (spring week, event, a person they spoke to) beat any fact from the web (02, 03).
7. **Zero defects.** Even a few spelling errors cut interview odds by about 7 points, and many errors by about 18.5 points (STRONG, 01). Naming the wrong company or leaving a placeholder in is fatal (01, 02, 03).
8. **Never invent anything.** Exaggeration is the most-cited reason for rejection, and anything in the letter can be probed at interview. Every claim about the candidate traces to their CV, profile or answers; every claim about the firm traces to the job description or the user's notes (all six files).
9. **Shorter than an LLM wants to write.** AI letters run 1.5–2x longer than human ones (01). A full letter is 250–400 words with a hard cap of 450. Field answers use 85–100% of the stated limit.
10. **Sound like a person.** Block the known AI and cover-letter tells: "delve", "passionate about", "fast-paced environment", "I am writing to apply", em-dash overuse, triplets, "not only X but Y", trailing "-ing" clauses, and paragraphs of identical length. Keep the user's own sentences word for word (05).

---

## 2. Output formats

The writer picks one before drafting. The posting and the form decide, never a default.

| Mode | When | Length | Shape |
|---|---|---|---|
| `skip` | The posting or form says there is no letter (PwC UK, Bain London AC, big-tech early careers without a field), or an optional upload where the user has no specific hook (04: CL-TP-23) | — | Write "why us" notes for the interview instead (03: CL-FC-02) |
| `full_letter` | Upload field, or the letter is required or recommended (BCG London, McKinsey UK, MS, boutiques, grad schemes) | 250–400 words, hard max 450, one A4 page | Header, salutation, 4–5 paragraphs, sign-off |
| `short_letter` | Goldman-style short letter, or an optional letter at a fintech or scale-up | about 300 words (±10%), or 150–250 | Same shape, compressed |
| `field_answer` | "Why this role/firm/division?" box, "Additional information", AI-lab "Why X?" | 85–100% of the limit (default 300 words) | No salutation or sign-off; the first sentence answers the question |
| `short_note` | Startups (Wellfound, YC, emailing a founder) | 50–150 words | "Hi {Name}", plain text, 1–2 proof links, one small ask |
| `email` | Direct application to a small firm or lab | 150–250 words | Subject = title + reference; the body *is* the letter |
| `speculative` | No advert (SMEs, boutiques, research groups) | 200–300 words | Year of study + exact ask (type, dates) + one research point + 14-day follow-up |

Not in scope for v1: networking notes (Inside Track already covers outreach), Civil Service personal statements (scored on Success Profiles behaviours, a separate format), and law training-contract forms.

**How the mode is chosen:** Autopilot already reads application forms, so the field label, type and `maxlength` (or an on-page counter) should be stored on the job. When nothing is known, use the job's sector (§5) to pick a default and ask the user one question: "Does this application ask for a cover letter?"

---

## 3. The full letter

| # | Section | Words | Job |
|---|---|---|---|
| 0 | Header | — | Name, email, phone, LinkedIn, date (`17 October 2026`), company, a `Ref:` line with the exact role title and vacancy ID. No home address by default (privacy) |
| 1 | Salutation | — | Named person → `Dear Ms Patel` (no full stop after Ms/Mr/Dr). Otherwise `Dear {Firm} Graduate Recruitment Team` if the programme has one, else `Dear Hiring Manager`. Never "To whom it may concern" or "Dear Sir/Madam" |
| 2 | Opening | 40–70 | **One sentence that names the exact role (and division/office) and carries a hook.** The hook is a specific link between *this* candidate and *this* role or firm. UK services want the role up front, US experts want a hook first; doing both in one sentence satisfies both |
| 3 | Why me | 120–200 | 2–3 requirements from the job description, each with its own example: what *I* did, how, and the result (with a number if the source has one), ending with a "so what" link to the role. Don't restate the CV; explain the how and why behind 2–3 items |
| 4 | Why them | 60–100 | 1–2 firm-specific facts (division, programme feature, deal, product, event, person met), **each connected to the candidate's own experience or goal**. Must pass the swap test. At most one company value, illustrated by something the candidate did |
| 5 | Close | 25–50 | A one-sentence fit summary, availability or interest in interview, thanks. No filler such as "I hope to hear from you soon" |
| 6 | Sign-off | — | Named recipient → `Yours sincerely`. Unnamed → `Yours faithfully` by default (configurable, since UK sources disagree for "Dear Hiring Manager") |

**Order:** put the stronger section first. With direct experience, lead with "why me"; with thin experience but strong research, lead with "why them" (02).

**Thin experience** (first-years, spring weeks): draw on modules, societies (with scale: members, £ raised, events run), part-time jobs (framed as client service, reliability, training others) and competitions. Never open with a deficit ("Although I have no experience…").

**Register:** formal, plain, confident, not boastful. Short sentences; no hedges ("I feel that", "I believe I could"); no vague quantifiers ("various", "many"); focus on what the candidate would contribute, not what they would gain; prose only, no bullets; British spelling.

---

## 4. The "why this firm" recipe

Inputs: job description, company, division, office, and the candidate's touchpoints (events, spring weeks, contacts, product usage notes).

1. **Classify** the sector (§5), programme, office and output mode.
2. **Pull anchors from the job description:** the division or service-line name, 3–5 required skills, programme features (rotations, ACA/CFA support, mentoring). These are the only firm facts guaranteed to be true.
3. **Use the candidate's own touchpoints first:** a spring week or insight day here, a person they spoke to (named only if the user gave the name and confirmed it), society sponsorship, alumni. If there are none, say nothing about touchpoints and lean on fit with the division.
4. **Add at most 1–2 differentiators** the closest rival lacks: a sector franchise, programme structure, or a dated deal or result. Run the swap test against the firm's top-3 rivals and drop any sentence that still works.
5. **Connect every fact to the candidate:** firm fact → why it matters for the work in this division → evidence the candidate has done related work. No fact stands on its own.
6. **Verify:** every deal or number must come from the job description or the user's notes. v1 doesn't browse; anything older than 12 months gets flagged. If there is no fact, omit it. A made-up deal is worse than none.
7. **If the user gives no reason**, ask: "Why this firm, in one sentence? Something you saw, read, or someone you met." If they skip it, write a factual sentence about fit with the role and mark it "add your own reason".

---

## 5. Notes by sector

- **Investment banking (IBD):** structure it as why firm, why division, why me. Name the division (M&A, ECM/DCM, coverage) and the office. Name-dropping contacts is expected. Large US banks treat the letter as a filter: aim for zero defects plus specificity rather than flourish.
- **Sales & trading / markets:** name the desk family (rates, FX, credit, equities, structuring). Show engagement with markets (a view, a competition, a portfolio log); "interest in markets" alone fails.
- **Asset management:** give a buy-side reason and mention the firm's investment style or asset class. Don't reuse IB motivation. Many programmes don't take a letter.
- **Big 4:** usually no letter, so the motivation goes into video interview answers. Show you understand the qualification (ACA/CTA/ACCA) and what the service line does day to day. "Why this Big 4" must not apply to the other three.
- **Strategy consulting (MBB):** office specificity is mandatory. Never call consulting a stepping stone ("a few years", "exit opportunities"). Bain London: no letter, and AI only for spelling and grammar.
- **Insurance / actuarial:** mention IFoA exam progress and the line of business (life, GI, pensions, Lloyd's).
- **Software engineering:** proof over adjectives; describe impact (users, latency, rank) rather than the tech stack; give 1–2 proof links the user owns (GitHub, demo).
- **Data:** each story runs question → method → decision, with tool names secondary. Evidence for this sector is weak, so these are soft rules.
- **Product:** one observation about *their* product from the user's own notes, plus a hypothesis. Never invent product usage.
- **Startups:** a short note. Qualify yourself in the first two lines, make most of it about them, end with one small ask.
- **AI labs / mission-driven:** a "Why X?" essay of 200–400 words that names specific work. Several of these firms (Anthropic among them) ask candidates not to use AI or to draft first themselves. Detect this and switch to feedback-only mode (§7).

---

## 6. Generation pipeline (how the writer should work)

1. **Choose the mode** (§2). Stop if it is `skip` and offer interview notes for "why us".
2. **Check the employer's AI policy.** If the job description says "do not use AI" or similar, switch to **feedback-only mode**: the user writes and Placed critiques against the rules, generating no text.
3. **Build an evidence pack** (structured, no prose yet): 2–4 job-description requirements, each mapped to CV lines with their IDs; firm facts with their source (JD line or user note); the user's touchpoints. This is the most important step, and it mirrors how `lib/tailor` already uses CV IDs.
4. **Ask 1–3 short questions**, all skippable: (a) why this firm, in their own words; (b) one experience, in their own words; (c) optional: anything a recruiter wouldn't know from the CV. Answers become **locked spans**: kept word for word, with only spelling and grammar fixed.
5. **Draft** from the evidence pack plus the answers, using the playbook section for the job's sector (like `lib/tailor/playbooks`). Give the style anchors (the user's own bullets) and voice stats (contraction rate, sentence length) when available. Ban only the handful of opening clichés in the prompt; long lists of banned words can prime the model to use them.
6. **Lint** deterministically using `cover-letter-rules.json` (§8).
7. **Ground-check** with a model, like `verifyTailoring`: every claim must be supported by the evidence pack, every number must appear in the sources, and no other employer's name may appear.
8. **Rewrite only the flagged sentences** ("say the plain thing; use the user's words"), at most 2 rounds, then show any remaining soft flags.
9. **Hand it to the user:** highlight "your words" vs "AI words", add a "you may be asked about this" note next to claims, and nudge at least one edit before export (time spent editing correlated with offers, 05).
10. **Export** both a PDF (named `First-Last_Cover-Letter_Company_YYYY-MM.pdf`) and a plain-text copy, so Autopilot can either upload or paste. Never auto-submit.

---

## 7. Honesty and safety rules (non-negotiable)

- No invented experience, numbers, motivations, contacts, events, product usage or company facts.
- Visa status, right to work, disability, grades and gaps are mentioned **only if they are in the user's profile and the user opts in**:
  - **Visa:** at most 2 sentences, in the final paragraph, with the visa length read from a dated config. The Graduate visa drops to 18 months for applications from 1 Jan 2027. If the form has a dedicated right-to-work question, answer it there instead.
  - **Disability:** opt-in only, at most 2 sentences, linked to strengths. Under a Disability Confident scheme, evidence every essential criterion.
  - **Gaps:** one sentence, after the main evidence.
- Respect employer AI policies (feedback-only mode).
- Never compute or show an AI-detector score. Detectors are biased against non-native writers (05), and many Placed users are international students.
- Named third parties (a person met at an event) appear only after the user confirms.

---

## 8. Lint (deterministic checks)

The full lexicon with regex is in `cover-letter-rules.json` → `lexicon`. In summary:

- **Hard ban (blocks export or forces a rewrite):** placeholders and chatbot leftovers; another employer's name; the "I am writing to apply/express" opening; "delve", "tapestry", "testament to", "underscore", "ever-evolving landscape"; "fast-paced environment", "dynamic team", "team player", "self-starter"; "prestigious/renowned/world-class firm", "commitment to excellence"; "it's not X, it's Y"; trailing "…, highlighting/ensuring/showcasing"; "In conclusion"; exclamation marks; markdown; "To whom it may concern"; consulting framed as a stepping stone; salary, perks or exit opportunities given as motivation.
- **Soft flag (density threshold: more than 3 distinct per 300 words → rewrite):** passionate, leverage, robust, pivotal, crucial, foster, showcase, vibrant, seamless, meticulous, holistic, "perfect fit", "proven track record", "results-driven", "I am confident that", "opportunity to learn/develop/grow" (more than once), hedges, vague quantifiers.
- **Structure counters:**
  - em dashes: at most 1 (3 or more fails);
  - at most 1 "not only…but";
  - at most 1 list of three;
  - sentence-length standard deviation of at least 4 words, with at least one sentence of 8 words or fewer;
  - paragraph-length coefficient of variation of at least 0.15;
  - at most about 35% of sentences start with "I", and no two paragraphs in a row start with "I";
  - average sentence of 22 words or fewer, longest sentence 40 words or fewer;
  - at most ~110 words per paragraph.
- **Format checks:**
  - word and character counts against the mode, and against the form's limit (counting spaces and newlines when the limit is in characters);
  - en-GB spelling;
  - UK date format;
  - the salutation and sign-off pair correctly;
  - the role title and company appear in the first paragraph (or in the first sentence of a field answer).
- **Overlap checks:**
  - no run of 8 or more words copied from the job description or careers page, other than the role title;
  - at most ~60% of sentences may paraphrase CV bullets;
  - no more than 40% verbatim sentence overlap with the user's other letters.

**Caveat:** none of these thresholds have been tested on real letters (05). Calibrate them on real UCL student letters vs raw LLM drafts. The target is to flag fewer than 10% of human-written letters. Keep the lexicon as data (JSON), not code, because model tics change over time.

---

## 9. Contradictions and how we resolved them

| Question | Positions | Decision |
|---|---|---|
| Fallback greeting | "Dear Hiring Manager" (MIT, Prospects, Green) vs "Dear Sir/Madam" (LSE, TARGETjobs) vs team name (eFC) | Team name if the programme has one → "Dear Hiring Manager". Never Sir/Madam (dated; eFC lists it as a mistake) |
| Sign-off after "Dear Hiring Manager" | Faithfully (strict UK) vs sincerely (common) | Default `Yours faithfully`, user-configurable; the lint only fails clear mismatches (named + faithfully) |
| Opening: role first or hook first? | UK services vs Green/Lees | One sentence that does both |
| Bad letter vs no letter | Practitioners say a bad letter is worse; ResumeGo found generic slightly beats none | A generic letter is never offered; with no hook on an optional upload → suggest `skip` |
| Word count | 250–400 is convention; the ResumeGo-sourced length figures can't be verified | Use it as a target, not as evidence |
| Em dashes | Widely cited AI tell; the Wikipedia page calls it a dated sign | Soft limit of 1; keep it as data |
| Disclose AI use? | Disclosing lowers trust; being caught concealing it lowers it more (05) | No disclosure line. Make every sentence defensible at interview |

---

## 10. Open questions for the build

1. **Where does the mode come from?** Can Autopilot store each form's letter field, label and `maxlength` on the job record? Until then: ask the user plus sector defaults.
2. **Company facts in v1:** only the job description plus user notes (safe, local-first), or also fetch the firm's careers page and newsroom (fresher, but adds network calls, scraping, and a risk of stale or wrong facts)?
3. **The questions step:** always ask, or only when the evidence pack has no touchpoint?
4. **Lint calibration:** we need a small corpus of real student letters. Could users opt in to donating anonymised letters?
5. **Placed is local-first and supports Ollama models.** The two-pass pipeline (draft → lint → targeted rewrite → ground-check) on qwen3:8b may take several minutes. Stream the draft and run lint locally (it's instant).
6. **UCL Careers and Oxford pages blocked our fetchers**, so their guidance comes from search snippets only. Worth a manual read.
7. **Evidence is thin** for PM and data roles, tier-2 consulting and asset management, so those rules stay soft.
