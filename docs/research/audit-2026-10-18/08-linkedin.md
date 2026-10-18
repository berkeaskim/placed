# LinkedIn playbook + LinkedIn Score audit

**Overall grade: C+.** The research behind it is careful and unusually honest. It traces myths, has a clear fairness stance (photo, network and activity carry weight 0), and grades its own evidence. Most of its platform claims still hold in October 2026 when checked against LinkedIn's own pages.
The shipped scorer falls short of that research in four places:
1. **False criticals.** Some CV-date mismatches it flags as critical are false, and it lets an LLM decide two critical integrity rules on D-grade evidence without having to quote any text. Both trigger the "capped at 59 / could actively cost you an offer" path.
2. **Year and sector context never reaches the LLM.** Year and sector thresholds are never sent to the LLM judge, so about half the rules ignore the year adjustments the playbook designed.
3. **Inputs disagree.** The PDF, public-URL and extension inputs see different data, so the same profile gets different verdicts on skills, grades and dates.
4. **Terms-of-service risk.** Two of the three inputs (the spoofed-UA URL fetch and the DOM-reading extension) sit squarely inside what LinkedIn's User Agreement §8.2 prohibits, while the sanctioned "Download your data" archive is not used at all.

There are also direct contradictions with the CV rules on CFA wording and on grade disclosure.

## Scorecard

| Dimension | Grade | One-line reason |
|---|---|---|
| Evidence quality | B | Myth table and grading are rigorous. Some inferences go beyond what the source supports (UK 8% skills-only figure; Roulin "length" read as validity). One myth verdict (Open to Work "2x") is now out of date. |
| Freshness | B- | Core mechanics verified live (PDF limits, Open to Work tiers, 100 skills, All-star 7 sections, Hiring Assistant GA). The "pinned top 3 skills" model and the headline/About limits are unverified or stale. The playbook header still says "nothing wired into lib/". |
| Coverage | C+ | No input from LinkedIn's official data archive. Nothing on international students' right-to-work signalling, no CV↔LinkedIn URL check, no employment-type use. Fixture gate (5 real exports) not met: only a synthetic fixture exists. |
| Implementation fidelity | D+ | False-positive criticals in the cross-check. LLM gets no year/sector params. The playbook's own "Good" headlines fail LI-GEN-08. Grade regex passes on "expected". The location rule contradicts its own statement. Projects captured by the extension fail the date rule. |
| Consistency (doc↔code, LI↔CV) | C- | CFA wording contradicts CV rule FIN-11. Grade disclosure contradicts CV rule G-32. The first-person LinkedIn rules sit beside the CV's no-"I" rule with no explanation. DATA-07 says "reachable" but the code only checks presence. |
| UX / copy | C | Good framing ("rarely decides on its own"). Overclaims: "Mismatches are what recruiters notice", "could actively cost you an offer" on D-grade LLM verdicts, and "N need a screenshot" when no screenshot path exists. |

## Findings

### 1. The CV↔LinkedIn date cross-check raises false *critical* fails on ordinary promotions and split roles
- **Severity**: P0 · **Type**: implementation
- **Where**: `lib/linkedin-score/cross-check.ts:56-65`; override in `lib/linkedin-score/score.ts:85-90`; cap `lib/linkedin-score/aggregate.ts:77`
- **Current**: a LinkedIn role is a contradiction unless some CV entry at the same organisation has its start within 1 month and the same Present/ended status (`if ((ce === null) !== (e.end === null)) return false;`).
- **Problem**: very often the CV merges roles and LinkedIn splits them. Example: CV "Pret A Manger, Barista → Team Leader, Jun 2023 – Present"; LinkedIn has "Team Member Jun 2023 – Dec 2023" and "Team Leader Jan 2024 – Present". Both LinkedIn roles fail. The first fails on Present-vs-ended, the second because its start is 7 months from the CV start. The deterministic hit overwrites the LLM verdict for LI-GEN-01 (critical, B). That caps the score at 59 and puts the item in "Fix these first … could actively cost you an offer". The same happens when a society role is shown as one CV line ("2023–2025") but as two terms on LinkedIn.
- **Evidence**: LinkedIn's own UI groups several roles under one company. The extension parser documents this ("grouped" shape, `lib/linkedin/parse-capture.ts:14`), so split roles are normal data, not contradictions.
- **Fix**: treat a LinkedIn role as consistent if its interval lies **within** the union of the CV intervals for that organisation, ±1 month:
  - Compute `cvSpan = [min(cv starts), max(cv ends | Present)]`.
  - Pass if `liStart >= cvSpanStart-1` and (`liEnd <= cvSpanEnd+1`, or both are Present).
  - Flag only when (a) a LinkedIn start is more than 1 month before the earliest CV start, or (b) the CV says ended but LinkedIn says Present (or the reverse) for the **latest** role at that organisation.
  - Downgrade a deterministic date hit to **major** unless two or more organisations mismatch. Never let one date mismatch alone trigger the 59 cap.
  - Add tests for promotion, two-term society role, and CV "Summer 2025" vs LinkedIn "Jun–Aug 2025".

