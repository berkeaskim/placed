# LinkedIn Scoring: How Recruiters Use LinkedIn With UK Students, and How to Score Fairly

Scope: the evidence on whether and how employers and recruiters look at students' LinkedIn profiles, the red flags they cite, the fairness and anti-gaming issues a LinkedIn scorer creates, and a proposed scoring model for Placed. Sector-specific "what good looks like" content is in the sibling files (`01-…`, `03-…`, …). This file sets the cross-sector rules `LI-REC-xx` and the scoring model.
Compiled: 2026-10-14. Status: research input for the Placed LinkedIn scorer. Not recruiting advice.

---

## 0. How to read this document

Conventions match `docs/research/cv-rules-finance-consulting.md` §0 and `lib/cv-rules/types.ts`.

**Check type**: `RULE` (deterministic code), `LLM` (model judgement, phrased as one yes/no question), `HYBRID` (code extracts, LLM grades).

**Input**: which input can check the rule.
- `pdf_export`: LinkedIn's "Save to PDF" export. In practice it contains name, headline, location, contact/URL, Top Skills, Languages, Certifications, Honors, Summary (About), Experience and Education. It does **not** contain the photo, banner, connection/follower count, endorsements, recommendations, Featured, or activity/posts (based on the typical export layout; evidence D, verify against 5–10 real exports before shipping). LinkedIn Help confirms the feature works only for English-language profiles [S10].
- `screenshot`: user uploads screenshots of the profile top card, Featured, Activity, etc.
- `self_report`: user answers a question in the app.

**Severity**: `critical` (likely to hurt the candidate on its own if a recruiter looks), `major` (materially weaker than peers), `minor` (polish).

**Evidence**: `A` employer's own guidance or consistent across several top-tier UK careers sources; `B` one top-tier source; `C` practitioner, trade press, or vendor-commissioned survey; `D` my synthesis, no direct source.

**Year keys** follow `lib/types.ts`: `1st`, `2nd`, `penultimate`, `final`, `masters`.

Citation tags [Sx] point to §8. All URLs accessed 2026-10-14.

---

## 1. Headline findings (read this first)

1. **LinkedIn is a secondary signal for UK student hiring, not a primary one.** UK graduate schemes, spring weeks and internships are application-led: CV or form, online tests, video interview, assessment centre. I found **no UK employer or ISE source saying LinkedIn is scored in student selection**. The ISE 2025 survey is paywalled and its public summary says nothing about LinkedIn [S12]. The 2026 ISE report is due 14 October 2026 and should be checked. Placed should present the LinkedIn score as "how you come across when a recruiter looks you up or searches", **never** as a selection score comparable to the CV score.
2. **Two different uses, two different rule sets.**
   - **Sourcing** (recruiter searches LinkedIn for people who match a spec): matters most for tech, data, product, marketing/growth and start-ups, and for off-cycle roles. TARGETjobs quotes a recruiter: "What we're doing on LinkedIn is often searching for people who fit the specification" [S1]. A Lidl recruiter on a Surrey careers blog: "LinkedIn is a great tool to research and contact candidates who we think could be a potential match" [S2]. This rewards **findability**: headline, location, education, skills, keywords.
   - **Screening/checking** (recruiter looks you up after you apply or before interview/offer): Nottingham Careers says "Some employers may review publicly available online information on you as part of the recruitment process or before making an offer" [S3]. This rewards **consistency with the CV and absence of red flags**, not polish.
3. **The UK regulator limits screening.** The ICO's draft employment guidance (under review after the Data (Use and Access) Act) says employers checking candidates' social media "must be able to justify why this is necessary", must tell candidates, should separate the researcher from the decision-maker, and that "It is unlikely to be fair and lawful to make a decision about the candidate based on this information alone" [S4]. It also says "It's unlikely to be lawful, appropriate or necessary to conduct intrusive or targeted checks of candidates on social media or online" [S4]. So in the UK, a well-run graduate employer should be cautious about LinkedIn screening. Where it happens, it is most likely an informal look-up by a recruiter or interviewer. Our rules should therefore weight **"does not undermine your application"** over **"impresses"**.
4. **The best peer-reviewed evidence says profile length, photo and connection count sway raters, while skills lists and endorsements barely do.** In Roulin & Levashina (2019, *Personnel Psychology*), LinkedIn-based ratings were reasonably reliable for *visible* traits (leadership, communication, planning, extraversion, cognitive ability). They were not reliable for less visible traits (conscientiousness, emotional stability, adaptability). Per Kent State's summary, profile length, photo and number of connections influenced hiring recommendations, while skills lists, endorsements, group memberships and volunteer descriptions had negligible effects [S5]. Two of the three influential features (photo, connection count) are exactly the ones that raise fairness problems (§4). **Placed should not reproduce rater bias. It should score the content features that predict something real.**
5. **Popular LinkedIn statistics are mostly untraceable.** Treat them as myths unless a primary source turns up (§2.3). Do not use them in UI copy as fact.
6. **Most quantitative social-screening data is US, old, or vendor-commissioned.** The CareerBuilder/Harris figures (70% of US employers screen social media, 2017) and the AVG 2012 "90% of HR search unprotected profiles" claim are US or mixed-country, and commissioned by vendors [S6][S7]. UK-specific, recent, independent data on how often student recruiters check LinkedIn **does not appear to exist publicly**. That is the main evidence gap.

