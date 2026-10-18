# Cover letter playbook and writer audit

**Overall grade: C+.** The research behind the playbook is unusually good. It grades vendor surveys as weak, rests on real field experiments, never builds an AI-detector score, and its "build from the student's own words" thesis now has a published *Journal of Labor Economics* result behind it. The shipped writer falls short of that research in four ways:
1. **Employer AI policies.** The detector is stale (Anthropic changed its policy) and its regex misses most real phrasings, so the "respect employer AI policy" rule fails silently.
2. **Wrong-company check.** The check against the catastrophic "wrong company named" error only looks at three rivals named by web research. In the local-first default (no Gemini or Serper key) it checks nothing at all.
3. **Invented motivation.** Nothing in the code catches an invented motivation or lesson ("this taught me…"), even though the playbook rates that a `block` rule.
4. **Lexicon.** The lexicon is a GPT-4-era (2023–24) list, and several hard-block patterns misfire on ordinary student prose. About 20 of the 63 rules in `rules.json` have no implementation.

The bigger strategic finding: UK employers increasingly move "why us" out of letters into form boxes and recorded-video questions. Big 4 firms ask for no letter and no written motivation answer at all. The product should become a single per-firm motivation bank that renders letters, form answers and HireVue scripts.

## Scorecard

| Dimension | Grade | Reason |
|---|---|---|
| Evidence quality | B+ | Sound grading (STRONG / MODERATE / WEAK-vendor). Core claims rest on peer-reviewed or preregistered field work. A few overreaches: a CV RCT is applied to letters, a gig-platform result is treated as general. |
| Freshness | C | Anthropic's AI policy, the ISE AI stats (43%→49%) and the BCG "official" letter claim are all stale. The lexicon reflects 2023–24 model tics. The Tilburg study, now published in JLE, is still cited as a press summary. |
| Coverage | C+ | Strong on letters. Weak on what UK firms actually ask in 2026: form motivation boxes on Oracle, Workday and Oleeo; video cover letters (Morgan Stanley); recorded "why us" answers (Big 4, JPM). No route for first-years or international students beyond spelling. |
| Implementation fidelity | C− | The policy, no-letter, motivation-label and AI-policy regexes miss the common phrasings (tested below). Wrong-employer check depends on research. CV-tailoring playbook injected instead of letter sector notes. About 20 rules unimplemented. |
| Consistency | C | Three different length bands (01: 200–350/400; 00: 250–400/450; autopilot answers: 200). Two separate field-answer writers. A strong worked example uses a banned rhetorical pattern. "Optional upload: send vs skip" resolved differently in 01 and 00. |
| UX / copy | B− | The Ready gate and "your words vs AI words" are well designed. But "This is true" clears swap-test failures in one tap and writes AI sentences into `confirmed_facts`. Spelling hits are labelled "Soft AI-ism". |

## Findings

### 1. The employer AI-policy detector is stale, and its regex misses most real policies
- **Severity:** P0 · **Type:** stale / implementation
- **Where:**
  - `lib/cover-letter/rules.json:945` (`counters.aiPolicy`), `lib/cover-letter/mode.ts:6,14-16`, `service.ts:93`; rule CL-16.
  - `docs/research/cover-letter/00-playbook.md:90` ("Anthropic among them ask candidates not to use AI").
  - `05-ai-voice-authenticity.md` F3 (cites Fortune, Feb 2025).