### 2. Two critical integrity rules are pure LLM judgements on D/C evidence, can fail with no quote, and still trigger the 59 cap
- **Severity**: P0 · **Type**: implementation / fairness
- **Where**: `lib/linkedin-rules/rules.json:2182` (LI-GEN-03, critical, evidence D, `llm`); `:4758` (LI-FINANCE_BANKING-06, critical, C); the prompt allows "only a 'fail' about something absent may use null" (`lib/ai/prompts.ts:60`); `mapVerdicts` accepts null-evidence fails (`lib/ai/judgeCvRules.ts:92`); the cap ignores evidence grade (`aggregate.ts:77`).
- **Current**: LI-GEN-03 asks whether the text discloses a "non-public client or deal name, internal figures or data…". The model cannot know what is non-public. "Analysed sales data for Tesco's Clubcard team" is a plausible false fail, and so is any named client.
- **Evidence**: the playbook itself grades LI-GEN-03 "D" (synthesis). Its own §9 row 3 says "one … false positive … must not cap a … score". The ICO says decisions based on online information alone are "unlikely to be fair and lawful" (A: ICO draft guidance, https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/recruitment-and-selection/pre-employment-vetting-of-candidates/). This is guidance for employers, but it shows how much weight automated judgements of this kind should carry.
- **Fix**:
  1. In `mapVerdicts` for LinkedIn, any **critical** rule fail with `evidence_line == null` → `could_not_assess`.
  2. Apply the 59 cap only when the critical fail is deterministic, or is an LLM fail with a verified quote **and** evidence ≥ C.
  3. Rewrite the LI-GEN-03 question so it is decidable: "Does any line state (a) a salary/offer amount, (b) an online-assessment or interview question, (c) revenue, P&L or deal value attributed to an employer or client, or (d) text the student labels internal/confidential? Naming an employer or client alone is NOT a fail."
  4. For FIN-06, see finding 14.

### 3. Year- and sector-specific thresholds are silently dropped for every LLM-judged rule (≈50% of scored rules)
- **Severity**: P1 · **Type**: implementation
- **Where**: `lib/ai/judgeLinkedIn.ts:43-46` (the prompt sends only `llmGuidance`/statement/examples); `lib/linkedin-score/score.ts:861-867` (no year/sector in the judge input).
- **Current**: 17–22 rules per sector go to the LLM. Their `yearAdjust.threshold` and `sectorParams` never reach the prompt. Examples:
  - LI-CONSULTING-03 "1st: threshold 1" (`rules.json:4108`)
  - LI-FINANCE_BANKING-08 "1st: threshold 60 words"
  - LI-PRODUCT-05 "1st: threshold 1"
  - sector About length ranges
  
  Severity changes still apply in the aggregator, but threshold changes don't.
- **Evidence**: the code itself (e.g. `liEffectiveSeverity` is used, while `threshold()` exists only in `checkers.ts`).
- **Fix**: in `buildLiJudgePrompt`, add a header `STUDENT: year=<year>; target sector=<sector>`. Render each rule's effective params inline, e.g. `- [LI-CONSULTING-03] … (threshold for this student: 1 evidence point)`. Resolve `yearAdjust[year].threshold ?? params.threshold` before rendering. Add a unit test asserting that the rendered prompt contains the 1st-year threshold.

### 4. Three inputs, three different scores for the same profile
- **Severity**: P1 · **Type**: implementation / UX
- **Where**: PDF parser `lib/linkedin/parse-export.ts:262` (topSkills = sidebar Top Skills, ~3); capture `lib/linkedin/parse-capture.ts:164` (topSkills = the full skills list, up to 150); public URL (skills hidden → n/a).
- **Current**: rules that mean "pinned top 3" read `topSkills` and so behave differently by input:
  - LI-SOFTWARE_ENG-06 reads `slice(0,3)` (checkers.ts:113).
  - LI-DATA_ANALYTICS-03 (`:139`) passes if SQL is anywhere in a 50-skill captured list, but only if it is in the 3 sidebar skills in the PDF.
  - LI-QUANT_TRADING-08 (`:186`) fails on "Excel" anywhere in the captured list, but only if Excel is in the PDF Top 3.

  Education differs too: capture carries "Grade: First" in `details` (parse-capture.ts:17), while the PDF very likely does not (see open question 1). So FIN-11, SWE-11 and PRODUCT-13 flip. Projects are merged into experience only on capture (finding 7). The panel never says which input produced the score. `meta.source` is stored but not rendered.
- **Fix**:
  - Add `skillsScope: "top" | "all"` to `ParsedLinkedIn`. Make "top-3" rules read `li.pinnedSkills`, which is the PDF Top Skills, or for capture the first 3 of `/details/skills` **only if** LinkedIn's order is confirmed to reflect pinning. Otherwise `not_applicable`.
  - Make "anywhere in skills" rules read `allSkills`.
  - Show "Scored from: PDF export / your logged-in profile / public page" on the panel.
  - Never compare scores across sources in history.

### 5. The playbook's own "Good" headline examples fail the keyword-stuffing rule
- **Severity**: P1 · **Type**: implementation / contradiction
- **Where**: `lib/linkedin-score/checkers.ts:40-47` (LI-GEN-08 counts `[|·•/]`, fails above 3); examples in `docs/research/linkedin/00-playbook.md:271-272, 362`.
- **Current**: "Maths & Stats @ UCL (2nd yr) | Aspiring Data Analyst | SQL · Python (pandas) · Power BI | Seeking 2027 summer internship" has 3 pipes and 2 middots, so 5 separators and a fail. "CS @ Imperial '27 | Product + data | Shipped a Chrome extension (1.2k weekly users) · SQL · A/B testing | Product Manager Intern 2027" has 6 separators: 3 pipes, 2 middots, and the "/" in "A/B". "Maths/CS" alone uses up a separator.
- **Evidence**: inconsistent with the playbook's own guidance. The rule's evidence is D.
- **Fix**: count only **segment** separators (`|`, `•`, and ` / ` with spaces). Treat `·` inside a segment as a list delimiter. Fail at more than 4 segments (5+ pipes) **or** when any 3+-letter non-stopword appears 3+ times. Add the 8 sector "Good" headlines from §5 as passing fixtures in `tests/linkedin`.

