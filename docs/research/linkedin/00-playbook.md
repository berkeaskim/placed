# LinkedIn Scoring Playbook (master)

Compiled 2026-10-14 by the editor, from ten research files in this folder (`01-platform-mechanics.md`, `02-recruiter-evidence.md`, `03-software-eng.md` … `10-research.md`). Machine-readable rules: `linkedin-rules.json` (same folder). Research input for Placed's LinkedIn scorer. Not recruiting advice. Wired into `lib/linkedin-score` (rules v0.1.0-draft). Revised 2026-10-18 after the playbook audit (`docs/research/audit-2026-10-18/08-linkedin.md`): see the notes marked *Audit 2026-10-18*.

---

## 0. How to read this

- **Rule IDs.** Generic rules are `LI-GEN-01` … `LI-GEN-29`. They are **renumbered**: the old `LI-GEN-xx` IDs from file 01 and the `LI-REC-xx` IDs from file 02 are merged and deduplicated, and §4.2 maps old to new. Sector rules keep the researchers' IDs (`LI-SOFTWARE_ENG-xx` etc.). Sector rules that duplicated a generic rule were folded into it (§12), so their numbers are missing from the sector tables on purpose.
- **Check** `code` / `llm` / `hybrid`. Every `llm` rule in the JSON has one yes/no question plus a pass and a fail example, as `CvRule` requires.
- **Input** `pdf_export` (LinkedIn "Save to PDF"), `screenshot`, `self_report`. The JSON has one primary `input` and an `altInputs` list.
- **Severity** `critical` / `major` / `minor`. **Critical is used only for integrity failures** (contradiction with the CV, misrepresentation, confidential or promotional content). That is an editorial decision, explained in §9.
- **Evidence** `A`–`D` as in the CV research: A = employer guidance or consistent across several top-tier UK sources; B = one top-tier source; C = practitioner, trade press or vendor survey; D = synthesis. Where a researcher gave a mixed grade ("B/D"), the JSON uses the **lower** letter, because the CV aggregator multiplies weight by evidence (A 1, B 0.85, C 0.6, D 0.4). `evidenceNote` keeps the original grades, so no grade information is lost.
- **Sources** `[Sn]` refer to the deduplicated list in §13. Each entry lists the researcher-local tags it replaces (e.g. TARGETjobs' LinkedIn guide was `[S1]`, `[L1]`, `[S6]`, `[L13]`, `[P7]`, `[L10]`, `[S2]` in seven files; here it is `[S62]`).

---

## 1. Executive summary

1. **LinkedIn is a secondary signal for UK student hiring.** No UK employer, and no ISE material, says LinkedIn is scored in graduate or intern selection [S54]. Schemes run on forms, CVs, tests and interviews. Every sector researcher found the same: employer careers pages for SWE [S81][S80], data [S90][S91], quant [S94][S96], consulting [S110][S111][S114], product [S119], banking [S130][S131][S132], marketing [S152] and research labs [S163][S165] do not mention LinkedIn. The only verified employer touchpoint is that Unilever's marketing scheme form can be filled from your LinkedIn profile [S151].
2. **So the score means "how you come across when someone looks you up or searches", not employability.** LinkedIn is used in two ways. In *sourcing*, a recruiter searches for people who fit a spec; this rewards findability [S62][S63]. In *screening*, someone looks you up after you apply; this rewards CV consistency and no red flags [S64][S53]. The UK regulator says employers should justify such checks and not decide on online information alone [S53]. Placed should frame the score as "don't undermine your application", and never set it beside the CV score as an equal.
3. **The best peer-reviewed evidence says raters can reliably infer visible skills such as leadership and communication from profile content, but profile length, photo and connection count also sway them, and skills lists and endorsements barely do** (Roulin & Levashina 2019, 133 North American senior business students) [S46]. Photo and connection effects are evidence of rater bias, not validity [S47][S21]. So Placed scores **content** (headline, About, experience, education, consistency) and gives photo, connections, endorsements, Open to Work and activity **weight 0**.
4. **How much LinkedIn matters differs by sector**, and the UI should say so with a sector banner:

| Archetype | LinkedIn importance | Main use | Researcher's banner copy (shortened) |
|---|---|---|---|
| software_eng | Medium | Second look after the CV; sourcing by scale-ups/agencies; alumni referrals | CV, coding test and GitHub decide most outcomes; make projects easy to find. |
| data_analytics | Medium | Sourcing by skill; portfolio hub (GitHub/Tableau/Kaggle); networking | Big schemes test skills directly; LinkedIn routes a reader to your portfolio in one click. |
| quant_trading | **Low** | Clean public record that matches the CV; discretion | Firms hire through their own applications, tests and competitions. Fix criticals, then go compete. |
| consulting | Medium | Networking with alumni and consultants; firm research | Firms hire through online applications and tests; LinkedIn matters when you message people. |
| product | Medium | Being found; referrals; showing shipped work in Featured | Screens run on CV + transcript; LinkedIn shows what you built. |
| finance_banking | Medium (networking), low (screening) | Networking, credibility check; posting is a risk | LinkedIn will not get you a spring week. Your application will. |
| marketing_growth | **High** (agencies, startups), medium-high (FMCG) | Networking and portfolio; the profile is itself a writing sample | Your profile is a sample of how you market yourself. |
| research | Medium-low | Networking with supervisors and think tanks; look-ups | Your application, research statement and references carry far more weight. |

5. **The Save to PDF export is the backbone input.** It is free, needs no scraping and carries most of the scored content. It omits photo, banner, Featured, activity, connections and endorsements, and its coverage of skills, projects, volunteering and recommendations is contested [S1][S38][S39][S40]. Placed must build **at least 5 real export fixtures** before shipping any rule that reads a contested section (`pdfContested: true`, 7 rules).
6. **The biggest unique win is the CV cross-check.** Placed already holds the parsed CV, so `LI-GEN-01` (consistency, critical) is cheap and catches the failure recruiters and interviewers actually notice.
7. **Popular LinkedIn statistics are mostly untraceable** (21x photo views, 40x All-Star, 17x skills, "95% of UK recruiters"). Never print a multiplier in the UI (§7).

**Rule counts:** 142 canonical rules = 29 generic + 113 sector (SWE 15, data 15, quant 14, consulting 13, product 16, finance 11, marketing 14, research 15). 13 are advisory (weight 0); 5 are critical. The ten researchers wrote 180 rules; after merging, 26 sector rules (or rule parts) were folded into generic rules and 2 became scorer guards (§12).

---

## 2. Input strategy

### 2.1 What each input can see

LinkedIn's help page confirms that Save to PDF exists, is desktop-only and English-only, and is capped at 200 downloads a month including your own. It does **not** list which sections are included [S1]. Secondary sources disagree [S38][S39][S40]. All ten researchers agree on the "in" and "out" rows; the "contested" row is where they disagree.

| Section | In the PDF? | Placed decision |
|---|---|---|
| Name, headline, location, Contact block (profile URL, websites added to Contact info), About/Summary, Experience (titles, employers, dates, descriptions), Education | **In** (all sources agree) | Scored from the PDF. |
| Top Skills (~3 in the sidebar), Languages, Certifications, Honors-Awards, Publications | **Mostly in** | Scored from the PDF; verify with fixtures. |
| Full skills list, Projects, Volunteering, Courses, Recommendations | **Contested** (one source says up to 50 skills and projects in; others say only Top Skills, recommendations out) | Rules marked `pdfContested`; fall back to screenshot or pasted text until fixtures settle it. |
| Photo, banner, Featured, Activity/posts, connections/followers, endorsements, Open to Work, verification badge, download date | **Out** | Screenshot or self-report only. |

### 2.2 Decisions

1. **PDF first.** After `replacedBy` is applied, 27-32 of the 28-33 scored rules per archetype have `pdf_export` as their primary input (§3.6). A student who uploads only the PDF gets a real score.
2. **One optional screenshot: Featured.** Photo, banner and the top card are not scored (§8), so the only screenshot that changes the score is Featured, plus Activity for marketing. Ask for "a screenshot of your Featured section, or paste the links". Projects and Recommendations can also come by screenshot until the fixtures confirm whether the PDF has them.
3. **Self-report splits in two.** *Pasted content* (a portfolio URL, a pasted skills list, pasted posts) is verifiable and can be scored. *Yes/no claims* ("I have a recommendation", "Open to Work is on", "I have 140 connections") are advisory only, because answering "no" must never cost points and because the claims cannot be checked (`claimsAreAdvisory` guard).
4. **Missing input = `not_applicable`, never `fail`.** The aggregator drops it from the denominator and renormalises (§3.1). The UI shows a coverage meter: "Checked from PDF: 27 · Needs a screenshot: 1 · Unlock with your CV: 2".
5. **Input gates** (from 01 §7): confirm the PDF is a LinkedIn export (sidebar "Contact" with a `linkedin.com/in/` URL, "Top Skills", "Page x of y" footer), or tell the student it looks like a CV and offer the CV scorer. Non-English profiles cannot be exported, so offer a paste path and never penalise them. The PDF has no download date [S40], so ask when it was downloaded and warn if it is more than 30 days old.
6. **Privacy.** The export carries contact details. Store only the parsed fields Placed needs, never the email or phone, and redact in logs (same as the CV pipeline).
7. **Anti-gaming.** The PDF carries the public profile URL, which discourages scoring a polished fake. Pasted-only profiles are labelled "unverified input" [02 §5].
8. **Fixtures first.** Export at least 5 real profiles (1st year to masters, including one with Projects, Volunteering and Recommendations, and one non-English) before shipping any `pdfContested` rule (`LI-GEN-13`, `LI-SOFTWARE_ENG-04`, `LI-DATA_ANALYTICS-06`, `LI-CONSULTING-09`, `LI-PRODUCT-10`, `LI-MARKETING_GROWTH-09`, `LI-RESEARCH-07`).

### 2.3 Verified platform mechanics worth knowing

- Up to 100 skills [S4]. Custom URL 3-100 characters, changeable 5 times in 6 months [S3]. Open to Work has three visibility levels; on recruiters-only LinkedIn says it "can't guarantee complete privacy" [S2]. Verification covers identity, workplace and education [S8]. The profile meter reaches All-star at 7 sections: photo, location, industry, education, position, skills, summary [S9]. Featured needs at least two items before you can reorder them [S7].
- Headline 220 / About 2,600 / Experience description 2,000 characters come from **trade sources only** [S31][S32]. UK careers pages still quote 120 (Imperial [S68], older guidance) or 200 (Edinburgh [S69]) for the headline; Imperial also still says "up to 50 skills", while LinkedIn Help now allows 100 [S4]. Rules read length off the export instead of hard-coding a limit, and score the first ~70 characters (what shows in search and invites).
- Creator mode was retired in March 2024, and the profile hashtag bar in February 2024 [S33]. Any tip that mentions either is stale.
- LinkedIn's 2025-26 AI-Assisted Search and Hiring Assistant match on qualifications "not explicitly listed" (semantic search) [S16][S17]. *Audit 2026-10-18:* verified. Hiring Assistant was announced as "globally available in English by the end of September" 2025 (LinkedIn Newsroom, 3 Sep 2025, https://news.linkedin.com/2025/hiring-assistant-globally-available), and LinkedIn engineers describe member people search as ranking "by meaning rather than token overlap" over summarised profiles plus network features such as connection distance (*Semantic Search at LinkedIn*, arXiv 2602.07309, Feb 2026). So connections do help findability; Placed still doesn't score them, for fairness. This favours specific, evidenced text in every section over keyword placement, which is why the rules grade specificity and penalise stuffing (`LI-GEN-08`).
- Only 8% of UK recruiter searches filter *solely* by skills (LinkedIn, 2025), among the lowest of any country measured [S19], so skills alone rarely find you. Pair skills with a clear title, education and location. (*Audit 2026-10-18:* the report doesn't say which other filters dominate; earlier wording that "degree, school, location and title drive UK searches" went beyond it.)

---

## 3. Scoring model

### 3.1 Mechanics (reuses the CV aggregator)

LinkedIn scoring should reuse `lib/cv-score/aggregate.ts`. Only the `Dimension` union and the weights change:

- Rule weight = severity (critical 3, major 2, minor 1) × evidence (A 1, B 0.85, C 0.6, D 0.4).
- Credit: pass 1, partial 0.5, fail 0. `not_applicable` and `could_not_assess` drop out. `yearAdjust.skip` drops the rule.
- Dimension score = weighted pass share. Total = sector-weighted mean over dimensions with at least one assessed rule, so renormalisation is automatic.
- Severity precedence: `yearAdjust` > `sectorAdjust` > base, as `effectiveSeverity()` already does.
- New in the JSON: `replacedBy` (drop a generic rule for a sector that has a sharper sector rule), `sectorParams`, `advisory`, `riskFlag`, `pdfContested`, `altInputs`, `evidenceNote`, `origin`.

### 3.2 Dimensions and base weights

I chose file 02's **outcome-based** dimensions over the section-based ones the sector files assumed (identity, headline, About, experience, skills, Featured, recommendations, activity, CV consistency). Outcome dimensions match the CV engine's style. They put fairness into the structure: presence gets weight 0. And they let one rule (e.g. "skills evidenced") count where it matters (proof), not where it sits on the page. Every sector file's weight table was mapped into these dimensions.

| Key | Label | Base weight | What it measures |
|---|---|---|---|
| `integrity` | Consistency & integrity | 25 | Matches the CV; no inflated titles; no confidential or promotional content; target coherent. The strongest UK evidence is about screening, and screening is mainly a consistency and red-flag check [S62][S64][S53]. |
| `proof` | Proof of work | 25 | Experience with own actions and outcomes; evidenced skills; projects, portfolio, competitions, research outputs. Raters can infer visible skills (leadership, communication) from content, though length, photo and connections also sway them [S46]; no rule rewards raw length beyond the About floor. |
| `findability` | Findability | 20 | Headline, location, education fields, skills fields, URL: what search and filters read [S15][S36]. |
| `narrative` | Narrative | 20 | About: present, specific, answer-first, no clichés. What a person reads on a look-up. |
| `polish` | Polish | 10 | Spelling, grammar, formatting, placeholder text, hype tone. |
| `presence` | Presence (advisory) | **0** | Photo, Open to Work, recommendations, network, activity risk, verification. Tips and risk flags only. |

### 3.3 Sector weights (one table)

| Archetype | integrity | proof | findability | narrative | polish | presence | Why (from the sector files) |
|---|---|---|---|---|---|---|---|
| **base** | 25 | 25 | 20 | 20 | 10 | 0 | 02 §7.2 |
| software_eng | 20 | **35** | 22 | 13 | 10 | 0 | Projects + Featured were raised to 22/100 in 03 §7 and About was cut; sourcing-heavy, so findability goes up (02 tilt). |
| data_analytics | 20 | **33** | 22 | 15 | 10 | 0 | Featured/portfolio 20 and skills 15 in 04 §6; skill search is the sourcing mechanism. |
| quant_trading | **32** | 33 | 10 | 15 | 10 | 0 | 05 §7: CV consistency + discretion 16 and Honors 22 were the two biggest gains; findability is low because these firms don't source on LinkedIn. |
| consulting | **30** | 28 | 12 | 18 | 12 | 0 | 06 §6: CV consistency/accuracy 20, Experience 30, skills −3; attention to detail lifts polish. |
| product | 20 | **35** | 20 | 15 | 10 | 0 | 07 §6: Featured 16 (+8) and Experience 27 (+2). |
| finance_banking | **33** | 27 | 12 | 16 | 12 | 0 | 08 §6: consistency/integrity 20 (+10), Experience 25; posting scored only as risk. |
| marketing_growth | 15 | 29 | 20 | **24** | 12 | 0 | 09 §6: About 15 (writing sample), Featured 12, CV consistency 8. Editor raised integrity from 8 to 15 because Unilever's form imports LinkedIn [S151]. |
| research | 25 | **32** | 13 | 20 | 10 | 0 | 10 §6 multipliers: research evidence ×1.5, Experience and Education ×1.3, About and consistency ×1.2, skills ×0.9. |

All weights are grade D (tunable defaults). Calibrate them on real profiles before trusting decimals.

### 3.4 Caps (gates)

| Cap | Value | Trigger | Source / resolution |
|---|---|---|---|
| Critical fail | **59** | Any critical rule fails after year/sector adjustment (`LI-GEN-01`, `-02`, `-03`, `LI-QUANT_TRADING-01`, `LI-FINANCE_BANKING-06`) | 02 proposed 59. 05 proposed 60 (discretion) and 70 (rank mismatch); 08 proposed 60. Unified at 59: one number, and below the "Nearly there" band. |
| Empty profile | **40** | penultimate/final/masters only: no About AND no Experience description of 15+ words AND headline matches `^Student at` | 02 §7.3. 1st/2nd years get a "starter profile" path instead. |

### 3.5 Year adjustments

| Year | Emphasis | What the rules do |
|---|---|---|
| `1st` | Build the basics: headline with degree + interest, education with modules, a short About, any society or part-time role with a line of description. | Most headline, About, experience and proof rules drop to minor. `LI-GEN-01` drops to major. Open to Work and recommendations skipped. Sector proof rules that need output (SWE Featured, research outputs, marketing Featured and certs) skipped. Empty-profile cap off. School-level competition results count fully (quant). |
| `2nd` (non-penultimate year of a 4-year course) | As 1st, but expect at least one described experience. | Headline (`LI-GEN-05`) and target coherence (`LI-GEN-04`) minor; recommendations skipped; research evidence and direction minor. |
| `penultimate` | Internship year: findability and proof matter, consistency critical. | Base severities. Product education becomes major (Google asks for the graduation month) [S119]. |
| `final` | Grad schemes and offers: consistency and red flags matter most. | Base severities, plus: data tutorial-only portfolio major; product adjacent-role keywords major; research evidence/education/direction major; marketing headline proof major; risk card shown prominently. Empty-profile cap on. |
| `masters` | Short time-to-hire; often international. | As final. Location minor (don't penalise international students); undergraduate entry expected; Google Data Analytics cert alone looks junior; product AI-fluency major for CS/analytics masters. |

### 3.6 Coverage after `replacedBy` (what each archetype actually runs)

| Archetype | Rules that apply | Scored | Advisory | Scored by input (pdf / screenshot / self_report) | Critical |
|---|---|---|---|---|---|
| software_eng | 38 | 32 | 6 | 30 / 1 / 1 | 3 |
| data_analytics | 38 | 32 | 6 | 31 / 1 / 0 | 3 |
| quant_trading | 38 | 31 | 7 | 31 / 0 / 0 | 3 |
| consulting | 34 | 28 | 6 | 27 / 1 / 0 | 3 |
| product | 39 | 33 | 6 | 32 / 1 / 0 | 3 |
| finance_banking | 34 | 28 | 6 | 27 / 1 / 0 | 4 |
| marketing_growth | 37 | 32 | 5 | 30 / 2 / 0 | 3 |
| research | 38 | 32 | 6 | 31 / 1 / 0 | 3 |

### 3.7 Output shape

- Overall 0-100 with a label (Ready / Nearly there / Needs work / Starter) and the sector banner from §1.
- **Top 3 fixes**, ordered by lost points (the existing `Fix` type). Each comes with a rewrite suggestion for the headline, About or one experience entry. The rewrite is grounded in facts from the user's CV and profile, and never invents numbers, titles or outcomes (`neverInventAchievements`).
- A separate, unscored **Presence tips** card (photo, Open to Work, recommendations, network), labelled "These don't affect your score".
- A **Risk** card for `riskFlag` findings (confidential info, OA questions, finfluencer posts), styled more strongly than ordinary fixes.
- A coverage meter and the evidence note: "Recruiters may look you up. LinkedIn rarely decides UK graduate applications on its own."

---

## 4. Generic rules (LI-GEN)

### 4.1 Rule table

Rules with a "Replaced in" note are dropped for those archetypes in favour of the sector rule named in the JSON `replacedBy` map. So `LI-GEN-05` (headline) and `LI-GEN-20` (About specific) only run when the user has no archetype yet. LLM questions, pass/fail examples, parameters and evidence notes are in the JSON.

| ID | Rule | Dim | Check | Input | Sev | Year adjust | Ev | Sources |
|---|---|---|---|---|---|---|---|---|
| LI-GEN-01 | Consistent with the CV Placed already holds: same employers, equivalent titles, dates within one month, same degree, grade, competition ranks and project metrics. LinkedIn may carry extra detail but must not contradict the CV. Not applicable when no CV is on file. | integrity | hybrid | pdf_export | critical | 1st: severity major | B | [S62], [S64], [S67], [S78], [S140], [S143], [S151], [S160] |
| LI-GEN-02 | No inflated or misleading Experience titles: each title fits the real format, duration and work. Spring weeks, insight days, one-day events and virtual simulations are labelled as such; a solo side project is not shown as employment or as 'CEO/Managing Director'. | integrity | hybrid | pdf_export | critical | — | A | [S14], [S98], [S101], [S132], [S143] |
| LI-GEN-03 | No confidential employer, client or deal information: no non-public client or deal names, internal figures, internal dashboards or customer data, offer or pay details, or assessment and case-interview content. The judge is asked a decidable question (pay/offer amounts, assessment questions, deal values, text labelled confidential); naming an employer or client alone is not a fail, a fail must quote the line, and a D-graded verdict never caps the score. | integrity | llm | pdf_export+screenshot | critical | — | D | [S55], [S103], [S135] |
| LI-GEN-04 | Profile and CV tell the same story about the target: if the CV targets sector X, the headline and About do not target an unrelated sector Y. LinkedIn may be broader than the CV. Not applicable when no CV is on file. | integrity | llm | pdf_export | major | 1st: severity minor; 2nd: severity minor | B | [S62] |
| LI-GEN-05 | Headline states what the student studies or targets plus at least one concrete differentiator (skill, experience, achievement); it is not just 'Student at X'. *Replaced in: software_eng, data_analytics, quant_trading, consulting, product, finance_banking, marketing_growth, research.* | findability | hybrid | pdf_export | major | 1st: severity minor; 2nd: severity minor | A | [S30], [S62], [S65], [S66] |
| LI-GEN-06 | Headline front-loads the key information: the first ~70 characters (what shows in search results, comments and invites) name the field or target role. Length is read from the export, not hard-coded (220 is reported by trade sources; UK careers pages still say 120 or 200). | findability | hybrid | pdf_export | major | — | C | [S31], [S32] |
| LI-GEN-07 | 'Seeking' language belongs in About or Open to Work, not as the whole headline: a headline that is only 'Seeking opportunities' / 'Aspiring X' / 'Open to work' fails. | findability | hybrid | pdf_export | minor | 1st: skip | B | [S66] |
| LI-GEN-08 | No keyword stuffing: the headline reads as a phrase a person wrote (at most 4 segments separated by | or •, no term repeated 3+ times; a middot list inside a segment is fine) and the skills list is not padded with unrelated terms. | findability | code | pdf_export | minor | — | D | [S46], [S62] |
| LI-GEN-09 | Education is complete: institution (ideally from LinkedIn's school list), degree and subject, start and expected graduation year. Graduation year is a recruiter filter. Masters students also list their undergraduate degree. | findability | code | pdf_export | major | 1st: severity minor | A | [S9], [S30], [S36], [S62], [S65] |
| LI-GEN-10 | Location is set to the UK city or region the student wants to work in (or studies in), not blank or a country they are not targeting. International students targeting the UK are told why; it is never a fail for them to list a home city if they are not targeting the UK (code: a non-UK location is not applicable; only a blank one fails). | findability | code | pdf_export | major | 1st: severity minor; masters: severity minor | A | [S9], [S15], [S36], [S62] |
| LI-GEN-11 | Custom public URL claimed (linkedin.com/in/firstname-lastname style), not the default random suffix, so it can go on the CV. | findability | code | pdf_export | minor | — | B | [S3], [S30], [S62] |
| LI-GEN-12 | Name field holds the student's name only: no emoji, job titles, 'Open to work', 'Student', 'Hiring' or 'Seeking'. Mononyms, initials and non-Western name orders always pass. | findability | code | pdf_export | minor | — | D | — |
| LI-GEN-13 | Skills section is populated: the ~3 Top Skills shown in the export are relevant to the target, and (when a screenshot or pasted list is given) at least 5 and no more than 50 skills are listed. *Replaced in: software_eng, data_analytics, quant_trading, consulting, product, finance_banking, marketing_growth, research.* *[fixture-gated]* | findability | hybrid | pdf_export+screenshot/self_report | major | 1st: severity minor | D | [S4], [S9], [S62] |
| LI-GEN-14 | Every Experience entry (including part-time, volunteering and society roles) has a description saying what the student personally did and at least one result or scope; no title-only entries. | proof | hybrid | pdf_export | major | 1st: severity minor | A | [S16], [S17], [S62], [S65] |
| LI-GEN-15 | Experience dates are complete and consistent: month and year for start and end; finished roles have end dates; no more than one 'Present' role that is actually over. Gaps are never penalised. | findability | code | pdf_export | major | — | C | [S36], [S37] |
| LI-GEN-16 | Listed skills are evidenced: each Top Skill (and any skill the user pastes) appears in use in at least one Experience, Education, Project or About description. At least 50% evidenced to pass. *Replaced in: software_eng, data_analytics, consulting, finance_banking, research.* | proof | hybrid | pdf_export | major | — | D | [S4], [S16], [S46] |
| LI-GEN-17 | At least one work sample is visible: a Featured item, Projects entry, or a link in Contact/About to a project, portfolio, write-up or competition result. *Replaced in: software_eng, data_analytics, quant_trading, product, marketing_growth, research.* | proof | hybrid | screenshot+pdf_export/self_report | minor | — | A | [S7], [S30] |
| LI-GEN-18 | About section is present and long enough to say something: at least ~400 characters (sector minimums below). Upper bounds are checked by sector rules. *Replaced in: consulting.* | narrative | code | pdf_export | major | 1st: severity minor | A | [S9], [S30], [S46], [S62], [S65] |
| LI-GEN-19 | About opening hook: the first ~250 characters (above 'see more') say who the student is, what they study and what they are aiming for. *Replaced in: consulting, product, finance_banking.* | narrative | llm | pdf_export | major | — | D | [S30], [S31] |
| LI-GEN-20 | About is specific: what the student studies, at least one concrete, checkable example (project, role, result, number) and a stated target. *Replaced in: software_eng, data_analytics, quant_trading, consulting, product, finance_banking, marketing_growth, research.* | narrative | hybrid | pdf_export | major | 1st: severity minor | A | [S30], [S46], [S62], [S65] |
| LI-GEN-21 | No cliché-saturated or generic AI-style text: at most 2 clichés (passionate, driven, results-oriented, dynamic, team player, synergy, leverage) without evidence nearby, and the About could not be pasted onto another student's profile unchanged. Placed grades specificity; it never tries to 'detect AI'. *Replaced in: consulting, marketing_growth.* | narrative | hybrid | pdf_export | major | 1st: severity minor | C | [S17], [S143] |
| LI-GEN-22 | Spelling and grammar are clean (UK English) across headline, About and Experience, with consistent date formats and title capitalisation. | polish | hybrid | pdf_export | major | — | A | [S65], [S117], [S143], [S146], [S152] |
| LI-GEN-23 | No placeholder or broken text: no 'Lorem', '[Company]', 'TBD', duplicated paragraphs, or text pasted with broken bullets or encoding. | polish | code | pdf_export | major | — | D | — |
| LI-GEN-24 | Advisory (weight 0): a recent photo of the student alone is on the profile. Placed never assesses the photo's appearance, dress, background or 'professionalism' and never runs face analysis. The only checks are the user's own answers ('Is it a recent photo of you?'). | presence | code | self_report | minor (advisory) | — | B | [S9], [S11], [S14], [S30], [S46], [S47], [S62], [S65] |
| LI-GEN-25 | Advisory (weight 0): when actively applying, Open to Work is set to 'Recruiters only' with target job titles (sector titles from the keyword bank), UK locations and start dates. The public #OpenToWork frame is the student's choice and is never scored. | presence | code | self_report+screenshot | minor (advisory) | 1st: skip | B | [S2], [S15], [S18], [S41] |
| LI-GEN-26 | Advisory (weight 0): at least one recommendation from a manager, supervisor, lecturer, society lead or client that names specific work. | presence | code | self_report+screenshot | minor (advisory) | 1st: skip; 2nd: skip | B | [S30], [S62], [S68], [S156] |
| LI-GEN-27 | Advisory risk check (weight 0): recent public posts, comments or photos contain nothing the student would be uncomfortable with an interviewer reading (abuse, discriminatory content, explicit images, confidential employer information). Political or religious views alone are not a fail. Posting nothing passes. *Replaced in: software_eng, data_analytics, consulting, product, finance_banking, marketing_growth, research.* | presence | llm | screenshot+self_report | minor (advisory) | final: severity major; masters: severity major | C | [S49], [S50], [S53], [S64] |
| LI-GEN-28 | Advisory (weight 0): a deliberate network of relevant connections (course mates, colleagues, society members, alumni at target employers; at least ~50, 20 for 1st years) and follows target firms. Coaching only; never ranked against peers. | presence | code | self_report+screenshot | minor (advisory) | 1st: threshold 20 | D | [S21], [S22], [S66], [S70], [S71], [S72], [S73], [S87], [S136] |
| LI-GEN-29 | Advisory (weight 0): a verification badge (identity via Persona passport, or education/workplace where offered). | presence | code | self_report+screenshot | minor (advisory) | — | B | [S8] |

### 4.2 Old ID → new ID

| New ID | Merged from |
|---|---|
| LI-GEN-01 | LI-GEN-21, LI-REC-01, LI-SOFTWARE_ENG-15, LI-CONSULTING-11, LI-FINANCE_BANKING-02, LI-QUANT_TRADING-11, LI-PRODUCT-15 (part a), LI-MARKETING_GROWTH-17, LI-RESEARCH-16 |
| LI-GEN-02 | LI-REC-04, LI-FINANCE_BANKING-03, LI-QUANT_TRADING-15 |
| LI-GEN-03 | LI-CONSULTING-14, LI-FINANCE_BANKING-05, LI-DATA_ANALYTICS-14 |
| LI-GEN-04 | LI-REC-15 |
| LI-GEN-05 | LI-GEN-04, LI-REC-03 |
| LI-GEN-06 | LI-GEN-05 |
| LI-GEN-07 | LI-GEN-06 |
| LI-GEN-08 | LI-REC-08 (stuffing part) |
| LI-GEN-09 | LI-GEN-12, LI-REC-02 |
| LI-GEN-10 | LI-GEN-13, LI-REC-05, LI-PRODUCT-16 (location part) |
| LI-GEN-11 | LI-GEN-03, LI-REC-11, LI-CONSULTING-17 (URL part), LI-FINANCE_BANKING-16 (URL part) |
| LI-GEN-12 | LI-GEN-02 |
| LI-GEN-13 | LI-GEN-14 |
| LI-GEN-14 | LI-GEN-10, LI-REC-09 |
| LI-GEN-15 | LI-GEN-11 |
| LI-GEN-16 | LI-GEN-15, LI-REC-08 (evidenced part) |
| LI-GEN-17 | LI-GEN-16 |
| LI-GEN-18 | LI-GEN-07, LI-REC-06 (length part) |
| LI-GEN-19 | LI-GEN-08 |
| LI-GEN-20 | LI-GEN-09, LI-REC-06 (content part) |
| LI-GEN-21 | LI-GEN-24, LI-REC-07, LI-GEN-09 (lexicon part) |
| LI-GEN-22 | LI-GEN-23, LI-REC-10, LI-CONSULTING-12 |
| LI-GEN-23 | LI-GEN-22 |
| LI-GEN-24 | LI-GEN-01, LI-REC-12, LI-CONSULTING-16, LI-FINANCE_BANKING-14, LI-MARKETING_GROWTH-13 |
| LI-GEN-25 | LI-GEN-20, LI-REC-14, LI-SOFTWARE_ENG-17, LI-DATA_ANALYTICS-17, LI-QUANT_TRADING-13, LI-MARKETING_GROWTH-14, LI-PRODUCT-16 (Open to Work part) |
| LI-GEN-26 | LI-GEN-17, LI-RESEARCH-14, LI-MARKETING_GROWTH-16 |
| LI-GEN-27 | LI-GEN-18, LI-REC-13 |
| LI-GEN-28 | LI-GEN-19, LI-DATA_ANALYTICS-16, LI-CONSULTING-17 (self-report part), LI-FINANCE_BANKING-16 (self-report part) |
| LI-GEN-29 | LI-GEN-25 |

---

## 5. What LinkedIn should look like, by sector

Each subsection: headline formula and examples, About template, Featured must-haves, top skills, posting norms, top 3 red flags, then the sector rule table. Examples are illustrative, not real people.

### 5.1 Software engineering (`software_eng`)

- **Headline formula:** `[Year + degree] @ [University] | [specialism or stack, 2-4 terms] | [one proof point] | [target role + season]`. The proof point (an internship, a shipped project with users, a hackathon place, an open-source contribution) is the SWE-specific part.
  - Good: `2nd-year CS @ UCL | Backend: Go, Python, PostgreSQL | Built a society ticketing app used by 1,200 students | Seeking Summer 2027 SWE internships`
  - Good: `MSc Computer Science @ Edinburgh (conversion from Physics) | Python, TypeScript, AWS | Ex-data engineering intern @ [fintech] | Graduate SWE roles 2027`
  - Bad: `Aspiring Software Engineer | Passionate about tech | Future Googler 🚀` (adjectives; "Future [Company]" reads as presumptuous). Bad: `Full-Stack Developer | AI/ML Engineer | Cloud Architect` (titles never held).
- **About (~600-1,200 chars):** (1) one line on who you are and what you build; (2) 1-2 projects or roles with stack and one number each; (3) what you're learning now, with a concrete sign; (4) target role, timeframe and location; (5) links (GitHub, portfolio, email) [S62].
- **Featured must-haves:** a GitHub profile or pinned repo with a good README; a live demo or Devpost page; a short technical write-up. Not certificates or "I'm happy to announce" posts [S7][S78]. Mirror projects into About/Experience, because Projects may not reach the PDF.
- **Top skills:** table-stakes Python, Java or C++, data structures & algorithms, Git, SQL. Differentiators JavaScript/TypeScript, Linux, Docker, cloud (AWS/GCP/Azure), testing + CI/CD [S83][S85][S86]. Noise: Office, "computer literacy", soft skills with no evidence.
- **Posting:** not expected; zero posts is neutral. Technical write-ups are a small plus. Engagement-bait and "500th LeetCode problem" posts are a light risk.
- **Top 3 red flags:** (1) job titles never held ("Founder & CTO" of a weekend project); (2) GitHub link missing, dead, private or empty [S78][S79]; (3) 30+ unevidenced skills, or certificate stacks in place of projects [S19].
- **Context:** Google recruiters tell students to put LinkedIn and GitHub in the CV contact line and say open-source contributions stand out [S78]. Amazon's recruiter advice never mentions LinkedIn [S81].

| ID | Rule | Dim | Check | Input | Sev | Year adjust | Ev | Sources |
|---|---|---|---|---|---|---|---|---|
| LI-SOFTWARE_ENG-01 | GitHub or portfolio link visible in Contact info (websites), About or Featured. | proof | code | pdf_export+screenshot/self_report | major | 1st: severity minor | B | [S7], [S78], [S79] |
| LI-SOFTWARE_ENG-02 | Headline = degree/year/university + specialism or stack + target: at least one tech term from the keyword bank and a target (role type and/or season); not just 'Student at X'. | findability | hybrid | pdf_export | major | — | B | [S62], [S69], [S84] |
| LI-SOFTWARE_ENG-03 | No self-awarded professional titles in the headline or project labels: 'Software Engineer', 'Full-Stack Developer', 'AI/ML Engineer', 'CTO' or 'Founder' only when backed by a real role (employer, dates, description). Personal projects are labelled as projects. | integrity | hybrid | pdf_export | major | — | D | [S14], [S128] |
| LI-SOFTWARE_ENG-04 | At least 2 technical projects visible (Projects section, Experience entries or Featured), each with stack, own role, one outcome and a link. *[fixture-gated]* | proof | hybrid | self_report+screenshot/pdf_export | major | 1st: threshold 1 | B | [S78], [S79], [S82] |
| LI-SOFTWARE_ENG-05 | Featured holds at least one technical artefact (repo, live demo, Devpost, technical write-up), not only certificates or announcement posts. | proof | llm | screenshot+self_report | minor | 1st: skip | D | [S7], [S62] |
| LI-SOFTWARE_ENG-06 | Top 3 (pinned) skills are technical and relevant (languages, frameworks, CS fundamentals), not office tools or generic soft skills. | findability | code | pdf_export | major | 1st: severity minor | D | [S19], [S62] |
| LI-SOFTWARE_ENG-07 | Listed languages and frameworks are evidenced: each technical skill in Top Skills (and any the user pastes) appears in at least one Experience, Project or Education description. | proof | hybrid | pdf_export+self_report | major | — | B | [S19], [S62] |
| LI-SOFTWARE_ENG-08 | Tech Experience entries use X-Y-Z content: action, stack and a measurable or concrete result, with the student's own contribution clear. Not blank, not a duty list. | proof | hybrid | pdf_export | major | 1st: severity minor | B | [S62], [S128] |
| LI-SOFTWARE_ENG-09 | Non-tech roles are kept but short: 1-2 lines with one transferable outcome; not deleted, not padded to tech length. | proof | hybrid | pdf_export | minor | final: skip; masters: skip | B | [S62] |
| LI-SOFTWARE_ENG-10 | About is specific: names what the student builds, at least one project or role with a number, a target role and timeframe, and links. ~600-1,200 characters. | narrative | hybrid | pdf_export | major | — | D | [S62], [S69] |
| LI-SOFTWARE_ENG-11 | Education carries SWE signal: expected graduation date, grade if 2:1 or above (or a year average), 3-6 relevant modules and/or the group or final-year project with stack. | proof | code | pdf_export | minor | — | B | [S62] |
| LI-SOFTWARE_ENG-12 | Tech activities are named with role or result: hackathons, tech societies, competitive programming, open source, TA/tutoring. | proof | hybrid | pdf_export+self_report | major | final: severity minor; masters: severity minor | B | [S78], [S82] |
| LI-SOFTWARE_ENG-13 | Certifications are signal, not noise: cloud vendor exams are a small plus; more than 3 short completion certificates with fewer than 2 described projects is flagged. | proof | code | pdf_export | minor | — | D | — |
| LI-SOFTWARE_ENG-14 | Competitive programming / LeetCode is stated as a verifiable result (contest rank, rating, ICPC regional placing), not as a problem count in the headline. | narrative | hybrid | pdf_export | minor | — | D | — |
| LI-SOFTWARE_ENG-16 | Advisory risk check (weight 0): activity is neutral-to-technical. No posting is fine; technical write-ups are good; engagement-bait or unprofessional posts are flagged. | presence | llm | screenshot | minor (advisory) | — | D | [S62] |

### 5.2 Data & analytics (`data_analytics`)

- **Headline formula:** `[Degree + University + year] | [target role] | [2-4 concrete tools] | [one proof point]`. Put the role and tools in the first ~70 characters.
  - Good: `Maths & Stats @ UCL (2nd yr) | Aspiring Data Analyst | SQL · Python (pandas) · Power BI | Seeking 2027 summer internship`
  - Good: `Economics @ Manchester | Insight & Analytics placement 2027-28 | Excel · SQL · Tableau | Built NHS A&E wait-time dashboard`
  - Bad: `Passionate data enthusiast | Aspiring | Hardworking 🚀`. Bad: `Data Scientist | AI Expert | ML Engineer` (titles never held).
- **About (600-1,300 chars):** hook (who you are + target role); what you analyse and with what; 2-3 proof points, each as **question → data → method → result** with a number and a link [S88]; what you want and when; contact line.
- **Featured must-haves:** GitHub repo with a README (question, data, method, result) [S87]; one dashboard (Tableau Public / Power BI web / Looker Studio); one write-up for a non-technical reader; optional Kaggle notebook. Never a certificate badge as the only item.
- **Top skills:** SQL, Python (pandas), advanced Excel, Power BI or Tableau, statistics, data cleaning; differentiators R, scikit-learn, a cloud data platform, data storytelling [S87][S88][S90]. Put SQL, Python and a BI tool among the **Top skills** in your About section (up to 5) and reorder your Skills list so they come first, since the PDF shows ~3. (*Audit 2026-10-18:* LinkedIn Help describes reordering skills and About "Top skills", not pinning; which of these the PDF sidebar reflects is unconfirmed, so the top-skills rules are minor/D.)
- **Posting:** neutral. An occasional post sharing a finished project with one chart and one insight is a mild plus. Risk: AI "10 Python tricks" posts, and especially confidential employer data or screenshots.
- **Top 3 red flags:** (1) inflated "Data Scientist/ML Engineer" titles; (2) tutorial-only portfolio (Titanic, Iris, MNIST); (3) internal dashboards or customer data shown publicly.
- **Context:** Lloyds tests Python, SQL and statistical modelling directly [S90]; Sky accepts any discipline [S91]; Civil Service sifts are name-blind [S58]. LSE calls a GitHub profile "standard practice in the sector" [S87]. Prospects: Kaggle "can help you gain visibility" [S89]. The Google Data Analytics certificate's UK consortium only agreed to "consider" holders [S93], and the certificate looks junior for MSc students [S92].

| ID | Rule | Dim | Check | Input | Sev | Year adjust | Ev | Sources |
|---|---|---|---|---|---|---|---|---|
| LI-DATA_ANALYTICS-01 | Headline names a data target role or function (data analyst/scientist, BI, analytics, insight, data engineering) or a quantitative degree, and at least 2 concrete tools (SQL, Python, R, Excel, Power BI, Tableau...). | findability | hybrid | pdf_export+screenshot | major | 1st: severity minor | D | [S5], [S62] |
| LI-DATA_ANALYTICS-02 | Headline does not present the student as holding a data job title they have not held ('Data Scientist', 'ML Engineer' with no data role). 'Aspiring', 'Student' or a real 'Incoming X Intern at Y' are fine. | integrity | hybrid | pdf_export | major | — | D | [S67], [S143] |
| LI-DATA_ANALYTICS-03 | SQL is listed as a skill and is among the pinned top skills for DA/BI targets. | findability | code | pdf_export+screenshot | major | 1st: severity minor | A | [S87], [S88], [S90] |
| LI-DATA_ANALYTICS-04 | At least one of Python or R is listed, and at least one visualisation/BI tool (Power BI, Tableau, Looker, Excel charts). | findability | code | pdf_export+screenshot | major | 1st: severity minor | A | [S87], [S88], [S89] |
| LI-DATA_ANALYTICS-05 | Top skills are evidenced: each of the top 5 skills appears in at least one Experience, Project or About sentence that shows it in use. | proof | hybrid | pdf_export | major | 1st: severity minor | C | [S62], [S143] |
| LI-DATA_ANALYTICS-06 | Skills list is focused: 8-30 skills, and fewer than about a third are generic non-data traits ('Teamwork', 'Microsoft Word'). *[fixture-gated]* | findability | code | screenshot+self_report | minor | — | D | [S62] |
| LI-DATA_ANALYTICS-07 | Portfolio link present (presence only; no reachability check): at least one link to GitHub, Tableau Public, Kaggle, Power BI web, Observable/Streamlit or a personal site, in Contact websites, About, Projects or Featured. | proof | code | pdf_export+screenshot/self_report | major | 1st: severity minor | A | [S10], [S87], [S88], [S89] |
| LI-DATA_ANALYTICS-08 | At least one project follows question -> data -> method -> result, with a number or decision in the result. | proof | llm | pdf_export+self_report | major | 1st: severity minor | A | [S88], [S91] |
| LI-DATA_ANALYTICS-09 | Portfolio is not only tutorial datasets (Titanic, Iris, MNIST, Boston housing) with no original question. | proof | hybrid | pdf_export+screenshot/self_report | minor | final: severity major; masters: severity major | C | — |
| LI-DATA_ANALYTICS-10 | Communication evidence exists: at least one item shows presenting or explaining findings to non-technical people. | proof | llm | pdf_export+screenshot | major | 1st: severity minor | A | [S88], [S91] |
| LI-DATA_ANALYTICS-11 | Education lists quantitative modules and/or a data-heavy dissertation, plus a grade or average if 2:1 or above. | proof | hybrid | pdf_export | major | 1st: severity minor | B | [S62], [S90] |
| LI-DATA_ANALYTICS-12 | Certifications are signal, not noise: at most ~6 listed; if more than 3, at least one is a proctored/vendor cert (PL-300, Tableau, AWS/Azure/GCP) or tied to a project; none expired. | proof | code | pdf_export | minor | — | C | [S87], [S92], [S93] |
| LI-DATA_ANALYTICS-13 | Non-data jobs show a data or quant angle where truthful: for retail/hospitality/tutoring roles, at least one bullet mentions a number, a tool or a process improvement. | proof | llm | pdf_export | minor | final: severity minor; masters: severity minor | D | [S62] |
| LI-DATA_ANALYTICS-15 | About is specific: names a target role, 2+ tools in context and at least one result; at most 2 clichés ('passionate about data', 'data-driven', 'turning data into insights', 'lifelong learner'). | narrative | hybrid | pdf_export | major | 1st: severity minor | B | [S10], [S62], [S67] |
| LI-DATA_ANALYTICS-18 | Advisory risk check (weight 0): posting is optional; if posts exist they share real work and contain no AI-generic 'tips' content or employer data. | presence | llm | screenshot+self_report | minor (advisory) | — | D | — |

### 5.3 Quant & trading (`quant_trading`)

- **Headline formula:** `[Degree] @ [University] ([year]) | [strongest verifiable quant signal: rank / rating / olympiad] | [2-3 core tools or areas]`. Lead with evidence, not aspiration: these firms do not require finance knowledge [S94][S98].
  - Good: `Maths & Computer Science @ UCL (2028) | BMO Round 1 Distinction | IMC Prosperity 3: top 5% | Python, C++`
  - Good: `MSci Physics, Imperial | Codeforces Expert (1,850) | Probability, statistics, ML`
  - Bad: `Aspiring Quant Trader | Passionate about Financial Markets | Future Jane Streeter`. Bad: `Quant Trading Intern @ Optiver | Made £1.2m on Euro Stoxx options` (P&L disclosure).
- **About (3-5 sentences, ~300-600 chars):** what you study plus your best quantitative evidence; 1-2 projects or competitions with a verifiable result and a link; target ("2027 quant trading / research internships"); optional one line on teaching or team competitions. IMC: "We like clear, concise resumes" [S97].
- **Featured:** low weight. A documented GitHub project (backtest, paper replication, competition bot), a competition write-up only after it ends and if the rules allow, a dissertation. **Honors & Awards matters most:** olympiads, Codeforces/ICPC, IMC Prosperity (22,600 players in 2025; standout performers hired [S100]), datathons, Kaggle medals, chess/bridge ratings, always with rank and field size. This follows from Optiver's "strategic games and/or competitive activities" criterion [S96].
- **Top skills:** Python, probability, statistics, linear algebra (table-stakes); C++ (table-stakes for QD/HFT), ML, algorithms, stochastic processes/time series, OCaml/Rust/Java, game theory. **Don't list Office**: IMC says to calibrate against professionals, not fellow students [S97]. CFA L1 and Bloomberg Market Concepts are noise here.
- **Posting:** neutral to risky, weight 0. Flag posts that share OA or interview questions or internal programme content. Anonymous industry discussion describes quants keeping low profiles [S106]; Jane Street warns of impersonators [S107].
- **Top 3 red flags:** (1) P&L, strategy logic, latency or position disclosure; firms treat returns as confidential and have given interns non-competes [S103][S102]; (2) OA/interview content in posts; (3) a one-day event labelled as an internship or "Trader" role.
- **Context:** none of the 9 in-scope firms publishes LinkedIn guidance or asks for a LinkedIn URL [S94][S96][S97][S101]. Discretion is about content, not existence: students who land these internships do have public profiles [S104][S105]. Never encode university prestige.

| ID | Rule | Dim | Check | Input | Sev | Year adjust | Ev | Sources |
|---|---|---|---|---|---|---|---|---|
| LI-QUANT_TRADING-01 | No confidential trading detail: Experience, About, headline and posts do not disclose P&L figures, strategy logic, position sizes, latency or venue-specific edges, or internal tool names from trading/quant roles. | integrity | hybrid | pdf_export+screenshot | critical | 1st: severity major | C | [S102], [S103] |
| LI-QUANT_TRADING-02 | Evidence-led headline: degree/university plus at least one verifiable quant signal (competition rank, rating, olympiad, project); no aspiration-only phrasing ('aspiring', 'future', 'passionate about markets'). | findability | hybrid | pdf_export | major | 1st: severity minor | D | [S94], [S96], [S100] |
| LI-QUANT_TRADING-03 | Competition and olympiad results are listed with rank and field size: medal, rank, percentile or rating. Absence is never a fail (not applicable); a result listed without a rank fails with 'add the rank'. | proof | code | pdf_export | major | — | B | [S96], [S100], [S105] |
| LI-QUANT_TRADING-04 | Code is verifiable: when a project is claimed or the target is QR/QD, Contact lists a GitHub or personal site, or Featured links to a repo. | proof | code | pdf_export+screenshot | minor | 1st: skip | C | [S95], [S102] |
| LI-QUANT_TRADING-05 | Honest project results: every claimed strategy or model result states method and evaluation (out-of-sample, benchmark, limitations), not just a return figure. | integrity | llm | pdf_export+screenshot | major | 1st: severity minor | D | [S97], [S143] |
| LI-QUANT_TRADING-06 | Calibrated proficiency: no 'expert/advanced/fluent' claims on programming languages unless backed by projects, internships or ratings (IMC: compare yourself to professionals). | integrity | hybrid | pdf_export | major | 1st: severity minor | A | [S97] |
| LI-QUANT_TRADING-07 | Sector-relevant skills present: Top Skills plus About/Experience text include at least 3 of {Python, Probability, Statistics, Linear algebra, C++, Algorithms}. | findability | code | pdf_export | major | 1st: severity minor, threshold 2 | B | [S96], [S102], [S143] |
| LI-QUANT_TRADING-08 | No office-suite padding: Microsoft Office/Word/PowerPoint/Excel are not listed as skills on a quant profile. | findability | code | pdf_export | minor | — | A | [S97] |
| LI-QUANT_TRADING-09 | Quant modules visible in Education: at least 2 quantitative modules or a quantitative degree title. Grade shown only if strong; a missing grade is never a fail on LinkedIn. | proof | code | pdf_export | major | 1st: severity minor | B | [S94], [S104] |
| LI-QUANT_TRADING-10 | Finance-knowledge rebalancing (advice): if finance branding (CFA, valuation, 'markets enthusiast', finance certificates) outweighs quantitative evidence, advise rebalancing. Never penalise the absence of finance knowledge. | narrative | hybrid | pdf_export | minor | — | A | [S94], [S98] |
| LI-QUANT_TRADING-12 | Short, dense About: 3-5 sentences (~300-600 characters) stating study, best quantitative evidence and target role, with no market-passion clichés. | narrative | hybrid | pdf_export | minor | — | D | [S97] |
| LI-QUANT_TRADING-14 | Advisory risk check (weight 0, shown prominently): no posts or articles sharing online-assessment or interview questions, or internal programme content, from trading firms. | presence | llm | screenshot+self_report | major (advisory) | — | D | [S103] |
| LI-QUANT_TRADING-16 | Strategic-games and competitive signals surfaced: if the student self-reports chess, bridge, poker, Go, competitive programming or sport at a competitive level, it appears on the profile (Honors or About) with a level or rating. Not applicable without a self-report. | proof | hybrid | pdf_export+self_report | minor | — | A | [S96] |
| LI-QUANT_TRADING-17 | Collaboration evidence: at least one item shows working with or teaching others (team competition, TA/tutoring, society committee). | proof | llm | pdf_export | minor | 1st: skip | A | [S94], [S143] |

### 5.4 Consulting (`consulting`)

- **Headline formula:** `[Degree] at [University] | [direction: strategy / management consulting] | [1-2 proof points: role + result]`.
  - Good: `Economics BSc, UCL | Strategy & management consulting | VP, UCL Consulting Society | Winner, 2026 [Firm] Case Challenge`
  - Good: `MSc Business Analytics, Imperial | Consulting & data | SQL, Excel, Power BI | Ex-intern, Deloitte Consulting (Technology)`
  - Bad: `Aspiring McKinsey Consultant | Future Leader | Passionate Problem Solver` (single-firm target). Bad: `MECE thinker | Hypothesis-driven | Synergy-focused strategist | 80/20`.
- **About (~600-1,200 chars, answer-first):** (1) who you are and what you are aiming for; (2) 2-3 evidence points with numbers (leadership, a problem solved, a case-competition result); (3) what you'd like to talk about ("happy to chat with anyone who moved from history into consulting") [S62][S74][S114].
- **Featured:** optional and not in the PDF. Good: a case-competition deck, a society event write-up, a dissertation summary (no confidential data). Bad: a "My CV" PDF (duplicates the profile and exposes your phone number).
- **Top skills:** problem solving, data analysis, Excel, PowerPoint/presentation, communication (table-stakes); market sizing, financial modelling, SQL/Power BI/Tableau (Big 4 tech), project management, languages (differentiators) [S117]. Put the most relevant 3 first (About "Top skills", and reorder the Skills list).
- **Posting:** neutral and optional; 1-4 posts a year is plenty. Risk only: case-interview content, complaining about firms, AI-generic posts.
- **Top 3 red flags:** (1) single-firm aspiration or firm logos in the banner; (2) confidential client details; (3) grade/date mismatch with the CV or typos. Consulting values attention to detail [S117].
- **Context:** no consulting careers page checked mentions LinkedIn for screening [S110][S111][S112][S113][S114]. 87% of consulting-interested students use LinkedIn for careers (Cibyl 2022 via [S115]). LSE, Cambridge and Manchester describe it as an alumni and research tool [S71][S72][S73]. Score the profile as "would a consultant you messaged want to reply and refer you?". Final-year users should apply before polishing: BCG UK closes 18 Oct 2026 [S110], Bain London 15 Oct 2026 [S111].

| ID | Rule | Dim | Check | Input | Sev | Year adjust | Ev | Sources |
|---|---|---|---|---|---|---|---|---|
| LI-CONSULTING-01 | Headline shows degree + university, a consulting/strategy direction, and at least one concrete proof point. | findability | hybrid | pdf_export | major | 1st: severity minor | B | [S62], [S74] |
| LI-CONSULTING-02 | Headline/About do not name a single target firm as an aspiration ('Future McKinsey Analyst') and the banner carries no firm logos. 'Incoming [Firm] Analyst' with a real accepted offer passes. | narrative | hybrid | pdf_export+screenshot | minor | — | D | [S116] |
| LI-CONSULTING-03 | About is answer-first and evidenced: the opening sentence states who the student is and what they are aiming for; at least two specific, quantified evidence points follow. | narrative | llm | pdf_export | major | 1st: threshold 1 | D | [S62], [S74], [S114] |
| LI-CONSULTING-04 | About length 400-1,600 characters (not empty, not an essay). | narrative | code | pdf_export | minor | — | D | — |
| LI-CONSULTING-05 | Each Experience entry has at least one outcome line with personal contribution ('I') and a number or named result. | proof | hybrid | pdf_export | major | 1st: severity minor | A | [S62], [S114], [S143] |
| LI-CONSULTING-06 | Consulting-relevant evidence is present and specific: at least one of consulting society role, pro-bono project, case competition, firm insight day/spring week or consulting internship, with a role, deliverable or rank. | proof | hybrid | pdf_export | major | 1st: severity minor | B | [S110], [S115], [S143] |
| LI-CONSULTING-07 | Leadership with scope: at least one position of responsibility showing team size, budget, members or change achieved. | proof | hybrid | pdf_export | major | — | A | [S111], [S114], [S115] |
| LI-CONSULTING-08 | At least one problem-solving arc (problem, analysis, recommendation, result) in Experience, Projects or About. | proof | llm | pdf_export | major | 1st: severity minor | A | [S110], [S114], [S117], [S143] |
| LI-CONSULTING-09 | Skills: 5-10 listed, including at least 3 consulting table-stakes skills (problem solving, data analysis, Excel, PowerPoint/presentation, communication), with the top 3 relevant. *[fixture-gated]* | findability | code | pdf_export+screenshot | minor | — | D | [S62] |
| LI-CONSULTING-10 | Listed skills are evidenced in Experience, Projects, Education or Certifications. | proof | hybrid | pdf_export | minor | — | A | [S143] |
| LI-CONSULTING-13 | Plain English, no buzzword strings: the headline and About do not rely on consulting jargon or clichés (MECE, synergy, 80/20, passionate, results-driven) without evidence. | narrative | hybrid | pdf_export | major | — | B | [S143] |
| LI-CONSULTING-15 | Education shows classification or current average when 2:1 or above, plus 2-4 relevant modules; never inflated or rounded up. | proof | hybrid | pdf_export | minor | — | D | [S74], [S110] |
| LI-CONSULTING-18 | Advisory risk check (weight 0): posting, if any, is low-risk: no case-interview content, no complaints about firms or recruiters, no AI-generic posts. No posting is never penalised. | presence | llm | screenshot+self_report | minor (advisory) | — | D | [S72], [S143] |

### 5.5 Product (`product`)

- **Headline formula:** `[Year/degree @ university] | [product focus or role target] | [one proof point: shipped thing + number, or product internship] | [what you're seeking + when]`. Use the role keywords recruiters type (Associate Product Manager, Product Manager Intern, Product Analyst).
  - Good: `Economics @ UCL '27 | Product & growth | Built a society booking app used by 400+ students | Seeking APM / product internships, Summer 2027`
  - Good: `CS @ Imperial '27 | Product + data | Shipped a Chrome extension (1.2k weekly users) · SQL · A/B testing | Product Manager Intern 2027`
  - Bad: `Aspiring Product Manager | Passionate about tech | Innovator`. Bad: `Founder & CEO @ StudyBuddy` (solo project, no users).
- **About (~80-200 words):** hook (product focus + best proof, above "see more"); how you work as a builder (users you talked to, what you shipped, the metric you watched); evidenced skills (SQL, Figma, experimentation, AI tools); what you're looking for and when. LinkedIn Help: "one or two paragraphs" [S10].
- **Featured must-haves:** a live product link with a usage number; a teardown or improvement proposal (core flow, competitor comparison, prioritised changes, the metric each should move); a demo video or pitch deck. These evidence Google's "technical presentations" and "entrepreneurial efforts" [S119]. Add side projects as Experience entries too, so they reach the PDF.
- **Top skills:** product management, user research, data analysis, stakeholder management (table-stakes); SQL, A/B testing, Figma, product analytics, AI/LLM prototyping (differentiators) [S119][S121][S122][S124].
- **Posting:** neutral-to-positive bonus, never required. Teardowns and build logs with real insight help; criticising target employers or ranting about rejections hurts.
- **Top 3 red flags:** (1) title inflation (PM/Founder/CEO for a solo or tiny project); (2) framework soup (RICE, JTBD, AARRR with no application); (3) "Aspiring PM" with zero artefacts, or dead product links.
- **Context:** Google's London APM intern posting asks for a CV and transcript and never mentions LinkedIn [S119]. A non-technical degree is fine: Capital One says "a tech background is not necessary" [S124] and Meta welcomes "non-traditional career paths" [S121]. Entry-level PM hiring is rare [S125], so cover adjacent titles (product analyst, BA, growth).

| ID | Rule | Dim | Check | Input | Sev | Year adjust | Ev | Sources |
|---|---|---|---|---|---|---|---|---|
| LI-PRODUCT-01 | Headline names a product target plus one proof point: a role keyword (product / APM / product analyst) and a shipped thing, a product internship or a concrete skill; not only 'Student at X' or adjectives. | findability | hybrid | pdf_export | major | 1st: severity minor | D | [S62] |
| LI-PRODUCT-02 | No title inflation: 'Product Manager', 'Founder/CEO' or 'Head of Product' only when other people worked on it and there are real users, customers or a team. | integrity | llm | pdf_export | major | — | D | [S128] |
| LI-PRODUCT-03 | At least one shipped artefact is visible: a live product, prototype, extension or no-code tool, in Featured or as an Experience/Project entry, with a link or usage evidence. | proof | hybrid | pdf_export+screenshot/self_report | major | 1st: severity minor | D | [S119], [S125], [S127] |
| LI-PRODUCT-04 | At least one entry tells a product story: user problem -> evidence (research/data) -> a decision the student made -> what shipped -> a metric. | proof | llm | pdf_export | major | 1st: severity minor | D | [S122], [S128] |
| LI-PRODUCT-05 | Quantified outcomes in Experience: at least 2 entries, or at least 40% of description bullets, contain a number tied to an outcome (users, %, £, time, n interviewed). | proof | hybrid | pdf_export | major | 1st: threshold 1 | A | [S62], [S122] |
| LI-PRODUCT-06 | Data literacy is evidenced, not just listed: SQL / analytics / A-B testing appears in skills and in at least one entry where it was used. | proof | hybrid | pdf_export+screenshot | major | 1st: severity minor | A | [S119], [S121], [S122], [S124] |
| LI-PRODUCT-07 | Technical and AI fluency signal: at least one entry shows working with engineers, or building with code, APIs or AI/LLM tools. Not required for non-technical PM paths. | proof | llm | pdf_export | minor | masters: severity major | B | [S119] |
| LI-PRODUCT-08 | Cross-functional leadership or entrepreneurial evidence: at least one entry shows coordinating people with different skills or leading an initiative. | proof | llm | pdf_export | major | 1st: severity minor | A | [S119], [S121], [S124] |
| LI-PRODUCT-09 | Communication proof: Featured or an Experience entry includes a presentation, demo video, pitch, or written teardown/proposal. | proof | hybrid | screenshot+self_report/pdf_export | minor | — | D | [S119], [S124] |
| LI-PRODUCT-10 | Skills section is focused: at least 5 and no more than ~30 skills; the 3 pinned Top Skills are product-relevant; no stand-alone filler ('Microsoft Office', 'Hard-working'). *[fixture-gated]* | findability | code | pdf_export+screenshot | minor | — | C | [S26], [S62] |
| LI-PRODUCT-11 | Frameworks are applied, not name-dropped: each framework named (RICE, MoSCoW, JTBD, AARRR, North Star) is attached to a specific use. | narrative | hybrid | pdf_export | minor | — | D | [S128] |
| LI-PRODUCT-12 | About opens with product focus and proof, and ends with a target: 1-2 short paragraphs (~80-200 words); the last line states the role and timing sought. | narrative | hybrid | pdf_export | minor | — | D | [S10], [S62] |
| LI-PRODUCT-13 | Education is complete for product screens: degree, university, expected graduation month and year, grade or average if 2:1+, and 2-4 relevant modules (HCI, statistics, ML, economics, entrepreneurship). | findability | code | pdf_export | minor | penultimate: severity major | B | [S62], [S119] |
| LI-PRODUCT-15 | Certifications do not outnumber projects: more than 5 certificates and no shipped project or product entry is flagged. | proof | code | pdf_export | minor | — | D | [S128] |
| LI-PRODUCT-17 | Adjacent-role keyword coverage: headline, About or skills contain at least 1 adjacent search term (product analyst, business analyst, growth, technology consulting, operations), because entry-level PM hiring is rare. | findability | code | pdf_export | minor | final: severity major; masters: severity major | B | [S125] |
| LI-PRODUCT-18 | Advisory risk check (weight 0): posting is a bonus, never a requirement; unprofessional posts (criticising target employers, ranting about rejections, engagement-bait) are flagged. | presence | llm | screenshot+self_report | minor (advisory) | — | D | [S62] |

### 5.6 Finance & banking (`finance_banking`)

- **Headline formula:** `[Degree] @ [University] | [target area] | [1-2 proof points: spring week / internship / society role / grade]`. Name the division, not a bank you haven't worked for. "Incoming [role] @ [bank]" is fine once an offer is signed.
  - Good: `Economics BSc @ UCL (First, Y1) | Aspiring IBD Analyst | Spring Week @ Barclays '26 | VP, UCL Investment Society`
  - Good: `MSc Finance, LSE | Ex-Summer Analyst, Rothschild & Co (M&A) | Seeking 2027 Graduate Analyst roles in Advisory`
  - Bad: `Future Goldman Sachs Banker 🚀💰 | Wolf of Wall Street in the making | Crypto Investor`. Bad: `Incoming Summer Analyst @ J.P. Morgan | CFA Level I | Ex-Morgan Stanley` (a 1-day virtual experience, and wording CFA Institute forbids [S56]).
- **About (80-200 words, three short paragraphs):** (1) degree, university, year, target division and timeline; (2) 2-3 commitment items (spring week, society role, stock-pitch placing, relevant modules, modelling course); (3) skills you can defend, languages, one substantive interest. Factual and understated; no market calls.
- **Featured:** not expected (0-2 weight). A stock-pitch PDF is a small plus; public research notes are a mild compliance consideration.
- **Top skills:** financial modelling, Excel, valuation (DCF, comps, precedents), financial statement analysis, PowerPoint (table-stakes); M&A, equity research, Python/VBA, Bloomberg/CapIQ, business-level languages (differentiators). Put the three most relevant first (About "Top skills", and reorder the Skills list); evidence each.
- **Posting:** neutral to risky. Banks are clamping down on employee influencer content [S135], and FCA rules on financial promotions apply on social media [S55]. Never reward posting volume or followers (`noVanityInputs`). A short thank-you after a spring week, with nothing internal, is fine.
- **Top 3 red flags:** (1) overclaimed titles (a spring week, insight day or Forage simulation listed as "IB Intern/Analyst"); (2) CFA misuse ("CFA Level I", "CFA (expected 2027)") [S56]; (3) confidential deal/pay information or finfluencer content (stock tips, crypto, "signals").
- **Context:** banks recruit students through portals and event sign-ups. Goldman says to follow it on LinkedIn for roles and news [S130], JPMorganChase points to its Talent Network [S131], and Barclays' tips page never mentions LinkedIn [S132]. Networking is the evidenced use: Cambridge [S129], Newcastle [S136], LSE [S70], Rothschild insight weeks [S137], Warwick [S138]. Morgan Stanley's "engage at least once a week" line is aimed at experienced staff [S133].

| ID | Rule | Dim | Check | Input | Sev | Year adjust | Ev | Sources |
|---|---|---|---|---|---|---|---|---|
| LI-FINANCE_BANKING-01 | Headline names a finance target area (IBD, M&A, Markets, S&T, Asset Management, Equity Research, PE) with degree/university and at least one proof point (spring week, internship, society role, grade). Prefer the division to a named bank. | findability | hybrid | pdf_export | major | 1st: severity minor | B | [S62], [S70] |
| LI-FINANCE_BANKING-04 | CFA references follow CFA Institute wording. Allowed: 'CFA Program candidate' (only if registered), 'Passed Level I of the CFA Program'. Forbidden: 'CFA Level I', 'CFA candidate', 'CFA (expected 20xx)', 'Level I CFA' after the name. | integrity | code | pdf_export | major | — | A | [S56] |
| LI-FINANCE_BANKING-06 | No investment-promotion or finfluencer content in headline, About or Experience: no stock tips, crypto promotion, trading 'signals', affiliate links or return claims ('made 40% this year'). | integrity | hybrid | pdf_export+screenshot | major (critical only for a code-detected referral/affiliate link, paid signals or paid group) | — | C | [S55], [S135] |
| LI-FINANCE_BANKING-07 | Professional tone, no hype: no emojis or slogans in headline/About; no 'future MD', 'Wolf of Wall Street', 'hustle', rocket/money emojis. | polish | code | pdf_export | major | — | D | — |
| LI-FINANCE_BANKING-08 | About is 80-200 words, opens with degree + target division, and includes at least 2 concrete finance-commitment items. | narrative | hybrid | pdf_export | major | 1st: threshold 60 | B | [S62], [S70] |
| LI-FINANCE_BANKING-09 | Demonstrated commitment to finance is visible (Experience, Education activities or Certifications): spring/insight week, society committee role, competition placing, student fund, modelling course or BMC. | proof | hybrid | pdf_export | major | 1st: severity minor | B | [S102], [S129], [S142] |
| LI-FINANCE_BANKING-10 | Experience entries are outcome-led and quantified, 2-4 bullets each, not duty lists. | proof | hybrid | pdf_export | major | — | A | [S62], [S129], [S140] |
| LI-FINANCE_BANKING-11 | If the grade (classification, current average or predicted) is 2:1 or above, it is stated in Education; optional below that, and a missing grade is never a fail (same policy as CV rule G-32). | findability | code | pdf_export | minor | — | A | [S102], [S129], [S141] |
| LI-FINANCE_BANKING-12 | Top (pinned) skills are sector-relevant and evidenced: of the ~3 exported Top Skills at least 2 are from the sector list (Financial Modelling, Excel, Valuation, Financial Analysis, M&A, Equity Research, Python/VBA, PowerPoint, Bloomberg/CapIQ, languages), and each technical skill appears in an experience, course or certification. | findability | hybrid | pdf_export+screenshot | major | 1st: threshold 1 | B | [S62], [S97] |
| LI-FINANCE_BANKING-13 | Certifications are signal, not noise: at most ~6; no day-trading/crypto 'expert' products; relevant ones (CFA Program, IMC, CISI, BMC, modelling courses, virtual experience programmes) appear here rather than as jobs. | proof | hybrid | pdf_export | minor | — | D | [S56] |
| LI-FINANCE_BANKING-15 | Advisory risk check (weight 0, shown prominently): recent posts/comments (~90 days) contain no deal chatter, office/screen photos, offer-letter pay, political rants or investment promotion. Posting nothing passes. | presence | llm | screenshot+self_report | major (advisory) | — | C | [S55], [S135] |

### 5.7 Marketing & growth (`marketing_growth`)

- **Headline formula:** `[Target role/area] + [Degree, University, grad year] + [one proof point: campaign result, channel, cert or society role]`. The target area goes in the first ~60 characters. Imperial's formula (older guidance, written for a 120-character limit): who you are + something distinctive + what you are seeking [S68].
  - Good: `Aspiring Brand Marketer | Business & Management @ UCL '28 | Grew MarketSoc Instagram 1.2k → 4.8k`
  - Good: `Growth & Performance Marketing | Economics, LSE '27 | Ran £300 Meta Ads test at 2.1x ROAS for student startup`
  - Bad: `Passionate, creative, results-driven marketing enthusiast 🚀✨ | Storyteller | Visionary`. Bad: `Seeking opportunities | Marketing | Finance | Consulting | Tech` (no sector commitment, which P&G and Unilever screen for [S151][S152]).
- **About (120-250 words, read as a writing sample):** hook showing a marketing point of view (1-2 sentences); 2-4 proof bullets with numbers (campaign, channel, audience, result); tools line (GA4, Meta Ads Manager, Canva, HubSpot, Excel/SQL); what you want and when [S68][S62].
- **Featured must-haves (the highest sector-specific value):** a campaign case study (problem, insight, idea, execution, result); a content sample or society campaign carousel with results; a brand-campaign analysis or blog. Weak: certificates only, or group work with no role stated. Prospects: a portfolio of "campaigns, content, or data projects" [S145].
- **Top skills:** social media marketing, content creation/copywriting, marketing strategy/brand management, Excel (table-stakes); market research/consumer insight, GA4, performance marketing, SEO, A/B testing (+SQL for growth), Canva/Adobe (differentiators) [S145][S146][S151].
- **Posting:** the one sector where posting is expected-to-neutral, not risky, **if substantive**. Campaign breakdowns and project results count as portfolio proof (`LI-MARKETING_GROWTH-15`, proof dimension). Zero posts is never a fail. Engagement-bait and AI-generic copy count against you; the IPA warns agencies are tired of everyone using "the same generator" [S150].
- **Top 3 red flags:** (1) "Student at X" or a multi-sector headline; (2) social/creator claims with no handle, link or metric, or vanity metrics with no base ("went viral"); (3) AI-generic, cliché-saturated copy.
- **Context:** UK careers services agree LinkedIn and personal brand matter more in marketing than elsewhere (Warwick [S76], Portsmouth [S147], York [S148], Newcastle [S149], TARGETjobs [S144], Prospects [S145]). This is grade A for the direction, but none of them gives data. P&G's 2027 brand internship process never mentions LinkedIn [S152]. Google Digital Marketing is accredited by IAB Europe and The Open University, per Google [S155]. CIM is the UK professional body [S144][S146].

| ID | Rule | Dim | Check | Input | Sev | Year adjust | Ev | Sources |
|---|---|---|---|---|---|---|---|---|
| LI-MARKETING_GROWTH-01 | Headline names a marketing target area (brand, marketing, growth, performance, content, social, media, comms, advertising) in the first 60 characters and does not list more than 2 unrelated sectors. | findability | code | pdf_export+screenshot | major | 1st: severity minor | A | [S62], [S68], [S144] |
| LI-MARKETING_GROWTH-02 | Headline contains one concrete proof point (metric, channel result, notable role, recognised cert or competition), not only adjectives. | findability | hybrid | pdf_export+screenshot | minor | final: severity major | C | [S68], [S150] |
| LI-MARKETING_GROWTH-03 | About reads as a strong writing sample: no typos, clear structure (hook, proof, tools, goal), 100-250 words. | narrative | hybrid | pdf_export | major | 1st: severity minor | A | [S62], [S68], [S146], [S152] |
| LI-MARKETING_GROWTH-04 | About states what the student is looking for and when (e.g. 'Summer 2027 brand or growth internship, London'). | narrative | code | pdf_export | minor | — | D | — |
| LI-MARKETING_GROWTH-05 | At least one marketing-relevant experience (paid, society, freelance, own channel/brand, startup, competition) appears as an Experience item with a title, not just in Activities. | proof | hybrid | pdf_export | major | 1st: severity minor | A | [S144], [S145], [S146], [S148], [S149] |
| LI-MARKETING_GROWTH-06 | Marketing bullets carry outcome metrics with a base or timeframe (reach, followers from->to, engagement rate, CTR, sign-ups, ROAS, budget, attendance): at least 50% of marketing-relevant entries have one. | proof | hybrid | pdf_export | major | 1st: severity minor | A | [S62], [S145], [S152] |
| LI-MARKETING_GROWTH-07 | Social/creator claims are backed by a handle, link, Featured item or metric a recruiter could check. | proof | llm | pdf_export+screenshot | major | — | B | [S145], [S147] |
| LI-MARKETING_GROWTH-08 | Featured contains 1-4 portfolio items (campaign case study, content sample, analysis, website/blog) with the student's role clear; certificates alone don't count. | proof | hybrid | screenshot+self_report | major | 1st: skip | A | [S76], [S145], [S147] |
| LI-MARKETING_GROWTH-09 | Top/visible skills match the target sub-area: at least 3 of the top 5 visible skills come from the marketing keyword bank, and total skills 10-50. *[fixture-gated]* | findability | code | pdf_export+screenshot/self_report | minor | — | B | [S68], [S145], [S151] |
| LI-MARKETING_GROWTH-10 | At least one data/measurement skill is evidenced (GA4, Excel analysis, A/B test, survey analysis, SQL, Looker Studio) in an experience or project, not only listed. | proof | hybrid | pdf_export | minor | 1st: skip | A | [S145], [S151], [S152] |
| LI-MARKETING_GROWTH-11 | Certifications are relevant and proportionate: from the worth-listing set (Google Digital Marketing, GA4, Google Ads, HubSpot, Meta Blueprint, CIM) or clearly relevant; certs at most 2x the number of marketing-relevant entries and at most ~8 in total. | proof | code | pdf_export | minor | 1st: skip | C | [S144], [S146], [S155] |
| LI-MARKETING_GROWTH-12 | No AI-generic or cliché-saturated copy across headline, About and experience: most sentences carry specific details (names, numbers, platforms, outcomes). | narrative | hybrid | pdf_export | major | — | B | [S145], [S150] |
| LI-MARKETING_GROWTH-15 | Recent posts, when present, are substantive portfolio pieces: campaign breakdowns, project results with what was learned, event write-ups with an insight. Zero posts = not applicable, never a fail. Engagement-bait fails. | proof | llm | screenshot+self_report | minor | 1st: skip | B | [S76], [S147], [S149] |
| LI-MARKETING_GROWTH-18 | Evidence of sector interest beyond coursework: competitions (e.g. L'Oréal Brandstorm), virtual experiences, sector events, following/engaging with brands or agencies. | proof | hybrid | pdf_export+self_report | major | 1st: severity minor | A | [S148], [S149], [S152], [S154] |

### 5.8 Research (`research`)

- **Headline formula:** `[Degree + level + institution] | [research area or question] | [1-2 methods/tools] | [what you're seeking, optional]`. Imperial: fact-based, no clichés [S68]. YCEDE's area-plus-method pattern [S156].
  - Good: `MSc Statistics, UCL | Causal inference for health data | R, Stan | Applying for PhDs 2027`
  - Good: `Economics BSc, LSE | Interested in labour markets & inequality | Stata, survey data | Research intern, [think tank]`
  - Bad: `Aspiring researcher | Passionate about science | Lifelong learner`. Bad: `AI Researcher | ML Scientist | Published Author` (an undergraduate with no peer-reviewed output).
- **About (120-220 words, 3 short paragraphs):** (1) research interest as a question, not a topic list; (2) evidence: dissertation or project, placement, method, output (poster, preprint, talk, dataset, code); (3) direction (PhD in X, RA roles, policy research) plus links (ORCID, Google Scholar, GitHub). Plain, first person, accessible [S156].
- **Featured must-haves:** a poster PDF or dissertation abstract, a code repo, a plain-language explainer. Link ORCID (free at any stage [S60]). Google Scholar is optional for undergraduates; a profile appears in search only with a verified university email [S61].
- **Top skills:** Python and/or R/Stata, statistics/econometrics/experimental design, literature review, scientific writing, real-data analysis (table-stakes); a field-specific method, Git/reproducible workflows, presenting, policy writing (differentiators) [S156][S165].
- **Posting:** neutral and not expected of undergraduates. Risks: overstated results, unpublished lab data, and partisan content for students targeting ONS/Civil Service, where impartiality duties apply once employed [S57].
- **Top 3 red flags:** (1) over-claimed titles ("Researcher", "Published Author") with no role or output; (2) coursework listed as a publication; (3) co-authored work with no statement of the student's own contribution [S160].
- **Context:** DeepMind [S163], Microsoft Research [S165] and Research Ready [S164] criteria are enrolment, publications, Python/Git, scientific communication and a referee, with no mention of LinkedIn. A recruiter quoted by Cambridge says "We will look you up on LinkedIn", but that recruiter is cross-sector (L'Oréal) [S160]. Think tanks fill some jobs without advertising [S161][S162]. Academics favour ResearchGate and Google Scholar over LinkedIn (2014, all career stages) [S59]. Show a banner saying LinkedIn carries little weight for research applications. Imperial PhD and ECRI pages stress networking [S158][S159]; UKCGE hosts the YCEDE guide [S157]; IFS asks for an "extremely good" economics degree (snippet only) [S166].

| ID | Rule | Dim | Check | Input | Sev | Year adjust | Ev | Sources |
|---|---|---|---|---|---|---|---|---|
| LI-RESEARCH-01 | Headline names a research area and at least one method or tool, not only 'Student at X'. | findability | hybrid | pdf_export | major | 1st: severity minor | B | [S68], [S156] |
| LI-RESEARCH-02 | No over-claiming self-labels: 'Researcher', 'Scientist', 'Research Scientist', 'Published Author' in the headline or titles are backed by a matching role or output. | integrity | hybrid | pdf_export | major | — | D | [S160] |
| LI-RESEARCH-03 | About states a research interest as a question or problem, plus evidence, plus direction (100-250 words). | narrative | llm | pdf_export | major | 1st: severity minor | B | [S68], [S156] |
| LI-RESEARCH-04 | Research Experience entries describe question -> method -> finding/output. | proof | llm | pdf_export | major | 1st: skip | B | [S156] |
| LI-RESEARCH-05 | Individual contribution is explicit on any co-authored or team research. | integrity | llm | pdf_export | major | — | B | [S160] |
| LI-RESEARCH-06 | Publications section is honest and well-formed: each item has a venue/type, date, status (published / preprint / submitted / in prep) and a link or DOI where one exists; coursework is not listed as a publication. | integrity | hybrid | pdf_export | major | 1st: severity minor | B | [S156], [S160] |
| LI-RESEARCH-07 | At least one research-evidence item (dissertation, UROP or placement, independent project with method, poster, preprint, competition write-up) appears in Experience, Projects, Publications or Featured. *[fixture-gated]* | proof | hybrid | pdf_export+screenshot | major | 1st: skip; 2nd: severity minor; penultimate: severity minor | D | [S156], [S164] |
| LI-RESEARCH-08 | Scholarly identity is linked when the student has any output or code: ORCID iD and/or Google Scholar / GitHub / personal site in Contact info or About. | findability | code | pdf_export+self_report | minor | 1st: skip | B | [S60], [S61], [S156] |
| LI-RESEARCH-09 | Education includes research-relevant detail: grade or average to date (if 2:1/First or equivalent), dissertation title and supervisor (final/MSc), 3-5 relevant advanced modules. | proof | hybrid | pdf_export | minor | final: severity major; masters: severity major | D | [S160], [S166] |
| LI-RESEARCH-10 | Skills include the core analysis tool for the subfield (Python, R or Stata) plus at least one named method, and these also appear in Experience or Projects. | proof | hybrid | pdf_export+self_report | major | 1st: severity minor | B | [S156], [S165] |
| LI-RESEARCH-11 | Communication evidence: at least one item shows research communicated (poster, talk, blog explainer, policy brief, outreach, teaching or tutoring). | proof | llm | pdf_export+screenshot | minor | 1st: skip | B | [S161], [S162], [S165] |
| LI-RESEARCH-12 | Tone is academic-accessible, not hype: no 'revolutionary/groundbreaking/thought leader', no overstated findings. | narrative | hybrid | pdf_export | minor | — | D | [S68], [S156] |
| LI-RESEARCH-13 | Featured holds a research artefact (poster PDF, dissertation abstract, repo, explainer) rather than generic certificates or reposts. | proof | llm | screenshot+self_report | minor | 1st: skip | B | [S156] |
| LI-RESEARCH-15 | Advisory risk check (weight 0; prominent for ONS/Civil Service targets): no unpublished or confidential lab data and no partisan content in visible posts. | presence | llm | self_report+screenshot | minor (advisory) | — | D | [S57], [S162] |
| LI-RESEARCH-17 | Direction signal: the headline or About says what the student is seeking (PhD area / RA / policy research), not only the Open to Work frame. | narrative | llm | pdf_export | major | 1st: skip; 2nd: severity minor; penultimate: severity minor | B | [S156] |

---

## 6. Keyword banks

The sector files each carry a full keyword bank (role titles, skills, tools, credentials, proof terms, noise lists) with synonym groups: `03` §8, `04` §7, `05` §8, `06` §7, `07` §7, `08` §7, `09` §7, `10` §7. Implementation should load them as data next to the CV keyword banks (`cv-rules-tech-product.md`, `cv-rules-finance-consulting.md`) so CV and LinkedIn feedback use one vocabulary. Each archetype has its own noise list. Excel is noise for quant and SWE but table-stakes for finance, consulting, data and marketing.

---

## 7. Myths and unverified statistics (never show as fact)

| # | Claim | What the researchers found | Verdict |
|---|---|---|---|
| M1 | "Profiles with a photo get **21x** more views, **36x** more messages, **9x** more connection requests." | Traced to a 2017 LinkedIn blog post that now redirects to a generic index [S27]. Reported by trade press [S42][S43] and repeated by universities [S66] and blogs [S44][S45]. No method published. LinkedIn's own pages disagree: 7x in 2013 [S30], 14x in 2024 [S25], "up to 2X" on today's help page [S10]. Aberdeen quotes 14x [S74]. | **Unverified, and LinkedIn contradicts itself.** Correlational at best. |
| M2 | "5+ skills = **17x** more views; **31x/33x** more messages; 27x more likely to be found." | 2016 LinkedIn newsroom/blog [S26][S29]; the blog URL redirects. | Unverified; decade-old, correlational. |
| M3 | "Current position = 16x more discoverable; city = 23x; field of study = 11x." | Repeated by the OU guide [S66] and blogs; no primary page. | Unverified. |
| M4 | "Open to Work **doubles** recruiter messages / **40%** more InMails." | *Audit 2026-10-18:* LinkedIn told CNBC (23 Jan 2025) the feature "doubles someone's chances of getting a recruiter to message them" and that 220 million+ members have it on (https://nbcnewyork.com/news/business/money-report/on-linkedin-220-million-people-are-open-to-work-recruiters-weigh-in-if-the-feature-helps-or-hurts-job-seekers/6119784). The 40% InMail figure comes from a 2020 LinkedIn blog, now dead [S28], re-quoted to Fortune (5 Sep 2024) [S41]; Fortune does not carry the "20% more messages" figure earlier cited here, so it is dropped. A separate live LinkedIn figure is 37% higher InMail *response* [S18]. | LinkedIn's own correlational figures (2x, 2025; ~40% more InMails, 2020/2024). They say nothing about hiring outcomes. LI-GEN-25 stays advisory. |
| M5 | "Verified members get 60% more profile views." | Live LinkedIn help page, no method [S8]. | LinkedIn claim, B, correlational. |
| M6 | "All-Star profiles are **40x** more likely to get opportunities." | No source found. | Myth. |
| M7 | "All-Star needs 50+ connections." | OU 2020 [S66] vs LinkedIn Help's 7 sections [S9]. | Follow LinkedIn Help. |
| M8 | "Recruiters look at a profile for **6-7 seconds**." | This is the Ladders CV eye-tracking study, not LinkedIn (see CV myth M2). | Misapplied. |
| M9 | "**87% / 95%** of (UK) recruiters check LinkedIn." | US recruiter surveys; the "95% of UK recruiters" figure is attributed to UK careers material, but the Surrey page doesn't contain it [S63]. | Untraceable for UK students. |
| M10 | "**70%** of employers screen social media; 54% rejected someone for content." | CareerBuilder/Harris 2017, US, vendor survey [S49]; AVG 2012 "70% less likely" is vendor-commissioned and pre-GDPR [S50]. | C-grade, US/old. Not UK, not students. |
| M11 | "Comprehensive LinkedIn = **71%** more callbacks" (ResumeGo). | Study URL 404; sample and country unknown (06 caveat). | Unverified. |
| M12 | "Engaging on 4 posts a day = 200-2000% more views." | Aberdeen careers page, no source [S74]. | Unverified. |
| M13 | "Over 45% of recruiters search by skills." | Attributed to LinkedIn Future of Recruiting 2025; PDF unreadable [S24]. | Unverified. |
| M14 | "Black professionals are 26% less likely to post a photo." | ERE cites unnamed research [S51]. | Unsourced; the direction is plausible and matters for fairness. |
| M15 | "Turn on Creator mode" / "add profile hashtags". | Retired in 2024 [S33]. | Obsolete. |
| M16 | "Endorsements boost your ranking / prove skills." | LinkedIn Help says endorsements can make you "more discoverable for related opportunities" (no data; https://www.linkedin.com/help/linkedin/answer/a554351). Raters give them negligible weight [S46]; TARGETjobs says recruiters pay little attention [S62]. Imperial's line is about *recommendations* increasing search ranking, not endorsements [S68] (corrected in the 2026-10-18 audit). | Not scored: negligible rater weight, and network-dependent, so unfair to score. |
| M17 | "You must post regularly to get noticed." | No employer source in any sector. Banks discourage it [S135]. | Myth (marketing: substantive posts help as portfolio, but are not required). |
| M18 | "Quant/MBB/banks headhunt students on LinkedIn." | Their documented pipelines are portals, programmes and competitions [S98][S100][S101][S110][S111][S130][S131]. | Unsupported. |
| M19 | "A Google/HubSpot/PM certificate gets you hired." | The Google DA consortium only agreed to "consider" holders [S93]; no product employer mentions PM certs; Prospects' marketing page stresses experience and CIM [S146]. | Overstated. |
| M20 | "Skills-based hiring means degrees don't matter in UK tech." | Only 8% of UK recruiter searches filter solely on skills [S19]. | Overstated for the UK. |
| M21 | "You need a Google Scholar profile / a CS degree / a marketing degree." | Scholar needs a verified university email [S61]; Capital One and Meta say otherwise for product [S124][S121]; York and the IPA say otherwise for marketing [S148][S150]. | Myths. |
| M22 | "Tailor your LinkedIn to each application." | TARGETjobs: you can't have a different profile per vacancy, so give context to your skills [S62]. | Tailor to the archetype, not the employer. |
| M23 | "Hide your profile entirely if you want quant." | Interns at these firms have public profiles [S104][S105]. | Overcorrection: discretion is about content. |

**UI rule:** never print a multiplier. If a statistic is ever shown, it must come from a live LinkedIn page and be labelled "LinkedIn says". The default is qualitative copy ("a photo helps people recognise you").

---

## 8. Fairness decisions

1. **Photo: weight 0; appearance is never assessed.** Field experiments show photos shift interview invitations (about 39% between the most and least favourable Facebook photo [S47]) and sway LinkedIn raters [S46]. That is evidence of **bias, not validity**. Judging attractiveness, dress or "professionalism" would encode that bias and process biometric data for no valid reason. `LI-GEN-24` asks only "Is it a recent photo of you?", in line with LinkedIn's likeness rule [S14]. There is no AI-face detection on users' photos (fake AI faces exist [S52], but detection is unreliable and unfair). This overrules the photo rules in 01 (major), 06 and 08 (vision-judged dress) and 09 (major).
2. **Connections and network: weight 0.** Network strength tracks gender, race and neighbourhood income [S21][S22]. First-generation, state-school, international and mature students start with smaller networks. Network advice is coaching, never a ranking against peers.
3. **Activity and posting: weight 0** (risk checks only), except marketing, where substantive posts count as portfolio proof and absence is `not_applicable`. Posting favours confident, well-networked students, is easy to fake, and has no outcome evidence [S46][S14].
4. **Recommendations and Open to Work: weight 0.** Both depend on network and on an unverifiable self-report.
5. **Language and accessibility.** The PDF works only for English profiles [S1]. Accept paste or screenshots and never penalise parse failures. Every scored rule can be decided without a screenshot.
6. **Non-UK experience** is judged on its description, not on whether the brand is known. Masters/international students are not penalised for location.
7. **Protected characteristics** (name, age, nationality, religion, ethnicity, disability, pronouns) are excluded from LLM prompts. Gaps are never penalised; only CV/LinkedIn date *inconsistency* is. `LI-GEN-12` (name field) was softened to fail only on emoji or job words, so it can never penalise how a name is written.
8. **No "AI detection".** It is unreliable and unfair to non-native writers. Placed grades specificity instead (`LI-GEN-21`).
9. **No university prestige** in any rule.
10. **ICO posture.** Placed processes the user's own data at their request. The UI must not imply that employers *should* screen LinkedIn [S53].

---

## 9. Contradictions between researchers, and what I chose

| # | Contradiction | Chosen | Why |
|---|---|---|---|
| 1 | Dimension scheme: outcome-based (02) vs section-based (03-10 assumed identity/headline/About/…) | Outcome-based, with every sector table mapped in (§3.3) | Matches the CV engine; puts fairness into the structure (presence = 0); one rule counts where it matters. |
| 2 | Severity points 15/6/2 (01) vs 3/2/1 (02) | 3/2/1 × evidence multiplier, as in `aggregate.ts` | Reuse the existing aggregator unchanged. |
| 3 | Which failures are critical. 01: headline (GEN-04) and education (GEN-12) critical. 03: no-projects critical. 04: portfolio link critical (penultimate+). 06: typos critical. 09: final-year experience/metrics critical. 10: over-claimed titles critical | **Critical = integrity only** (contradiction, misrepresentation, confidential or promotional content). All the others are major. Their sector dimension weights (proof 33-35 in SWE/data/product) keep them decisive. | A 59 cap should mean "this could actively cost you an offer", which applies to misrepresentation, not to a thin profile. One spell-check false positive on a proper noun must not cap a consulting score. |
| 4 | Programme mislabelling: major (05) vs critical (08, 02) | Critical (`LI-GEN-02`) | LinkedIn policy forbids misleading experience claims [S14]; a 1-day event shown as "Trader" is misrepresentation in every sector. |
| 5 | CV consistency severity: major (09, marketing) vs critical (01, 02, 05, 06, 08) | Critical everywhere; marketing gets a lower integrity weight (15) instead | A contradiction is a contradiction. Unilever imports LinkedIn into its form [S151]. |
| 6 | Self-labels like "Data Scientist" / "AI Researcher" in the headline: major (03, 04, 07) vs critical (10) | Major for self-labels; critical for Experience-entry mislabelling (`LI-GEN-02`) | Consistent across sectors; a headline label is boastful but is not a fabricated role. |
| 7 | Caps: 59 (02), 60 (05, 08), 70 (05 rank mismatch) | One cap at 59 | One rule, easy to explain. |
| 8 | Photo: major and scored (01, 09; 08 and 06 vision-judged dress) vs weight 0 (02) | Weight 0, presence asked only via self-report, never judged | §8.1. |
| 9 | Photo statistic to quote: "up to 2X" (04, 07, from LinkedIn Help) vs never quote a multiplier (01) | Never quote a multiplier | LinkedIn's own figures disagree (2X, 7x, 14x, 21x), and the photo isn't scored anyway. |
| 10 | Open to Work: major scored rule (01) vs advisory (02 and all sectors) | Advisory; recommend recruiters-only; the public frame is never scored | No student-level evidence either way; UK recruiters disagree [S41]; 37%/40% are LinkedIn's own response figures [S18][S28]. |
| 11 | Activity: scored minor (01 GEN-18) vs weight 0 (02) vs bonus up to +6 (09) | Weight 0 everywhere; marketing posts count as proof when supplied, `not_applicable` when absent | No outcome evidence; easy to fake; fairness. Marketing careers services treat posts as portfolio [S147][S76]. |
| 12 | Self-report: scored (several sector rules) vs advisory (02 §4.4) | Yes/no claims advisory; pasted URLs/text scorable | Answering "no" must never cost points; pasted links can be checked. |
| 13 | Featured when only the PDF is uploaded: renormalise (04, 09) vs move Featured's points into Experience (07) | Renormalise (automatic: `not_applicable` drops out) | Same effect, no special case. The SWE and data portfolio-link rules still run from the PDF Contact block, so a missing link is a real fail. |
| 14 | About length: ≥600 chars (01); 60-300 words (02); 300-600 chars (05); 400-1,600 (06); 80-200 words (07, 08); 100-250 words (09, 10); 600-1,200 (03); 600-1,300 (04) | Generic floor 400 chars (`LI-GEN-18`) with sector floors in `sectorParams`; upper bounds in the sector About rules | Each sector's reader differs: quant wants density, marketing reads it as a writing sample. |
| 15 | Headline limit 120 (Imperial, LSE), 200 (Edinburgh), 220 (trade) | Don't hard-code; read from the export; score the first ~70 chars | Only trade sources give 220; no LinkedIn page fetched. |
| 16 | Skills count: ≥10 (01); 5-10 key (TARGETjobs); 8-20 (03); 8-30 (04); 5-30 (07); 10-50 (09); ≤20 (10) | Generic 5-50, never reward >30; sector rules keep their bands | Thresholds are D everywhere; the evidence is that unevidenced lists add little [S46]. |
| 17 | "List even beginner skills" (TARGETjobs [S62]) vs "don't claim what you can't defend" (CV FCQ-11) | List them, but pinned top skills must be evidenced and no proficiency adjectives without evidence | Resolves both; matches IMC's calibration advice [S97]. |
| 18 | Naming a target firm in the headline: avoid (03, 06, 08) vs PrepLounge's "showcase target firms" [S116] | Avoid single-firm aspiration (minor); "Incoming X at Y" with a real offer passes | Students apply to several firms; the PrepLounge view is C-grade and US-leaning. Marked contested. |
| 19 | Grade on LinkedIn: major (08), minor (06, 09), never a fail (05) | Kept per sector; the generic education rule checks completeness, not grade | Sector norms really differ (banks signal 2:1; Jane Street has no GPA requirement [S94]). |
| 20 | Confidentiality: critical in quant, consulting, finance, data; absent elsewhere | One generic critical rule (`LI-GEN-03`) for all sectors; quant keeps its own P&L pre-filter rule | Confidential disclosure is never acceptable. |
| 21 | Recommendations: minor scored (01, 03-07), major final (09, 10) vs not scored (02) | Advisory | Network-dependent; may be missing from the PDF. |
| 22 | All-Star = 7 sections (LinkedIn Help [S9]) vs "50 connections" (OU [S66]) | LinkedIn Help | Primary source. |
| 23 | Duplicate rules across files (e.g. 7 CV-consistency rules, 5 photo rules, 5 Open to Work rules) | Folded into one generic rule each (§12) | No double counting; `origin` keeps traceability. |

---

## 10. Evidence gaps and open questions

**Gaps every researcher hit**
1. **No public UK data on how often graduate recruiters look at students' LinkedIn**, or what they do with it. The ISE 2025 survey is paywalled [S54]; **the ISE 2026 report is released today (14 Oct 2026) and should be checked**. A 5-question poll of employers on Placed would beat every source here.
2. **No study links LinkedIn profile features to UK student hiring outcomes.** Rater studies are North American or Belgian [S46][S47][S48].
3. **No employer in any sector publishes how it uses student LinkedIn profiles.** Most sector rules apply grade-A employer *values* to the profile (grade B at best) or are synthesis (D).
4. **Save to PDF contents are undocumented** [S1] and contested [S38][S39][S40]. This decides the input tag for 7 rules.
5. **The web-search budget (200 calls) ran out mid-research and firecrawl had no credits.** Not fetched: Russell Group LinkedIn pages (UCL, Manchester, Warwick, Cambridge), Bright Network (403) [S75][S84], Prospects' LinkedIn guide, Gradcracker, Deloitte/EY/KPMG/PwC student pages, McKinsey students (timeout), Kearney, Oliver Wyman UK (404), Citadel Securities (403) [S109], G-Research, DRW, Flow Traders, SIG, L'Oréal and WPP UK [S153][S154], the IFS page (403) [S166], Imperial's ECRI tipsheet (SSO) [S159]. Rules sourced to TARGETjobs plus one careers service would move from B to A if two Russell Group pages confirm them.
6. **Character limits and photo/banner specs are trade-sourced** [S31][S32][S34]. Fetch the LinkedIn help pages.
7. **Dead primary sources:** the 21x photo, skills 17x and Open to Work 40% blog posts all redirect [S27][S28][S29], and the network-gap post too [S22].
8. **Mirrors and snippets:** Meta RPM, Google APM grad, MSR intern and Unilever postings were read on mirrors [S120][S121][S165][S151]. TARGETjobs and LSE quotes came through a summarising fetch tool (08). Re-check wording before quoting any of these in the UI.
9. **Verify before UI use:** the Roulin & Levashina DOI (quoted from memory) [S46]; the IMC Prosperity page date [S100]; the Civil Service name-blind practice (2015) [S58]; whether Recruiter Lite sees recruiters-only Open to Work [S2][S15].
10. **Scoring weights, thresholds and caps are grade D.** Calibrate on 20-30 real student profiles labelled by careers advisers.

**Open questions for Berke**
1. Should the LinkedIn score be visible as a number at all, or only as fix cards plus a label? (The research says it is not comparable with the CV score.)
2. Sub-track capture: quant QT vs QR/QD, marketing brand vs growth, and product technical vs non-technical change severities in 4 rules. Do we add one onboarding question?
3. Who supplies the 5+ fixtures, and when? Team members' own exports are the fastest route.
4. Does the screenshot path (Featured) make the hackathon cut, or do we ship PDF-plus-pasted-links only?
5. Should the rewrite suggestions write directly into a copyable "new headline / new About" block (high value, low effort), with grounding checks reused from `lib/verify`?

---

## 11. Implementation notes

- **Engine fit:** `Severity`, `Evidence`, `Citation`, `Archetype` and `Year` match `lib/cv-rules/types.ts` and `lib/types.ts`. Add `type LiDimension = "integrity" | "proof" | "findability" | "narrative" | "polish" | "presence"` and generalise `aggregateCvScore` over the dimension union, or copy it.
- **Checkers:** most `code` rules reuse CV checkers by analogy: `spelling`, `cliche_density`, `skills_evidenced`, `quantified_bullets`, `github_link`, `we_vs_i`, `uk_grades`. New ones needed: LinkedIn-PDF detector and section parser, slug check, date-overlap check, CV-vs-LinkedIn entity diff (reuse the `lib/verify` matching), CFA-wording regex, discretion pre-filter.
- **Order of work for the hackathon:** (1) PDF detector + parser + fixtures; (2) the 3 integrity criticals plus the CV diff; (3) headline/About/experience rules for the user's archetype; (4) fix cards with grounded rewrites; (5) Featured screenshot path last.
- Load the keyword banks from the sector files as data. Don't inline them in rules.

---

## 12. Folded rules and scorer guards

Researcher rules that duplicated a generic rule are handled by that rule. Their original severities and evidence notes are recorded in the generic rule's `evidenceNote` and `origin`.

| Sector rule | Now handled by |
|---|---|
| LI-SOFTWARE_ENG-15 | LI-GEN-01 |
| LI-SOFTWARE_ENG-17 | LI-GEN-25 |
| LI-DATA_ANALYTICS-14 | LI-GEN-03 |
| LI-DATA_ANALYTICS-16 | LI-GEN-28 |
| LI-DATA_ANALYTICS-17 | LI-GEN-25 |
| LI-QUANT_TRADING-11 | LI-GEN-01 |
| LI-QUANT_TRADING-13 | LI-GEN-25 |
| LI-QUANT_TRADING-15 | LI-GEN-02 |
| LI-CONSULTING-11 | LI-GEN-01 |
| LI-CONSULTING-12 | LI-GEN-22 |
| LI-CONSULTING-14 | LI-GEN-03 |
| LI-CONSULTING-16 | LI-GEN-24 |
| LI-CONSULTING-17 | LI-GEN-10, LI-GEN-11, LI-GEN-28 |
| LI-PRODUCT-14 | _meta.scorerGuards.nonTechDegreeNotPenalised |
| LI-PRODUCT-15 (part a) | LI-GEN-01 |
| LI-PRODUCT-16 | LI-GEN-10, LI-GEN-25 |
| LI-FINANCE_BANKING-02 | LI-GEN-01 |
| LI-FINANCE_BANKING-03 | LI-GEN-02 |
| LI-FINANCE_BANKING-05 | LI-GEN-03 |
| LI-FINANCE_BANKING-14 | LI-GEN-24 |
| LI-FINANCE_BANKING-16 | LI-GEN-10, LI-GEN-11, LI-GEN-28 |
| LI-FINANCE_BANKING-17 | _meta.scorerGuards.noVanityInputs |
| LI-MARKETING_GROWTH-13 | LI-GEN-24 |
| LI-MARKETING_GROWTH-14 | LI-GEN-25 |
| LI-MARKETING_GROWTH-16 | LI-GEN-26 |
| LI-MARKETING_GROWTH-17 | LI-GEN-01 |
| LI-RESEARCH-14 | LI-GEN-26 |
| LI-RESEARCH-16 | LI-GEN-01 |

**Scorer guards** (configuration, not user-facing checks; in `_meta.scorerGuards`): `noVanityInputs`, `noPhotoAppearance`, `nonTechDegreeNotPenalised`, `noUniversityPrestige`, `nonUkExperienceJudgedOnDescription`, `protectedCharacteristicsIgnored`, `zeroPostsNeverFail`, `noMultipliersInUi`, `notApplicableNotFail`, `claimsAreAdvisory`, `neverInventAchievements`.

---

## 13. Sources (deduplicated)

All accessed 2026-10-14 by the researchers. "Tags" lists the researcher-local citation tags each entry replaces (`01:L1` = file 01 tag [L1]; `cv:S13` = `cv-rules-finance-consulting.md` §9; `int:` = Placed internal docs). The notes record fetch status (snippet-only, 403, mirror, dead link) exactly as the researchers reported it. Sources cited only as evidence of a myth are kept so the myth can be traced.

S1. Save a profile as a PDF (answer a541960). LinkedIn Help, live 2026. https://www.linkedin.com/help/linkedin/answer/a541960. *Tags: 01:L1, 02:S10, 03:L6, 04:S1, 05:Q17, 06:L10, 08:L13, 09:S16, 10:S12.* Fetched by 9 of 10 researchers. Desktop-only, English-only, 200 downloads/month incl. your own. Does not list included sections.
S2. Let recruiters know you're open to work (answers 67405 / a507508). LinkedIn Help, live 2026. https://www.linkedin.com/help/linkedin/answer/67405. *Tags: 01:L2, 03:L5, 04:S13, 05:Q18, 06:L16, 09:S15.* Alt URL https://www.linkedin.com/help/linkedin/answer/a507508. Three visibility levels; recruiters-only 'can't guarantee complete privacy'. No statistic.
S3. Customize your public profile URL (answer 87). LinkedIn Help, live 2026. https://www.linkedin.com/help/linkedin/answer/87. *Tags: 01:L3.* 3-100 chars; changeable 5 times per 6 months.
S4. Add and remove skills on your profile (answer a549047). LinkedIn Help (LinkedIn Learning help centre), live 2026. https://www.linkedin.com/help/learning/answer/a549047. *Tags: 01:L4.* Up to 100 skills.
S5. Skills on your profile (answer a564064). LinkedIn Help, n.d.. https://www.linkedin.com/help/linkedin/answer/a564064. *Tags: 04:S2.* Skills improve 'likelihood to be found in others' searches'.
S6. Skill endorsements (answer 31888). LinkedIn Help, live 2026. https://www.linkedin.com/help/linkedin/answer/31888. *Tags: 01:L5.* Mechanism only, no effect size.
S7. Featured section / Manage featured samples of your work (answer 111587). LinkedIn Help, live 2026. https://www.linkedin.com/help/linkedin/answer/111587. *Tags: 01:L6, 03:L4.*
S8. Verifications on your LinkedIn profile (answer 140551). LinkedIn Help, live 2026. https://www.linkedin.com/help/linkedin/answer/140551. *Tags: 01:L7.* Claims 60% more profile views for verified members; no method.
S9. Use the profile level meter to update your profile (answer 391). LinkedIn Help (LinkedIn Learning help centre), live 2026. https://www.linkedin.com/help/learning/answer/391. *Tags: 01:L8.* All-star = 7 sections.
S10. Create a good LinkedIn profile (answer a554351). LinkedIn Help, n.d. (live 2026). https://www.linkedin.com/help/linkedin/answer/a554351. *Tags: 04:S2b, 07:P8.* Photo 'up to 2X more profile views'; About 'one or two paragraphs'.
S11. Add, change, edit, or delete your LinkedIn profile photo (answer a541850). LinkedIn Help, n.d.. https://www.linkedin.com/help/linkedin/answer/a541850. *Tags: 04:S2c.* No view statistic on the page.
S12. Skills help article (100-skill limit) (answer 35265). LinkedIn Help, n.d.. https://www.linkedin.com/help/linkedin/answer/35265. *Tags: 09:S17.* Search-indexed snippet only, not fetched.
S13. Add sections to your profile (section list). LinkedIn Help, n.d.. URL not confirmed. *Tags: 10:S19.* Search snippet only; exact URL not confirmed.
S14. LinkedIn Professional Community Policies. LinkedIn, live 2026. https://www.linkedin.com/legal/professional-community-policies. *Tags: 02:S15.* No misleading info about qualifications/experience; no artificial engagement; photo must be your likeness.
S15. How to use LinkedIn Recruiter to search for candidates. LinkedIn Talent Solutions, n.d. (live 2026). https://business.linkedin.com/hire/resources/talent-acquisition/how-to-use-linkedin-recruiter. *Tags: 01:L9.* '40+ advanced search filters'; Spotlights.
S16. 2025 LinkedIn Hiring Release, Wave 2. LinkedIn Talent Solutions, 2025. https://business.linkedin.com/hire/product-update/wave2-2025. *Tags: 01:L10.* AI-Assisted Search; 18% higher InMail acceptance (no method).
S17. 2026 LinkedIn Hiring Release: What's New and What's Next. LinkedIn Talent Community, 2026. https://tcommunity.linkedin.com/product-updates/2026-linkedin-hiring-release-2275. *Tags: 01:L11.* Semantic search on 'hard-to-define skills'.
S18. These InMails Get the Best Response Rates. LinkedIn Talent Blog, 2022. https://www.linkedin.com/business/talent/blog/talent-strategy/these-inmails-get-best-response-rates. *Tags: 02:S8.* Open to Work candidates: 37% higher InMail response (global; response, not hiring).
S19. The Skills Signal: Unlocking opportunity in a changing labor market. LinkedIn Economic Graph (with OECD), 2025. https://economicgraph.linkedin.com/content/dam/me/business/en-us/talent-solutions/resources/pdfs/the-skills-signal-report-2025.pdf. *Tags: 03:L7.* UK: 8% of recruiter searches filter solely on skills; avg skills 5 -> 9 (2019-2024).
S20. Skills-based resources (research hub). LinkedIn Economic Graph, 2025. https://economicgraph.linkedin.com/research/skills-based-resources. *Tags: 04:S3.* LinkedIn's own research (conflict of interest).
S21. Insights on US Network Homophily and Strength by Gender, Race, and Community Income. LinkedIn Economic Graph (D. Kavanagh Smith), 2023. https://economicgraph.linkedin.com/blog/insights-on-us-network-homophily-and-strength-by-gender-race-and-community-income. *Tags: 02:S18.* US data.
S22. Closing the Network Gap. LinkedIn, 2019. https://blog.linkedin.com/2019/september/26/closing-the-network-gap. *Tags: 02:S19.* Redirects; figures via search summaries and business.linkedin.com thinkinsights/network-gap. Grade C until verified.
S23. The Future of Recruiting 2023. LinkedIn Talent Solutions, 2023. URL not confirmed. *Tags: 03:L8.* Excerpt via trade press only; URL not recorded; not used in rules.
S24. Future of Recruiting 2025. LinkedIn Talent Solutions, 2025. https://business.linkedin.com/content/dam/me/business/en-us/talent-solutions/resources/pdfs/future-of-recruiting-2025-stff.pdf. *Tags: 09:S21.* PDF text not readable on fetch; skills-search statistic unverified.
S25. 10 Tips for Taking a Professional LinkedIn Profile Photo. LinkedIn Talent Blog, 2024. https://www.linkedin.com/business/talent/blog/product-tips/tips-for-taking-professional-linkedin-profile-pictures. *Tags: 04:S12.* Claims photo = '14 times more likely to be viewed'. Contradicts LinkedIn Help's 2X.
S26. Rethinking LinkedIn endorsements so members always look their best. LinkedIn Newsroom, 2016. https://news.linkedin.com/2016/rethinking-linkedin-endorsements-so-members-always-look-their-best. *Tags: 07:P9.* '5+ skills = up to 17x more profile views'; correlational, self-reported.
S27. LinkedIn Profile Photo Tips: Introducing Photo Filters and Editing (dead link). LinkedIn Blog, 2017. https://blog.linkedin.com/2017/march/14/linkedin-profile-photo-tips-introducing-photo-filters-and-editing. *Tags: 10:S20.* Claimed origin of '21x'. Redirects to linkedin.com/blog/member; not fetched.
S28. The benefits of sharing with your community you're open to work (dead link). LinkedIn Blog, 2020. https://blog.linkedin.com/2020/october/29/the-benefits-of-sharing-with-your-community-you-re-open-to-work. *Tags: 01:DEAD1.* Origin of Open to Work 40%/20% figures. Redirects to linkedin.com/blog/member.
S29. Expert tips for making skills on your LinkedIn profile stand out (dead link). LinkedIn Blog, 2016. https://blog.linkedin.com/2016/10/26/expert-tips-for-making-skills-on-your-linkedin-profile-stand-out. *Tags: 01:DEAD2.* Origin of skills 17x/33x figures. Redirects to linkedin.com/blog/member.
S30. Building a Great Student Profile (hosted copy). LinkedIn Corporation (hosted by NC State Poole College), 2013. https://poole.ncsu.edu/undergraduate/wp-content/uploads/sites/23/2023/06/LinkedIn-Building-a-Great-Student-Profile.pdf. *Tags: 01:L13.* Only LinkedIn-branded student checklist found; US-centric, dated. Says photo = 7x.
S31. LinkedIn Character Limits in 2026 (Complete Reference for Every Field). UniLink (trade), 2026. https://www.unilink.us/blog/linkedin-character-limits-2026. *Tags: 01:L16, 08:L17.* Headline 220 / About 2,600 / Experience 2,000. Trade source only.
S32. LinkedIn character limits. AuthoredUp (trade), 2026. https://authoredup.com/blog/linkedin-character-limit. *Tags: 01:L17.* Search snippet, not fetched.
S33. LinkedIn Creator Mode retired (trade summaries). Socialk.it / Guiding Tech, 2024-26. https://socialk.it/en/blog/linkedin-creator-mode-retired. *Tags: 01:L18.* Also https://www.guidingtech.com/you-cant-activate-creator-mode-on-linkedin-anymore-heres-what-you-can-do-instead. Snippet, not fetched.
S34. LinkedIn size guide 2026. Linearity (trade), 2026. https://linearity.io/blog/linkedin-size-guide/. *Tags: 01:L19.* Snippet, not fetched.
S35. How to add your personal pronouns to your LinkedIn profile. Android Central, n.d.. https://www.androidcentral.com/how-add-your-personal-pronouns-your-linkedin-profile. *Tags: 01:L20.* Snippet, not fetched.
S36. LinkedIn Recruiter search filters (practitioner). Skylead / Leonar, 2024-26. https://skylead.io/blog/find-employees-using-linkedin-recruiter-search-filters/. *Tags: 01:L21.* Also https://www.leonar.app/__md/blog/linkedin-recruiter-search-filters.md. Snippet, not fetched.
S37. YOE in LinkedIn Recruiter Demystified. Boolean Strings (Irina Shamaeva), 2022. https://booleanstrings.com/2022/04/04/yoe-in-linkedin-recruiter-demystified/. *Tags: 01:L22.* Snippet, not fetched.
S38. How to Export Your LinkedIn Profile to PDF (2026 Step-by-Step Guide). magic-self.dev (trade), 2026. https://www.magic-self.dev/blog/how-to-export-linkedin-profile-to-pdf. *Tags: 01:L23.*
S39. Save Your LinkedIn Profile as a PDF in Under 2 Minutes (2026). Aycabtu Blog (trade), 2026. https://aycabtu.com/blog/how-to-export-linkedin-profile-pdf. *Tags: 01:L24.*
S40. A Profile in a PDF? What, Why and How. Sid Clark, LinkedIn Pulse (practitioner), n.d.. https://www.linkedin.com/pulse/profile-pdf-what-why-how-sid-clark. *Tags: 01:L25.* PDF has no download date.
S41. 40 million people are using LinkedIn's #OpenToWork badge right now, but recruiters say it can look desperate. Fortune, 2024. https://fortune.com/2024/09/05/linkedin-opentowork-badge-recruiters-job-search/. *Tags: 01:L15.* Re-quotes LinkedIn's 2020 40%/20% figures; UK recruiters disagree on the public frame.
S42. LinkedIn adds profile picture filters (reports 21x/36x/9x). Search Engine Journal, 2017. https://www.searchenginejournal.com/linkedin-profile-picture-filters/190137/. *Tags: 03:L15.* Trade press reporting a vendor claim.
S43. Get more views on your LinkedIn page by using a profile picture. Press and Journal, 2017. https://www.pressandjournal.co.uk/fp/news/1202209/get-views-linkedin-page-using-profile-picture/. *Tags: 07:P10, 09:S19.* Reports LinkedIn's 'up to 21x' claim; no methodology.
S44. LinkedIn profiles with a photo get 21x more views. Towson University (TU Today), 2019. https://tutoday.towson.edu/2019/02/11/linkedin-profiles-with-a-photo-get-21x-more-views-update-yours. *Tags: 08:L18.* Repost of the myth; snippet only.
S45. Does your LinkedIn profile picture matter?. Lilach Bullock (blog), n.d.. https://www.lilachbullock.com/does-linkedin-profile-picture-matter/. *Tags: 02:S13.* Cited only as evidence of the 21x myth.
S46. LinkedIn as a New Selection Method: Psychometric Properties and Assessment Approach (Roulin & Levashina, Personnel Psychology 72(2)); summary 'Kent State Researcher Studies LinkedIn as Employee Selection Tool'. Personnel Psychology / Kent State University, 2019. https://www.kent.edu/business/news/kent-state-researcher-studies-linkedin-employee-selection-tool. *Tags: 02:S5, 03:L9.* Journal article not fetched; DOI 10.1111/peps.12296 quoted from memory by researcher 03, verify before UI use.
S47. Do They Find You on Facebook? Facebook Profile Picture and Hiring Chances (Baert). IZA DP 9584 / New Media & Society, 2015/2018. https://repec.iza.org/dp9584.pdf. *Tags: 02:S9.* Belgian field experiment: ~39% more interview invites for the most favourable photo.
S48. An Experiment in Hiring Discrimination via Online Social Networks (Acquisti & Fong). Management Science, 2020. https://papers.ssrn.com/abstract=2031979. *Tags: 02:S11.* 403 on fetch; abstract summaries only.
S49. Number of Employers Using Social Media to Screen Candidates at All-Time High (CareerBuilder / Harris Poll). CareerBuilder, 2017. https://www.careerbuilder.com/advice/blog/60-of-employers-are-peeking-into-candidates-social-media-profiles. *Tags: 02:S6, 09:S20.* US, n=2,380, vendor survey; 403 on fetch; figures via https://www.staffingindustry.com/news/global-daily-news/social-media-candidate-screening-record-high-survey-finds. Grade C.
S50. UK Graduates With Inappropriate Online Photos 70 Per Cent Less Likely to get job Interviews (AVG 'Digital Diaries'). AVG Technologies via PR Newswire, 2012. https://www.prnewswire.co.uk/news-releases/uk-graduates-with-inappropriate-online-photos-70-per-cent-less-likely-to-get-job-interviews-182168891.html. *Tags: 02:S7.* Vendor-commissioned, 230 HR pros, pre-GDPR. Grade C.
S51. A Catch-22 When Sourcing Black Candidates. ERE, 2021. https://www.ere.net/articles/a-catch-22-when-sourcing-black-candidates. *Tags: 02:S14.* 26% photo statistic unsourced.
S52. Researchers find 1,000 LinkedIn profiles using computer-generated faces. The Register, 2022. https://www.theregister.com/2022/03/28/fake_linkedin_faces/. *Tags: 02:S17.*
S53. Pre-employment vetting of candidates (draft guidance, under review). Information Commissioner's Office, draft, under review 2025-26. https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/recruitment-and-selection/pre-employment-vetting-of-candidates/. *Tags: 02:S4.* Checks must be justified and disclosed; not decide on online info alone.
S54. ISE Student Recruitment Survey 2025. Institute of Student Employers, 2025. https://ise.org.uk/knowledge/research/491/ise_student_recruitment_survey_2025. *Tags: 02:S12.* Paywalled; no public LinkedIn data. 2026 report due 14 Oct 2026.
S55. FG24/1: Finalised guidance on financial promotions on social media. Financial Conduct Authority, 2024. https://www.fca.org.uk/publications/finalised-guidance/fg24-1-finalised-guidance-financial-promotions-social-media. *Tags: 08:L12.* Regulator; context only.
S56. How to Share Your Achievements (CFA marks / trademark usage guidance). CFA Institute, 2026. https://www.cfainstitute.org/en/about/governance/policies/trademark-usage-guide-for-cfa-charterholders. *Tags: 08:L11.* 'CFA Level I' is not an allowed designation.
S57. The Civil Service Code. Cabinet Office, GOV.UK, 2015 (current). https://www.gov.uk/government/publications/civil-service-code/the-civil-service-code. *Tags: 10:S16.* Impartiality duties.
S58. Name blind recruitment: a commitment to diversity (John Manzoni). Civil Service Blog, GOV.UK, 2015. https://civilservice.blog.gov.uk/2015/11/05/name-blind-recruitment-a-commitment-to-diversity/. *Tags: 04:S11, 10:S17.* Researcher 04 fetched a shorter URL variant; researcher 10 saw snippet only. Old; current practice may vary.
S59. Online collaboration: Scientists and the social network (Van Noorden). Nature, 2014. https://www.nature.com/news/onlinecollaboration-scientistsand-the-social-network-1.15711. *Tags: 10:S15.* Old, all career stages, not UK-specific.
S60. What is ORCID?. ORCID, n.d.. https://info.orcid.org/what-is-orcid/. *Tags: 10:S14.*
S61. Google Scholar Citations: help. Google, n.d.. https://scholar.google.com/intl/en/scholar/citations.html. *Tags: 10:S13.* Profile needs verified university email to appear in search.
S62. The graduate's guide to creating the perfect LinkedIn profile. TARGETjobs (GTI), 2026 (updated 11 Aug 2026). https://targetjobs.co.uk/careers-advice/finding-a-job/graduates-guide-creating-perfect-linkedin-profile. *Tags: 02:S1, 03:L1, 04:S6, 06:L13, 07:P7, 08:L10, 09:S2.* Most-cited source (7 researchers). Alt URL https://targetjobs.co.uk/careers-advice/networking/449493-the-graduates-guide-to-creating-the-perfect-linkedin-profile. Quotes recruiter Simon Katchay (GTI) and cites Cibyl 2021 (79% of students use LinkedIn for careers).
S63. Why Employers think you should use LinkedIn. University of Surrey Careers blog, 2020. https://blogs.surrey.ac.uk/careers/?p=3084. *Tags: 02:S2.* Lidl recruiter quote. No '95%' statistic on the page.
S64. LinkedIn and online presence. University of Nottingham Careers and Employability Service, n.d. (live 2026). https://www.nottingham.ac.uk/careers/students/applications/linkedin-and-online-presence.aspx. *Tags: 02:S3.*
S65. LinkedIn Profile Checklist. University of Worcester Careers, n.d.. https://www2.worc.ac.uk/careers/documents/LinkedIn_Checklist.pdf. *Tags: 02:S16.*
S66. Your guide to making the most of LinkedIn. The Open University Careers & Employability Services, 2020. https://help.open.ac.uk/students/_data/documents/careers/your-guide-to-making-the-most-of-LinkedIn.pdf. *Tags: 01:L14.* Repeats 21x and '50 connections for All-Star' (conflicts with LinkedIn Help).
S67. Maximise your LinkedIn profile (Noemie Oster). Imperial College London Careers Service, 2024. https://www.imperial.ac.uk/news/252093/maximise-your-linkedin-profile/. *Tags: 03:L2, 04:S14.*
S68. LinkedIn (careers guidance page). Imperial College London Careers Service, n.d. (live 2026). https://www.imperial.ac.uk/admin-services/careers/applications-and-interviews/linkedin/. *Tags: 09:S1, 10:S3.* Headline 120 chars fact-based; About 100-250 words; up to 50 skills; says endorsements feed search ranking (unverified).
S69. LinkedIn (student development page). University of Edinburgh Business School, n.d.. https://development.business-school.ed.ac.uk/linkedin/. *Tags: 03:L3.* Headline 200 chars, About 2,000 chars (older limits).
S70. LinkedIn (looking for work). LSE Careers, n.d. (live 2026). https://info.lse.ac.uk/current-students/careers/information-and-resources/looking-for-work/linkedIn. *Tags: 08:L9.* Personalised connection notes; quote retrieved via a summarising tool, re-check before UI use.
S71. Networking (looking for work). LSE Careers, n.d.. https://info.lse.ac.uk/current-students/careers/information-and-resources/looking-for-work/networking. *Tags: 06:L6.*
S72. Networking. University of Cambridge Careers Service, n.d.. https://www.careers.cam.ac.uk/node/601. *Tags: 06:L7.*
S73. LinkedIn (job search). University of Manchester Careers Service, n.d.. https://careers.manchester.ac.uk/findjobs/job-search/linkedin. *Tags: 06:L8.* Some organisations 'sometimes screen out applicants who aren't following their company'.
S74. LinkedIn. University of Aberdeen Careers Service, n.d.. https://abdn.ac.uk/careers/applying/linkedin. *Tags: 06:L9.* Page has unsourced stats (14x photo; posting 200-2000%).
S75. LinkedIn for students and graduates. Bright Network, n.d.. https://www.brightnetwork.co.uk/graduate-career-advice/key-career-skills/how-stand-out-graduate/linkedin-for-students-graduates/. *Tags: 03:L19.* 403; excerpt only.
S76. Should students bother with LinkedIn? (A. Shoker). University of Warwick Student Opportunity blog, 2021, revised 2025. https://warwick.ac.uk/services/careers/blog/should_students_bother_with_linkedin. *Tags: 09:S7.*
S77. Career Essentials: LinkedIn - sourcing opportunities and raising your profile (event listing). UCL, 2026. https://www.ucl.ac.uk/study/events/2026/oct/career-essentials-linkedin-sourcing-opportunities-and-raising-your-profile. *Tags: 07:P11.* Search result only, not fetched.
S78. Google Resume Workshop (report of a talk by Google recruiters). University of Toronto Teaching Labs Ambassadors, 2025. https://www.teach.cs.toronto.edu/ambassadors/blog/2025-events/google_resume_workshop. *Tags: 03:L10.* Secondary report; North American audience.
S79. Tips for a graduate technical CV: template and advice. TARGETjobs, 2025. https://targetjobs.co.uk/careers-advice/information-technology/tips-graduate-technical-cv-template-and-advice. *Tags: 03:L11.*
S80. Preparing for mobile interviews at Monzo (Jamie McDonald). Monzo blog, 2025. https://monzo.com/blog/preparing-for-mobile-interviews-at-monzo. *Tags: 03:L12.*
S81. 8 things Amazon recruiters say top job candidates do (Brittany Bunch). About Amazon, c. 2023-24. https://aboutamazon.com/news/workplace/successful-amazon-job-candidates. *Tags: 03:L13.* No LinkedIn mention.
S82. IT & computing sector (sector insights). University of Birmingham Careers Network, n.d.. https://intranet.birmingham.ac.uk/student/careers/sector-insights/it-computing.aspx. *Tags: 03:L14.*
S83. Software Engineer Intern listing (London), Bloomberg. Bright Network / RateMyPlacement, 2024 cycle. https://www.brightnetwork.co.uk/graduate-jobs/bloomberg/2024-software-engineer-intern. *Tags: 03:L16.* Excerpt only (403). Grade B-.
S84. How to build a CV and LinkedIn profile for the tech industry. Bright Network, n.d.. https://brightnetwork.co.uk/graduate-career-advice/stem-advice/building-cv-linkedin-tech. *Tags: 03:L17.* Excerpt only (403); not quoted.
S85. 2025 Developer Survey: Technology. Stack Overflow, 2025. https://survey.stackoverflow.co/2025/technology. *Tags: 03:L18.* Reused from cv-rules-tech-product.md; not re-fetched.
S86. Octoverse 2025. GitHub Blog, 2025. https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/. *Tags: 03:L18.* Reused from cv-rules-tech-product.md; not re-fetched.
S87. Careers in data. LSE Careers, n.d. (current). https://info.lse.ac.uk/current-students/careers/information-and-resources/employment-sectors/data. *Tags: 04:S5.* GitHub 'standard practice in the sector'; alumni finder.
S88. Data analyst job profile. Prospects (Jisc), 2026. https://www.prospects.ac.uk/job-profiles/data-analyst. *Tags: 04:S7.* Portfolio on open datasets; question -> data -> method -> result.
S89. Data scientist job profile. Prospects (Jisc), 2025. https://www.prospects.ac.uk/job-profiles/data-scientist. *Tags: 04:S8.* Kaggle 'can help you gain visibility and experience'.
S90. Data Science and AI Graduate Scheme. Lloyds Banking Group, 2025-26. https://www.lloydsbankinggrouptalent.com/our-opportunities/graduates/data-science-and-ai-graduate-scheme/. *Tags: 04:S9.* Python, SQL, stats assessed; no minimum degree class.
S91. Data & Analytics graduate programme. Sky Early Careers, 2026. https://careers.sky.com/earlycareers/graduates/data/data-and-analytics. *Tags: 04:S10.*
S92. Google Career Certificate in Data Analytics. Grow with Google UK, 2026. https://grow.google/intl/uk/google-career-certificates/data-analytics/. *Tags: 04:S15.*
S93. UK businesses and tech talent (Google Career Certificates employer consortium). Google (The Keyword blog), 2022. https://blog.google/company-news/inside-google/around-the-globe/google-europe/united-kingdom/uk-businesses-and-tech-talent/. *Tags: 04:S16.* BBC, BT, Deloitte, John Lewis will 'consider' holders.
S94. Interviewing (FAQ: cover letters, GPA, applications). Jane Street, live 2026. https://www.janestreet.com/join-jane-street/interviewing/. *Tags: 05:Q1, cv:S13.* No GPA or degree requirement.
S95. Quantitative finance (sector page). University of Oxford Careers Service, 2026. https://www.ox.ac.uk/careers/careers-guidance/explore-careers/sectors-and-occupations/quantitative-finance. *Tags: 05:Q2, cv:S12.* 403 in the LinkedIn research run; no quotes used here.
S96. Quantitative Trading Internship (2027 Start), Amsterdam. Optiver, 2026 posting. https://www.optiver.com/join-us/jobs/trading/amsterdam/quantitative-trading-internship-2027-start/. *Tags: 05:Q3, cv:S17.* 'Interested in strategic games and/or competitive activities'.
S97. Recruitment Process (CV advice, APAC page). IMC Trading, live 2026. https://www.imc.com/ap/careers/recruitment-process. *Tags: 05:Q4, cv:S15.* 'compare yourself to professionals and not fellow students'; don't list Office. APAC page, assumed to apply in Europe.
S98. Programs and Events. Jane Street, live 2026. https://www.janestreet.com/join-jane-street/programs-and-events/. *Tags: 05:Q5.* 'Many of us had little to no experience in economics or finance'.
S99. INSIGHT programme. Jane Street, live 2026. https://www.janestreet.com/join-jane-street/programs-and-events/insight/. *Tags: 05:Q6.*
S100. PROSPERITY 4: IMC's latest global trading challenge. IMC Trading, 2026 (date to verify). https://www.imc.com/eu/corporate-news/prosperity-4. *Tags: 05:Q7.* 22,600 players in 2025; standout performers hired. Page date ambiguous.
S101. Student opportunities. Hudson River Trading, live 2026. https://www.hudsonrivertrading.com/student-opportunities/. *Tags: 05:Q8.*
S102. Inside Knowledge: Careers in Banking and Financial Markets 2025/2026. eFinancialCareers (hosted by Imperial College Careers Service), 2025. https://www.imperial.ac.uk/media/imperial-college/administration-and-support-services/careers-service/public/resources/efinancialcareers-Careers-in-Banking-and-Financial-Markets-2526.pdf. *Tags: 05:Q10, cv:S7.* p.23 social-media line is banking-CV context; p.80 intern non-competes (no firm named); p.118 GitHub quote is a fintech recruiter.
S103. Morning Coffee: Hedge funds are demanding awkward information in return for highest pay (D. Davies). eFinancialCareers, 2025. https://www.efinancialcareers.com/news/hedge-funds-pnl-proof-hiring. *Tags: 05:Q12.* Experienced-hire context, applied by analogy.
S104. The 25 universities Jane Street loves most for its quants & engineers (A. McMurray). eFinancialCareers, 2026. https://www.efinancialcareers.co.uk/news/jane-street-target-universities. *Tags: 05:Q13.* Method: public LinkedIn profiles of staff.
S105. This is what it takes to get a $64k Jane Street internship (A. McMurray). eFinancialCareers, 2025. https://www.efinancialcareers.co.uk/news/this-is-what-it-takes-to-get-a-64k-jane-street-internship. *Tags: 05:Q14.* US-centric sample (72 interns).
S106. Why did people in HFT/quant take down their LinkedIn profiles? (anonymous thread). Blind (teamblind.com), 2022. https://www.teamblind.com/post/why-did-people-in-hft-quant-take-down-their-linkedin-profiles-s24iemwy. *Tags: 05:Q15.* Anonymous, grade C-; context only.
S107. Fraud and Impersonation Warnings. Jane Street, live 2026. https://www.janestreet.com/fraud-and-impersonation-warnings/. *Tags: 05:Q16.*
S108. Citadel's Data Open showcases innovative recruitment approach. Citadel, 2018. https://www.citadel.com/wp-content/uploads/2018/03/Citadels_Data_Open_showcases_innovative_recruitment-approach.pdf. *Tags: 05:Q19.* Search snippets only; no quotes.
S109. Our Campus Quantitative Research Interview Process. Citadel Securities, Nov 2024 (mod. Sep 2026). https://www.citadelsecurities.com/careers/career-perspectives/our-quantitative-research-interview-process/. *Tags: cv:S19.* Cited in the CV research; 403 in the LinkedIn run.
S110. Associate Jobs: United Kingdom. BCG, live 2026. https://careers.bcg.com/global/en/locations/united-kingdom/associate-jobs. *Tags: 06:L1, cv:S24.* Grad deadline 18 Oct 2026; internships 1-24 Jan 2027; 2:1 minimum.
S111. Bain London University Hiring. Bain & Company, live 2026. https://www.bain.com/careers/recruiting/london-recruiting/. *Tags: 06:L2, cv:S23.* Full-time deadline 15 Oct 2026; ACI from Nov 2026.
S112. Careers at L.E.K.. L.E.K. Consulting, live 2026. https://www.lek.com/careers. *Tags: 06:L3.*
S113. Careers. Oliver Wyman, live 2026. https://www.oliverwyman.com/careers.html. *Tags: 06:L4.*
S114. Applying to McKinsey & Company: CVs, cover letters and interviews (Jacky Barrett). TARGETjobs, 2025. https://targetjobs.co.uk/careers-advice/business-consulting-and-management/applying-mckinsey-company-cvs-cover-letters-and-interviews. *Tags: 06:L5, cv:S22.*
S115. How hard is it to get into consulting? (cites Cibyl Graduate Research UK 2022). TARGETjobs, 2023. https://targetjobs.co.uk/careers-advice/business-consulting-and-management/how-hard-is-it-to-get-into-consulting. *Tags: 06:L11, cv:S27.* 87% of consulting-interested students use LinkedIn for careers (n=65,432).
S116. How you can use LinkedIn for your consulting applications. PrepLounge, 2026. https://www.preplounge.com/en/blog/consulting/interview/linkedin-referrals. *Tags: 06:L12.* Practitioner, grade C.
S117. 12 skills that consulting recruiters want in graduates (Olivia Rowland). TARGETjobs, 2025. https://targetjobs.co.uk/careers-advice/business-consulting-and-management/top-consulting-skills. *Tags: 06:L14, cv:S26.*
S118. Management consultant job profile. Prospects (Jisc), 2026. https://www.prospects.ac.uk/job-profiles/management-consultant. *Tags: 06:L15.*
S119. Associate Product Manager BS/MS Intern, 2027 (London). Google Careers, 2026. https://www.google.com/about/careers/applications/jobs/results/103464941339452102. *Tags: 07:P1.* CV + transcript only; no LinkedIn mention.
S120. Associate Product Manager, University Graduate, 2026 Start (mirror). Google via AnitaB.org job board, 2025-26. https://jobs.anitab.org/companies/google-24698/jobs/58853379-associate-product-manager-university-graduate-2026-start. *Tags: 07:P2.* US locations only; mirror, not google.com.
S121. Rotational Product Manager (RPM) (mirror). Meta via Accel job board, n.d. (observed 2026). https://jobs.accel.com/companies/facebook-2-07d2eb1b-d3ad-4084-93df-74a124ac9233/jobs/56890087-rotational-product-manager-rpm. *Tags: 07:P3.* Mirror; location not shown.
S122. Product Management at Monzo: the interview process. Monzo blog, 2022. https://monzo.com/blog/2022/10/04/product-management-at-monzo-the-interview-process. *Tags: 07:P4.* Experienced-PM hiring.
S123. Current openings at Monzo. Monzo via Greenhouse, observed 2026. https://job-boards.greenhouse.io/monzo/jobs/8173733. *Tags: 07:P4b.* No graduate PM role visible.
S124. What it's really like working as a Graduate Product Manager at Capital One. TARGETjobs (employer profile), c. 2024. https://targetjobs.co.uk/organisations/capital-one/what-its-really-working-graduate-product-manager-capital-one. *Tags: 07:P5.* 'a tech background is not necessary for success'.
S125. Product manager job profile. Prospects (Jisc), 2026. https://www.prospects.ac.uk/job-profiles/product-manager. *Tags: 07:P6.* Entry-level PM hiring 'extremely unusual'.
S126. Careers Informed: interview with a Skyscanner graduate. University of Edinburgh Careers Service blog, c. 2024. https://blogs.ed.ac.uk/careersinformed/?p=6083. *Tags: 07:P12.*
S127. How to use Product Management Side Projects to get jobs and internships. The Product Folks, n.d.. https://theproductfolks.com/product-management-blog/how-to-use-product-management-side-projects-to-get-jobs-and-internships. *Tags: 07:P13.* Practitioner, not UK, grade C.
S128. CV rules: tech & product (PRD-01 to PRD-09, SWE-08, keyword banks). Placed internal research, 2026. docs/research/cv-rules-tech-product.md. *Tags: 07:P14, int:tech.* Internal; cited for CV/LinkedIn consistency, not external evidence.
S129. Banking & Financial Markets: Short Guide to Recruitment 2025-2026. University of Cambridge Careers Service, 2025. https://www.careers.cam.ac.uk/sites/default/files/Banking%20and%20Financial%20Markets%20Short%20Guide%20to%20Recruitment%202025%20-%202026.pdf. *Tags: 05:Q11, 08:L1, cv:S1.* 'Follow firms on social media and LinkedIn to keep up with recruitment timelines'.
S130. Students: Prepare. Goldman Sachs, live 2026. https://www.goldmansachs.com/careers/students/prepare. *Tags: 08:L2, cv:S4.* 'Follow us on LinkedIn for the latest open roles and news.'
S131. How we hire. JPMorganChase, live 2026. https://www.jpmorganchase.com/careers/how-we-hire. *Tags: 08:L3, cv:S6.*
S132. Hints and tips. Barclays, n.d. (live 2026). https://search.jobs.barclays/hints-and-tips. *Tags: 08:L4, cv:S5.* No LinkedIn mention.
S133. Networking Like a Pro. Morgan Stanley, 2021. https://www.morganstanley.com/articles/professional-networking-tips. *Tags: 08:L5.* Audience: experienced staff.
S134. Connecting with Black Undergrads and High School Students During Summer Event (networking tips). Goldman Sachs Careers Blog, n.d.. https://www.goldmansachs.com/careers/blog/posts/black-economic-alliance-event.html. *Tags: 08:L6.* Search excerpt only.
S135. As banking clamps down on influencers, consulting pays its interns to post on LinkedIn (Alex McMurray). eFinancialCareers, 2026. https://www.efinancialcareers.com/news/bankers-influencers-consulting. *Tags: 08:L7.* Grade C.
S136. Careers in banking and finance. Newcastle University Careers Service, n.d. (live 2026). https://www.ncl.ac.uk/careers/explore-your-options/occupations/banking-finance/. *Tags: 08:L8.* Alumni tool.
S137. Students and Graduates (Insight Week Programmes). Rothschild & Co, live 2026. https://www.rothschildandco.com/en/careers/students-and-graduates/. *Tags: 08:L14.*
S138. First Year Advice for Securing an Internship. University of Warwick, Dept of Economics, n.d. (live 2026). https://warwick.ac.uk/fac/soc/economics/current/careers/first-year-advice. *Tags: 08:L15.*
S139. Spring weeks at banks (articles). eFinancialCareers, various. https://www.efinancialcareers.co.uk/news/spring-week-bank. *Tags: 08:L16.* Search excerpt only.
S140. Resume Advice: recruiter video transcript. Goldman Sachs, n.d. (live 2026). https://www.goldmansachs.com/careers/materials/Resume-Advice-Transcript.pdf. *Tags: cv:S3.* Reused from CV research.
S141. How to write a banking CV (Zeno Toulon). eFinancialCareers, 2026. https://www.efinancialcareers.com/news/the-absolutely-perfect-investment-banking-cv. *Tags: cv:S8.* Reused from CV research.
S142. Make your CV stand out for Investment Banking. Bright Network, n.d. (template 2017). https://www.brightnetwork.co.uk/career-path-guides/investment-banking/cv-stand-out-investment-banking/. *Tags: cv:S9.* Reused from CV research.
S143. CV rules: finance & consulting (FCQ-01 to FCQ-12, CON, FIN, QNT rules). Placed internal research, 2026. docs/research/cv-rules-finance-consulting.md. *Tags: int:fin.* Internal; cited where LinkedIn rules mirror CV rules (e.g. FCQ-11 'everything on there is fair game').
S144. How do I get a graduate job in marketing?. TARGETjobs, 2025. https://targetjobs.co.uk/careers-advice/marketing-advertising-and-pr/how-do-i-get-graduate-job-marketing. *Tags: 09:S3.*
S145. Overview of the UK's marketing, advertising and PR sector. Prospects (Jisc), 2026. https://prospects.ac.uk/jobs-and-work-experience/job-sectors/marketing-advertising-and-pr/overview-of-the-uks-marketing-advertising-and-pr-sector. *Tags: 09:S4.*
S146. Marketing executive job profile. Prospects (Jisc), 2025. https://www.prospects.ac.uk/job-profiles/marketing-executive. *Tags: 09:S5.*
S147. Marketing, advertising and PR career guide. University of Portsmouth (MyPort), n.d.. https://myport.port.ac.uk/guidance-and-support/careers-support/getting-into-your-chosen-career/career-guides/marketing-advertising-and-pr. *Tags: 09:S6.*
S148. Advertising, marketing and PR. University of York Careers and Placements, n.d.. https://york.ac.uk/students/work-volunteering-careers/options/sectors/advertising. *Tags: 09:S8.*
S149. Advertising. Newcastle University Careers Service, n.d.. https://www.ncl.ac.uk/careers/explore-your-options/occupations/advertising/. *Tags: 09:S9.*
S150. Careers in advertising FAQs. IPA (Institute of Practitioners in Advertising), n.d.. https://ipa.co.uk/talent-diversity/careers-in-advertising/a-career-for-you/careers-in-advertising-faqs/. *Tags: 09:S10.* 'same generator' warning.
S151. Unilever Future Leadership Programme - Marketing UK (job posting via WORK180 mirror). Unilever, 2025. https://work180.com//en-gb/for-women/employer/qualcomm/job/755438/unilever-future-leadership-programme---market. *Tags: 09:S11.* Original https://careers.unilever.com/job/united-kingdom/unilever-future-leadership-programme-marketing-uk/34155/86160028416 (404). Form can be filled 'using your LinkedIn profile'.
S152. Brand Management Summer Internship 2027 (P&G listing). TARGETjobs, 2026. https://targetjobs.co.uk/jobs/brand-management-summer-internship-2027-248785. *Tags: 09:S12.* No LinkedIn step.
S153. Marketing Graduate Scheme - start date July 26 or Jan 27. L'Oréal, 2025-26. https://careers.loreal.com/es_ES/jobs/JobDetail/Marketing-Graduate-Scheme-start-date-July-26-or-Jan-27/218455. *Tags: 09:S13.* Fetch returned generic careers content; scheme details from snippet only.
S154. WPP recruiter interview and WPP Media 'Thrive' scheme listing. BusinessBecause / WPP Media, n.d.. https://job-boards.greenhouse.io/wppmedia/jobs/5112213008. *Tags: 09:S14.* Snippets only, not verified. Also https://businessbecause.com/news/inside-view-top-jobs/2912/inside-view-wpp-mba-recruiter (404).
S155. New partners and courses to develop tomorrow's workforce. Google (The Keyword blog), c. 2019-20. https://www.blog.google/around-the-globe/google-europe/new-partners-and-courses-develop-tomorrows-workforce/. *Tags: 09:S18.* Digital Garage accredited by IAB Europe and The Open University (Google's claim).
S156. LinkedIn Top Tips for Postgraduate and Early Career Researchers (A. Akram). University of Sheffield / YCEDE, 2025. https://ycede.ac.uk/wp-content/uploads/2025/07/linkedin-top-tips-for-postgraduate-and-early-career-researchers.pdf. *Tags: 10:S1.* Best UK research-sector source; written for PGR/ECR.
S157. LinkedIn Top Tips for Postgraduate and Early Career Researchers (resource page). UK Council for Graduate Education, 2025. https://ukcge.ac.uk/resources/resource-library/linkedin-top-tips-for-postgraduate-and-early-career-researchers. *Tags: 10:S2.*
S158. Career planning: PhD. Imperial College London Careers Service, n.d.. https://www.imperial.ac.uk/admin-services/careers/plan-your-career/career-planning/phd/. *Tags: 10:S4.*
S159. Making connections. Imperial College London, Early Career Researcher Institute, n.d.. https://www.imperial.ac.uk/early-career-researcher-institute/careers-and-transitions/careers-beyond-academia/reflection-and-research/research/make-connections/. *Tags: 10:S5.* Tipsheet PDF behind SSO, not read.
S160. CVs and Cover Letters for PhDs and Postdocs. University of Cambridge Careers Service, 2016 (file dated 2018). https://www.careers.cam.ac.uk/files/phdpostdoccvbook.pdf. *Tags: 10:S6.* L'Oreal recruiter: 'We will look you up on LinkedIn.' (cross-sector).
S161. Think tanks. LSE Careers, n.d.. https://info.lse.ac.uk/current-students/careers/information-and-resources/type-of-organisation/think-tanks. *Tags: 10:S7.* 'Some jobs are not advertised or are filled internally'.
S162. Jobs with think tanks. TARGETjobs, 2023. https://targetjobs.co.uk/careers-advice/public-services-and-administration/jobs-think-tanks. *Tags: 10:S8.*
S163. Student Researcher Program. Google DeepMind, n.d.. https://deepmind.google/careers/internships/. *Tags: 10:S9.*
S164. Google DeepMind Research Ready Programme. Department of Computer Science and Technology, University of Cambridge, 2026. https://www.cst.cam.ac.uk/node/11411971. *Tags: 10:S10.*
S165. Research Intern - Machine Intelligence (Cambridge) (mirror). Microsoft Research via flexa.careers, 2025-26. https://flexa.careers/jobs/microsoft-cambridge-machine-intelligence-intern-673750a16f9e1e8574b452ca. *Tags: 10:S11.* Mirror, verify on careers.microsoft.com.
S166. Research economists. Institute for Fiscal Studies, n.d.. https://ifs.org.uk/research-economists. *Tags: 10:S18.* HTTP 403; snippet only; no verbatim quote.