---

## 2. Evidence on recruiter use of LinkedIn

### 2.1 Sourcing vs screening

| Use | What happens | Who does it most (UK students) | What it rewards | Evidence |
|---|---|---|---|---|
| **Sourcing** | Recruiter runs LinkedIn Recruiter searches by degree, university, location, skills, title; sends InMail. | Tech, data, product, start-ups, scale-ups, agencies, off-cycle and experienced-hire roles; some diversity outreach. Less for structured grad schemes (IB, Big 4, MBB), which fill from application pipelines. | Complete, keyword-rich, accurate fields; location set; "Open to Work" signal. | B: TARGETjobs recruiter quotes [S1]; Lidl quote [S2]; LinkedIn's own InMail data: Open to Work candidates had a 37% higher InMail response rate [S8] (LinkedIn-owned, global, measures response not hiring). Sector split is D. |
| **Screening / checking** | After application, before interview or offer, someone looks up the candidate. | Any employer, informally; ICO says it must be justified and disclosed [S4]. | Consistency with CV; no unprofessional content; no misrepresentation. | A-ish: ICO [S4] + Nottingham [S3] + TARGETjobs [S1] agree it happens and that consistency matters. Frequency for UK students: **unknown**. |
| **Employer branding / candidate research** | Students use LinkedIn to research employers and network. | Students. | Not scored here. | Cibyl UK Graduate Survey 2021 reported 79% of students using LinkedIn for career purposes (seen only via search snippets of TARGETjobs, not fetched, so unverified). |

### 2.2 Social-screening surveys (use with care)

| Source | Claim | Quality notes |
|---|---|---|
| CareerBuilder / Harris Poll 2017 [S6] | 70% of US employers use social media to screen candidates; 54% found content that led them not to hire; 57% less likely to interview someone they can't find online. | US, all levels, vendor survey. Primary page returned 403. Figures taken from trade coverage (Staffing Industry Analysts, Benzinga). **Grade C. Not UK, not students.** |
| AVG Technologies "Digital Diaries" 2012 [S7] | 90% of UK/US HR professionals search unprotected profiles; "inappropriate" photos reduce interview chances by 70%. | 230 HR professionals, UK+US, commissioned by an antivirus vendor, 2012, pre-dates GDPR. **Grade C, stale.** The 70% figure has unclear methodology. |
| Baert 2018, *New Media & Society* (IZA DP 9584, 2015) [S9] | Belgian field experiment: "Candidates with the most beneficial Facebook picture obtain approximately 39% more job interview invitations" than those with the least beneficial picture. | Real field experiment (n ≈ 1,056 vacancies). Facebook, not LinkedIn; Belgium. **Strong evidence that employers do look applicants up and that photos sway them, i.e. evidence of bias, not of a valid signal.** |
| Acquisti & Fong 2020, *Management Science* [S11] | US field experiment (4,000+ employers) with social-network profiles manipulating religion and sexual orientation. Little effect nationally, but bias against the Muslim candidate in Republican-leaning areas. | Peer-reviewed. Confirms that a minority of employers look up candidates' online profiles and that some discriminate on what they find. Not fetched (SSRN 403); details taken from abstract summaries. |
| Roulin & Levashina 2019, *Personnel Psychology* [S5] | LinkedIn ratings are reliable for visible skills and cognitive ability. Length, photo and connections drive recommendations; endorsements and skill lists don't. | Peer-reviewed, North American samples. **The best evidence for what a profile can and cannot tell a rater.** |

### 2.3 Popular statistics: verified or myth?

