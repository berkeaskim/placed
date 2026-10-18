# CV tailoring playbooks and fabrication guard: audit

Auditor 05 · 2026-10-18 · Scope: `docs/research/tailor-playbooks-*.{md,json}`, `docs/research/market-2026/05-tailoring-science.md`, `lib/tailor/*`, `lib/ai/tailorCV.ts`, `lib/ai/prompts.ts` (SYSTEM_TAILOR), `lib/verify/*`, `scripts/build-tailor-playbooks.ts`, `tests/tailor/*`, and branch `feat/experience-bank` (read-only).

**Executive verdict: C+.**
1. The deterministic gate is unusually strong on *entities and digits*: invented employers, digit metrics in bullets, vocab skills, verb-ladder escalation and sibling-tool swaps are all caught. I ran 56 adversarial probes against the real `verifyTailoring` (pure function, scratch script, no app or DB). Of the 48 that were fabrications, it **missed 34 (caught 14)**, and the misses cluster in five classes: summary-level claims, frequency/modality/hedge drops ("estimated", "paper", "monthly"→"weekly"), outcome/achievement upgrades ("finalist"→"won"), audience/scope inflation ("committee"→"senior management"/"clients"), and role-type inflation of a real employer ("Spring Insight at Goldman Sachs"→"worked at Goldman Sachs").
2. The prompt actively pushes the model *into* these blind spots. It demands a "substantial" 8–12-change rewrite where "unchanged is never the safe default", and it writes a brand-new summary when the CV has none. The summary is the least-guarded unit. The prompt also runs on the "fast" tier, against the research doc's own recommendation (strong model, low temperature).
3. The playbooks are well sourced on *what UK screeners read*. But they contradict the system prompt: summaries are to name the target role and use numbers, while the system prompt says "no numbers" and "never write the target role". Many `reframes` are either always blocked by the gate (dead letters that cost a retry) or unguarded by it ("A/B test", "stock pitch", "deployed").
4. The evidence for keyword mirroring is weaker than the playbooks imply. Vendor docs show semantic, qualification-level matching (Greenhouse embeddings, Workday HiredScore LLM per-qualification grading, SAP skills compatibility, Taleo form-answer prescreening). Workday HiredScore **does not grade campus/graduate requisitions at all**, and the tailoring premium has decayed post-LLM (Cui 2025: −51%; Galdin & Silbert 2025). Tailoring is defensible as *salience and selection*, not as ATS gaming.
5. There are real fairness and compliance gaps. No employer-AI-policy notice exists for tailoring, although Bain's live FAQ restricts CV AI use to grammar and spelling, and the cover-letter feature already has a (JD-only) check. Archetype coverage is missing for Big 4 audit/tax, actuarial and engineering. On `feat/experience-bank`, LLM-extracted LinkedIn-post bullets can launder unverified skills into the fact corpus.

## Scorecard

| Dimension | Grade | One-line reason |
|---|---|---|
| Evidence quality (playbook docs) | B | UK careers services, employer pages and arXiv studies verified. Reframes, `onlyIf` guards and verb lists are self-declared D. One eye-tracking source is mischaracterised. |
| Evidence quality (05 tailoring science) | B+ | Key arXiv papers verified to exist with the stated numbers (Takano, Indukuri, Cui, Galdin, Xu). The ATS section relies on absence of evidence and has no vendor docs. |
| Freshness | B− | Mostly 2025–26. Misses the 2026 HiredScore LLM grading change, the Greenhouse Talent Matching docs, ISE 2025 AI figures, Civil Service AI guidance (2025) and the Eightfold FCRA suit (Jan 2026). |
| Coverage (roles) | C | 8 archetypes. Big 4 audit/tax, actuarial/insurance, engineering (non-software), public sector/policy, sales/ops, law and banking ops/tech are absent or forced into a wrong playbook. "research" conflates academic, equity, market and UX research. |
| Coverage (fabrication classes) | C | Strong on entity, digit and tool. Weak on summary, modality, frequency, outcome, audience, role-type, proficiency, grade, causal-link and purpose-clause fabrication. |
| Implementation fidelity (doc → code) | C | Recommended strong model/low temp, minimal edits, strict mode for switchers, entailment judge, bullet-count invariant and firm AI notice are all not shipped. `competencyThemes`/`sectionOrder` are never sent to the model. |
| Consistency | D+ | Playbook summary formulas contradict SYSTEM_TAILOR twice. Reframes contradict the gate. The prompt's "minimal-edit" research basis is contradicted by "never the safe default". |
| UX / copy | B− | Good honesty copy ("Not in your CV — we didn't invent it"). But "Verified"-style passes overclaim given the blind spots, and there is no employer-policy or legal notice in the tailor flow. |

## Probe method (reproducible)

I wrote a scratch script outside the repo that calls the shipped `verifyTailoring` on a synthetic CV. It does not edit code, does not touch the app, and does not touch the DB. The CV has: Predicted 2:2; Events Officer with "monthly events for 60 members", "£5k paper trading portfolio in the society's simulated fund", "Shortlisted as finalist", "Drafted a proposal to cut costs by an estimated 15%" and "Presented findings to the society committee"; a Goldman Sachs Spring Insight with "shadowed an analyst"; and Tesco Customer Assistant. Results are quoted per finding as **[probe: pass/warn/block]**. "pass" or "warn" on a fabrication means it is *rendered into the PDF*, because only `block` stops rendering (`lib/tailor/render.ts:20`).

---

## Findings

### 1. Summary is the least-guarded unit, and the prompt writes one from scratch
- **Severity**: P0 · **Type**: implementation
- **Where**: `lib/ai/prompts.ts:95`; `lib/verify/tailoring.ts:883-890` (scopedSummary); `lib/verify/checks-extra.ts:396-407` (extra checks run on roles only)
- **Current**: "Otherwise rewrite it (or write one, 1-2 lines, if the CV has none) for this role." Summary numbers are checked only by "value exists somewhere in a source unit that shares ≥1 content word". The `scopedMetrics` kind/magnitude check, qualifier drops and the authorship ladder never run on the summary.
- **Evidence**: Probes against the real gate, all **pass**:
  - "managed a £5m trading portfolio" (source £5k): "5m" yields values {5, 5000000}, and "5" exists in the corpus.
  - "grew attendance by 60%" (source "60 members").
  - "First-class Economics student" (source Predicted 2:2).
  - "with a 2:2" (dropped "Predicted").
  - "A-levels A*A*A" (source A*AB).
  - "fluent Spanish speaker" (source "conversational").
  - "Former Goldman Sachs summer analyst" (source Spring Insight).
  - "has worked at Goldman Sachs".
  - "2 years of customer service experience" (source Jun–Aug 2024).

  Takano (2026) found un-guarded pipelines fabricate in 96.7% of outputs, and prompt guardrails still leave 50% (A-, arXiv 2608.26171, verified). FRANK classes these as "Out of Article" and "Circumstance" errors (Pagnoni et al., NAACL 2021). UK careers services say a student profile is usually unnecessary: TARGETjobs calls it "a waste of space" in many cases; LSE says it is "not necessary" (cited and verified in the playbook doc).