- **Current:** One regex. Matching it switches to feedback-only mode, where nothing is generated. Pattern: `(do not|don't|please don't) use (AI|generative AI|ChatGPT|AI assistants)|without (the use of )?AI|AI[- ]generated … (not permitted|prohibited|not allowed)`.
- **Evidence:**
  - Anthropic's current guidance is "draft first, then refine", not "no AI". "Please create your first draft yourself, then use Claude to refine it." (A, https://www.anthropic.com/candidate-ai-guidance, Anthropic, current as fetched 2026-10-18).
  - Bain London is "grammar and spelling only": "only use AI, such as Chat GPT or Claude, to check grammar and spelling in your CV" (A, https://www.bain.com/careers/recruiting/london-recruiting/, Bain, current).
  - I ran the regex against real and realistic phrasings. It returns **false** for:
    - "Candidates must not use generative AI tools…"
    - "Use of AI tools is not permitted."
    - "You may use AI for spelling and grammar only."
    - Anthropic's 2025 wording ("…ask that you not use AI assistants during the application process").
  - The ISE 2025 survey says only 10% of employers have banned AI, and 45% give applicants no guidance at all. Most policies are therefore partial ("draft yourself", "proofreading only"), not bans (A, https://ise.org.uk/knowledge/insights/498/5_trends_you_need_to_know_from_ises_recruitment_survey_2025/, ISE, 2025).
- **Fix:**
  1. Replace the boolean with a 4-state `aiPolicy`: `forbidden` | `draft_first` | `proofread_only` | `allowed_or_silent`.
  2. Behaviour per state:
     - `forbidden` → feedback-only, as today.
     - `draft_first` → require the student's own full draft before any AI text. The writer may only make sentence-level edits. Locked spans are ≥ 70% of characters.
     - `proofread_only` → spelling and grammar fixes only, shown as tracked changes.
  3. Regex additions, case-insensitive:
     - `\b(must|should|may) not use (any )?(generative )?AI\b`
     - `\buse of (generative )?AI( tools)?( is| are)? (not permitted|prohibited|not allowed)\b`
     - `\bnot use AI (assistants|tools)\b`
     - `\b(only|solely) (use )?AI (to|for) (check|proofread|spelling|grammar)`
     - `\b(first|initial) draft yourself\b`
     - `\bwithout (the )?(help|assistance|use) of (generative )?AI\b`
  4. Add a dated, curated `employer-ai-policies.json` (company → state, source URL, `verified_at`), seeded with Anthropic = `draft_first` and Bain London = `proofread_only`. Check it before the regex.
  5. Delete the Anthropic "don't use AI" claim from 00 §5 and 05 F3.

### 2. The wrong-employer check depends on web research and never looks at the student's other applications
- **Severity:** P0 · **Type:** implementation
- **Where:** `verify.ts:624-626`, `service.ts:328,369-372` (`otherEmployers` = research `rivals` minus CV orgs), `research.ts:22` (`NONE` returns `rivals: []`); rule CL-21. Doc: `01-recruiter-evidence.md:84` (CL-EV-01 says "no other employer name from the user's job list").
- **Current:** `otherEmployers` is at most 3 rivals that an LLM named during research. With no Gemini key and no Serper key (the local-first Ollama default), research returns `provider: "none"` and an empty list. Then:
  - CL-21 has nothing to match, so the "wrong company" check is off.
  - The swap-test judge receives `<rivals>(none)</rivals>`.
- **Evidence:** The playbook itself calls naming the wrong company "fatal" (00 §1.7). eFC records a JPMorgan letter that referred to Morgan Stanley (cited in 03). The real-world cause is copy-paste from the student's previous letter, so the names that matter are the **other companies in the student's own tracker**, not market rivals. (Internal evidence; 03 cites eFC, B.)
- **Fix:**
  1. Build `otherEmployers` from three sources: (a) every `jobs.company` in this user's tracker except the current job; (b) the company of every other `cover_letters` output; (c) research rivals when available.
  2. Exempt CV orgs and the current company, as now.
  3. Add a static list of about 60 UK graduate employers (BB banks, Big 4, MBB, tier-2 consulting, big tech).
  4. Match on word boundaries **and** require a capital initial, so that "Next", "Wise", "Three" and "Arm" don't fire on ordinary words.
  5. Keep the swap-test judge's fallback rivals from that static list grouped by sector, so `<rivals>` is never empty.

### 3. Invented motivations, lessons and feelings get past every check
- **Severity:** P1 · **Type:** implementation / unsupported
- **Where:** `verify.ts:215-233` (`freeTextReason`, `meReason`), the judge prompt at `verify.ts:645-647` ("the student's own experience is checked elsewhere"); rule CL-12 (`rules.json:155`, severity `block`, check `llm`).
- **Current:** "Me" sentences are checked by lexical machinery: numbers, capitalised names, tools, authorship verbs (`meBlock` → `verifyTailoring`). The judge only rules on what a sentence says about the firm.
- **What passes:**
  - "Since childhood I have been fascinated by capital markets."
  - "Running the fund taught me that risk sizing matters more than the idea."
  - "This experience confirmed my wish to work in restructuring."

  These sentences have no new numbers or proper nouns, so they pass. Yet invented motivation is the most interview-probeable fabrication.
- **Evidence:**
  - Anthropic's guidance warns that AI-written answers produce "Generic content with experiences you haven't actually had" (A, URL above).
  - Liverpool Careers' test is whether you "could comfortably explain, expand on and defend every sentence in your application at interview" (B, https://www.liverpool.ac.uk/careers/students/using-ai-in-job-applications-and-recruitment/, University of Liverpool, undated).
  - The Tilburg field experiments found recruiters weight the motivation content most, and LLMs improve it least (A, Abbas Nejad, Musillo, Wicker & Zaccaria, *Journal of Labor Economics*, 2026, https://research.tilburguniversity.edu/en/publications/labor-market-signals-the-role-of-large-language-models-2/).
- **Fix:**
  1. Add a deterministic `INFERRED_INNER_STATE` detector for AI-scope sentences:
     `\b(taught me|I (learned|learnt|realised|realized|discovered)|(fascinat|inspir|drew|drawn|motivat|excit)\w* (me|by)|since (I was|childhood|a young age)|ever since|confirmed my|sparked my|my (passion|wish|desire|ambition) (for|to))\b`
  2. Any match in an `ai` span with no `⟦you:…⟧` ref gets flag `"AI-inferred motivation: say it in your own words"`. Put this flag in `NOT_CONFIRMABLE`, so the student has to type it.
  3. Extend the judge prompt: for kind "me", return `verdict:"unsupported"` when the sentence states a reason, feeling, realisation or lesson that no `<answer>` block states.

### 4. "This is true" bypasses the swap test and launders AI sentences into the CV evidence base
- **Severity:** P1 · **Type:** implementation / fairness
- **Where:** `service.ts:408-435` (`FIRM_FLAGS`, `NOT_CONFIRMABLE`, `confirmTrue`).
- **Current:**
  - `NOT_CONFIRMABLE` contains only greeting, sign-off and "no source". So "would work for any firm" (a failed swap test) and `NO_VERDICT` can both be cleared with one tap.
  - Any confirmed "me" sentence is inserted verbatim (up to 500 characters, AI phrasing included) into `confirmed_facts`, which grounds future letters **and CV tailoring**.
  - On Ollama or with no judge, every firm sentence fails closed as `NO_VERDICT`. The only quick route to Ready is then to tap "This is true" repeatedly.
- **Evidence:**
  - The spec lists as an anti-goal "A letter that passes the swap test" (`docs/superpowers/specs/2026-10-17-cover-letter-writer-design.md` §2).
  - Disclosure research shows the cost of AI help comes when it is concealed and later uncovered. Once a hollow claim has been laundered into the CV base, it can be exposed at interview (A, Schilke & Reimann, *OBHDP* 2025, 13 experiments, https://news.arizona.edu/news/disclosing-ai-use-can-backfire-research-shows).
- **Fix:**
  1. Add "would work for any firm" to `NOT_CONFIRMABLE`. Genericness isn't a truth question, so editing is the only remedy.
  2. For "me" confirmations, store a **claim extract**, not the sentence: run a structured call ("restate as one plain factual clause with no adjectives"), show it, and ask for a second confirm.
  3. Tag rows `source: "cover_letter_confirm"` so tailoring can down-weight them.
  4. Rate-limit to 3 confirmations per letter before showing "Consider rewriting these in your own words".

### 5. The hard-block lexicon misfires on ordinary student prose (tested)
- **Severity:** P1 · **Type:** implementation
- **Where:** `rules.json:785-845` (hard), `:919-923` (soft), applied by `rules.ts:87-99`. A `block` in AI scope stops the Ready gate (`gate.ts:21`).
- **Current and tested hits** (node run of `rules.json` against sample sentences):

  | Sentence | Lexicon hit | Severity / effect |
  |---|---|---|
  | "Overall, the project cut processing time by 40%." | `Formulaic transition` | block |
  | "Ultimately, the client chose the second option." | `Formulaic transition` | block |
  | "It's not easy, but it's worth it." | `Negative parallelism` | block |
  | "I worked at Yahoo! as an intern." | `Exclamation mark` | block |
  | "…benchmarking executive compensation for FTSE 250 clients" (a reward-consulting placement) | `Money as motivation` | high, so auto-rewritten |
  | "I built a bonus-pool allocation model" | `Money as motivation` | high |
  | "I tested three pricing models before deciding on a binomial tree" | `Consulting stepping-stone` | high (any sector) |
  | "I wrote a Python program…" | US-spelling soft pattern | soft hit labelled "Soft AI-ism" |
  | "…the Software Engineer Program at JPMorgan Chase" | US-spelling soft pattern | soft hit labelled "Soft AI-ism" |

- **Evidence:**
  - "Program" is standard British English for software; Oxford "-ize" spelling is accepted British usage. *Unverified in a dictionary this session; standard OED/Collins usage, grade C.*
  - CL-70 and CL-71 are sourced only to consulting and banking motivation advice (03 §2: IGotAnOffer, TARGETjobs McKinsey).
  - Wikipedia's AI-cleanup guide warns "Not all text featuring these indicators is AI-generated" (C, https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing, 2026).
- **Fix:**
  - `Formulaic transition`: ban only `In conclusion|In summary|To sum up`, and downgrade `Ultimately,|Overall,` to soft.
  - `Negative parallelism`: require the second clause to be a reframe. `\bit'?s not (just |merely |only )?(about )?\w+[^.]{0,40}[,;—–-] it'?s (about )?\w+` and *not* followed by "worth", "easy" or "hard".
  - `Exclamation mark`: `(?<![A-Za-z0-9])!|!(?=\s|$)(?<!Yahoo!)`, or simpler: exempt tokens found in the CV or the company name.
  - `Money as motivation`: only when near intent words: `\b(attract|appeal|motivat|reason|why)\w*\b[^.]{0,60}\b(salary|bonus|compensation|pay|perks|benefits)\b`, severity `med`.
  - `Consulting stepping-stone`: scope to `sector ∈ {consulting}`, and drop "before deciding".
  - US spelling: remove `program(?!me)` and `organiz|optimiz|analyz`. Relabel as `CL-60 "US spelling"`, not "Soft AI-ism", and use an en-GB dictionary with an allowlist (CV rules already describe Hunspell en_GB at `docs/research/cv-rules-general.md:214`). The same `program` problem exists in `lib/cv-rules/rules/general.ts:207-210`, so fix both.

### 6. The AI-tell lexicon is a 2023–24 snapshot, and half of it is pre-AI cliché presented as "AI tells"
- **Severity:** P1 · **Type:** stale / unsupported
- **Where:** `rules.json` lexicon; `05-ai-voice-authenticity.md` §2; `00-playbook.md:20,126-127`.
- **Current:** "delve", "tapestry", "testament", "underscore", "realm", "beacon" and similar are hard blocks. "passionate", "team player", "fast-paced environment" and similar are grouped in the playbook as "known AI and cover-letter tells".
- **Evidence:**
  - Model tics change by era. Wikipedia's AI-cleanup page now lists era-specific vocabularies:
    - 2023–mid-2024 (GPT-4) = delve, tapestry, testament, intricate.
    - Mid-2025 to mid-2026 = "emphasizing", "enhance", "highlighting", "showcasing".
    - Mid-2026 on = "challenge", "clearer", "dependable", "echoed", "foster", "leverage", "matters", "multifaceted", "practical", "prioritize", "quietly", "steady".
  - The same page moves em-dash overuse into "Historical indicators (2022–September 2026)". It states "the word delve was famously overused by ChatGPT in 2023 and early 2024" (C, https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing, fetched 2026-10-18).
  - Peer-reviewed support exists only for the scientific-abstract vocabulary: Kobak et al., *Science Advances* 2025, https://arxiv.org/abs/2406.07016 (A); Juzek & Ward, COLING 2025, https://aclanthology.org/2025.coling-main.426 (A).
  - No study found shows "passionate", "team player" or "fast-paced" are LLM markers. They are pre-LLM careers-service clichés: TARGETjobs's "prestigious and vibrant company" example (03); LSE's emotive-word ban (02 §2.8).
  - The playbook's own 01 says Freelancer AI letters lost signal through *content* sameness, not vocabulary.
- **Fix:**
  1. Split the lexicon into two arrays with different copy:
     - `cliche` (careers-service evidence, B): team player, fast-paced, dynamic team, prestigious firm, passionate about. Label it "Generic phrase recruiters flag".
     - `model_tic` (corpus evidence; A for 2023–24 words, C for later eras): each entry gets `era` and `addedAt`.
  2. Add the mid-2025/2026 tics as **soft** (not hard): `\bquietly\b`, `\bsteady\b`, `\b(it|this) matters\b`, `\bpractical\b` (density only), `\bhighlighting\b`, `\benhanc(e|es|ed|ing)\b`, `\bemphasi[sz]ing\b`.
  3. Demote "realm", "beacon", "symphony" and "indelible" to soft. They are rare in student letters, and a block costs a rewrite round.
  4. Set a 6-monthly review date in `_meta`.
  5. Never call a cliché "AI" in UI copy. Fairness matters here: international students are already suspected of AI use more often (05 F5).

### 7. The company and role checks (CL-20) force string-matching and keyword stuffing
- **Severity:** P1 · **Type:** implementation
- **Where:** `rules.ts:212-218` (`roleNamed`, 60% token match), `rules.ts:282-298` (`openingNameHits`, severity `block`, letter scope). For `field_answer`, only the **first sentence** counts.
- **Current:** The company must appear as the exact normalised string from the job record. Failures:
  - "J.P. Morgan" or "JPMorgan" in a letter where the job says "JPMorgan Chase & Co." → block.
  - "Goldman" where the job says "Goldman Sachs" → block.

  The role must match ≥ 60% of its tokens longer than 2 characters. Scraped titles like "2027 Summer Analyst Programme – Global Banking & Markets – London" need 5 of their 8 tokens in the opening sentence of a 150-word "Why this division?" box.
- **Evidence:** QMUL says a form's "Why this organisation?" answer is about motivation and fit, not furniture (B, https://www.qmul.ac.uk/sef/news/2026/items/getting-your-application-right-what-uk-employers-expect.html, QMUL, 8 Sep 2026). The field label already names the firm, so restating the full role title in a box is unnecessary padding. The playbook's own CL-64 says "never keyword-stuff".
- **Fix:**
  1. Company aliases: `companies.aliases` (seed: "J.P. Morgan", "JPMorgan", "JPM", "GS", "Goldman", "MS", "BofA", "Bank of America", "PwC", "EY", "Ernst & Young", "KPMG", "Deloitte", "BCG", "McKinsey"). Match any alias. Also strip legal suffixes (`plc|ltd|llc|inc|& co\.?|group|holdings|the`) before comparing.
  2. Role: for `full_letter`, require the role's **head noun phrase**, i.e. the shortest of {programme name, division, title} (for example "Summer Analyst" plus one of {division, office}). For `field_answer`, require only the company (or nothing when the label already names it), and downgrade to `med`.

### 8. The draft prompt injects the CV-tailoring playbook, not the cover-letter sector notes
- **Severity:** P1 · **Type:** contradiction / implementation
- **Where:** `lib/cover-letter/draft.ts:128,142` → `lib/tailor/playbooks.ts:29-43`. Doc: `00-playbook.md:78-90` (§5 sector notes), rules CL-70 to CL-78.
- **Current:** The letter prompt receives "ROLE PLAYBOOK … how screeners read student CVs … Lead each entry with … Profile/summary: … Verbs that read well". None of the letter sector rules reach the model:
  - IB: why firm / why division / office;
  - S&T: desk family;
  - Big 4: qualification realism;
  - MBB: office plus no "stepping stone";
  - AM: buy-side reason;
  - actuarial: IFoA.

  CL-72 to CL-77 have no code at all.
- **Evidence:** The cover-letter research (03 §2) is sector-specific and medium to strong for IB and MBB structure (M&I, RocketBlocks, TARGETjobs; B). The CV playbook was researched for a different reader task.
- **Fix:**
  1. Create `lib/cover-letter/sector-notes.json`, with each archetype → 4–6 bullets copied from 00 §5 plus CL-70 to CL-78.
  2. Render it as `SECTOR NOTES (shape only, never a source of facts)`. Drop `playbookPrompt` from the letter prompt, or keep only its `pitfalls`.
  3. Add CL-72 to CL-77 to the judge as optional `coverage` booleans, and show unmet ones as amber.

### 9. About 20 rules in `rules.json` have no implementation, but the spec says "the playbook lint passes"
- **Severity:** P1 · **Type:** implementation / copy
- **Where:** `lib/cover-letter/rules.json` `rules[]`, compared with `rules.ts`, `verify.ts` and `mode.ts`. Grep found no reference to CL-05, 22, 24, 25, 26, 27, 28, 30, 31, 32, 56, 57, 58, 60, 61, 64, 72, 73. Counters `jdCopyNgram`, `cvParaphraseRatioMax` and `crossLetterOverlapMax` (`rules.json:942-944`) are never read.
- **Current:** The spec (§6.1 step 6c) promises a judge for "the swap test and requirement coverage". The judge does no requirement coverage (CL-22). Nothing checks:
  - JD copying (CL-27);
  - CV recap (CL-32);
  - reuse across letters (CL-57);
  - en-GB spelling (CL-60, only the mis-scoped soft regex).
- **Evidence:** The "CV recap" letter is the second-most-cited failure (MIT, Oxford and Ask a Manager, in 01 and 02; B).
- **Fix:**
  1. Implement the cheap deterministic ones now:
     - CL-27: 8-gram overlap with `jdLines`, excluding the role title.
     - CL-32: share of sentences with Jaccard ≥ 0.6 against any CV bullet (threshold 60%).
     - CL-57: sentence-level overlap with the user's other `cover_letter_outputs` (threshold 40%).
     - CL-60: Hunspell en_GB.
  2. Add `coverage: {requirementId, met}` to the judge schema for CL-22.
  3. Until then, mark unimplemented rules `"implemented": false` in JSON, and keep UI copy from saying "passes the playbook".

### 10. Mode selection: short formats never chosen, character limits ignored, video formats missing
- **Severity:** P1 · **Type:** implementation / missing
- **Where:** `mode.ts:32-41`, `service.ts:215-223` (passes only `f?.wordLimit`), `lib/autopilot/forms/limits.ts:1-3` (parses words only), `lib/autopilot/forms/types.ts:4` (`FormField` has no `charLimit`). Rules CL-01, CL-05.
- **Current:**
  - An upload always becomes `full_letter` (250–400 words). `short_letter` and `short_note` are reachable only through the manual switch.
  - A box labelled "max 1,000 characters" gets the 300-word default, roughly 1,800 characters, so it overflows.
  - CL-05 (an optional upload needs a hook, otherwise suggest skip) has no code.
- **Evidence:**
  - Goldman uses "a specially formatted cover letter that's more of a personal statement" (B, eFinancialCareers, 15 Aug 2025, https://www.efinancialcareers.com/news/goldman-2026-internships).
  - Morgan Stanley's 2025 EMEA "Foundations in Finance" flyer lists a **video** cover letter as a step (C, search-indexed PDF; the text could not be extracted this session: https://traded.enfield.gov.uk/public-assets/attach/8676/2025-Step-In-Step-Up-Foundations-in-Finance-ext.pdf).
  - JPM candidates report "3 competency questions to answer rather than a cover letter" and HireVue "why JPM" questions (C, Glassdoor, https://www.glassdoor.com.hk/Interview/J-P-Morgan-Interview-E145-RVW3513538.htm).
- **Fix:**
  1. Add `charLimitOf(label)`: `/(\d{2,5})\s*(characters?|chars?)\b/i` and `/max(?:imum)?\.?\s*(\d{2,5})\s*char/i`. Add `FormField.charLimit`, and pass it in `modeFor`.
  2. Upload → `short_letter` when sector ∈ {banking_ibd, sales_trading} and the company is in a curated `shortLetterFirms` list (start with Goldman Sachs). Startup or seed-stage archetype → `short_note`.
  3. Add a `video_script` mode: 150–220 spoken words (60–90 s), no furniture, first-sentence answer, read-aloud lint (no parentheses or abbreviations).
  4. Implement CL-05: an optional upload with no `why_firm` answer and no touchpoint → the first message offers skip.

### 11. Motivation-field detection misses the commonest prompts, which then go to a second writer with different rules
- **Severity:** P1 · **Type:** implementation / contradiction
- **Where:** `mode.ts:4,9-11` (`MOTIVATION`); `lib/autopilot/drafts.ts:16` (`DEFAULT_LIMIT = 200`) and `:121-127` (its own prompt with an inline ban list).
- **Current:** I tested the regex. It returns **false** for:
  - "Why are you applying to Goldman Sachs?"
  - "What attracts you to this programme?"
  - "Why have you chosen this business area?"
  - "Tell us why you want to join Barclays"
  - "Why Anthropic?"
  - "What interests you about this role?"
  - "Please explain your interest in this position (250 words)"
  - "Why J.P. Morgan?"
  - "Why our firm?"

  Unmatched fields stay with `drafts.ts`, which defaults to 200 words (the letter writer defaults to 300), has no ground-check judge and no locked spans, and puts banned words in the prompt. The playbook advises against that (00 §6.5).
- **Evidence:** These are the standard UK motivation prompts. Barclays's "Why Barclays?" and "Why this programme?" (C, Finbound, https://www.finbound.org/blog/barclays-summer-internship-application-guide); JPM's "why J.P. Morgan, why the specific division" (C, Glassdoor above).
- **Fix:** Replace the regex with:
  ```
  /\bwhy\b[^?]{0,60}\b(apply|applying|join|joining|work|chose|chosen|choose|us|our|this|these|[A-Z][\w.&]+)\b|\bwhat (attracts|interests|excites|draws|motivates) you\b|\b(interest|interested|motivation|motivated) (in|for|to)\b|cover(ing)? letter|personal statement/i
  ```
  Also add a `/^why [A-Z]/` rule for "Why {Firm}?". Route every motivation field to the cover-letter writer, and make 300 the single shared default for an unknown limit (or ask).

### 12. Target employers' forms aren't reachable: Autopilot reads Greenhouse, Ashby and Lever only
- **Severity:** P1 · **Type:** missing
- **Where:** `lib/autopilot/forms/types.ts:1` (`Ats = "greenhouse" | "ashby" | "lever"`); spec §5 "From the Autopilot form".
- **Current:** `field_answer` is mainly reached through Autopilot forms. Those ATSs mostly serve startups and US tech.
- **Evidence:**
  - JPMorgan's student roles run on Oracle Cloud HCM (C, CityU HK careers PDF listing `jpmc.fa.oraclecloud.com` postings, 2024, https://www.cb.cityu.edu.hk/careerdevelopment/docs/2024%20APAC%20GPB%20Info%20Sess.pdf; C, resumegeni).
  - Morgan Stanley early careers run on Oleeo (`morganstanley.tal.net`) (C, https://www.resumeadapter.com/companies/morgan-stanley/interview-process, vendor, "partly verified").

  I could not verify Workday use by Barclays, Citi or HSBC this session.
- **Fix:**
  1. Until there is form support for Oracle, Workday and Oleeo, make the manual "Add a 'why us' answer" the primary path for finance and Big 4 jobs.
  2. Prefill the label from a curated `firmPrompts.json` (firm → typical prompts + limits + `verified_at`).
  3. Let the student paste the exact question and limit from the portal.

### 13. Strategic finding: the product should become a "motivation bank", not a cover-letter writer
- **Severity:** P1 · **Type:** missing (strategy)
- **Where:** Spec §2 non-goals; `00-playbook.md` §2.
- **Evidence for the pivot:**

  | Employer / type | What it asks for | Source |
  |---|---|---|
  | PwC UK | No CV and no covering letter; a data form; motivation tested at video and assessment centre | B, TARGETjobs, Apr 2025, https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/pwc-graduate-application-process-explained |
  | KPMG UK | "you won't need to submit a CV"; online case tasks; strengths interview, with no written motivation box | B, TARGETjobs, 1 Aug 2024, https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/kpmg-graduate-schemes-how-apply |
  | Bain London | No cover letter for Associate Consultant | A, Bain |
  | JPM | Competency or motivation questions plus HireVue "why JPM / why division", reported in place of a letter | C |
  | Goldman | A personal-statement-style letter | B |
  | Morgan Stanley | A video cover letter (2025) | C |

  - QMUL (Sept 2026) treats the cover letter and the form question "Why this organisation?" as the same task (B).
  - ISE 2025: 49% of employers accept AI for "drafting CVs and cover letters or answering online application questions", and 79% are redesigning processes (A).
  - EDF closed its scheme after 12,000 applications and uses skills assessments and video to limit AI misuse (B/C, reported via whali.co.uk and others; primary not opened).

  The durable unit is therefore the student's **per-firm motivation evidence** (why firm, why division, why me, touchpoints), reused across formats. Prose letters are a shrinking share.
- **Fix:**
  1. Promote the existing per-job interview (`cover_letters.answers` + evidence pack) to a first-class **Motivation Bank** per company, with three slots: `why_firm`, `why_division`, `why_me`.
  2. Render from it:
     - `full_letter`
     - `short_letter`
     - `field_answer`
     - `video_script` (Finding 10)
     - Interview Prep "why us" cards (the existing PR #21 feature)
  3. Surface the bank on every job card, with the copy "Big 4 and many banks ask this on video, not in a letter".
  4. For PwC, KPMG, EY and Deloitte, default the mode to `video_script` + interview notes.

### 14. The per-firm "who asks for a letter" table carries stale "official" labels
- **Severity:** P2 · **Type:** stale
- **Where:** `03-finance-consulting.md:28-31` (BCG London "**High (official)**", McKinsey "optional but recommended"), `00-playbook.md:31`.
- **Current:** BCG London: "CV, cover letter and transcripts", cited to `careers.bcg.com/on-campus/cardiff-university`.
- **Evidence:**
  - That page no longer lists any application documents: it "doesn't mention a CV, cover letter, or transcripts" (fetched 2026-10-18).
  - McKinsey's position now comes only from third-party guides that say "role dependent… often optional" (C, https://www.myconsultingcoach.com/mckinsey-recruiting and others).
  - Bain London's "no cover letter" is still current (A).
- **Fix:** Add `verified_at` and a `status ∈ {official_current, official_unverified, third_party}` to each row. Downgrade BCG and McKinsey to `official_unverified` / `third_party`. Show "Check the posting: last verified {date}" in the mode message. Re-verify every September.

### 15. Survey statistics are stale or mis-weighted (ISE, Bright Network, the CIPD gap)
- **Severity:** P2 · **Type:** stale
- **Where:** `01-recruiter-evidence.md:58`, `05-ai-voice-authenticity.md` F3.
- **Current:** "43% of ISE employers are fine with AI at some stages"; "Bright Network: 38% … rising to 58%".
- **Evidence:**
  - ISE 2025: **49%** "have no problem with candidates using AI, mostly for drafting CVs and cover letters"; 10% banned; 45% give no guidance; 79% redesigning (A, URL in Finding 1).
  - Prospects Early Careers Survey via ISE, 4 Jun 2026, n = 5,000: **73%** used AI somewhere in applying; **46%** used it to write a CV or cover letter; 66% of those making 101–200 applications used AI (A, https://ise.org.uk/knowledge/insights/569/students_use_ai_to_compete_yet_oppose_ai_assessment).
  - Bright Network's figures are from 2024 (B, https://workplacejournal.co.uk/2024/04/bright-network-survey-reveals-students-use-of-generative-ai-in-job-applications/).
  - **CIPD:** I found no CIPD survey on AI-written applications or cover letters, so the brief's premise is unsupported. Do not cite CIPD.
  - **Resume Builder / Resume.org:** I could not locate primary reports on AI-written cover letters, only secondary blogs. TopResume (2025, ~600 US managers) found 19.6% would reject over an AI-generated CV or letter (vendor, https://topresume.com/career-advice/ai-in-hiring-survey).
- **Fix:** Replace with the ISE 2025 and Prospects 2026 figures. Add a source-policy line: vendor surveys (Resume Genius, CV Genius, Zety, TopResume, Resume Builder) may appear only in research docs, never in UI copy.

### 16. Upgrade the Tilburg AI-letter study: it's now a published JLE paper
- **Severity:** P2 · **Type:** stale
- **Where:** `01-recruiter-evidence.md:54,130` ("STRONG-ish … press summary, results not published").
- **Evidence:**
  - Abbas Nejad, Musillo, Wicker & Zaccaria, *Journal of Labor Economics*, accepted Feb 2026: LLM gains "do not boost interview invitations" because they sit in "standardized, less influential sections".
  - "When recruiters learn of LLM usage, they place greater value on high-quality, human-crafted letters" (A, Tilburg research portal).
- **Fix:** Cite it as STRONG and add the second finding to 00 §1.5. It directly supports locked spans and the student-first interview. Remove "watch for results" from open question 7.

### 17. The Wiles/Horton RCT is about CVs on a gig platform, but is presented as evidence for letters
- **Severity:** P2 · **Type:** unsupported (overreach)
- **Where:** `00-playbook.md:15`, `01:56`, `05` F1.
- **Evidence:** The study is *nongenerative* algorithmic writing help on **résumés** in an online labour market. Treated jobseekers were "hired 8% more often at 10% higher wages". The authors disclose funding from the platform (A, Management Science 71(12), 2025, https://pubsonline.informs.org/doi/fpi/10.1287/mnsc.2024.04528; NBER w30886).
- **Fix:** Reword to: "On résumés in an online labour market, error and readability fixes raised hires 8%; we assume the same mechanism holds for letters (untested)." Keep the design conclusion, but mark it as an analogy.

### 18. "Dear Sir/Madam" is penalised although the main UK sources still list it
- **Severity:** P2 · **Type:** wrong
- **Where:** `rules.json:835` (`Salutation` → CL-42, severity `high`, which triggers auto-repair), `draft.ts:79`, `00-playbook.md:49,156`.
- **Current:** "Never 'To whom it may concern' or 'Dear Sir/Madam'".
- **Evidence:**
  - Prospects (May 2025) lists "Dear Sir/Madam" and "Dear Hiring manager" as acceptable fallbacks once named contacts are exhausted, and pairs a general greeting with "Yours faithfully" (B, https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/cover-letters).
  - TARGETjobs: "Dear Sir/Madam" → "Yours faithfully" (B, Jan 2023, https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/covering-letter-essentials-graduate-vacancies).
  - The one dissent is eFC's mistakes list (03).
- **Fix:** Split the pattern:
  - "To whom it may concern" stays `med`.
  - "Dear Sir/Madam" becomes `low` with the copy "Fine in the UK, but a name or team reads warmer."

  Keep the default fallback order: team → "Dear Hiring Manager".

### 19. Salutation logic forces gendered titles and misses full-name greetings
- **Severity:** P2 · **Type:** fairness / implementation
- **Where:** `rules.ts:267-276` (named = only `Dear (Mr|Mrs|Ms|Mx|Dr|Prof)`), `draft.ts:79` ("A named person: 'Dear Ms Patel'").
- **Current:**
  - "Dear Priya Patel … Yours faithfully" isn't flagged, because it isn't seen as named.
  - The model is told to choose Ms or Mr, which means guessing gender from a name.
- **Evidence:** TARGETjobs warns that people "may feel quite strongly about how they are addressed" (B, above). No UK careers source found requires a title.
- **Fix:**
  1. Treat `^dear\s+[A-Z][a-z]+(\s+[A-Z][\w'-]+)+$` (two capitalised words, not stock words) as named.
  2. Prompt: "Use the person's title only if the source gives it; otherwise 'Dear Firstname Lastname'".
  3. Accept `Mx`. *Recommendation; no direct source.*

### 20. The "fewer sentences starting with I" and "more formal" pressures push text toward the LLM style
- **Severity:** P2 · **Type:** contradiction
- **Where:** `rules.json:941` (`iStartRatioMax 0.35`), `rules.ts:339-346`, the edit chip `more_formal` (`edit.ts:144`); CL-56 voice stats are unimplemented.
- **Evidence:**
  - LLM rewriting "consistently" reduced first-person pronouns and contractions, and voice-preserving prompts reduced but "did not reverse" this (A−, van Nuenen, arXiv 2604.22142, Apr 2026, https://arxiv.org/abs/2604.22142).
  - Readers treat first-person pronouns and contractions as human cues (A, Jakesch, Hancock & Naaman, *PNAS* 2023, as cited in 05; not reopened).
  - AI *editing*, unlike generation, has no consistent stylometric footprint (A, Shan, Lee & Hao, EMNLP 2026, https://arxiv.org/abs/2608.27855).
- **Fix:**
  1. Raise `iStartRatioMax` to 0.5 and keep it `low`.
  2. Implement CL-56: compute the student's contraction rate and first-person rate from their `⟦you⟧` answers, and pass them as targets in the prompt.
  3. Make `more_formal` keep contractions where the student used them in answers.

### 21. Field answers must fill 85–100% of the limit at high severity, which forces padding
- **Severity:** P2 · **Type:** unsupported
- **Where:** `rules.json:34` (`fillRatio [0.85,1]`), `rules.ts:237` (CL-03 `high`, so `repairTargets` auto-rewrites); CL-02.
- **Evidence:** No source given in 00–06 for 85%. The recruiter evidence (01 §G) favours short. Prospects says "concise paragraphs" (B). The playbook's own §1.9 says "Shorter than an LLM wants to write".
- **Fix:** `fillRatio: [0.6, 1]` and severity `low` ("You have room for one more specific example"). Never auto-repair under-length.

### 22. Length bands contradict each other, and the PDF can overflow one page
- **Severity:** P2 · **Type:** contradiction / implementation
- **Where:** `01:86` (CL-EV-03: 200–350 soft, hard 400), `00:31` and `rules.json:12` (250–400, hard 450), `drafts.ts:16` (200); `pdf.tsx:9-16` (11pt, line height 1.4, 54/60pt margins, no page-count check).
- **Evidence:**
  - Prospects: "three to five concise paragraphs… should not exceed one A4 page" (B).
  - 02 §2.7 admits 250–400 is "convention, not evidence".
  - My arithmetic: about 33 usable body lines × about 14 words per line ≈ 460 words. A 450-word body plus paragraph breaks and a header will likely spill onto page two. *Estimate; not rendered.*
- **Fix:**
  - Single source of truth: `full_letter.words = [220, 380]`, `hardMax = 420`.
  - After `renderToBuffer`, check the page count (`@react-pdf` exposes it via the `onRender` callback or a re-parse). If it's over 1 page, drop the line height to 1.3, then refuse Ready with "Cut about N words".

### 23. Undated research facts bypass the 12-month freshness filter
- **Severity:** P2 · **Type:** implementation
- **Where:** `research.ts:55-62` (`f.date === null ||` passes), `00-playbook.md:73`.
- **Evidence:** The playbook requires flagging anything older than 12 months. Ex-GS Afzal Hussein, via eFC, warns against reciting website facts (03, B).
- **Fix:** Undated facts are kept but labelled "undated" in the picker and cannot be picked for a `them` sentence unless the student taps "I've checked this". Also drop facts whose claim is headcount, office count, founding year or AUM unless the student links them to themselves (CL-28, unimplemented).

### 24. The triplet counter measures the wrong thing
- **Severity:** P2 · **Type:** implementation
- **Where:** `rules.json:933` (`\b\w+, \w+,? and \w+\b`).
- **Current:** It matches single-word lists only ("Python, SQL and Excel": tested, counts 1, and a second list makes a `med` hit). It misses phrase-level tricolons ("leading teams, building models and presenting to clients"), which are the actual LLM pattern.
- **Evidence:** LLMs use tricolon at "nearly twice the expert rate" (B, single-author preprint, Bakhshi, arXiv 2604.19768, Mar 2026, https://arxiv.org/abs/2604.19768). Wikipedia lists the rule of three as a current, not historical, sign (C).
- **Fix:** Match `(?:[^,.;]{3,40}, ){2}(?:and |or )[^,.;]{3,40}` within one sentence. Exclude spans where all three items are capitalised tokens or in the CV skills list. Keep max 1, severity `low`.

### 25. The em-dash counter ignores the en-GB dash, and the signal is now "historical"
- **Severity:** P3 · **Type:** implementation / stale
- **Where:** `rules.ts:103` (counts `—` only), `rules.json` (`emDashFail 3` → **block**).
- **Evidence:**
  - British house style uses a spaced en dash " – ". A model told "en-GB" often emits it, so the counter is easy to slip past. *Style claim, C.*
  - Wikipedia classes em-dash overuse under "Historical indicators (2022–September 2026)" (C).
- **Fix:** Count `—`, ` – ` and `--` together. Lower `emDashFail` to `high`, not `block`.

### 26. "Optional upload: send or skip" is resolved differently in two docs
- **Severity:** P2 · **Type:** contradiction
- **Where:** `01:76,98` (CL-EV-15 "Optional means send… generate one by default") vs `00:30,159` and CL-05 ("with no hook… suggest skip").
- **Evidence:** ResumeGo's field experiment: generic letter ≈ +17% vs none, tailored ≈ +53% (vendor-run audit, MODERATE, 01). Oxford: submit one whenever you're given the chance (B, cited in 01).
- **Fix:** Use one rule, CL-05: "Optional upload → draft by default. If there is no `why_firm` answer and no touchpoint, say 'A specific reason roughly triples the value of this letter' and ask once." Remove "suggest skip".

### 27. A "strong" worked example uses the banned negative-parallelism pattern
- **Severity:** P3 · **Type:** contradiction
- **Where:** `02-structure-craft.md` §3 Example A, strong version: "the hardest part of a trade is not the idea but sizing it".
- **Evidence:** 05 §2 D lists `not … but` negative parallelism as a tell. The spec's unit test only asserts lexicon hits per paragraph, so this example "passes" by accident.
- **Fix:** Rewrite to "taught me that sizing a trade is harder than finding the idea". Add a letter-level test that runs `lintLetter` on the full strong example.

### 28. Playbook text has drifted from what shipped
- **Severity:** P3 · **Type:** contradiction
- **Where:** `00-playbook.md:73` ("v1 doesn't browse") vs `research.ts` (Gemini grounding / Serper); `00:112-115` (visa/disability opt-in) vs `draft.ts:65` (always banned); `00:100` (voice stats) vs no implementation.
- **Fix:** Add a "Shipped v1 behaviour" box to 00 that lists: web research on (cached for 7 days), visa/disability/grades never mentioned, voice stats not yet implemented. The Graduate visa change is correct (from 1 Jan 2027, 18 months; B, THE, https://www.timeshighereducation.com/node/739481; Bath, https://www.bath.ac.uk/announcements/upcoming-changes-affecting-the-student-visa-and-graduate-visa/). It is unused because v1 bans visa mentions.

### 29. No guidance for students whose first language isn't English (the "AI flattening" risk)
- **Severity:** P2 · **Type:** missing / fairness
- **Where:** Absent from 00 §7; `edit.ts` has no "keep my phrasing" option.
- **Evidence:**
  - Edinburgh Careers: "don't use AI to present a higher level of [English] ability than you have" (B, 29 Jul 2025, https://careers.ed.ac.uk/cvs-and-applications/guidelines-on-the-use-of-generative-ai-in-the-application-process).
  - AI suggestions homogenise non-Western writing styles (A, Agarwal, Naaman & Vashistha, CHI 2025, cited in 05; not reopened).
  - Readers suspect international students of AI use more (05 F5).
- **Fix:** Add a "Minimal edit" toggle. Locked answers get grammar fixes only; AI sentences are capped at 40% of the body; no `more_formal` chip. Add copy: "Your interview English should match your letter".

### 30. The vendor-survey caveat is good, but UI copy and the spec still lean on vendor framing
- **Severity:** P3 · **Type:** copy
- **Where:** Spec §1 uses the "+17% / +53%" ResumeGo figures as headline justification.
- **Evidence:** 01 itself notes there are no significance tests and that per-group rates come from secondary reproductions (01 §4.5).
- **Fix:** In any user-facing copy, use only Tilburg (JLE 2026) and Cui/Dias/Ye (arXiv 2509.25054) phrasing: "AI polish alone doesn't get interviews; specific, true content does."

## New rules / signals to add

| ID | Text | Severity | Pass / fail anchors | Sources |
|---|---|---|---|---|
| CL-80 `ai_policy_state` | Detect employer AI policy as forbidden / draft_first / proofread_only / silent, from a curated table, then the regex (Finding 1). | block (forbidden), high (others) | **Pass:** Anthropic → draft_first; Bain London → proofread_only. **Fail:** "Use of AI tools is not permitted" read as silent. | Anthropic; Bain; ISE 2025 |
| CL-81 `inferred_inner_state` | AI-written sentences may not state a reason, feeling, realisation or lesson that no student answer states. | block (not confirmable) | **Pass:** ⟦you:a1⟧ "I chose rates after the UCL fund's gilt trade". **Fail:** AI "This experience taught me resilience". | Anthropic; Liverpool; JLE 2026 |
| CL-82 `tracker_employer_leak` | No company from the user's other tracked jobs or letters appears, except CV orgs. | block | **Fail:** a Citi letter containing "Barclays" when Barclays is a tracked target but not a CV org. | 00 §1.7; eFC via 03 |
| CL-83 `char_limit` | Parse character limits and count characters including spaces and newlines. | block | **Fail:** a 300-word answer in a 1,000-character box. | Form practice (C); 06 |
| CL-84 `video_script` mode | 150–220 spoken words, answer in the first sentence, no parentheses, abbreviations or furniture. | med | **Pass:** a 90-second "Why PwC?" script. | PwC/KPMG TARGETjobs (B); MS 2025 flyer (C) |
| CL-85 `motivation_bank_reuse` | The why_firm answer is stored per company and offered across letter, form, video and interview prep. A why_firm reused across *different* companies triggers CL-57 overlap. | med | **Fail:** the same why_firm sentence used for two firms. | QMUL 2026 |
| CL-86 `confirm_extract` | "This is true" stores a plain-clause extract, not the AI sentence, and is never available for "would work for any firm". | high | n/a | Spec anti-goals; Schilke & Reimann |
| CL-87 `page_fit` | The rendered PDF must be exactly 1 page. | block | **Fail:** 2 pages. | Prospects (B) |
| CL-88 `lexicon_era` | Every model_tic lexicon entry carries `era` and `addedAt`; reviewed every 6 months. | policy | n/a | Wikipedia era lists (C); Kobak (A) |

## Rules to delete or downgrade

- **"Dear Sir/Madam" (CL-42, high) → low.** Prospects and TARGETjobs list it (Finding 18).
- **`Formulaic transition` "Overall," / "Ultimately," (block) → soft.** These are ordinary words. Keep "In conclusion" (Finding 5).
- **`Money as motivation` / `Consulting stepping-stone` → sector-scoped, intent-anchored, med** (Finding 5).
- **US-spelling soft regex → delete.** Replace with an en_GB dictionary check under CL-60 and stop labelling it "AI-ism". Also fix `lib/cv-rules/rules/general.ts:207-210` ("program" is correct for software).
- **Hard-block "realm / beacon / symphony / indelible" → soft.** These are GPT-4-era and rare in student writing.
- **CL-03 field fill 85% (high) → 60% (low)** (Finding 21).
- **Em dash `emDashFail` block → high.** Now a historical signal (Finding 25).
- **CL-55 I-start 35% → 50%** (Finding 20).
- **Delete** the "Anthropic forbids AI" claim (00 §5, 05 F3) and "BCG London letter: High (official)" (03).

## Open questions

1. **Goldman 2026/27 EMEA letter format.** Is it really about 300 words, and in what fields? I found only eFC's "personal statement" description (Aug 2025) and a UNSW (Australia) "300-word cover letter" listing. Someone needs to read a live GS posting.
2. **Morgan Stanley video cover letter.** The 2025 flyer is indexed, but its text couldn't be extracted here. Confirm the length and prompts, and whether it covers all EMEA programmes or only Foundations in Finance.
3. **Barclays, Citi, HSBC, Deloitte UK.** Current application documents and ATS are unverified (vendor guides conflict). I didn't reach Deloitte's or Barclays's UK form pages.
4. **CIPD and Resume Builder / Resume.org.** I found no primary survey on AI-written cover letters. If the brief's authors know a specific report, it should be added with full wording and sample.
5. **Do UK recruiters read letters at interview prep?** Still unmeasured (01 §4.4). No new evidence found.
6. **Lint calibration.** The playbook's <10% false-positive target on human letters is untested. Five tested sentences already trip block rules (Finding 5). This needs a corpus of real UCL letters (opt-in donation).
7. **PDF one-page fit at 420–450 words.** This is an estimate; render it to confirm.

## Sources

Grades follow the brief: A = peer-reviewed, official employer, regulator or ISE; B = large-sample, careers service or established outlet; C = practitioner, forum, vendor or community.

| # | Source | Publisher, date | URL | Grade |
|---|---|---|---|---|
| 1 | Candidate AI guidance | Anthropic, current (fetched 2026-10-18) | https://www.anthropic.com/candidate-ai-guidance | A |
| 2 | London recruiting FAQ | Bain & Company, current | https://www.bain.com/careers/recruiting/london-recruiting/ | A |
| 3 | 5 trends from ISE's recruitment survey 2025 | ISE, 2025 | https://ise.org.uk/knowledge/insights/498/5_trends_you_need_to_know_from_ises_recruitment_survey_2025/ | A |
| 4 | Students use AI to compete, yet oppose AI assessment | ISE / Prospects Early Careers Survey (n = 5,000), 4 Jun 2026 | https://ise.org.uk/knowledge/insights/569/students_use_ai_to_compete_yet_oppose_ai_assessment | A |
| 5 | Student Recruitment Survey 2025 (PDF) | ISE, 2025 | https://ise.org.uk/_userfiles/pages/files/reports/student_recruitment_survey_2025.pdf | A (not opened) |
| 6 | Labor market signals: the role of LLMs | Abbas Nejad, Musillo, Wicker, Zaccaria, *J. Labor Economics*, 2026 | https://research.tilburguniversity.edu/en/publications/labor-market-signals-the-role-of-large-language-models-2/ | A |
| 7 | Signaling in the Age of AI: Evidence from Cover Letters | Cui, Dias, Ye, arXiv 2509.25054, Nov 2025 | https://arxiv.org/abs/2509.25054 | A− (preprint) |
| 8 | Algorithmic Writing Assistance on Jobseekers' Resumes Increases Hires | Wiles, Munyikwa, Horton, *Management Science* 71(12), 2025 | https://pubsonline.informs.org/doi/fpi/10.1287/mnsc.2024.04528 | A |
| 9 | Delving into LLM-assisted writing… excess vocabulary | Kobak et al., *Science Advances*, Jul 2025 | https://arxiv.org/abs/2406.07016 | A |
| 10 | Why Does ChatGPT "Delve" So Much? | Juzek & Ward, COLING 2025 | https://aclanthology.org/2025.coling-main.426 | A |
| 11 | Voice Under Revision | van Nuenen, arXiv 2604.22142, Apr 2026 | https://arxiv.org/abs/2604.22142 | A− |
| 12 | AI Writers Have a Consistent Stylometric Footprint, but AI Editors Do Not | Shan, Lee, Hao, EMNLP 2026 | https://arxiv.org/abs/2608.27855 | A |
| 13 | Saying More Than They Know (tricolon rate) | Bakhshi, arXiv 2604.19768, Mar 2026 | https://arxiv.org/abs/2604.19768 | B (single-author preprint) |
| 14 | Generative AI and Perceptual Harms | Kadoma, Metaxa, Naaman, arXiv 2410.00906, 2025 | https://arxiv.org/abs/2410.00906 | A− |
| 15 | Disclosing AI use can backfire | Schilke & Reimann, *OBHDP* 2025 (Univ. of Arizona release) | https://news.arizona.edu/news/disclosing-ai-use-can-backfire-research-shows | A |
| 16 | Human heuristics for AI-generated language are flawed | Jakesch, Hancock, Naaman, *PNAS* 2023 | https://sml.stanford.edu/publications/2023/human-heuristics-ai-generated-language-are-flawed | A (cited from 05; not reopened) |
| 17 | GPT detectors are biased against non-native English writers | Liang et al., *Patterns* 2023 | https://arxiv.org/abs/2304.02819 | A (not reopened) |
| 18 | Cover letters | Prospects, May 2025 | https://www.prospects.ac.uk/careers-advice/cvs-and-cover-letters/cover-letters | B |
| 19 | Covering letter essentials for graduate vacancies | TARGETjobs, 25 Jan 2023 | https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/covering-letter-essentials-graduate-vacancies | B |
| 20 | PwC graduate application process explained | TARGETjobs, Apr 2025 | https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/pwc-graduate-application-process-explained | B |
| 21 | KPMG graduate schemes: how to apply | TARGETjobs, 1 Aug 2024 | https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/kpmg-graduate-schemes-how-apply | B |
| 22 | Morgan Stanley cover letter and CV advice | TARGETjobs, 25 Oct 2023 | https://targetjobs.co.uk/careers-advice/cvs-applications-and-tests/morgan-stanley-cover-letter-and-cv-advice-telling-your-story | B |
| 23 | Getting your application right: what UK employers expect | Queen Mary University of London, 8 Sep 2026 | https://www.qmul.ac.uk/sef/news/2026/items/getting-your-application-right-what-uk-employers-expect.html | B |
| 24 | Guidelines on the use of GenAI in the application process | University of Edinburgh Careers, 29 Jul 2025 | https://careers.ed.ac.uk/cvs-and-applications/guidelines-on-the-use-of-generative-ai-in-the-application-process | B |
| 25 | Using AI in job applications and recruitment | University of Liverpool Careers, undated | https://www.liverpool.ac.uk/careers/students/using-ai-in-job-applications-and-recruitment/ | B |
| 26 | Goldman Sachs 2026 internships | eFinancialCareers, 15 Aug 2025 | https://www.efinancialcareers.com/news/goldman-2026-internships | B |
| 27 | Shorter UK graduate visa from January 2027 | Times Higher Education, 2025 | https://www.timeshighereducation.com/node/739481 | B |
| 28 | Upcoming changes to student and Graduate visas | University of Bath, 2025 | https://www.bath.ac.uk/announcements/upcoming-changes-affecting-the-student-visa-and-graduate-visa/ | B |
| 29 | Bright Network survey on students' GenAI use | Workplace Journal, Apr 2024 | https://workplacejournal.co.uk/2024/04/bright-network-survey-reveals-students-use-of-generative-ai-in-job-applications/ | B (dated) |
| 30 | Employers say job applications up 51% since AI (Hays) | Staffing Industry Analysts, Dec 2025 | https://www.staffingindustry.com/news/global-daily-news/employers-say-job-applications-up-51-since-start-of-ai-hays | B |
| 31 | Signs of AI writing (era vocabularies, historical indicators) | Wikipedia WikiProject AI Cleanup, 2026 | https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing | C (community; descriptive) |
| 32 | J.P. Morgan interview reviews (London spring week) | Glassdoor, 2025–26 | https://www.glassdoor.com.hk/Interview/J-P-Morgan-Interview-E145-RVW3513538.htm | C |
| 33 | Morgan Stanley 2025 Foundations in Finance flyer (video cover letter) | Morgan Stanley HR via Enfield Council, Nov 2024 | https://traded.enfield.gov.uk/public-assets/attach/8676/2025-Step-In-Step-Up-Foundations-in-Finance-ext.pdf | C (text not extracted; search-indexed) |
| 34 | Morgan Stanley interview process (Oleeo ATS) | ResumeAdapter (vendor) | https://www.resumeadapter.com/companies/morgan-stanley/interview-process | C |
| 35 | J.P. Morgan GPB postings on Oracle candidate site | CityU HK Career Centre PDF, 2024 | https://www.cb.cityu.edu.hk/careerdevelopment/docs/2024%20APAC%20GPB%20Info%20Sess.pdf | C |
| 36 | Barclays summer internship application guide | Finbound (vendor) | https://www.finbound.org/blog/barclays-summer-internship-application-guide | C |
| 37 | McKinsey recruiting process | MyConsultingCoach (vendor) | https://www.myconsultingcoach.com/mckinsey-recruiting | C |
| 38 | AI in hiring survey (19.6% would reject) | TopResume, 2025 | https://topresume.com/career-advice/ai-in-hiring-survey | C (vendor) |
| 39 | BCG on-campus page (no longer lists documents) | BCG, fetched 2026-10-18 | https://careers.bcg.com/on-campus/cardiff-university | A (absence of claim) |
| 40 | If AI can write the application, what evidence will employers trust? | Cambridge Network, 2026 | https://www.cambridgenetwork.co.uk/news/if-ai-can-write-application-what-evidence-will-employers-trust | C |

**Code evidence:** I ran the shipped `rules.json` regexes and the `mode.ts` regexes in Node against 18 lexicon sentences, 7 AI-policy phrasings, 6 no-letter phrasings and 11 motivation prompts. The results are quoted in Findings 1, 5, 10 and 11.