| Claim | Status | What to do |
|---|---|---|
| "Profiles with a photo get **21×** more views and **9×** more connection requests." | **Unverified.** Widely attributed to "LinkedIn", but no LinkedIn primary page found. The blog that repeats it gives no link or date [S13]. A LinkedIn Help result in search snippets instead said "up to 2X more profile views and 3X more connection requests" (not fetched, unconfirmed). Even if true, it is correlational: people with photos are also more active and have more complete profiles. | Do not show it in the UI. If needed, say "LinkedIn says profiles with photos get more views". |
| "A professional photo makes your profile **14×** more likely to be viewed." | **Unverified.** Repeated in UK careers material (seen in search snippets), no primary source. | Same as above. |
| "Complete profiles are **40×** more likely to receive opportunities." | **Unverified / probably obsolete.** An old LinkedIn "All-Star" marketing line; no current primary source. | Don't use. |
| "**95%** of UK recruiters check LinkedIn even if the role was advertised elsewhere." | **Untraceable.** Search snippets attribute it to UK careers material. The Surrey careers blog I fetched contains no such figure [S2]. | Treat as a myth. |
| "Recruiters spend **6 seconds** on a CV/profile." | **Untraceable** for LinkedIn (and contested for CVs; see CV research doc caveat 3). | UX copy only. |
| "Black professionals are **26%** less likely to include a photo." | **Unsourced.** ERE 2021 cites "recent research findings" without naming the study [S14]. | Do not cite as fact. The direction is plausible and relevant to fairness (§4). |

---

## 3. Red flags recruiters cite

| Red flag | Evidence | Detectable from |
|---|---|---|
| **CV/LinkedIn mismatch** on employer, title or dates | TARGETjobs: one profile for all vacancies, so "you need to give context to your skills" rather than tailoring per job [S1]. UK careers services (QUB, via search snippets; PDF 403) say dates, titles and responsibilities should mirror the CV. Background-screening logic: a mismatch reads as misrepresentation. **B.** | `pdf_export` + Placed's stored CV |
| **Inflated titles / claims** ("Founder & CEO" of a solo side project; "Investment Banking Analyst" for a spring week) | LinkedIn's own policy: "Do not post misleading or deceptive information about yourself, your business, your qualifications, work experience, affiliations, or achievements" [S15]. CV doc FCQ-11 ("everything on there is fair game"). **A** (platform rule + employer CV guidance). | `pdf_export` (LLM) |
| **Empty or near-empty profile** (no About, no experience descriptions, headline = "Student at X") | Roulin & Levashina: profile length influences raters [S5]. TARGETjobs: more complete profiles surface higher in searches [S1]. Worcester careers checklist covers every section [S16]. **A/B.** | `pdf_export` |
| **Unprofessional photo / posts / controversial activity** | AVG 2012 [S7], CareerBuilder 2017 [S6] (both C, US/old). Nottingham: consider how content "might be viewed by employers" [S3]. ICO says decisions shouldn't rest on this alone [S4]. **B** for "check your footprint"; **C** for the magnitude. | `screenshot` / `self_report` only |
| **AI-generic About text** (interchangeable buzzwords, no specifics) | CV doc FCQ-12 cites eFC 2026 recruiters on identical AI-written profiles (C). There is no LinkedIn-specific study. **C.** | `pdf_export` (LLM) |
| **Fake or AI-generated photo** | The Stanford Internet Observatory found 1,000+ LinkedIn profiles with AI-generated faces (2022). Tells include "Backgrounds are often indistinct, blurry, or irregular" [S17]. LinkedIn: "Do not use an image of someone else, or any other image that is not your likeness" [S15]. Relevant now that students use AI headshot generators. **B.** | `screenshot` (advisory only; we do not judge faces, see §4) |
| **Spelling/grammar errors** | Worcester checklist: all sections "checked and re-checked for formatting, spelling, punctuation, and grammar" [S16]. Same logic as CV rule FCQ-05. **A** (consistent across careers services). | `pdf_export` |

---

## 4. Fairness and validity

### 4.1 Photos

- **Evidence of bias, not validity.** Baert's field experiment shows the photo alone shifts interview invitations by about 39% [S9]. An Italian field experiment reported large attractiveness effects on callbacks (seen in HR trade coverage only, not fetched; C). Roulin & Levashina found photos influence ratings [S5]. **None of this says the photo predicts job performance.** It says raters are biased by it.
- **UK norm is no photo on CVs** (CV doc FCQ-03). LinkedIn is a different medium, and every UK careers source I saw recommends a clear, professional headshot [S1][S16]. The reason given is visibility and trust on the platform, not merit.
- **Who goes without a photo is not random.** There are claims (unsourced, [S14]) that Black professionals are less likely to post photos for fear of discrimination. Religious, gender-identity, disability, visa-status or safety reasons can apply too.

**Recommendation for Placed:**
1. **Never score the photo's content**: no attractiveness, smile, clothing, background or "professionalism" judgement by the LLM, and no face analysis. That would encode exactly the bias the research documents, and would process biometric/special-category data for no valid reason.
2. **Photo presence is advisory only, weight 0 in the score.** Show it as a tip: "Most UK careers services recommend a clear headshot because it helps people recognise you; it's your choice." Let the user dismiss it permanently.
3. **The only photo checks allowed** are the user answering self-report questions ("Is it a photo of you?", "Is it recent?") and the LinkedIn policy point that the photo must be your likeness [S15]. No AI-face detection on users' photos.

### 4.2 Network size and connections