- **Fix**:
  1. Never *create* a summary. Change prompt line 95 to: "If the CV has no summary, return summary: null. If it has one, you may only shorten it or reorder its clauses; never add a fact the summary did not state." Add a gate rule `summaryCreated` (block) that fires when `source.summary == null && tailored.summary != null`.
  2. Run `scopedMetrics` on summary sentences, with each sentence's cited set = source units sharing ≥2 content stems. Compare `metricKey` (kind + magnitude), not raw values.
  3. Add the new summary-specific checks `gradeClaim`, `roleTypeClaim`, `durationClaim` and `proficiencyClaim` (see New rules).

### 2. Role-type inflation of a real employer passes everywhere outside one bullet
- **Severity**: P0 · **Type**: missing
- **Where**: `lib/verify/tailoring.ts:930-937` (known-employer check uses `employerInCv(nameCorpus)`, presence only)
- **Current**: An employer is "supported" if its name appears anywhere in org/title/bullets. The *relationship* (insight attendee vs intern vs analyst) is never checked.
- **Evidence**:
  - [probe: pass] "Former Goldman Sachs summer analyst studying Economics" (summary).
  - [probe: pass] "Economics student who has worked at Goldman Sachs".
  - In a bullet, "Completed a Goldman Sachs internship" was caught only incidentally, through the dropped "shadowed" qualifier.

  Forage's partner programmes are explicitly not employment: ASU says "Forage experiences are NOT employment or professional work experiences" (B, Arizona State University careers, fetched 2026-10-18). Civil Service guidance forbids "inventing or ramping up skills and experience" (B, PublicTechnology report of Cabinet Office guidance, 31 Oct 2025). UK spring weeks and insights are exactly the entries first-years have, which makes this the highest-value lie for Placed's core segment.
- **Fix**: New block check `roleTypeEscalation`.
  - Classify each source entry's engagement type from title + org:
    - `virtual` (Forage, virtual experience/job simulation)
    - `insight` (spring week, insight, discovery, open day)
    - `vacation/internship/placement`
    - `fulltime`
  - In any tailored unit, find a CV employer name within 6 tokens of a role noun (intern|internship|placement|analyst|associate|worked at|employed|summer analyst|trainee).
  - Block when the noun's rank exceeds the entry's rank (virtual < insight < internship ≤ placement < analyst/fulltime).
  - Tests:
    - (a) source "Spring Insight Programme, Goldman Sachs", summary "former Goldman Sachs summer analyst" → block.
    - (b) "Virtual Experience Programme, JPMorgan (Forage)", bullet "JPMorgan internship" → block.
    - (c) "Goldman Sachs Spring Insight" → "Spring Insight Programme at Goldman Sachs" → pass.

### 3. Modality and hedge drops are invisible: "estimated", "proposed", "paper/simulated", "drafted", "predicted"
- **Severity**: P0 · **Type**: missing
- **Where**: `lib/verify/checks-extra.ts:136-161` (QUALIFIERS)
- **Current**: The qualifier list covers team/partOf/subordinate/context and numeric hedges (~, approx, around, up to, over, nearly). It has no modality or realisation qualifiers.
- **Evidence**:
  - [probe: pass] "Managed a £5k trading portfolio for the society fund" (dropped "paper" and "simulated").
  - [probe: pass] "Cut costs by 15% through a proposal" (estimate → realised).
  - [probe: pass] "Delivered a proposal that cut costs" (drafted → delivered).
  - [probe: pass] "Drafted a proposal to cut costs by 15%" (dropped "estimated").

  05-tailoring-science F9 itself lists "certainty (familiar → proficient)" as a protected dimension, but no certainty qualifiers ship. FRANK's PredE ("predicate conflicts with the source") is the formal class. In finance CVs, simulated, paper and student-fund portfolios are very common, and an interviewer will probe them.
- **Fix**: Add qualifier groups to `QUALIFIERS`:
  - `simulated` (block): `paper (?:trading|portfolio)|simulat\w+|mock|virtual|fantasy|hypothetical|model portfolio|student[- ]run fund|case (?:study|competition)|challenge`
  - `projection` (block): `estimated|projected|forecast(?:ed)? to|expected to|on track to|potential(?:ly)?|target(?:ed)?|aim(?:ed)? to|could|would`
  - `proposal` (block): `propos\w+|recommend\w+|suggest\w+|draft\w*|pitched|prototype\w*|proof of concept|MVP|pilot\w*`
  - `predicted` (block): `predicted|expected|on course for`

  A drop is a removal of the group from source to tailored. Also block the projection→realisation verb pair: source has a projection, tailored has `cut|reduced|saved|increased|grew|delivered` with the same metric. Tests: the four probes above → block. "Drafted a proposal to cut costs by an estimated 15%" → "Drafted a cost-cutting proposal (estimated 15% saving)" → pass.

### 4. Outcome upgrades are only a warning: "finalist" → "won", "first place"
- **Severity**: P0 · **Type**: implementation
- **Where**: `lib/verify/tailoring.ts:341`, `:1037-1042` (newAchievement = warn)
- **Current**: A new achievement token not in the cited text is a **warn**. "first place" via "Placed first" is not matched at all.
- **Evidence**: [probe: warn] "Won the UCL trading challenge" (source "Shortlisted as finalist"): this renders. [probe: pass] "Placed first in the UCL trading challenge". HEDD-linked surveys found grade and achievement inflation is the most common CV lie, with 47% saying they would claim a higher class (C/B, HRreview/THE coverage of HEDD survey, 2012: old but the only UK data found).
- **Fix**: Ladder `OUTCOME = participated(0) < shortlisted|nominated|longlisted(1) < finalist|semi-finalist(2) < runner-up|highly commended|2nd|3rd(3) < won|winner|first|1st|champion|gold(4)`. Block if tailored rank > cited rank. Keep warn only when the cited text has no outcome word at all and the claim is new. Extend the regex with `placed (?:first|1st|second|2nd|third|3rd)` and `(?:gold|silver|bronze) (?:medal|award)`. Tests: the two probes → block. "Finalist, UCL trading challenge" → "UCL trading challenge finalist" → pass.