### 6. LI-GEN-10 fails international students, contradicting its own statement and §8.6
- **Severity**: P1 · **Type**: fairness / implementation
- **Where**: `checkers.ts:59-63`; statement `rules.json:2385`; playbook §8.6.
- **Current**: the statement says "it is never a fail for them to list a home city if they are not targeting the UK". The code fails any non-UK location (the fix text says "If you aren't, ignore this"). Only masters students get severity minor. An undergraduate from Lagos or Mumbai who is targeting home loses major points.
- **Evidence**: Equality Act 2010 indirect discrimination risk (nationality/national origin correlates with location). This is the playbook's own fairness decision §8.6.
- **Fix**: if the location is non-UK, return `not_applicable` with `detail:"non-UK location"` and show a tip. Fail only on **blank** location. If onboarding later captures "target country", fail when location ≠ target country.

### 7. Extension-captured projects fail the date rule and distort experience rules
- **Severity**: P1 · **Type**: implementation
- **Where**: `lib/linkedin/parse-capture.ts:147-153` (projects pushed into `experience` as `Project: …` with `company:""`); `checkers.ts:78-81` (LI-GEN-15 fails if `!e.start?.month`).
- **Current**: an undated project, or a single-date project ("Jan 2024", where `range()` returns null), gets `start:null`. LI-GEN-15 then says "Use month and year for both dates on 'Project: …'". That is a major findability fail for content LinkedIn does not require dates on. Projects also enter LI-GEN-14 ("every Experience entry …") and the LLM's experience rules.
- **Fix**: add `projects: LiProject[]` to `ParsedLinkedIn`. Keep projects out of `experience`. LI-GEN-15 iterates `experience` only. Project-aware rules (SWE-04, PRODUCT-03, RESEARCH-07, LI-GEN-17) read `projects`.

### 8. The grade regex passes on "expected", "average" and "predicted" without any grade
- **Severity**: P1 · **Type**: implementation
- **Where**: `checkers.ts:22` (`GRADE_RE` includes `predicted|expected|average`), used by FIN-11 (`:248`), SWE-11 and PRODUCT-13.
- **Current**: "Expected graduation: June 2027" or "Average module size 30" counts as a stated grade.
- **Fix**: `/\b(First(?:[- ]class)?(?: Honours)?|2:1|2\.1|Upper Second|2:2|Lower Second|Distinction|Merit|GPA\s*[0-4]\.\d|\d{2}(?:\.\d)?\s?%|(?:predicted|expected|on track for)\s+(?:a\s+)?(?:First|2:1|2\.1|Distinction|Merit))\b/i`.

### 9. LI-FINANCE_BANKING-11 forces grade disclosure, contradicting CV rule G-32
- **Severity**: P1 · **Type**: contradiction / fairness
- **Where**: `rules.json:4867` ("Grades stated in Education … for at least the current degree", major, A); CV `lib/cv-rules/rules/general.ts:256-258` (G-32: "State your grade if it's a 2:1 or above … a higher grade earns no extra credit").
- **Current**: a finance student on a 2:2, or a 1st-year without results, fails a major LinkedIn rule unless they post the grade publicly. The CV engine says to state it only if 2:1+.
- **Evidence**: TARGETjobs' LinkedIn guide (B, 11 Aug 2026, https://targetjobs.co.uk/careers-advice/finding-a-job/graduates-guide-creating-perfect-linkedin-profile) does not require grades on LinkedIn. The playbook's own §9 row 19 says grade norms differ and "a missing grade is never a fail" for quant.
- **Fix**: restate as "If your grade (or predicted grade) is 2:1 or above, state it in Education". Absence → `not_applicable`, never fail. The same wording goes for SWE-11, CONSULTING-15 and DATA-11. Also make it fixture-gated (open question 1).