- LinkedIn's Economic Graph team reports large network-strength gaps by ZIP-code income, race and gender. For example, "Men's average total network strength percentile is 6 points higher than women's", and the highest-income areas are 12.8 percentile points above the lowest (US data) [S18]. LinkedIn's 2019 "network gap" work (seen via search summaries; the page redirected) said members from affluent ZIP codes were about 3× as likely to have a strong network, and top-college alumni about 2× [S19].
- First-generation, state-school, international and mature students start with smaller networks for reasons unrelated to ability. International students also may have prior experience at employers unknown to UK recruiters.
- Roulin & Levashina show connection count sways raters [S5]. That is a bias to warn users about, not a merit signal to copy.

**Recommendation:** connection/follower count gets **weight 0**. It can't be read from the PDF anyway. Offer optional, non-scored advice ("connect with people you've actually met: course mates, society members, speakers at events") with a neutral floor message, never a ranking against peers.

### 4.3 Activity / posting

There is no evidence that posting frequency predicts hiring outcomes for students. Engagement is easy to fake (pods, automation) and LinkedIn prohibits faking it [S15]. Posting also favours confident, extraverted, well-networked students (Roulin & Levashina: LinkedIn mostly reveals *visible* traits like extraversion [S5]). **Activity is advisory only, weight 0.** The one exception is a red-flag check: controversial or unprofessional recent posts, via `self_report` or a screenshot, phrased as "would you be comfortable with an interviewer reading this?". It produces no numeric penalty.

### 4.4 Other fairness points

- **Language**: the PDF export works only for English-language profiles [S10]. Accept screenshots or pasted text for others, and do not penalise non-English profiles for parse failures.
- **Accessibility**: don't require screenshots. Every scored rule must be checkable from `pdf_export` or paste. Screenshot/self-report rules are advisory.
- **Non-UK experience**: the LLM must not mark unfamiliar foreign employers or universities as weak. Judge the description, not the brand.
- **Protected characteristics**: the LLM prompt must ignore name, age, nationality, religion, ethnicity, disability, pronouns and graduation-gap reasons. Gaps are not penalised; date *inconsistency* between CV and LinkedIn is.
- **ICO posture**: Placed processes the user's own data at their request, which is lawful. But the UI should not imply that employers *should* screen LinkedIn. Framing: "recruiters may look you up; here's how to make sure it supports your application."

---

## 5. Anti-gaming