### 5. Audience and scope inflation passes: "committee" → "senior management" / "clients"; "busy store" → "UK's busiest"
- **Severity**: P1 · **Type**: missing
- **Where**: none (no check exists)
- **Current**: Not checked. perBulletDrift needs >3 new content stems, and only warns.
- **Evidence**:
  - [probe: pass] "Presented findings to senior management".
  - [probe: pass] "Presented findings to clients".
  - [probe: pass] "Served customers in one of the UK's busiest stores".
  - [probe: pass] "Presented recommendations…, which were adopted".

  The consulting playbook itself guards "client-facing" with `onlyIf: direct contact with external people` and "Proposed X; implemented by management" with `onlyIf: source says it was adopted`. The gate never enforces those guards (see #9). FRANK EntE ("core participants or their attributes are wrong") is the formal class.
- **Fix**: New block check `audienceEscalation`.
  - Rank audiences: `self/team/peers(0) < committee/society/members/manager(1) < senior management|directors|executives|partners|MDs|board|C-suite|leadership team(2)`; `external: clients|customers|investors|sponsors|regulators|press`.
  - Block when the tailored text introduces a rank-2 or external audience absent from the cited text.
  - Separately block new adoption/outcome clauses (`adopted|implemented|approved|rolled out|signed off|went live`) absent from the cited text.
  - Warn on new superlative scope (`busiest|largest|leading|top-performing|record|national|global|firm-wide`).

### 6. Frequency and quantity-word changes pass ("monthly" → "weekly"/"daily", "regular")
- **Severity**: P1 · **Type**: implementation / contradiction
- **Where**: `lib/verify/tailoring.ts:169-171` (`weekly daily monthly` are in STOP, so drift ignores them); `lib/ai/prompts.ts:93,101` (prompt says keep "weekly" and never add a frequency)
- **Current**: The prompt protects frequency; the gate deliberately ignores it.
- **Evidence**: [probe: pass] monthly → weekly; [probe: pass] monthly → daily. "Organised weekly events" vs "monthly" is a fourfold scope inflation, equivalent to a number change.
- **Fix**: Remove `weekly daily monthly` from STOP. Add check `frequencyEscalation` with rank `annual|yearly(1) < termly|quarterly(2) < monthly(3) < fortnightly|biweekly(4) < weekly(5) < daily|every day(6) < hourly(7)`. Block on rank increase vs cited. Warn when a specific frequency is replaced by a vaguer one ("regular"). Test: probes → block. Same frequency, reworded ("each month") → pass.

### 7. Proficiency escalation is unchecked outside exact skills-list strings
- **Severity**: P1 · **Type**: missing
- **Where**: `lib/verify/tailoring.ts:1047-1056` (skills list) and per-unit skillInjection (canonical names only)
- **Current**: "Advanced Python" canonicalises to Python, so it passes. "Spanish (fluent)" was caught only because the whole string is not a corpus token; "fluent Spanish" in the summary passes.
- **Evidence**:
  - [probe: pass] "Used advanced Python…".
  - [probe: pass] summary "proficient in Python and Excel".
  - [probe: pass] summary "fluent Spanish speaker".
  - IMC: "If we read 'very good' in C++, you'll be setting a high bar for yourself" (A, quoted in the playbook doc, IMC recruitment page).
  - eFC: a language "not good enough… to hold a client meeting in" should not go on (C).
  - Eightfold community notes that proficiency is not a match input, so there is no ATS upside to inflating it (C).
- **Fix**: New block check `proficiencyEscalation`.
  - Tool ladder: `familiar|exposure|basic|beginner(0) < working|intermediate|competent(1) < proficient|strong|good(2) < advanced|very good|fluent(3) < expert|mastery|native(4)`.
  - Language ladder: `A1-A2|basic(0) < B1|conversational|intermediate(1) < B2|professional working(2) < C1|fluent(3) < C2|native|bilingual(4)`.
  - Attach each level word to the nearest skill or language within 4 tokens. Block if tailored rank > source rank for the same skill, or if any rank ≥ 2 is new with no source level.
  - Add a languages vocab (the top 30 languages) so "Spanish" is extractable.

### 8. Grade and qualification claims are not entity-checked
- **Severity**: P1 · **Type**: missing
- **Where**: `lib/ai/tailorCV.ts:95` forces education from the source (good), but the summary is free; `lib/verify/tailoring.ts:345-366` (COMMON contains "first")
- **Current**: Grades appear only as digits ("2:1" yields 2 and 1). "First", "Distinction", "A*" and "predicted" are not modelled.
- **Evidence**: [probe: block] "on track for a 2:1" was caught only because "1" happened to be absent from that corpus; most CVs contain a "1". [probe: pass] "First-class", "A*A*A", "with a 2:2" (Predicted dropped). The software_eng summary formula explicitly asks the model to insert "grade if 2:1+" (`playbook-data.json:17`), which invites restating, and thus mis-stating, the grade.
- **Fix**: New block check `gradeClaim`. Parse the source grade into {class: first|2:1|2:2|third|distinction|merit|pass, predicted: bool, percent?} and A-level/IB strings. In any tailored unit:
  - detect class/grade mentions (`first[- ]class|\bfirst\b(?= (?:class|degree))|2[:.]1|upper second|2[:.]2|distinction|merit|A\*|\d{2}%|IB \d{2}`);
  - block if the value is not equal to the source value;
  - block if the source says predicted and the tailored text omits predicted|expected|on track.

  Tests: the four grade probes → block. "Predicted 2:2" → "predicted 2:2" → pass.

### 9. Playbook reframes and the gate contradict each other: many are dead letters, others are unguarded
- **Severity**: P1 · **Type**: contradiction
- **Where**: `lib/tailor/playbook-data.json` reframes; `lib/skills/vocab.ts:111,174,185,204`; `lib/verify/tailoring.ts:906-913`
- **Current**: Reframes map plain phrases to vocab skills. The gate blocks any vocab skill absent from the source, so these reframes can *only* pass when the term was already present, which makes them pointless and burns the single retry. Meanwhile non-vocab reframe targets are never checked against their `onlyIf`.
- **Evidence**:
  - [probe: block] "Client-facing: served customers" → skillInjection "Stakeholder Management": the consulting/finance reframe "spoke to customers → client-facing" can never succeed.
  - Product "worked with committee, sponsors and the SU → stakeholder management" and "asked people → gathered user feedback through interviews" (User Research alias) are equally always blocked.
  - Unguarded:
    - [probe: pass] "Drafted an A/B test proposal": `extractSkills("Ran an A/B test")` returns `[]`, because only "a/b tests"/"ab testing" are aliases. So the data playbook's named top over-claim ("Relabelling a simple comparison as an A/B test", `playbook-data.json` data pitfalls) is undetected.
    - [probe: pass] "Presented a stock pitch": `extractSkills` returns only `["Communication"]` and misses vocab "Stock Pitch".
    - [probe: pass] "Comparable company analysis" (alias is "comparable companies").
    - [probe: pass] "Built and deployed a Python model": "deployed" is the data playbook's other named over-claim.
- **Fix**:
  1. Generate a deterministic `REFRAME_GUARDS` table from the playbook JSON. Each reframe's `to` term gets a `requires` regex that must match the *cited* source:

     | Term | Required evidence in cited source |
     |---|---|
     | A/B test | control\|variant\|split\|randomi[sz]\|two versions.*(?:rate\|%\|metric) |
     | deployed/live | deploy\|hosted\|live\|https?:\|vercel\|heroku\|aws\|app store |
     | client-facing | client\|customer\|external\|public |
     | stakeholder management | ≥2 distinct group nouns |
     | DCF/LBO/comps | the exact method name |
     | pitchbook | deal\|transaction\|M&A |
     | pro bono consulting | charity\|non-profit + deliverable noun |
     | published/publication | journal\|conference\|proceedings\|doi |
     | manuscript in preparation | always allowed only if source says paper\|manuscript |

     Block when the term is new and its evidence is absent.
  2. Add aliases "a/b test", "ab test", "split test", "comparable company analysis", "comps", "trading comps" and fix the "stock pitch" extraction bug (likely the soft-skill signal pass shadowing it: `lib/skills/extract.ts`, worth a separate ticket).
  3. Delete reframes whose `to` is a vocab skill the gate will always block (client-facing, stakeholder management, user research), or let the student confirm them as a `confirmed_fact` in the UI before tailoring.

### 10. Summary formulas contradict SYSTEM_TAILOR twice (numbers; target-role label)
- **Severity**: P1 · **Type**: contradiction
- **Where**: `lib/ai/prompts.ts:90` ("Never write the posting's job title or the target role or field as a label anywhere"), `:95` ("No numbers"); `lib/tailor/playbook-data.json:17,133,245,357,692,808`
- **Current**:
  - SWE: "+ … with its existing number + target role type".
  - Data: "+ the target (analyst vs data science) taken from the advert".
  - Product: "+ the target (graduate product manager, APM, product analyst)".
  - Marketing: "existing headline metric … + the target".
  - Consulting: "leading with its strongest quantified … fact".
  - Finance: "target division".
- **Evidence**: The two instructions are mutually exclusive in the same prompt. LLMs resolve conflicts unpredictably. The playbook formulas (numbers in summary) also steer the model into the weakly checked summary path (#1).
- **Fix**: Rewrite every `summaryFormula` to "Only when the CV already has a profile: compress it to ≤2 lines of facts it already states (degree, year, institution, tools the bullets show). No numbers, no target-role label, no grade restatement." Then rebuild with `scripts/build-tailor-playbooks.ts`. Add a test in `tests/tailor/playbooks.test.ts` that asserts no `summaryFormula` contains `number|metric|target|quantified`.

### 11. The "substantial rewrite" mandate contradicts the research it cites and maximises fabrication exposure
- **Severity**: P1 · **Type**: contradiction / unsupported
- **Where**: `lib/ai/prompts.ts:87-89,99`; `tests/tailor/playbooks.test.ts` pins "never the safe default"
- **Current**: "GOAL: a substantial, role-specific rewrite… Default to rephrasing… Aim for 8-12 changes… Returning a bullet unchanged… is never the safe default."
- **Evidence**:
  - 05-tailoring-science F27 recommends to "Default to the *smallest* edit", and the pipeline box says "may return bullet unchanged (allowed & encouraged)".
  - Dhillon et al. (CHI 2024): high scaffolding lowered ownership. Draxler et al. (TOCHI 2024): the ghostwriter effect.
  - Cui, Dias & Ye (arXiv 2509.25054, v2 Nov 2025, verified): "the correlation between cover letters' textual alignment and callbacks fell by 51%", and editing time correlates with callbacks.
  - Galdin & Silbert (arXiv 2511.08785, verified): the pre-LLM premium for tailored applications "disappears".
  - Takano: each extra rewrite is a fabrication opportunity, and humans catch only 54.5% of subtle ones.
  - Oxford Careers: AI-heavy applications "often appear very similar in content, language, and structure" (B, via search excerpt; page 403 on fetch).
- **Fix**: Replace lines 87–89 and 99 with: "GOAL: make the strongest honest evidence for this role easy to find. Prefer, in order: (1) reorder, (2) select/drop, (3) swap one phrase for the posting's term where the original shows the same thing, (4) tighten. Rewrite a bullet only when it buries evidence the posting asks for. Leaving a bullet unchanged is correct when it already reads well. At most 8 changes; fewer is fine." Update the test that pins "never the safe default". Track "your words kept %" (F27) in `TailorOutcome`.

### 12. Tailor runs on the fast tier with no temperature control, against the research recommendation
- **Severity**: P1 · **Type**: implementation
- **Where**: `lib/ai/tailorCV.ts:115`; `docs/research/market-2026/05-tailoring-science.md:161,184`
- **Current**: `tier: "fast", thinking: "low"`, with the comment "no temperature: Claude rejects it". The doc says "Sonnet …, temperature low (≤0.3)" and "prompt grounding works only with a capable model at low temperature (F12)".
- **Evidence**: Indukuri & Agrawal (arXiv 2607.01457, verified) report that prompt-only grounding reached zero detected hallucinations only "at low temperature with a capable instruction-following model". Higher temperatures and weaker models still needed deterministic layers. Fast-tier + local Ollama models (local-first release) are the worst case.
- **Fix**: Route tailorCV to the "smart" tier by default (the latency issue was a Vercel 300 s limit that no longer applies to a local-first app), or set temperature ≤0.3 on providers that accept it. When the provider is a local Ollama model, enable `strictMode` (#15). Document the provider-dependence in the tailor UI.

### 13. No employer AI-policy notice in tailoring; the cover-letter check reads the JD only
- **Severity**: P1 · **Type**: fairness / missing
- **Where**: `lib/cover-letter/mode.ts:6-14` (JD regex only); nothing in `lib/tailor/*`; `docs/research/tailor-playbooks-finance-consulting.md:54-59` (recommended, not built); `playbook-data.json:789` (Bain policy injected as a "reads badly" line to the LLM, which can't act on it)
- **Current**: Placed AI-rewrites a CV for Bain London with no warning.
- **Evidence**:
  - Bain London FAQ (live, fetched 2026-10-18): "We'd ask that you only use AI, such as Chat GPT or Claude, to check grammar and spelling in your CV" (A).
  - Anthropic: "Please create your first draft yourself, then use Claude to refine it"; generated answers are "Generic content with experiences you haven't actually had" (A, anthropic.com/candidate-ai-guidance).
  - McKinsey allows refinement but not embellishment (C, Fortune Jan 2026 reporting; page timed out).
  - UK Civil Service: AI must not "generate full or false responses" (B, PublicTechnology 2025).
  - ISE 2025: 49% of employers have no problem with AI use, 10% have banned it or added technical measures, and 79% are redesigning or reviewing selection due to AI (A, ISE insight, Claire Tyler, 22 Oct 2025).
  - Oxford Careers' 2025 employer survey: 15% allow or encourage AI and about half say no (B, search excerpt).
  - QMUL SEF (8 Sep 2026): some employers "do not accept applications generated using AI" (B).
- **Fix**: Add `seed/employer-ai-policy.yml` with {employer, policy: grammar_only|refine_ok|no_ai|unknown, quote, url, checked}. Before `runTailoring`, if `job.company` maps to `grammar_only` or `no_ai`, or the JD matches the existing `aiPolicy` regex, show a blocking notice: "Bain asks candidates to use AI only for spelling and grammar in their CV. We can reorder your bullets (no rewording), or you can continue at your own risk." Offer a "reorder-only" mode that reuses `heuristicTailor`. Seed it with Bain (grammar_only) and Anthropic (refine_ok, draft yourself). Mark the rest unknown until verified.

### 14. Causal-link and purpose-clause insertion pass (FRANK LinkE / "Merging Facts")
- **Severity**: P1 · **Type**: missing
- **Where**: `lib/ai/prompts.ts:93` forbids it; no check; `tests/tailor/playbooks.test.ts` even treats "Trained 3 new staff on the till to cut queues" as a legitimate rephrase
- **Evidence**:
  - [probe: pass] merging "Organised society events" + "Membership grew 20% this year" into "Organised society events that grew membership 20%": two true facts plus an invented causal link. The number passed scopedMetrics because it is in a cited bullet.
  - [probe: pass] "…on the till to cut queue times".
  - [probe: pass] "model that accurately forecast…".
  - Chiang & Lee (ACL Findings 2024, verified): individually true facts "combined into a non-factual paragraph". FRANK LinkE is "logical, causal, or temporal connection… incorrect".
- **Fix**: New check `causalInsertion` (block on merged bullets, warn on single). Connectives: `(?:that|which) (?:led to|drove|grew|increased|reduced|cut|resulted in)|resulting in|leading to|thereby|to (?:cut|reduce|increase|improve|boost|drive)|so that|in order to|helping to|enabling`. Fire when the connective is new vs the cited text. Also add an evaluative-adverb list (`accurately|successfully|significantly|substantially|dramatically|efficiently|effectively|seamlessly`) as warn when new. Fix the test fixture so it uses a purpose clause present in the source.

### 15. "Strict mode" for career switchers and the optional entailment judge were recommended and never built
- **Severity**: P2 · **Type**: implementation
- **Where**: `docs/research/market-2026/05-tailoring-science.md:155,173-176,244`; `lib/tailor/run.ts:10` ("Item 4… deliberately skipped")
- **Evidence**: Takano reports contamination rising monotonically with specialty distance (12 → 36 findings). MiniCheck-FT5 (770M) is GPT-4-level on LLM-AggreFact (Tang et al., EMNLP 2024, in doc). AlignScore (355M, ACL 2023, verified) and SummaC (TACL, verified) are sentence-level NLI checkers. All are small enough for local-first via ONNX or Ollama-hosted small models.
- **Fix**:
  1. `strictMode = archetypeDistance(cv.archetypes[0], job.archetype) ≥ threshold || provider is local`. In strict mode, set DRIFT_K = 2, make perBulletDrift block, and force minimal edits.
  2. Add an advisory entailment pass that runs the configured AI on each changed bullet with a binary schema {entailed: bool, unsupportedSpan}. Mark failures amber and require an explicit per-bullet accept. Never auto-pass on judge failure (Indukuri: "defaults to reject").

### 16. Workday HiredScore does not grade campus/graduate requisitions; vendor ranking is semantic, not keyword
- **Severity**: P1 · **Type**: unsupported / stale
- **Where**: `docs/research/market-2026/05-tailoring-science.md:33-37` (F5: "keyword coverage as a *plausible* lever"); `lib/ai/prompts.ts:94` ("Distribute the top posting keywords … across the summary, the first bullet of each entry and the Skills list"); `lib/tailor/run.ts` coverage before/after shown as a headline
- **Evidence**:
  - Workday HiredScore does not assign grades when "You are reviewing candidates for a campus or graduate requisition" (A, Workday docs ES page, fetched). The Aug 2026 release note says "Each qualification is now assessed directly", with an LLM evaluating each qualification against the parsed resume (A).
  - Greenhouse Talent Matching uses "embedding representation of skills and job titles so that we can run a semantic search", and "There is no mechanism that automatically takes action to advance or reject a candidate based on an AI rating" (A, Greenhouse support FAQ). Its candidate blog says "Greenhouse never uses AI to rate candidates or auto-reject applications" (A, 8 Jan 2025).
  - Oracle Taleo ACE ranks on prescreening *answers*: "meet all Required criteria and some Asset criteria" (A, Oracle docs).
  - SAP SuccessFactors AI-Assisted Applicant Screening gives a "skills compatibility score" with matching/related/missing skills (B, SAP Community release blog, 2024).
  - Eightfold publishes no formula. A Jan 2026 FCRA class action alleges a 0–5 "Match Score" filtered applicants pre-review (C, Reuters/Yahoo).
  - UK GOV jobhelp still says ATS "scan each CV to find key words" (B).
- **Fix**:
  - Reword F5/F6 in the doc: "Major ATS vendors document semantic, per-qualification matching (Greenhouse, Workday HiredScore, SAP); graduate requisitions are often screened by forms and tests (Taleo prescreening; HiredScore excludes campus reqs). Exact-keyword mirroring has small expected value beyond making real evidence legible to a human."
  - In the prompt, replace "Distribute the top posting keywords …" with "Where the CV already shows something the posting names, use the posting's term once, in the most relevant place."
  - In the UI, label coverage as "Requirements your CV visibly evidences", not a score to maximise.

### 17. Keyword-stuffing risk: the prompt's "summary + first bullet of every entry + skills" placement is stuffing by construction
- **Severity**: P2 · **Type**: implementation
- **Where**: `lib/ai/prompts.ts:94`
- **Evidence**:
  - QMUL: "Use the language of the job description naturally" (B, 2026).
  - TARGETjobs: "be careful not to go overboard" (B, in TP25).
  - Semantic matchers (Greenhouse embeddings, HiredScore LLM) gain nothing from repetition.
  - LLM screeners self-prefer LLM text at 67–82% (Xu et al., arXiv 2509.00462, verified), so homogenised keyword-dense text is an arms race the doc itself rejects (F15).
- **Fix**: Gate rule `keywordRepetition` (warn): any JD keyword appearing more than 2 times across summary+bullets+skills, or more than 1 time in the summary, that was not already at that count in the source.

### 18. Lower-case and unlisted tool swaps, and programming-language swaps, pass
- **Severity**: P2 · **Type**: missing
- **Where**: `lib/verify/tool-families.ts` (no language family); `lib/verify/tailoring.ts:12-15` (documented limit)
- **Evidence**: [probe: pass] "Used Python to analyse" → "Used R to analyse": `extractSkills("Used R to analyse")` returns `[]`, and there is no language family. Indukuri: cross-domain contamination was 79–89% of baseline incidents.
- **Fix**:
  - Add families:
    - `general-language` {Python, R, MATLAB, Julia, Stata, SAS}
    - `systems-language` {C, C++, C#, Rust, Go}
    - `js-language` {JavaScript, TypeScript}
    - `notebook` {Jupyter, Colab}
    - `analytics` {Google Analytics/GA4, Adobe Analytics, Mixpanel, Amplitude}
    - `email` {Mailchimp, Klaviyo, HubSpot}
    - `accounting-standard` {IFRS, US GAAP}
    - `valuation-method` {DCF, LBO, comps, precedent transactions}
  - Treat a bare "R" as a tool when it directly follows used|in|with|using.

### 19. Duration claims ("2 years of experience") are not computed from dates
- **Severity**: P2 · **Type**: missing
- **Evidence**: [probe: pass] summary "2 years of customer service experience" with source Jun–Aug 2024. Kristal et al. (Nature Human Behaviour 2023, n=9,022 UK applications) show years-worked framing raises callbacks about 8–15%, so a duration claim is material, and fabricating it is the dark side of a proven lever.
- **Fix**: `durationClaim` (block): parse `(\d+|one|two|…)\+?\s*(years?|months?)\s+(?:of\s+)?(?:\w+\s+){0,3}experience`. Compute the max of summed non-overlapping entry durations (from `dates`) for entries whose title/org/bullets share a stem with the qualifier. Block if the claim exceeds the computed value rounded up to the nearest unit.

### 20. Currency swap and "60 → 60+" inflation are only warnings
- **Severity**: P2 · **Type**: implementation
- **Where**: `lib/verify/tailoring.ts:1026-1036`
- **Evidence**: [probe: warn] "£5k" → "$5k"; [probe: warn] "60 members" → "60+ members". Both render. "60+" changes a fact (a lower bound replaces an exact count). A currency swap changes magnitude by about 25% and the geography.
- **Fix**: Make `currencySwap` and `inflationQualifier` block.

### 21. Silent bullet loss is only a warning, and the prompt encourages dropping
- **Severity**: P2 · **Type**: implementation
- **Where**: `lib/verify/checks-extra.ts:337-361`; `lib/ai/prompts.ts:97`
- **Evidence**: [probe: warn] two of four bullets silently removed. Indukuri's mitigation was a bullet-count invariant |b′| ≥ |b|−1. 05 F12-H3 "removes truth".
- **Fix**: Block when more than 1 bullet per entry disappears without `changeType: "dropped"` and a reason. Cap drops at 1 per entry unless the student accepts each drop individually.

### 22. Archetype coverage: Big 4 audit/tax, actuarial and engineering are forced into wrong playbooks; "research" is ambiguous
- **Severity**: P1 · **Type**: missing / wrong
- **Where**: `lib/types.ts:1-4`; `lib/ai/prompts.ts:18` ("archetype: the single best fit", with no definitions given to the model); `lib/ai/heuristics.ts:13-21`; `docs/research/tailor-playbooks-finance-consulting.md:179` ("Big 4 … Use the same playbook")
- **Current**: A Big 4 audit or tax graduate scheme gets finance_banking ("Named finance exposure … division", pitfall "originated a deal") or consulting. A data-scientist JD matches the `research` regex via "scientist". An equity-research or market-research JD can match `research` and get an academic playbook (supervisor, referees, "Research interests" line).
- **Evidence**: The ISE 2025 survey shows accountancy and professional services among the largest graduate recruiters (A, ISE insight). The playbook doc admits Big 4 was "not re-researched". The heuristic regex `research: /\b(research(er)?|scientist|…)/` collides with data_analytics.
- **Fix**:
  - Add an `archetype_definitions` block to SYSTEM_TAG_JOB with one line per archetype and explicit routings:
    - "audit/tax/accountancy/actuarial → finance_banking with subtype"
    - "equity research → finance_banking"
    - "market/UX research → marketing_growth/product"
    - "research = academic or R&D lab roles only"
  - Add a `subtype` field (ib|markets|am|audit_tax|actuarial|risk|ops_tech). Branch playbook lines by subtype (audit: ACA/ACCA trajectory, client service, accuracy, professional scepticism; no deal language).
  - Long-term, add `engineering` (non-software; Gradcracker market) and `public_policy` (Civil Service Fast Stream: forms, no CV) archetypes, or skip tailoring for form-only schemes with a notice.
  - Change the heuristic research regex to `\bresearch (?:assistant|intern|scientist|fellow)\b|\bphd\b|\blaborator`.

### 23. `competencyThemes` and `sectionOrder` are researched but never sent to the model
- **Severity**: P3 · **Type**: implementation
- **Where**: `lib/tailor/playbooks.ts:32-42`
- **Evidence**: The prompt builder omits both fields. The doc says themes must be emitted only when evidenced (tech-product.md §6).
- **Fix**: Either delete both from the schema and JSON (simplest, since the tailor can't reorder sections anyway: `normalizeTailored` keeps the source order) or use `sectionOrder` in the PDF renderer as a suggestion the student can toggle.

### 24. Experience Bank (feat/experience-bank): post-derived bullets can launder unverified skills and verbs into the fact corpus
- **Severity**: P1 (on merge) · **Type**: implementation
- **Where**: `feat/experience-bank:lib/bank/import.ts:162-192`; `lib/bank/tailor-context.ts` `groundingText`; `lib/ai/prompts.ts` SYSTEM_POST_BULLETS
- **Current**: An LLM turns a LinkedIn post into CV bullets. The acceptance check is: excerpt quoted, numbers ⊆ post, word-metrics and known employers via `unsupportedInSource`. It does **not** check skills, the authorship ladder, qualifier drops or sibling tools. Once accepted, the bullet's own text (and the post) enters `groundingText`, i.e. the gate's fact corpus for all future tailoring.
- **Evidence**: The post prompt reuses `<job_posting>` tags for a post, which is confusing to the model. Example: post "helped my team build X with React" → bullet "Built X in React and TypeScript" passes import checks. After accept, "TypeScript" and "Built" become source truth and tailoring can list TypeScript in Skills. Takano's highest-yield bait was "a domain upgrade adjacent to real experience".
- **Fix**: Run the full `verifyTailoring` unit checks on each suggested bullet with `cited = excerpt` (skills, authorship, qualifiers, sibling, scoped metrics). Store `sourceText` only, and ground on the excerpt rather than the LLM text unless the student edited it (`manual`). Rename the tag to `<linkedin_post>`. What the branch does well: per-job *selection* of entries (one-page fit) is the most evidence-backed tailoring tactic (salience: Kristal 2023; "Add the most relevant information first", Newcastle in TP28), and it needs no rewriting at all.

### 25. Playbook doc mischaracterises the eye-tracking source
- **Severity**: P3 · **Type**: wrong
- **Where**: `docs/research/tailor-playbooks-finance-consulting.md:70` ("First-screen attention goes to titles, organisations, dates and education … [TF35] (A, small n)")
- **Evidence**: Törngren et al. (Frontiers in Sociology 2024, fetched) studied 40 recruiters at three *Swedish* firms on ethnic bias. It reports dwell time (~14 s per CV) and "no significant correlation between dwell-time and CV rating". It does not report which section was viewed first.
- **Fix**: "A Swedish eye-tracking study (n=40 recruiters) found ~14 s average dwell per CV and no link between dwell time and rating [TF35, B, not UK]." Remove the "titles, organisations, dates" ordering claim, or source it elsewhere.

### 26. 05 doc's ATS section cites no vendor documentation and repeats an anecdotal pass rate
- **Severity**: P2 · **Type**: stale
- **Where**: `docs/research/market-2026/05-tailoring-science.md:33-37`
- **Fix**: Add the vendor rows from #16 as A-grade sources and keep "75% auto-rejected has no primary source". Add ISE 2025's 140 applications per vacancy (A) as the real driver of screening.

### 27. Tailoring prompt is framed for internships only
- **Severity**: P3 · **Type**: copy
- **Where**: `lib/ai/prompts.ts:84` ("to one internship posting")
- **Fix**: "to one early-careers posting (spring week, insight, internship, placement or graduate role)". For spring weeks and insights (first-years), add: "the student may have little experience; prefer selection and reordering over rewording."

### 28. "Verified"/pass state overclaims given the known blind spots
- **Severity**: P2 · **Type**: copy
- **Where**: `docs/research/market-2026/05-tailoring-science.md:239` ("Verified CV" badge proposal); tailor UI pass state
- **Evidence**: 34 of 48 fabrication probes rendered (pass or warn).
- **Fix**: Copy: "Checked for invented numbers, employers, skills and ownership. Still read each change: we can't catch everything (e.g. 'monthly' → 'weekly')." Never show "Verified" until findings #1–#8 ship.

### 29. Legal and consequence notice is missing from the tailor flow
- **Severity**: P3 · **Type**: copy
- **Where**: 05 §4 item 11 recommended it; not in `lib/tailor/view.ts` copy
- **Evidence**: R v Andrewes [2022] UKSC 24 (A, cited in 05). Civil Service: applicants confirm their information is true, and the department may reject applications where AI is used inappropriately (B).
- **Fix**: One line under the gaps panel: "Employers can withdraw offers for CV inaccuracies, and in the UK it can be fraud. Everything here traces back to your own CV."

### 30. Reframe guards rely on the model's judgement of `onlyIf`, which the doc admits is synthesis
- **Severity**: P2 · **Type**: unsupported
- **Where**: `docs/research/tailor-playbooks-tech-product.md:98`; `…finance-consulting.md:242` ("Evaluate them with the tailor-eval fixtures before trusting them")
- **Evidence**: No `tailor-eval` fixtures exist in `tests/tailor/` (checked: diff, playbooks, rules-gained, run, tailorCV, view).
- **Fix**: Create `tests/tailor/reframe-guards.test.ts` with one pass and one block fixture per reframe (8 × 8 = 64 pairs), driven by the `REFRAME_GUARDS` table from #9.

---

## New rules / signals to add

All are deterministic, run in `verifyTailoring` on every unit (summary included) unless stated, and use `cited` = the cited source bullets (summary: units sharing ≥2 content stems). Test cases use the probe CV above.

| id | Text (student-facing reason) | Severity | Fail anchor | Pass anchor | Source |
|---|---|---|---|---|---|
| `summaryCreated` | "Your CV has no profile, so we don't write one for you." | block | source.summary null, tailored non-null | both null | TARGETjobs/LSE (in TF4/TF30); Takano 2026 |
| `roleTypeEscalation` | "Your CV lists this as a Spring Insight, not an internship." | block | "former Goldman Sachs summer analyst" from Spring Insight | "Spring Insight Programme at Goldman Sachs" | ASU/Forage; Civil Service AI guidance |
| `modalityDrop` (qualifier groups simulated/projection/proposal/predicted) | "Your original says this was estimated/simulated: keep that." | block | "Managed a £5k portfolio" from "paper trading portfolio … simulated fund" | "Managed a £5k paper portfolio in the society's simulated fund" | FRANK PredE; 05 F9 |
| `outcomeEscalation` | "Your CV says finalist, not winner." | block | "Won the UCL trading challenge" from "Shortlisted as finalist" | "UCL trading challenge finalist" | HEDD survey (C); FRANK |
| `audienceEscalation` | "Your original says the society committee, not senior management." | block | "Presented findings to clients" from "…to the society committee" | "Presented findings to the committee" | FRANK EntE; consulting playbook `onlyIf` |
| `adoptionClaim` | "Your original doesn't say this was adopted." | block | "…recommendations, which were adopted" (absent in source) | adoption word in cited text | Consulting reframe guard |
| `frequencyEscalation` | "Your CV says monthly." | block (warn if made vaguer) | monthly → weekly/daily | "each month" | prompt line 93 |
| `proficiencyEscalation` | "Your CV says conversational Spanish." | block | "fluent Spanish", "advanced Python" from none/basic | same level reworded ("working knowledge" ↔ "intermediate") | IMC (A); eFC (C) |
| `gradeClaim` | "Your grade is predicted 2:2: we keep it exactly as written." | block | "First-class", "2:1", "with a 2:2" (from predicted), "A*A*A" | "predicted 2:2" | HEDD (C); Prospects (B) |
| `durationClaim` | "Your dates add up to 3 months, not 2 years." | block | "2 years of customer service experience" | "summer customer service role" | Kristal et al. 2023 (A) |
| `causalInsertion` | "Your original lists these separately; it doesn't say one caused the other." | block on merged, warn on single | "events that grew membership 20%" | "Organised society events; membership grew 20% this year" | Chiang & Lee 2024; FRANK LinkE |
| `evaluativeAdverb` | "'Accurately' is a new claim." | warn | "accurately forecast" | "forecast" | FRANK; LSE avoid adjectives |
| `reframeGuard` (table from playbooks) | "'A/B test' needs a control or two variants with a measured result in your original." | block | "A/B test" from "compared two posters" | source mentions variants + rate | playbook pitfalls (D), guarded |
| `keywordRepetition` | "This keyword now appears 4 times; once or twice reads better." | warn | JD term >2× overall or >1× in summary, above source count | source count unchanged | QMUL 2026; TARGETjobs TP25 |
| `employerAiPolicy` (pre-run, not gate) | "Bain asks applicants to use AI only for spelling and grammar." | modal: reorder-only default | company in policy list or JD regex | unknown policy | Bain FAQ (A); Anthropic (A); ISE 2025 |
| `strictMode` (pipeline) | n/a | DRIFT_K=2, drift blocks | archetype distance high or local model | same-archetype CV | Takano F13; Indukuri |

Additional families for `tool-families.ts`: `general-language`, `systems-language`, `js-language`, `analytics`, `email`, `accounting-standard`, `valuation-method` (see #18). Additional vocab aliases: "a/b test", "ab test", "comparable company analysis", "comps"; a languages list.

## Rules to delete or downgrade

- **Delete** reframes whose `to` is a vocab skill the gate always blocks: consulting/finance "client-facing", product "stakeholder management", product "gathered user feedback through interviews" (User Research alias). Either delete them or convert them to a pre-tailor confirm step (#9).
- **Delete** the Bain line from consulting `pitfalls` (`playbook-data.json:789`). Policy belongs in the pre-run notice (#13), not in a prompt the model can't act on.
- **Downgrade** "Distribute the top posting keywords … across the summary, the first bullet of each entry and the Skills list" (`prompts.ts:94`) to "use the posting's term once where the CV already shows it" (#16–17).
- **Delete** the target-role and number clauses from all `summaryFormula`s (#10).
- **Delete or wire up** `competencyThemes` / `sectionOrder` (#23).
- **Upgrade** (warn → block): `newAchievement` when the cited text contains a lower outcome rung, `currencySwap`, `inflationQualifier`, and `structuralLoss` beyond 1 per entry.
- **Downgrade** the test pin `SYSTEM_TAILOR toMatch(/never the safe default/)` in `tests/tailor/playbooks.test.ts` (#11).

## Open questions

- **Web search budget**: the shared web-search budget ran out mid-audit. I could not run fresh searches on:
  - the ICO "AI tools in recruitment" audit outcomes (Nov 2024);
  - HireVue's 2025 explainability statement body;
  - Bright Network / Gradcracker employer AI policies;
  - Big 4 UK AI-in-application pages;
  - the full ISE 2025 report PDF (the URL now 404s).

  These should be checked in a follow-up.
- Oxford Careers' 15% figure and Gartner's 39% / 26% figures were read from search excerpts. Both pages returned 403 on direct fetch.
- The McKinsey careers page timed out. Its "refine, not embellish" policy is from Fortune (Jan 2026) reporting only.
- I could not verify the full text of HiredScore's post-August-2026 grading rules, or whether the campus/graduate exclusion still applies after the LLM change. The ES concept page states it, but the EN concept URL now 404s.
- Eightfold publishes no scoring formula. The FCRA case status is unknown.
- I did not find a peer-reviewed field study showing recruiters penalise AI-written CVs. A registered AEA trial (Qiu & Wang) is pending. The strongest causal evidence (Wiles et al. 2025) shows writing *assistance* raised hires 8%, so "AI-sounding" penalties remain practitioner claims (C).
- `extractSkills("Presented a stock pitch to the committee")` returning only `Communication` looks like an extractor bug outside my scope. It needs a separate check of the soft-skill pass in `lib/skills/extract.ts`.

## Sources

| # | Source | Publisher / date | Grade | Used for |
|---|---|---|---|---|
| 1 | https://arxiv.org/abs/2608.26171 | Takano, arXiv v2 16 Sep 2026 | B (A- for method) | 96.7% / 50% / 54.5% fabrication and review rates |
| 2 | https://arxiv.org/abs/2607.01457 | Indukuri & Agrawal, arXiv 1 Jul 2026 | B | taxonomy; low-temp capable-model finding |
| 3 | https://arxiv.org/abs/2509.25054 | Cui, Dias & Ye, arXiv v2 12 Nov 2025 | B | alignment–callback correlation fell 51% |
| 4 | https://arxiv.org/abs/2511.08785 | Galdin & Silbert, arXiv 11 Nov 2025 | B | tailoring premium disappears; 19% / 14% |
| 5 | https://www.nber.org/papers/w30886 | Wiles, Munyikwa & Horton, NBER / Mgmt Sci | A | writing assistance +8% hires |
| 6 | https://arxiv.org/abs/2509.00462 | Xu, Li & Jiang, arXiv v4 Jun 2026 (AIES/EAAMO) | B | LLM self-preference 67–82% |
| 7 | https://arxiv.org/abs/2402.05629 | Chiang & Lee, ACL Findings 2024 | A | merged true facts → false claims |
| 8 | https://arxiv.org/abs/2104.13346 + ar5iv | Pagnoni et al., NAACL 2021 (FRANK) | A | error typology (PredE/EntE/CircE/LinkE/OutE) |
| 9 | https://arxiv.org/abs/2005.00661 | Maynez et al., ACL 2020 | A | hallucination in all model summaries |
| 10 | https://arxiv.org/pdf/1910.12840 | Kryściński et al., EMNLP 2020 (FactCC) | A | entity/number/negation swap test generation (via search summary) |
| 11 | https://arxiv.org/abs/2305.16739 | Zha et al., ACL 2023 (AlignScore) | A | small local entailment checker |
| 12 | https://arxiv.org/abs/2111.09525 | Laban et al., TACL (SummaC) | A | sentence-level NLI consistency |
| 13 | https://arxiv.org/abs/2404.10774 | Tang, Laban & Durrett, EMNLP 2024 (MiniCheck) | A | cheap verifier (cited in 05) |
| 14 | https://doc.workday.com/hiredscore/en-us/workday-hiredscore/recruiter-productivity-/reference--candidate-grades.html | Workday docs | A | A–D grade definitions |
| 15 | https://doc.workday.com/hiredscore/es-es/workday-hiredscore/productividad-de-reclutador-/concept--hiredscore-grades.html | Workday docs | A | no grades for campus/graduate reqs |
| 16 | https://doc.workday.com/hiredscore/en-us/workday-hiredscore/hiredscore-release-notes/2026/august/wednesday--5th-august.html.html | Workday release notes, Aug 2026 | A | per-qualification LLM grading |
| 17 | https://support.greenhouse.io/hc/en-us/articles/41131616864283-Talent-Matching-Data-Processing-FAQ | Greenhouse support | A | embeddings; no auto-advance/reject |
| 18 | https://my.greenhouse.com/blogs/how-does-greenhouse-use-ai-heres-everything-candidates-need-to-know | Greenhouse, 8 Jan 2025 | A | "never uses AI to rate candidates or auto-reject" |
| 19 | https://docs.oracle.com/en/cloud/saas/taleo-enterprise/23a/otrcg/c-acecandidatealert.html | Oracle docs | A | ACE = Required + Asset answers |
| 20 | https://docs.oracle.com/en/cloud/saas/taleo-enterprise/20b/otrec/candidate-prescreening.html | Oracle docs (via search) | A | prescreening = disqualification Qs, competencies |
| 21 | https://groups.community.sap.com/t5/human-capital-management-blogs-by-sap/1h-2024-release-highlights-leveraging-ai-within-sap-successfactors/ba-p/13680058 | SAP Community, 2024 (via search) | B | skills compatibility score |
| 22 | https://finance.yahoo.com/news/ai-company-eightfold-sued-helping-181520309.html | Reuters via Yahoo, Jan 2026 (via search) | C | Eightfold 0–5 Match Score allegation |
| 23 | https://www.bain.com/careers/recruiting/london-recruiting/ | Bain & Company, live 2026-10-18 | A | AI only for grammar/spelling in CV |
| 24 | https://www.anthropic.com/candidate-ai-guidance | Anthropic | A | draft yourself; no generated answers |
| 25 | https://ise.org.uk/knowledge/insights/498/5_trends_you_need_to_know_from_ises_recruitment_survey_2025/ | ISE, Claire Tyler, 22 Oct 2025 | A | 49% OK with AI, 10% banned, 79% redesign/review, 140 apps/vacancy |
| 26 | https://ise.org.uk/knowledge/insights/416/employers_concerned_student_use_of_ai_misrepresents_skills/ | ISE Student Development Survey 2025 (via search) | A | 48% worry AI misrepresents graduates |
| 27 | https://www.prospects.ac.uk/prospects-press-office/a-tenth-of-graduates-change-careers-due-to-ai | Prospects Luminate, May 2025 | A | 43% edit / 35% write CV with AI |
| 28 | https://www.ox.ac.uk/careers/careers-guidance/job-search-and-applications/use-of-ai-in-job-applications-and-assessments | Oxford Careers, 2025 (via search; 403) | B | 15% of recruiters allow AI |
| 29 | https://www.publictechnology.net/2025/10/31/education-and-skills/what-new-civil-service-guidance-on-ai-for-job-applicants-tells-us-about-shifts-in-recruitment/ | PublicTechnology, 31 Oct 2025 | B | Civil Service AI rules |
| 30 | https://www.qmul.ac.uk/sef/news/2026/items/getting-your-application-right-what-uk-employers-expect.html | QMUL SEF, 8 Sep 2026 | B | "language of the job description naturally"; some employers ban AI |
| 31 | https://sheffield.ac.uk/careers/support/apply/applications/tracking-systems | University of Sheffield Careers | B | keyword advice |
| 32 | https://jobhelp.campaign.gov.uk/improve-your-chances-of-getting-a-job/cv-job-apps-interviews/make-your-cv-stand-out/getting-through-application-filters-applicant-tracking-systems | GOV.UK jobhelp (via search) | B | ATS keyword scan claim |
| 33 | https://studentemployment.asu.edu/students/applying-and-interviewing/resume-tips-and-examples/add-forage-your-resume | Arizona State University | B | Forage is not employment |
| 34 | https://www.frontiersin.org/journals/sociology/articles/10.3389/fsoc.2024.1222850/full | Törngren et al., Frontiers in Sociology 2024 | A (non-UK) | 14 s dwell; no dwell–rating link |
| 35 | https://pmc.ncbi.nlm.nih.gov/articles/PMC7614241 | Kristal et al., Nature Human Behaviour 2023 (cited in 05) | A | years-worked framing +8–15% callbacks |
| 36 | https://hrreview.co.uk/?p=36576 and THE coverage | HEDD-linked surveys 2012–14 (via search) | C (old) | grade inflation most common CV lie |
| 37 | https://fortune.com/2026/01/14/how-to-get-hired-at-mckinsey-ai-tools-liberal-arts-creativity | Fortune, Jan 2026 (via search) | C | McKinsey: refine, no embellishment |
| 38 | https://www.gartner.com/en/newsroom/press-releases/2025-07-31-gartner-survey-shows-just-26-percent-of-job-applicants-trust-ai-will-fairly-evaluate-them | Gartner, 31 Jul 2025 (via search; 403) | B | 39% of candidates use AI; 26% trust AI |
| 39 | https://www.socialscienceregistry.org/trials/13527 | AEA RCT registry, Qiu & Wang (pending) | — | no published penalty study yet |