### 10. CFA wording: the LinkedIn rule is right, but CV rule FIN-11 teaches the forbidden form
- **Severity**: P1 · **Type**: contradiction
- **Where**: CV `lib/cv-rules/rules/finance.ts:183-187` (statement "Passing CFA Level I is a plus"; passExample "CFA Level I — passed Aug 2025"); LinkedIn LI-FINANCE_BANKING-04 (`checkers.ts` CFA regex).
- **Evidence**: CFA Institute (A, https://www.cfainstitute.org/about/governance/policies/trademark-usage-guide-for-cfa-charterholders, fetched 2026-10-18). Approved forms are "CFA Program candidate" (only if registered for an upcoming exam or awaiting results) and "Passed Level I of the CFA Program". The page gives "not Jane Doe, CFA Level I" as an example of what not to write. It answers "Can I call myself a 'CFA candidate'?" with "No. Use CFA Program candidate."
- **Fix**: change the FIN-11 passExample to "Passed Level I of the CFA Program (Aug 2025)" and the statement to "Passing Level I of the CFA Program is a plus …". Add the LI-FINANCE_BANKING-04 regex as a code check on the CV too. The LinkedIn fix copy should add "(only while registered for an upcoming exam or awaiting results)" after 'CFA Program candidate'.

### 11. Data and URL inputs use automated access that LinkedIn's User Agreement prohibits; the sanctioned archive goes unused
- **Severity**: P1 · **Type**: missing / copy (legal risk to the user's account)
- **Where**:
  - `lib/linkedin/fetch-public.ts:33-43` (server fetch with a spoofed desktop-Chrome User-Agent, plus one retry)
  - `extension/linkedin.js:1-10, 79-88, 141` (reads the logged-in DOM, auto-scrolls, clicks "…more", navigates to `/details/skills/`)
  - `extension/README.md:56-62`
- **Evidence**:
  - LinkedIn User Agreement §8.2 (A, effective 3 Nov 2025, https://www.linkedin.com/legal/user-agreement) bars members from using software "(such as crawlers, browser plugins and add-ons or any other technology) to scrape or copy the Services … including profiles". It has no own-profile exception.
  - Enforcement is real. hiQ v LinkedIn ended in Nov–Dec 2022 with summary judgment that scraping breached the User Agreement, then a stipulated judgment and injunction (B, https://www.privacyworld.blog/2022/12/linkedins-data-scraping-battle-with-hiq-labs-ends-with-proposed-judgment/). Proxycurl was sued in Jan 2025 and shut down in July 2025 (B, Social Media Today, https://www.socialmediatoday.com/news/linkedin-wins-legal-case-data-scrapers-proxycurl/756101/).
  - Meanwhile LinkedIn's own "Download your data" archive (A, https://www.linkedin.com/help/linkedin/answer/a1339364) delivers Profile, Positions, Education and Skills "within minutes", desktop only.
- **Fix**:
  1. Make the **data archive** (`Profile.csv`, `Positions.csv`, `Education.csv`, `Skills.csv`) the recommended input. It is first-party, has the full skills list, needs no scraping, and works for non-English profiles too, which the PDF does not.
  2. Keep the PDF as the second option.
  3. Keep the extension behind an explicit consent screen: "This reads your own LinkedIn page in your browser. LinkedIn's User Agreement restricts browser add-ons that copy profile data; using it is your choice." Default the extension path off.
  4. Remove the spoofed UA from the URL path or drop the path. A local-first app making requests that pose as Chrome from the user's IP puts the user's account at risk.

### 12. "Pinned top 3 skills" advice may be impossible to follow on today's LinkedIn
- **Severity**: P1 · **Type**: stale / unsupported
- **Where**: playbook §5.2 "Pin SQL, Python and a BI tool, since the PDF shows ~3"; rules SWE-06, DATA-03, FIN-12, CONSULTING-09, MARKETING-09, PRODUCT-10.
- **Evidence**:
  - LinkedIn Help (A, https://www.linkedin.com/help/linkedin/answer/a549047) says "You can add up to 100 skills" and does not mention pinning.
  - LinkedIn Help 35265 (A, snippet only) describes **Reorder** via More > Reorder, not pinning.
  - Since Aug 2023 members can "tag up to five of your top skills" in the About section (B, Social Media Today, 9 Aug 2023, https://www.socialmediatoday.com/news/linkedin-adds-new-ways-for-job-seekers-highlight-key-skills-and-competencies/690461/).
  - It is unverified which of these the PDF's "Top Skills" sidebar reflects.
- **Fix**: change fix copy to "Add SQL to the **Top skills** in your About section (up to 5), and reorder your Skills list so it comes first". Until real exports confirm the source of the PDF sidebar, give the "top-3" rules severity minor and evidence D.

### 13. The "UK recruiters filter on degree/school/location" inference overreaches the cited data
- **Severity**: P2 · **Type**: unsupported
- **Where**: `00-playbook.md:74` ("Degree, school, location and title fields still drive UK searches"); M20.
- **Evidence**: LinkedIn *Skills Signal* 2025 (B, https://economicgraph.linkedin.com/content/dam/me/business/en-us/talent-solutions/resources/pdfs/the-skills-signal-report-2025.pdf, text extracted 2026-10-18) says the UK shows "a lower proportion of searches that filter exclusively by skills" (8%). That is skills-**only** searches. It says nothing about which other filters dominate, and skills may still appear in combined searches. The OECD companion work reports that skills criteria are the most common search criterion (B, snippet only; oecd.org returned 403).
- **Fix**: replace the line with: "Only 8% of UK recruiter searches filter *solely* by skills (LinkedIn, 2025), so skills alone rarely find you. Pair skills with a clear title, education and location." Downgrade any rule citing it for "education drives search" to evidence C.

### 14. The finfluencer rule is critical on C evidence and conflates student boasting with FCA financial promotions
- **Severity**: P2 · **Type**: wrong severity
- **Where**: `rules.json:4758` (LI-FINANCE_BANKING-06, critical, C; sources [S55] FCA FG24/1, [S135] eFinancialCareers).
- **Evidence**: FG24/1 covers communicating financial promotions. A student writing "made 40% on my ISA" is poor judgement, not a regulated promotion unless it invites investment. eFinancialCareers (B/C, 5 Mar 2026, https://www.efinancialcareers.com/news/bankers-influencers-consulting) reports Goldman "discouraging analysts from making day-in-the-life content". That is a culture signal, not a hiring rule.
- **Fix**: severity **major** (risk card, no cap). Keep the cap only for affiliate or referral links, "DM for signals", or paid-group promotion. Those are plausibly promotions and can be detected with a regex: `/(t\.me\/|discord\.gg\/|referral|affiliate|signals?\b|DM me for)/i`.

### 15. Hybrid-rule guidance tells the LLM that "code" already ran checks that do not exist
- **Severity**: P2 · **Type**: implementation
- **Where**: LI-GEN-01, -02, -14, -21 and -22 `llmGuidance` (e.g. "Code fuzzy-matches organisations and diffs dates first…", "Spell-check with a UK dictionary plus a proper-noun allowlist…"); `checkers.ts:304-313` only runs `code` rules; `types.ts` comment "hybrid rules are judged by the LLM".
- **Current**: LI-GEN-22's guidance is not a yes/no question at all. Pre-filters described in the JSON (GEN-02 "duration under 3 weeks", GEN-14 "<15 words", GEN-21 cliché lexicon) are not implemented.
- **Fix**: either implement the pre-filters as code checks whose findings go into the prompt ("Code found: entry 'Analyst, Barclays' lasted 5 days"), or strip "Code …" sentences before prompting. Rewrite LI-GEN-22 as: "Are there 3 or more clear spelling or grammar errors (not names, tools, or US/UK variants) in the headline, About and Experience? (yes = fail)". Remove "UK English" from its statement, since the prompt correctly accepts both spellings.

### 16. LI-QUANT_TRADING-03 competition detector matches "step" and "mat", and counts any year as a rank
- **Severity**: P2 · **Type**: implementation
- **Where**: `checkers.ts:165-174`
- **Current**: `comp` includes `MAT|STEP` case-insensitively, so "my first step into trading" becomes a competition line. That line then fails with "add the rank" (false positive, major). The `ranked` regex accepts `\b\d{3,4}\b`, so "Kaggle competition 2025" passes as ranked (false negative).
- **Fix**: match `\b(STEP|MAT)\b` case-sensitively and only near "paper|exam|grade|S\d". Remove the bare year from `ranked`. Use `/(top \d+%|\b\d+(st|nd|rd|th)\b|\brank(ed)? \d+|medal|gold|silver|bronze|distinction|merit|honourable mention|finalist|winner|rating \d{3,4}|\b(Expert|Specialist|Candidate Master|Master)\b)/i`.

### 17. LI-GEN-11 fails customised slugs that end in a year
- **Severity**: P2 · **Type**: implementation
- **Where**: `checkers.ts:65-70` (`/\d{4,}$/`)
- **Current**: `linkedin.com/in/jane-doe-2003` or `aisha-khan-2027` fails as "default URL". A pure-hex regex also hits rare letter-only surnames such as "-abbade".
- **Fix**: fail only on `/-[0-9a-z]{6,12}$/i` where the suffix contains **both** a digit and a letter (LinkedIn's default pattern, e.g. `-1a2b3c4d`), or on a numeric suffix of 6+ digits. Pass 4-digit years.

### 18. LI-DATA_ANALYTICS-04 accepts "R&D" as R, and the portfolio checks accept the word "portfolio"
- **Severity**: P2 · **Type**: implementation
- **Where**: `checkers.ts:146-151` (`\b(Python|R)\b` passes on "R&D"); `:109-111` and `:153-156` (the `portfolio` word in About passes SWE-01 and DATA-07: "I manage a portfolio of society events").
- **Fix**: R must appear in a skills list item equal to "R", or as `\bR\b(?![&-])` next to "programming|Studio|tidyverse|ggplot". Portfolio checks should match URLs only (`https?:\/\/\S+|[\w-]+\.(github\.io|vercel\.app|netlify\.app|dev)\b`), not the bare word.

### 19. DATA-07 says "reachable", but no reachability check exists
- **Severity**: P2 · **Type**: doc↔code drift
- **Where**: `rules.json:3513` vs `checkers.ts:153`.
- **Fix**: rename to "Portfolio link present". Reachability needs a network call, so add an opt-in, user-triggered HEAD check only on the student's own links (and not at all for LinkedIn URLs).

### 20. "N need a screenshot" copy points to an input that does not exist, and code rules with no checker are counted nowhere
- **Severity**: P2 · **Type**: copy / implementation
- **Where**: `components/linkedin-score-panel.tsx:130`; `checkers.ts:310` (`not checkable from the PDF export` has no `input:` prefix, so `aggregate.ts:58` does not count it); CONSULTING-09, PRODUCT-10 and MARKETING-09 have no checker.
- **Fix**: say "N checks need sections the export doesn't include" until a screenshot or paste input ships. Give code rules with no checker `detail: "input:unimplemented"` so they show in the coverage meter. Better, implement the three skills-count checks on capture/archive input, which carries the full list.

### 21. Overclaiming copy
- **Severity**: P2 · **Type**: copy
- **Where**: `linkedin-score-panel.tsx:127` ("Mismatches are what recruiters notice."), `:83` ("These could actively cost you an offer if a recruiter compares…").
- **Evidence**: the playbook's own §10.1–10.3 found "No public UK data on how often graduate recruiters look at students' LinkedIn". The ISE 2026 survey commentary (B, Wonkhe, 14 Oct 2026, https://wonkhe.com/wonk-corner/a-slightly-better-outlook-for-graduate-jobs) describes screening on "the CV, the cover note, any written exercises" and does not mention LinkedIn.
- **Fix**: "Upload your CV too and we'll check both say the same thing. If an interviewer looks you up, a mismatch is hard to explain." And for the risk card: "Worth fixing first: if someone compares your profile with your application, these are the things that would raise questions."

### 22. Open to Work myth verdict M4 is out of date ("2x has no source")
- **Severity**: P2 · **Type**: stale
- **Where**: `00-playbook.md:493`.
- **Evidence**: CNBC via NBC New York (B, 23 Jan 2025, https://nbcnewyork.com/news/business/money-report/on-linkedin-220-million-people-are-open-to-work-recruiters-weigh-in-if-the-feature-helps-or-hurts-job-seekers/6119784). LinkedIn said the feature "doubles someone's chances of getting a recruiter to message them" and that more than 220 million members have it on. Fortune (B, 5 Sep 2024, https://fortune.com/2024/09/05/linkedin-opentowork-badge-recruiters-job-search/) has the 40% InMail figure. It does **not** contain the "20% more messages" figure the playbook attributes to it. Its only quoted sceptic is James Caan, which is thin support for "UK recruiters disagree".
- **Fix**: M4 becomes: "LinkedIn says Open to Work doubles recruiter messages (2025) and the public frame adds ~40% more InMails (2020/2024). These are LinkedIn's own correlational figures and say nothing about hiring outcomes." Drop "20%". Keep LI-GEN-25 advisory.

### 23. The endorsements myth (M16) misreads Imperial and ignores LinkedIn's own claim
- **Severity**: P3 · **Type**: wrong
- **Where**: `00-playbook.md:505`.
- **Evidence**: Imperial (B, https://www.imperial.ac.uk/admin-services/careers/applications-and-interviews/linkedin/) says "Recommendations … can increase your ranking in search results". That is recommendations, not endorsements. LinkedIn Help (A, https://www.linkedin.com/help/linkedin/answer/a554351) itself says endorsements can make you "more discoverable for related opportunities".
- **Fix**: "LinkedIn says endorsements can aid discoverability (no data). Raters give them negligible weight (Roulin & Levashina). Not scored, for fairness and because they are network-dependent."

### 24. The Roulin & Levashina finding is used one-sidedly
- **Severity**: P2 · **Type**: unsupported
- **Where**: `00-playbook.md:22, 98` ("Content depth is what raters read reliably [S46]").
- **Evidence**: the Kent State summary (A-via-summary, 10 Jan 2019, https://www.kent.edu/business/news/kent-state-researcher-studies-linkedin-employee-selection-tool) says hiring recommendations "are influenced by the job applicant's LinkedIn profile length, photo and number of connections". Length is in the same bias-influence list as photo and connections, not shown as valid. The paper supports inferring *visible* skills (leadership, communication, planning) and cognitive ability. The sample is 133 North American senior business students. The DOI 10.1111/peps.12296 and the reference Personnel Psychology 72(2):187-211 are confirmed.
- **Fix**: reword as "Raters can reliably infer visible skills such as leadership and communication from profile content, but length, photo and connections also sway them (Roulin & Levashina 2019, North American sample)." Make sure no rule rewards raw length beyond the About floor. The sector upper bounds already do this.

### 25. The first-person LinkedIn rules sit beside the CV's no-"I" rule with no explanation
- **Severity**: P2 · **Type**: contradiction (UX)
- **Where**: `rules.json:3195` (LI-SOFTWARE_ENG-08 "in first person"), LI-CONSULTING-05 ("personal contribution ('I')"), LI-FINANCE_BANKING-08/10; CV G-24 `general.ts:192` (no "I"/"my" in bullets).
- **Current**: a student who pastes CV bullets into LinkedIn, which TARGETjobs treats as fine, risks failing first-person checks. Meanwhile the CV engine penalises "I".
- **Evidence**: no source among S1–S166 says LinkedIn experience *must* be first person. TARGETjobs' guide asks for context and achievements, not pronoun style.
- **Fix**: judge "personal contribution is clear" (own action stated), not grammatical person. Remove "in first person" from SWE-08, FIN-10 and CONSULTING-05. Add a UI note: "On LinkedIn 'I' is fine; on your CV, drop it."

### 26. Virtual work experience is labelled differently across engines
- **Severity**: P3 · **Type**: contradiction
- **Where**: CV `finance.ts:133` counts "a virtual internship" as commitment; LinkedIn LI-GEN-02 (critical) fails a virtual simulation that carries an Intern/Analyst title.
- **Fix**: use one vocabulary everywhere: "virtual work experience / job simulation (Forage)". In CV guidance, write "virtual work experience (e.g. Forage job simulation)" and never "virtual internship".

### 27. Hiring Assistant and AI search: the claims are verified, but marked "not verified"
- **Severity**: P3 · **Type**: stale
- **Where**: `01-platform-mechanics.md:98, 310`; playbook §2.3.
- **Evidence**:
  - LinkedIn Newsroom (B, 3 Sep 2025, https://news.linkedin.com/2025/hiring-assistant-globally-available): "globally available in English by the end of September".
  - Wave 2 2025 (B, https://business.linkedin.com/hire/product-update/wave2-2025): AI-Assisted Search matches on skills "not explicitly listed on resumes".
  - LinkedIn engineers' *Semantic Search at LinkedIn* (B, arXiv 2602.07309, Feb 2026, https://arxiv.org/html/2602.07309v1): "Semantic search retrieves and ranks results by meaning rather than token overlap". People search uses "summarized profiles" plus network features (network size, connection distance).
- **Fix**: mark as verified and add the arXiv source. Add one honest line: "LinkedIn's member people-search also ranks on network features, so connections help findability. Placed still doesn't score them, for fairness." This stops the panel implying that connections don't matter.

### 28. Headline/About limits remain trade-sourced, and UK pages quoted are stale
- **Severity**: P3 · **Type**: stale/unverified
- **Where**: `00-playbook.md:71`; marketing §5.7 ("Imperial suggests under 120 characters").
- **Evidence**: no LinkedIn Help page found for 220/2,600. Trade sources: AuthoredUp (C, https://authoredup.com/blog/linkedin-character-limit) says 220, display ~60–70; NapoleonCat (C) says 220 desktop / 240 mobile. Imperial (B) still says "You have 120 characters" and "up to 50 skills". LinkedIn Help says 100 skills (A).
- **Fix**: keep "don't hard-code". Drop the Imperial 120-character advice from the marketing headline formula, or label it "older guidance". Note that LinkedIn now allows 100 skills.

### 29. Playbook header says nothing is wired, and the fixture gate was bypassed
- **Severity**: P2 · **Type**: doc drift / process
- **Where**: `00-playbook.md:3` ("Nothing here is wired into `lib/` yet"); §2.2.8 (≥5 real exports before shipping `pdfContested` rules); `scripts/make-linkedin-fixture.mjs:2-4` (only a SYNTHETIC fixture).
- **Current**: two `pdfContested` rules are LLM-judged from the PDF anyway: LI-SOFTWARE_ENG-04 (altInput pdf_export) and LI-RESEARCH-07 (hybrid). With Projects possibly absent from the export, they can fail.
- **Fix**: update the header to "Wired into lib/linkedin-score (v0.1.0-draft)". In `isJudged`, exclude `pdfContested` rules when `source === "pdf"` until real fixtures exist, and add the 5 real redacted exports.

### 30. LI-GEN-23 placeholder regex flags legitimate "TBC"
- **Severity**: P3 · **Type**: implementation
- **Where**: `checkers.ts` PLACEHOLDER_RE `\b(TBD|TBC)\b`.
- **Current**: "Start date TBC" on an accepted offer, or "Incoming Analyst (team TBC)", fails a major polish rule.
- **Fix**: fail TBD/TBC only when it is the whole field value, or inside square brackets.

### 31. The location regex misses common UK places when "United Kingdom" is absent (capture/public input)
- **Severity**: P3 · **Type**: implementation
- **Where**: `checkers.ts` UK_PLACE_RE.
- **Current**: the PDF usually includes "United Kingdom". Capture and public input may show "Greater Reading Area", "Hatfield, England", "Stoke-on-Trent" or "Swansea", and some of these miss.
- **Fix**: also match `\b(England|Scotland|Wales|Northern Ireland|Area)\b` with a UK county/city list, or use LinkedIn's "…, United Kingdom" suffix where present. Combined with finding 6, non-match → n/a, not fail.

### 32. The sector importance labels rest on opinion only
- **Severity**: P3 · **Type**: unsupported
- **Where**: `lib/linkedin-rules/index.ts:41-50` (marketing "high").
- **Evidence**: the playbook admits that the marketing careers pages give "no data".
- **Fix**: add "(careers-service view)" to the high/low label tooltips.

## New rules / signals to add

1. **LI-GEN-30: CV links to this profile.** If the CV on file has a `linkedin.com/in/<slug>`, it must equal `li.profileUrl` (case-insensitive slug). Integrity, code, minor, evidence B.
   - Pass: CV `linkedin.com/in/aisha-khan` with profile `/in/aisha-khan`.
   - Fail: CV slug `aisha-khan-1a2b3c` with profile `aisha-khan`. Fix: "Update the link on your CV".
   - Sources: CV rule general.ts:281 (links live and correct); LinkedIn Help 87 (custom URL).
2. **LI-GEN-31: Employment type is honest** (capture/archive input). An Experience whose LinkedIn employment type is "Internship" lasting under 3 weeks, or whose title contains "Spring|Insight|Virtual|Job Simulation", must not carry "Analyst/Associate/Trader/Engineer" without the programme word. Integrity, code pre-filter feeding LI-GEN-02, major, evidence A.
   - Pass: "Spring Insight Programme, Barclays".
   - Fail: "Investment Banking Analyst, Barclays · Internship · 1 week".
   - Source: LinkedIn Professional Community Policies (A, https://www.linkedin.com/legal/professional-community-policies): "Do not post misleading or deceptive information about yourself … work experience".
3. **LI-INPUT-01: archive parser.** Parse `Profile.csv` (headline, summary, location), `Positions.csv`, `Education.csv` (school, degree, dates, notes, activities) and `Skills.csv` into `ParsedLinkedIn`, with `skillsScope:"all"`. Source: LinkedIn Help a1339364 (A). The CSV schema is community-documented (C, TomeVault); confirm with a real archive.
4. **LI-INTL-01 (advisory tip, international students).** "Your location and work-authorisation are your call. Many UK students on a Student or Graduate visa leave work-authorisation off LinkedIn and answer it on application forms." Advisory, weight 0. Gap: the playbook has no international-student guidance beyond location. Verify the Graduate route wording against GOV.UK before publishing; it was not fetched here.
5. **LI-GEN-32: About "Top skills" set** (capture/archive). The About section's tagged top skills (up to 5) include at least 2 target-relevant skills. Findability, minor, B (Social Media Today 2023). This replaces "pin your top 3".

## Rules to delete or downgrade

- **LI-FINANCE_BANKING-06**: critical → major (finding 14).
- **LI-GEN-03**: keep it critical only once the question is rewritten and a quote is required (finding 2). Until then, major.
- **LI-FINANCE_BANKING-11**: delete the "must state" form and merge into a generic "state grade if 2:1+" rule (finding 9).
- **SWE-06, DATA-03, FIN-12, QUANT-08** in "pinned top 3" form: minor, D, until the source of the PDF sidebar is confirmed (finding 12).
- **LI-GEN-08** separator threshold: loosen (finding 5).
- **LI-SOFTWARE_ENG-14, -13 and LI-PRODUCT-15** (D, no source): these opinions are low-value. Make them minor advisory.
- **"in first person"** clauses in SWE-08, CONSULTING-05 and FIN-08/10: delete (finding 25).
- **LI-GEN-15**'s "month and year required": keep for experience, remove for projects (finding 7).

## Open questions (could not verify)

1. **What does the Save-to-PDF export include from Education** (Grade, Activities, Description), and does it include Projects, Volunteering and the full skills list? LinkedIn Help a541960 (A) "doesn't say which profile sections the PDF contains". Secondary sources disagree. This decides 7 contested rules plus all grade rules. Needs 5 real redacted exports.
2. **Where the PDF "Top Skills" sidebar comes from**: About-section top skills, reorder order, or endorsement count.
3. Whether LinkedIn's default URL suffix is always hex-like (finding 17).
4. **Headline and About character limits on LinkedIn Help** were not found (trade only).
5. Whether "Creator mode retired March 2024" still matches LinkedIn Help. The web-search budget ran out before re-verifying, so this rests on the researchers' trade sources [S33].
6. **The OECD skills-first chapter** returned 403. Its "skills criteria most common" claim is snippet-only.
7. **No UK survey (ISE, Cibyl, Bright Network 2025/26) quantifies how often student LinkedIn profiles are looked at.** ISE 2026 coverage does not mention LinkedIn.
8. **LinkedIn's position on members reading their own profile with an extension**: the User Agreement text has no carve-out. We don't know whether LinkedIn enforces against it.
9. **Bright Network's LinkedIn guide** returned 403 again.

## Sources

Graded per the brief: A = official, regulator or peer-reviewed; B = large-sample, established outlet or careers service; C = practitioner or vendor. All fetched on 2026-10-18 unless noted.

1. CFA Institute, Trademark usage guide (A). https://www.cfainstitute.org/about/governance/policies/trademark-usage-guide-for-cfa-charterholders
2. LinkedIn User Agreement §8.2, effective 3 Nov 2025 (A). https://www.linkedin.com/legal/user-agreement
3. LinkedIn Help, Save a profile as a PDF, a541960 (A). https://www.linkedin.com/help/linkedin/answer/a541960
4. LinkedIn Help, Download your account data, a1339364 (A). https://www.linkedin.com/help/linkedin/answer/a1339364
5. LinkedIn Help, Open to Work, a507508 (A). https://www.linkedin.com/help/linkedin/answer/a507508
6. LinkedIn Help, Profile level meter, 391 (A). https://www.linkedin.com/help/learning/answer/391
7. LinkedIn Help, Add and remove skills, a549047 (A). https://www.linkedin.com/help/linkedin/answer/a549047
8. LinkedIn Help, Skills display order, 35265 (A; search snippet only). https://www.linkedin.com/help/linkedin/answer/35265
9. LinkedIn Help, Verifications, 140551 (A for mechanics; the 60% claim is B). https://www.linkedin.com/help/linkedin/answer/140551
10. LinkedIn Help, Create a good profile, a554351 (A/B). https://www.linkedin.com/help/linkedin/answer/a554351
11. LinkedIn Professional Community Policies (A). https://www.linkedin.com/legal/professional-community-policies
12. LinkedIn Talent Solutions, 2025 Hiring Release Wave 2 (B). https://business.linkedin.com/hire/product-update/wave2-2025
13. LinkedIn Newsroom, Hiring Assistant globally available, 3 Sep 2025 (B). https://news.linkedin.com/2025/hiring-assistant-globally-available
14. LinkedIn engineers, *Semantic Search at LinkedIn*, arXiv 2602.07309, Feb 2026 (B). https://arxiv.org/html/2602.07309v1
15. LinkedIn Economic Graph, *The Skills Signal* 2025 (B). https://economicgraph.linkedin.com/content/dam/me/business/en-us/talent-solutions/resources/pdfs/the-skills-signal-report-2025.pdf
16. OECD, Skills signalling in OECD countries (B; 403, snippet only). https://www.oecd.org/en/publications/empowering-the-workforce-in-the-context-of-a-skills-first-approach_345b6528-en/full-report/skills-signalling-in-oecd-countries_158ea858.html
17. Kent State University, summary of Roulin & Levashina 2019, Personnel Psychology 72(2):187-211 (A via summary). https://www.kent.edu/business/news/kent-state-researcher-studies-linkedin-employee-selection-tool
18. ICO, Pre-employment vetting of candidates, draft (A). https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/recruitment-and-selection/pre-employment-vetting-of-candidates/
19. Wonkhe on ISE Student Recruitment Survey 2026, 14 Oct 2026 (B). https://wonkhe.com/wonk-corner/a-slightly-better-outlook-for-graduate-jobs
20. TARGETjobs, Graduate's guide to the perfect LinkedIn profile, 11 Aug 2026 (B). https://targetjobs.co.uk/careers-advice/finding-a-job/graduates-guide-creating-perfect-linkedin-profile
21. Imperial College Careers, LinkedIn (B). https://www.imperial.ac.uk/admin-services/careers/applications-and-interviews/linkedin/
22. CNBC via NBC New York, Open to Work, 23 Jan 2025 (B). https://nbcnewyork.com/news/business/money-report/on-linkedin-220-million-people-are-open-to-work-recruiters-weigh-in-if-the-feature-helps-or-hurts-job-seekers/6119784
23. Fortune, #OpenToWork badge, 5 Sep 2024 (B). https://fortune.com/2024/09/05/linkedin-opentowork-badge-recruiters-job-search/
24. eFinancialCareers, banks vs influencers, 5 Mar 2026 (B/C). https://www.efinancialcareers.com/news/bankers-influencers-consulting
25. IMC Trading, Recruitment process (A). https://www.imc.com/ap/careers/recruitment-process
26. IMC Trading, Prosperity 4 (A; undated, © 2025). https://www.imc.com/eu/corporate-news/prosperity-4
27. Privacy World, hiQ v LinkedIn judgment, Dec 2022 (B). https://www.privacyworld.blog/2022/12/linkedins-data-scraping-battle-with-hiq-labs-ends-with-proposed-judgment/
28. ZwillGen, hiQ v LinkedIn wrapped up (B). https://www.zwillgen.com/alternative-data/hiq-v-linkedin-wrapped-up-web-scraping-lessons-learned/
29. Social Media Today, LinkedIn wins case against Proxycurl, 2025 (B). https://www.socialmediatoday.com/news/linkedin-wins-legal-case-data-scrapers-proxycurl/756101/
30. Social Media Today, Top skills in About, 9 Aug 2023 (B). https://www.socialmediatoday.com/news/linkedin-adds-new-ways-for-job-seekers-highlight-key-skills-and-competencies/690461/
31. AuthoredUp, LinkedIn character limits (C). https://authoredup.com/blog/linkedin-character-limit
32. NapoleonCat, LinkedIn character count (C). https://napoleoncat.com/dictionary/linkedin-character-count/
33. TomeVault, LinkedIn archive CSV schema (C; community documentation). https://tomevault.io/tome/henriquesantanati/linkedin-profile-score
34. Internal code and rules read for this audit:
    - `lib/linkedin-score/*`, `lib/linkedin-rules/*`, `lib/linkedin/*`
    - `lib/ai/judgeLinkedIn.ts`, `lib/ai/prompts.ts`
    - `components/linkedin-score-panel.tsx`
    - `extension/linkedin.js`
    - `lib/cv-rules/rules/{general,finance}.ts`