| Gaming tactic | Why it matters | Detection from the inputs we have | Scoring response |
|---|---|---|---|
| **Keyword stuffing** in headline, About or Skills (long pipe-separated lists, 50 skills, repeated terms) | LinkedIn search does match keywords, but stuffed profiles read badly to humans. Endorsements and skill lists had negligible effect on raters [S5]. | RULE: headline token count, pipe/separator count, repeated-term density; Skills count from the PDF "Top Skills" plus any pasted full list; skills not mentioned anywhere in Experience/Education/Projects ("unevidenced"). LLM: "Does the headline read as a sentence a person wrote?" | Coverage of relevant keywords earns points up to a cap, then stops. Stuffing triggers LI-REC-08. Unevidenced skills earn nothing. |
| **Endorsement inflation** (endorsement-for-endorsement swaps) | Endorsements had negligible effect on raters [S5]. | Not in the PDF export. | **Never score endorsements.** |
| **Buying connections / engagement pods / automation** | Against LinkedIn policy: "Don't do things to artificially increase engagement" [S15]. | Not detectable from the export, and we don't score connections or activity. | Nothing to game, because there's no reward. Mention the policy in help text. |
| **Title inflation / fabricated roles** | Misrepresentation is against LinkedIn policy [S15] and is caught at the CV-LinkedIn consistency check or interview. | LLM title-vs-description plausibility; CV-vs-LinkedIn diff. | LI-REC-04 (critical). |
| **AI-written About / descriptions** | Generic, interchangeable text. | LLM genericness check; cliché list shared with CV GEN-09/FCQ-12. | LI-REC-07 (major). Don't try to "detect AI" per se, which is unreliable and unfair to non-native writers. Grade specificity. |
| **Gaming Placed itself** (pasting a different, polished profile than what's live) | The score would be meaningless. | Ask for the PDF export, which carries the public profile URL. Optional `self_report` "this is my live profile". | Mark pasted-text scores as "unverified input". |

---

## 6. Rules (LI-REC-xx)

| ID | Rule | Check | Input | Severity | Year adjust | Evidence | Citations |
|---|---|---|---|---|---|---|---|
| LI-REC-01 | **Employer, title and dates match the CV.** Every role on the CV that is also on LinkedIn has the same organisation, an equivalent title, and start/end dates within 1 month. No role appears on one with materially different dates on the other. | HYBRID: code fuzzy-matches orgs and diffs dates; LLM judges title equivalence. Q: "Are the job titles for the same role on the CV and LinkedIn equivalent (no promotion or inflation on either)?" Pass: CV "Summer Intern, Risk", LinkedIn "Risk Summer Intern". Fail: CV "Spring Week participant", LinkedIn "Investment Banking Analyst". | pdf_export (+ stored CV) | **critical** | 1st: major; all others critical | B | [S1][S3]; QUB careers guidance (snippet only) |
| LI-REC-02 | **Education entry is complete**: university, degree title, expected graduation year present (grade or predicted grade optional but recommended for FIN/CON). | RULE: Education section parsed; institution, degree, and end year present. | pdf_export | major | final/masters: major; 1st: minor | A | [S1] (recruiters filter by degree); [S16] |
| LI-REC-03 | **Headline states who you are and what you're targeting**, not just "Student at X". It should name the degree/university and a target role or sector. | HYBRID: RULE flags headlines of fewer than 4 words or matching `^Student at`. LLM Q: "Does the headline say both what the person studies and what kind of role/sector they want?" Pass: "Final-year Economics @ UCL, seeking 2027 grad roles in strategy consulting". Fail: "Student at University College London". | pdf_export | major | 1st/2nd: minor | A | [S1] (one line on role, study, goals); [S16] ("1 line to sum up your status") |
| LI-REC-04 | **No inflated or misleading claims**: titles fit the described work and duration (e.g. not "CEO/Founder" for a solo side project without users; not "Analyst" for an insight day). | LLM Q: "Given the description and duration, is the title a fair label for this role?" Pass: "Founder, campus tutoring service (40 paying clients)". Fail: "Managing Director, Personal Investment Portfolio". | pdf_export | **critical** | none | A | [S15] LinkedIn policy; CV doc FCQ-11 |
| LI-REC-05 | **Location is set** to a UK city/region you'd work in (or "London Area" etc.). Recruiters filter by location. | RULE: location field present; flag non-UK location for UK-targeting users (advisory; international students may legitimately differ). | pdf_export | major | 1st: minor | B | [S1] (recruiters use location filters) |
| LI-REC-06 | **About section exists and is substantive**: 3–8 sentences / ~60–300 words. Says what you study, what you've done that's relevant (at least one concrete example), and what you're looking for. | HYBRID: RULE word count; LLM Q: "Does the About section include at least one concrete, verifiable example (project, role, result) and a stated target?" Pass: "…built a Python model forecasting society ticket demand (±8%)… looking for 2027 data analyst internships." Fail: "Passionate, driven student eager to learn and grow." | pdf_export | major | 1st: minor | A | [S1]; [S16]; [S5] (profile length sways raters) |
| LI-REC-07 | **About and descriptions are specific, not generic**: no more than 2 clichés (passionate, driven, results-oriented, dynamic, team player, synergy…) without evidence nearby; no interchangeable AI-style text. | HYBRID: RULE cliché density (shared lexicon with CV GEN-09); LLM Q: "Could this paragraph be pasted onto another student's profile unchanged?" (yes = fail). | pdf_export | major | 1st: minor | C | CV doc FCQ-12 (eFC 2026); D for LinkedIn specifically |
| LI-REC-08 | **No keyword stuffing**: headline is at most ~220 characters and reads as a phrase (≤ 3 separators); Skills are relevant and mostly evidenced elsewhere on the profile. | RULE: separator count, repeated-term density; HYBRID: share of listed skills mentioned in Experience/Education/Projects ≥ 50%. | pdf_export | minor | none | B/D | [S5] (skill lists add little); [S1] (5–10 key skills) |
| LI-REC-09 | **Experience entries have descriptions** with what *you* did and at least one outcome, not a bare title. Applies to every role on the profile, including part-time and volunteering. | HYBRID: RULE flags entries with fewer than 15 words of description; LLM Q: "Does this entry say what the person personally did and a result?" Pass: "Ran sign-ups for a 300-person careers fair; cut no-shows 25% with SMS reminders." Fail: "Volunteer." | pdf_export | major | 1st: minor (if any entries) | A | [S1] ("I" statements, achievements); [S16] |
| LI-REC-10 | **No spelling or grammar errors** in headline, About, Experience. | RULE: UK-English spell-check; LLM grammar pass. | pdf_export | major | none | A | [S16]; CV doc FCQ-05 |
| LI-REC-11 | **Custom profile URL** (linkedin.com/in/firstname-lastname, not a random suffix) so it can go on the CV. | RULE: URL from export matches `/in/[a-z-]+` without trailing random digits/hash. | pdf_export | minor | none | B | [S1] |
| LI-REC-12 | **Photo present and is of you** (advisory, **weight 0**). Never assess the photo's appearance. | self_report: "Do you have a profile photo that is a recent photo of you?" | self_report / screenshot | minor (advisory, unscored) | none | B (careers-service consensus) for presence; A for "must be your likeness" | [S1][S16][S15]; fairness: [S9][S5] |
| LI-REC-13 | **Public content won't undermine you**: no recent posts, comments or photos you'd be uncomfortable with an interviewer seeing (advisory, **weight 0**). | self_report checklist; optional screenshot of Activity with LLM Q: "Would a reasonable UK graduate recruiter find anything in these posts unprofessional (abuse, discriminatory content, explicit/drunken images, confidential employer info)?" Political or religious views alone are **not** a fail. | self_report / screenshot | minor (advisory, unscored) | final/masters: shown more prominently | B (advice) / C (magnitude) | [S3][S4][S6][S7] |
| LI-REC-14 | **Open to Work / job preferences set** when actively searching (advisory; recruiter-only visibility is fine). | self_report / screenshot. | self_report / screenshot | minor (advisory) | penultimate/final/masters only; skip 1st | B (LinkedIn data, response not hiring) | [S8] |
| LI-REC-15 | **Profile and CV tell the same story about target**: if the CV targets sector X, LinkedIn headline/About do not target an unrelated sector Y. LinkedIn may be broader than the CV, but must not contradict it. | LLM Q: "Is the career target implied by the LinkedIn headline/About compatible with the target sector of the user's CV?" Pass: CV for quant, LinkedIn "Maths @ Imperial, interested in quant research and trading". Fail: CV for IB, LinkedIn "Aspiring UX designer". | pdf_export (+ CV, target sector) | major | 1st/2nd: minor (exploration is normal) | B | [S1] (one profile for all vacancies; give context) |

Notes:
- LI-REC-12, -13 and -14 are **advisory and unscored** by design (§4).
- LI-REC-01 and LI-REC-15 need the user's CV in Placed. Without one, they are `not_applicable` and their weight is redistributed (§7).
- Sector files will add `LI-<SECTOR>-xx` rules (e.g. GitHub link for software_eng, deal/society evidence for finance). This file stays cross-sector.

---

## 7. Proposed scoring model

### 7.1 Principles

1. **Score only what predicts something real and can be checked from the export.** Content (headline, About, experience descriptions, education, consistency) yes. Photo, connections, endorsements, activity: no.
2. **Integrity issues are gates, not small deductions.** A critical consistency or inflation failure caps the score, as in the CV scorer.
3. **The score means "LinkedIn readiness for sector X at year Y"**, not employability.
4. **Year matters.** A 1st-year with an empty Experience section is normal. A final-year with one is not.

### 7.2 Dimensions and weights (sum = 100)

| Dimension | What it measures | Rules | Weight | Why this weight |
|---|---|---|---|---|
| **Consistency & integrity** | Matches CV; no inflation; target coherent | LI-REC-01, -04, -15 | **25** | The strongest UK evidence is about screening, and screening is mainly a consistency/red-flag check [S1][S3][S4]. Misrepresentation is the one LinkedIn issue that can actively lose an offer. |
| **Proof** | Experience descriptions with personal actions and outcomes; evidenced skills | LI-REC-09, -08 (evidenced part), sector rules (projects, links) | **25** | Content depth is what raters can reliably read (visible skills, cognitive ability) [S5]. It mirrors the CV impact dimension. |
| **Findability** | Headline, location, education completeness, relevant keywords, custom URL | LI-REC-02, -03, -05, -11, -08 (stuffing) | **20** | Drives sourcing [S1]. Higher weight for sourcing-heavy sectors (below). |
| **Narrative / first impression** | About exists, is specific, states a target | LI-REC-06, -07 | **20** | The headline + About is what a recruiter reads on a look-up. Profile length sways raters [S5]. |
| **Polish** | Spelling, grammar | LI-REC-10 | **10** | Cheap to fix. Errors read badly, but it is less decisive than on a CV. |
| **Presence & activity** | Photo, Open to Work, posts | LI-REC-12, -13, -14 | **0** (advisory) | Evidence of bias, not validity (§4). Not in the export. Easily gamed. |

**If no CV is on file:** LI-REC-01 and LI-REC-15 are N/A. Consistency drops to LI-REC-04 only, with weight 10, and the remaining 15 points split pro rata across the other dimensions. Show "Upload your CV to unlock the consistency check, the thing recruiters most often catch."

**Sector tilt (D, tunable):** move 5 points from Narrative to Findability for `software_eng`, `data_analytics`, `product`, `marketing_growth` (sourcing-heavy). Move 5 points from Findability to Consistency for `finance_banking`, `consulting`, `quant_trading` (application-led; LinkedIn is mostly a look-up check). `research`: as default.

### 7.3 Within-dimension scoring

Follow the CV scorer: each rule yields pass / partial / fail / not_applicable. A dimension's score = weighted pass share, with critical = 3, major = 2, minor = 1.

**Gates (caps on the total):**
- Any **critical fail** (LI-REC-01 or LI-REC-04) caps the total at **59**. The fix-first card shows the critical item.
- An empty profile (no About, and no Experience description of 15 words or more, and headline matches `^Student at`) caps the total at **40** for penultimate/final/masters. No cap for 1st/2nd; they get an encouraging "starter profile" path instead.

### 7.4 Year adjustment

| Year | Emphasis | Severity changes |
|---|---|---|
| `1st` | Build the basics: headline, education, About draft, any society/part-time role with a line of description. | LI-REC-01 → major; -03, -05, -06, -07, -09 → minor; LI-REC-14 skipped; empty-profile cap off. |
| `2nd` (non-penultimate, e.g. 4-year courses) | As 1st, but expect at least one described experience. | -03, -15 → minor; others default. |
| `penultimate` | Internship/spring-week season: findability and proof matter; consistency critical. | Defaults. LI-REC-14 shown. |
| `final` | Grad-scheme screening and offers: consistency and red flags matter most. | Defaults. LI-REC-13 shown prominently. Empty-profile cap on. |
| `masters` | Often applying with short time-to-hire and prior experience; international share is high. | As final. Explicitly don't penalise non-UK employers or locations (LI-REC-05 advisory for international users). |

### 7.5 Output shape (suggested)

- Overall 0–100 plus label ("Ready", "Nearly there", "Needs work", "Starter").
- Top 3 fixes ordered by weight × severity, each with a rewrite suggestion for headline/About/an experience entry (LLM, grounded in the user's CV facts. Never invent achievements).
- A separate, unscored "Presence tips" card (photo, Open to Work, activity), with the fairness note: "These don't affect your score."
- An evidence note: "Recruiters may look you up. LinkedIn rarely decides UK graduate applications on its own."

---

## 8. Citations

All accessed 2026-10-14.

- **[S1]** "The graduate's guide to creating the perfect LinkedIn profile". TARGETjobs (Group GTI), 2026 (page dated 11 Aug 2026). https://targetjobs.co.uk/careers-advice/finding-a-job/graduates-guide-creating-perfect-linkedin-profile. Quotes used: "What we're doing on LinkedIn is often searching for people who fit the specification" (recruiter); "You can't have a different LinkedIn profile for every vacancy you apply for, so you need to give context to your skills." (careers leader).
- **[S2]** "Why Employers think you should use LinkedIn". University of Surrey Careers blog, 2020. https://blogs.surrey.ac.uk/careers/?p=3084. Quote (Lidl recruiter): "LinkedIn is a great tool to research and contact candidates who we think could be a potential match." Note: the page contains no "95% of UK recruiters" statistic.
- **[S3]** "LinkedIn and online presence". University of Nottingham Careers and Employability Service, undated (live 2026). https://www.nottingham.ac.uk/careers/students/applications/linkedin-and-online-presence.aspx. Quote: "Some employers may review publicly available online information on you as part of the recruitment process or before making an offer."
- **[S4]** "Pre-employment vetting of candidates" (Employment practices and data protection: recruitment and selection, draft under review). Information Commissioner's Office, draft guidance (consultation closed; under review after the Data (Use and Access) Act 2025). https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/recruitment-and-selection/pre-employment-vetting-of-candidates/. Quotes as in §1.
- **[S5]** Roulin, N. & Levashina, J. (2019). "LinkedIn as a New Selection Method: Psychometric Properties and Assessment Approach". *Personnel Psychology*. Summarised in "Kent State Researcher Studies LinkedIn as Employee Selection Tool", Kent State University, 2019. https://www.kent.edu/business/news/kent-state-researcher-studies-linkedin-employee-selection-tool. Quote: profiles "could be used to make inferences about job applicants' visible skills (such as leadership, communication and planning)". Journal article itself not fetched.
- **[S6]** "Number of Employers Using Social Media to Screen Candidates at All-Time High". CareerBuilder / Harris Poll, 2017. https://www.careerbuilder.com/advice/blog/60-of-employers-are-peeking-into-candidates-social-media-profiles (403 on fetch; figures via trade coverage, e.g. https://www.staffingindustry.com/news/global-daily-news/social-media-candidate-screening-record-high-survey-finds). US. Grade C.
- **[S7]** "UK Graduates With Inappropriate Online Photos 70 Per Cent Less Likely to get job Interviews". AVG Technologies via PR Newswire, 2012. https://www.prnewswire.co.uk/news-releases/uk-graduates-with-inappropriate-online-photos-70-per-cent-less-likely-to-get-job-interviews-182168891.html. 230 UK/US HR professionals; vendor-commissioned. Grade C.
- **[S8]** "These InMails Get the Best Response Rates". LinkedIn Talent Blog, 2022. https://www.linkedin.com/business/talent/blog/talent-strategy/these-inmails-get-best-response-rates. Open to Work candidates had a 37% higher InMail response rate (tens of millions of InMails, May 2021–Apr 2022). Global; measures response, not hiring.
- **[S9]** Baert, S. (2015/2018). "Do They Find You on Facebook? Facebook Profile Picture and Hiring Chances". IZA Discussion Paper 9584 (Dec 2015); published in *New Media & Society* (2018). https://repec.iza.org/dp9584.pdf. Quote: "Candidates with the most beneficial Facebook picture obtain approximately 39% more job interview invitations compared to candidates with the least beneficial picture."
- **[S10]** "Save a profile as a PDF". LinkedIn Help, current. https://www.linkedin.com/help/linkedin/answer/a541960. Quote: "This feature is available only to members who have profiles and whose profile language is set to English".
- **[S11]** Acquisti, A. & Fong, C. (2020). "An Experiment in Hiring Discrimination via Online Social Networks". *Management Science*. https://papers.ssrn.com/abstract=2031979 (403 on fetch; details via abstract summaries). US.
- **[S12]** "ISE Student Recruitment Survey 2025". Institute of Student Employers, 2025. https://ise.org.uk/knowledge/research/491/ise_student_recruitment_survey_2025. Paywalled; public page has no LinkedIn data; 2026 report announced for 14 Oct 2026.
- **[S13]** "Does your LinkedIn profile picture matter?". Lilach Bullock (blog), undated. https://www.lilachbullock.com/does-linkedin-profile-picture-matter/. Repeats "21 times more profile views" with no source. Cited only as evidence of the myth.
- **[S14]** "A Catch-22 When Sourcing Black Candidates". ERE, 2021. https://www.ere.net/articles/a-catch-22-when-sourcing-black-candidates. The 26% photo statistic is unsourced in the article. Grade C.
- **[S15]** "LinkedIn Professional Community Policies". LinkedIn, current. https://www.linkedin.com/legal/professional-community-policies. Quotes: "Do not post misleading or deceptive information about yourself, your business, your qualifications, work experience, affiliations, or achievements."; "Don't do things to artificially increase engagement with your content."; "Do not use an image of someone else, or any other image that is not your likeness, for your profile photo."
- **[S16]** "LinkedIn Profile Checklist". University of Worcester Careers, undated. https://www2.worc.ac.uk/careers/documents/LinkedIn_Checklist.pdf. Quotes: Headline "1 line to sum up your status"; all sections "checked and re-checked for formatting, spelling, punctuation, and grammar". (Not Russell Group; it corroborates TARGETjobs.)
- **[S17]** "Researchers find 1,000 LinkedIn profiles using computer-generated faces" (Stanford Internet Observatory / NPR investigation). The Register, 2022. https://www.theregister.com/2022/03/28/fake_linkedin_faces/. Quote: "Backgrounds are often indistinct, blurry, or irregular".
- **[S18]** Kavanagh Smith, D. "Insights on US Network Homophily and Strength by Gender, Race, and Community Income". LinkedIn Economic Graph, 2023. https://economicgraph.linkedin.com/blog/insights-on-us-network-homophily-and-strength-by-gender-race-and-community-income. Quote: "Men's average total network strength percentile is 6 points higher than women's." US data.
- **[S19]** "Closing the Network Gap". LinkedIn, 2019. https://blog.linkedin.com/2019/september/26/closing-the-network-gap (redirects; figures via search summaries and https://business.linkedin.com/talent-solutions/recruiting-tips/thinkinsights/network-gap). Not fetched; grade C until verified.

---

## 9. Evidence gaps and next steps

1. **No public UK data on how often graduate recruiters look at students' LinkedIn**, or what they do with it. The ISE 2026 survey (out today, 14 Oct 2026) and Bright Network/Cibyl employer surveys are the best bets; both may be paywalled. A 5-question poll of the employers on Placed would beat every source here.
2. **No study links LinkedIn profile quality to UK graduate hiring outcomes.** All rater studies are North American or European and use lab or field-experiment designs.
3. **Firm-level guidance is missing.** I found no UK bank, Big 4, MBB or tech firm page saying whether it checks applicants' LinkedIn. Sector files should try employer careers FAQs.
4. **The Save-to-PDF contents need empirical confirmation.** Collect 5–10 real exports, including one non-English and one with Projects, before building parsers.
5. **Several fetches failed** (CareerBuilder, SSRN/Acquisti, QUB careers PDF, LinkedIn network-gap blog, NACE). Those claims rest on secondary summaries and are flagged in the citations.
6. **The web search budget ran out mid-research**, so Russell Group LinkedIn pages (UCL, Manchester, Warwick, Cambridge), Bright Network and Prospects LinkedIn guides were not fetched. Sibling sector files may cover them. Rules sourced to [S1]+[S16] would move from B to A if two Russell Group pages confirm them.
