# LinkedIn Profile Scoring 01: Platform Mechanics and Input Feasibility (sector-agnostic)

Scope: what a LinkedIn profile contains in 2026, how recruiters find UK students on it, what the "Save to PDF" export lets Placed check, LinkedIn's own student guidance, and which popular LinkedIn stats are myths. Ends with a generic rule set (LI-GEN-xx) that applies to every archetype (`software_eng`, `data_analytics`, `quant_trading`, `consulting`, `product`, `finance_banking`, `marketing_growth`, `research`).
Compiled: 2026-10-14. All URLs accessed 2026-10-14. Status: research input for the Placed LinkedIn scorer. Not recruiting advice.

---

## 0. How to read this document

Same conventions as `docs/research/cv-rules-finance-consulting.md` §0, so rules can be merged into `lib/cv-rules/`-style data.

**Check type**
- `RULE`: deterministic in code (regex, section parser, counts).
- `LLM`: model judgement; each one is phrased as a single yes/no question with a pass and a fail example.
- `HYBRID`: code extracts or pre-filters, LLM grades.

**Input** (which input can check the rule; we never scrape LinkedIn)
- `pdf_export`: the member's own LinkedIn "Save to PDF" file.
- `screenshot`: a screenshot of the profile top card or a section (OCR + vision).
- `self_report`: a question the student answers in Placed (yes/no, number, paste).

**Severity**: `critical` (likely to make a recruiter skip the profile or make it unfindable), `major` (materially weaker than peers), `minor` (polish).

**Evidence**: `A` LinkedIn's own help/product pages, or consistent across several top-tier UK careers sources; `B` one top-tier source (incl. a single LinkedIn blog/marketing claim with no method); `C` practitioner or trade press; `D` my synthesis, no source.

**Year adjust** uses Placed's `Year` values: `1st`, `2nd`, `penultimate`, `final`, `masters`.

**Citation tags** [Lx] refer to section 8.

**About quotes.** Quotes are verbatim, under 25 words, and only from pages fetched on 2026-10-14. LinkedIn help pages were read through a fetch tool that renders the page to text; wording was checked against the returned text but not against a browser render. Two PDFs ([L13], [L14]) were text-extracted locally, so those quotes are exact.

### Honest caveats up front

1. **Evidence on LinkedIn profiles is much thinner than evidence on CVs.** There is no peer-reviewed study I could verify that links specific LinkedIn profile features to student hiring outcomes in the UK. Most "LinkedIn says X times more views" numbers trace to old LinkedIn blog posts whose URLs now redirect to a generic blog index (§5). LinkedIn's live help pages are the strongest evidence, and they describe *mechanics*, not *outcomes*.
2. **The search budget for this research ran out before I could fetch UK careers-service LinkedIn pages** (TARGETjobs, Prospects, Bright Network and Russell Group URLs I tried returned 403/404). The only UK careers source I read in full is the Open University's 2020 guide [L14]. UK-specific claims below are therefore mostly grade B or C. A follow-up pass should fetch at least three Russell Group LinkedIn pages before any rule is promoted to A on UK grounds.
3. **LinkedIn's own student guide is from 2013 and US-centric** [L13] (GPA, "major/minor", "Honors student"). It is still the only LinkedIn-branded student checklist I could open. Its advice is consistent with current help pages, but its numbers are stale.
4. **The PDF export's exact contents are contested between secondary sources** (§3). LinkedIn's help page does not list included sections. Placed must build fixtures from real exports before shipping any rule that depends on a section being present or absent.
5. **Recruiter search is increasingly AI/semantic** (§2.3). Keyword-matching advice from 2015–2022 guides is still directionally right (the fields are still indexed), but "stuff keywords into the headline" matters less than it did. Write rules about clear, evidenced content, not keyword density.

---

## 1. Profile sections and their limits (verified status, 2026-10-14)

| Section / feature | Limit or behaviour | Verified from | Grade | Notes for Placed |
|---|---|---|---|---|
| **Name** | Free text; no limit verified. | — | D | Check it is a real name, not "Jane S." or emoji. |
| **Headline** | 220 characters. Only ~60–70 chars show in search results, comments and invites. | Trade sources [L16], [L17]; LinkedIn help page not fetched | C | Treat 220 as hard limit; score the first ~70 chars as "what most people see". |
| **About** (formerly Summary) | 2,600 characters; "see more" fold at roughly 230–370 chars depending on device. | [L16], [L17] | C | Score the first ~250 chars separately. |
| **Experience: title** | 100 characters. | [L16] | C | |
| **Experience: description** | 2,000 characters per role. | [L16] | C | |
| **Recommendation text** | 3,000 characters. | [L16] | C | |
| **Skills** | Up to 100 skills. | LinkedIn help [L4]: "You can add up to 100 skills to your profile." | A | |
| **Top skills** | A short list of headline skills shown in About / top of Skills. The help page I fetched does not state the number; secondary sources say 5. | [L4] (silent on number); trade sources | C | Don't hard-code 5 as a LinkedIn rule; use "3–5 top skills" as Placed guidance (D). |
| **Endorsements** | 1st-degree connections endorse skills; LinkedIn says this "contributes to the strength of your profile, and increases the likelihood that you'll be discovered". | [L5] | A (mechanic) / no effect size | Not visible in the PDF. |
| **Featured** | Posts, articles, external links, uploaded media (images, documents, presentations, videos). No maximum stated. "you must have at least two work samples featured to be able to reorder their positions." | [L6] | A | Not in PDF (§3). Needs screenshot or self-report. |
| **Custom public URL** | "Your custom URL can be 3-100 characters long and should not contain spaces, symbols, special characters, or the word LinkedIn." Changeable 5 times per 6 months; old URLs stay linked for 6 months. | [L3] | A | The URL appears in the PDF contact sidebar (D: observed layout; see §3). |
| **Open to Work** | Three visibility options: all members (adds the #OpenToWork photo frame), recruiters only (people using LinkedIn Recruiter), or only you (used to tailor job recommendations). LinkedIn warns, on recruiters-only, "we can't guarantee complete privacy." | [L2] | A | Not in PDF. Self-report. |
| **Creator mode** | Retired: toggle removed in March 2024; its features (follow button default, newsletters, Live) were folded into normal profiles for eligible members. | Trade/news sources [L18]; no LinkedIn page fetched | C | Never recommend "turn on Creator mode". Any rule or tip mentioning it is stale. |
| **Profile photo** | Recommended 400×400 px, JPG/PNG, up to 8 MB. LinkedIn offers filters and #OpenToWork / #Hiring frames. | Trade sources only [L19] | C | Not in PDF. Screenshot. |
| **Background (banner)** | Recommended 1584×396 px, up to 8 MB. | Trade sources only [L19] | C | Not in PDF. Screenshot. |
| **Pronouns** | She/Her, He/Him, They/Them or custom; visible to everyone or only connections. | Trade source [L20] | C | Optional. Never score on presence. |
| **Name pronunciation** | Audio recording, mobile app only. | [L20] | C | Optional; ignore. |
| **Services** | A section mainly for freelancers/service providers. Limits not verified. | — | D | Not relevant to students; do not score. |
| **Verification badges** | Three types: identity, workplace, educational institution. Identity via CLEAR (US/CA/MX) or Persona (NFC passport, many countries). LinkedIn claims "Verified members see 60% more profile views on average" (no method given). | [L7] | A (mechanic) / B (effect claim) | Not in PDF. UK students can usually verify identity via Persona (passport) and education via school email where supported. Score as minor. |
| **Profile level meter** | Beginner → Intermediate (4 sections) → All-star (7 sections: photo, location, industry, education, position, skills, summary). Visible only to the member; disappears once complete. | LinkedIn help (LinkedIn Learning help centre) [L8] | A (that it exists) | The OU guide adds "at least fifty connections" for All-Star [L14]; this conflicts with [L8]. Use the 7 sections as a checklist, not the label as a goal. |
| **Save to PDF limit** | "You're limited to 200 PDF downloads per month..., including both your own profile and other members' profiles." English-only; desktop only. | [L1] | A | Older third-party pages say 100/month and "no limit for your own profile"; LinkedIn's current page says 200 including your own. |

---

## 2. How recruiters find students on LinkedIn

### 2.1 Fields that are searchable and filterable (LinkedIn Recruiter / Recruiter Lite)

What LinkedIn itself confirms:
- LinkedIn's Recruiter marketing page mentions "40+ advanced search filters" and names job titles, locations and skills as examples, but does not list them all [L9].
- **Spotlights** let recruiters prioritise "candidates who are more likely to engage", based on activity, interest and relationship signals; Open to Work is named as one of them [L9].
- **Open to Work, recruiters-only**, is shared with "People using LinkedIn Recruiter only" [L2]. So a student with the recruiters-only setting is visible to Recruiter seat holders through the Spotlight, but not to Recruiter Lite or free-search users (D: inferred from "LinkedIn Recruiter only"; LinkedIn does not say whether Recruiter Lite counts).
- **Skills** help LinkedIn "match you with the right opportunities" [L4]; endorsements increase "the likelihood that you'll be discovered" [L5].
- The profile level meter page says completing sections improves searchability (LinkedIn's wording, no detail) [L8].

What practitioner sources add (grade C):
- Filters include job title (current, past or both), skills, companies, schools, years of experience, location, industry, seniority, spoken languages, and Spotlights; most filters accept Boolean and "must have / can have / doesn't have" [L21].
- **Years of experience** is calculated from Experience dates and rounds months, so a student's 3-month internship can count as a year or be missed [L22]. Implication: Experience dates must be complete and accurate; a missing end date makes an internship look current.

What this means for students (D):
1. **Title, company and school fields are indexed and filterable.** Recruiters looking for "penultimate-year UCL maths" filter on school and graduation year, so Education must list the institution from LinkedIn's school list (linked logo), the degree, and an end year.
2. **Location is a filter.** A missing or overseas location can drop a UK student out of "London" searches.
3. **Headline is free text that keyword and semantic search both read.** It is the most visible field in result lists.
4. **Skills are a structured field.** Skills typed in About but not added to the Skills section are not filterable as skills.

### 2.2 Ranking and "profile strength"

LinkedIn does not publish how Recruiter ranks results [L9]. It states completeness improves searchability [L8] and endorsements help discovery [L5], without effect sizes. Any Placed claim like "this will raise you X places in search" is unsupported. Phrase UI copy as "makes you findable for filters recruiters use", not "boosts your ranking".

### 2.3 AI-assisted search and Hiring Assistant (2025–26)

- **AI-Assisted Search** (English, rolled out through September 2025): moves beyond keyword and filter matching to "matching based on qualifications that are unique to the candidate you're looking for — even those critical, hard-to-define skills not explicitly listed on resumes." LinkedIn reports 18% higher InMail acceptance vs manual-filter sessions [L10].
- **Hiring Assistant**: LinkedIn's first AI agent for Recruiter & Jobs; recruiters upload job descriptions and intake notes to build pipelines. English-first rollout [L10]. Verified 2026-10-18 (audit): LinkedIn Newsroom, 3 Sep 2025, "globally available in English by the end of September" (https://news.linkedin.com/2025/hiring-assistant-globally-available).
- **2026 release**: LinkedIn describes "semantic search powered by AI" that surfaces candidates on "hard-to-define skills" and AI-written follow-up messages based on "candidate profiles and past interactions" [L11].

**Implication for scoring (D).** When the recruiter types a natural-language brief, the model reads the whole profile text (headline, About, Experience descriptions, projects). Profiles with empty Experience descriptions or a one-word headline give the model nothing to match. This favours rules about *substantive, specific text in every section*, over rules about exact keyword placement. It also means a profile that only lists a skill, with no evidence anywhere, may match less well than one that describes using it (D, plausible, not demonstrated).

---

## 3. What "Save to PDF" contains and omits

**LinkedIn's own description** [L1]: it saves "a copy of your profile ... as a resume in a PDF". Desktop only ("This feature is not available on the LinkedIn mobile app."). English only ("The Save to PDF option currently supports only English characters."), and the member's language setting must also be English. 200 downloads/month including your own. LinkedIn does **not** list which sections are included.

**Secondary sources disagree:**

| Element | magic-self.dev, Jan 2026 [L23] | aycabtu.com, Aug 2026 [L24] | LinkedIn Pulse article (Sid Clark, undated) [L25] | My assessment (D) |
|---|---|---|---|---|
| Name, headline, location | Yes | Yes | Yes | **In.** |
| Contact block | Yes ("contact details") | not stated | Email only if 1st-degree connection | **In:** public profile URL; email for own profile (verify). |
| About / Summary | Yes | Yes | Yes | **In.** |
| Experience with descriptions and dates | Yes | Yes | Yes | **In.** Duration also printed per role (verify). |
| Education with dates | Yes | Yes | Yes | **In.** |
| Skills | "up to 50 skills" | Yes | Yes | **Contested.** Recent exports I have seen show only a short "Top Skills" list (about 3) in the sidebar. Do not count skills from the PDF. |
| Certifications, languages, honours/awards, publications | Yes | Yes (accomplishments) | Yes | **Mostly in** (sidebar). |
| Projects, volunteering, courses, test scores | Projects and volunteering: yes | Projects, courses, test scores: yes | — | **Contested.** Verify with fixtures. |
| Recommendations | **No** | Yes (received and given) | Yes (received) | **Contested.** Older exports included them; treat as absent until a fixture proves otherwise. |
| Profile photo | No | No | No | **Out** (all agree). |
| Background banner | — | — | No | **Out.** |
| Featured / uploaded media | — | — | No (uploaded docs, videos) | **Out.** |
| Activity / posts / articles | No | No | No | **Out.** |
| Connections / followers count | No | No | No | **Out.** |
| Endorsement counts | No | — | — | **Out.** |
| Open to Work, verification badges, Premium badge | Premium: no | — | — | **Out** (D). |
| Download date | — | — | "nor the date the download was made" | **Out.** Ask the user for the date. |

**Decision for Placed:**
1. **Checkable from PDF with confidence:** name, headline, location, URL slug, About, Experience (titles, companies, dates, descriptions), Education (school, degree, dates), certifications/languages/awards where present.
2. **Not checkable from PDF:** photo, banner, Featured, activity, connections, endorsements, Open to Work, verification, recommendations (until proven), full skills list.
3. **Must build fixtures** (≥5 real exports from team members across 1st-year to masters, including one with recommendations, projects and volunteering) before shipping rules that depend on contested sections. The parser must also detect non-English or non-LinkedIn PDFs (a CV uploaded by mistake) and say so.
4. **Screenshot path** covers the top card (photo, banner, headline, Open to Work frame, verification badge, connection count "500+") and Featured. Use one guided screenshot of the top card plus one of Featured.
5. **Self-report path** covers Open to Work setting, recommendations count, activity in last 90 days, connections count, verification, and full skills count.

---

## 4. LinkedIn's own guidance for students

The only LinkedIn-branded student checklist I could open is **"Building a Great Student Profile"** (© 2013 LinkedIn, hosted by NC State) [L13]. US-centric, dated, but its 10 points map onto the current profile:

1. Informative headline: "a short, memorable professional slogan".
2. Appropriate photo: high quality, alone, professionally dressed; "LinkedIn isn't Facebook."
3. Show off education: all schools, courses, study abroad, grades and honours.
4. Professional Summary: like the first paragraphs of your best cover letter.
5. Skills filled with keywords that recruiters search for, taken from job listings.
6. Update your status regularly ("Many recruiters read your feed!").
7. Collect recommendations: "at least one recommendation for each position", ideally from managers.
8. Claim your unique URL, set profile to public.
9. Share work samples (now the Featured section).
10. Join groups (much less visible on 2026 profiles; low value, D).

It claims a photo makes a profile "7x more likely to be viewed", a different number from the later "21x" (§5).

The **Open University careers guide (2020)** [L14], a UK source, adds: use a headline with "relevant keyword phrases" for the target role; "We would recommend stating “seeking opportunities” in your profile summary rather than your headline."; let recruiters know via career interests (now Open to Work); and build a connection strategy rather than chasing numbers ("a larger network has more reach this alone does not guarantee the quality or impact").

**LinkedIn data on photos, skills, Open to Work:** see §5. The only LinkedIn-published numbers I could fetch on a live LinkedIn page in 2026 are the verification claim (60% more profile views [L7]) and the AI-assisted search InMail acceptance figure (18% [L10]). Both are LinkedIn marketing figures with no published method.

**Open to Work in practice.** LinkedIn's 2020 blog (as quoted by Fortune, 2024 [L15]) says members with the public frame are "on average, 40% more likely to receive InMails from recruiters". Fortune reports 40 million members used the public badge in July 2024 and 200 million had it on privately. UK recruiters quoted disagree on the public frame: Victoria McLean (City CV) says it "can look desperate, amateurish"; Lewis Maleh (Bentley Lewis) says unemployed candidates "need to be visible" [L15]. Neither side cites data. **For students, the recruiters-only setting gets the Recruiter Spotlight benefit without the debate** (D).

---

## 5. Popular LinkedIn stats that are NOT traceable to a primary source (myths / unverified)

| # | Claim as commonly quoted | What I found | Verdict |
|---|---|---|---|
| M1 | "Profiles with a photo get **21x** more profile views, **36x** more messages, **9x** more connection requests." | Repeated by universities (OU 2020 [L14]) and countless blogs, attributed to LinkedIn. The LinkedIn blog posts these trace to now 301-redirect to `linkedin.com/blog/member`; no archived copy could be fetched here. No method, date range or control is published. LinkedIn's own 2013 student guide said **7x** [L13]. | **Unverified.** Do not show in UI as fact. Correlational at best: people with photos are also more active. Safe copy: "LinkedIn has long said profiles with photos get far more views." |
| M2 | "Members with **5+ skills** get **17x** more profile views and are messaged **33x** (or 31x) more"; "**27x** more likely to be found by recruiters." | Attributed to a 2016 LinkedIn blog post ("Expert tips for making skills on your LinkedIn profile stand out"); URL now redirects; numbers vary between sources (31x vs 33x). | **Unverified.** Same treatment as M1. |
| M3 | "Listing your current position makes you **16x** more discoverable; adding your city **23x**." | Repeated in OU guide [L14] and blogs; no primary LinkedIn page found. | **Unverified.** |
| M4 | "Open to Work **doubles** recruiter messages (2x)"; "**40%** more InMails", "**20%** more messages from the community". | 40%/20% come from a 2020 LinkedIn blog post (now redirecting), re-quoted by LinkedIn to Fortune in 2024 [L15]. "2x" has no source I could find. | **40%: LinkedIn claim, grade B, self-selected sample.** 2x: unverified. |
| M5 | "Verified members get **60%** more profile views and **50%** more engagement." | Live on LinkedIn's help page [L7]. No method. | **LinkedIn claim, grade B.** Correlational (verified members are likelier to be active). |
| M6 | "All-Star profiles are **40x** more likely to receive opportunities." | Widely quoted on blogs. I found no LinkedIn source. | **Unverified / likely myth.** |
| M7 | "All-Star requires 50+ connections." | OU 2020 [L14]; contradicted by LinkedIn's help page listing 7 sections [L8]. | **Conflicting; follow [L8].** |
| M8 | "Recruiters look at a LinkedIn profile for **6–7 seconds**." | This is the TheLadders eye-tracking study on *CVs/résumés*, not LinkedIn profiles. | **Misapplied.** Don't use for LinkedIn. |
| M9 | "**87% / 95%** of recruiters use LinkedIn to vet candidates." | US recruiter surveys (Jobvite etc.), old and US-only; not checked in this pass. | **Unverified for UK students.** |
| M10 | "Turn on Creator mode to grow reach." | Creator mode toggle was removed in March 2024 [L18]. | **Obsolete.** |
| M11 | "Hashtags on your profile improve search." | Profile hashtag bar removed February 2024 (trade sources [L18]). | **Obsolete.** |

**Rule for Placed copy:** never print a multiplier ("21x") in the scorer UI. If a stat is shown, it must be from a live LinkedIn page (M5, the 18% AI search figure) and labelled "LinkedIn says".

---

## 6. Generic rule set (LI-GEN-xx, all sectors)

Columns as required. "Year adjust" lists only deviations from the base severity. LLM rules include a yes/no question with pass and fail examples in §6.1.

| ID | Rule | Check | Input | Severity | Year adjust | Evidence | Citations |
|---|---|---|---|---|---|---|---|
| LI-GEN-01 | **Profile photo present**: a clear, recent head-and-shoulders photo of the student alone; no group shots, avatars, logos or heavy filters. | HYBRID (vision: face present, single person, not a logo/avatar; LLM: professional enough) | screenshot (fallback self_report) | major | none | A (LinkedIn guidance [L13]; profile meter lists photo [L8]) / effect size unverified (M1) | [L8], [L13], [L14] |
| LI-GEN-02 | **Real full name** in the name field: first and last name, no emoji, job titles, "Open to work" or "Student" in the name. | RULE (regex: ≥2 alphabetic tokens; no emoji; no words like `student|hiring|open|seeking|intern`) | pdf_export | major | none | D | — |
| LI-GEN-03 | **Custom public URL** claimed: slug is name-based, not the default random suffix (e.g. `/in/jane-smith-a1b2c3d4`). | RULE (regex on contact block: slug ends in `-[0-9a-f]{6,}` or long digit run → fail) | pdf_export | minor | none | A (LinkedIn recommends a variation of your name [L3]; [L13]) | [L3], [L13] |
| LI-GEN-04 | **Headline is not just "Student at X"**: states field/target role plus at least one concrete differentiator (skill, experience, achievement). | LLM | pdf_export | critical | 1st, 2nd: major | A (LinkedIn [L13]; OU [L14]; consistent across careers guidance) | [L13], [L14] |
| LI-GEN-05 | **Headline front-loads the key information** in the first ~70 characters (what shows in search results and invites). | HYBRID (RULE: len ≤ 220; take first 70 chars; LLM: does that slice state role/field?) | pdf_export | major | none | C (display truncation from trade sources) | [L16], [L17] |
| LI-GEN-06 | **"Seeking" language belongs in About or Open to Work, not as the whole headline** ("Seeking opportunities" / "Aspiring X" with nothing else fails). | RULE (regex `^(seeking|looking for|aspiring|open to)` and < 6 other content words) + LLM tie-break | pdf_export | minor | 1st: skip | B (OU [L14]) | [L14] |
| LI-GEN-07 | **About section present** and at least ~600 characters. | RULE (section exists; char count) | pdf_export | major | 1st: minor | A (Summary is one of LinkedIn's 7 profile-meter sections [L8]; [L13]) | [L8], [L13] |
| LI-GEN-08 | **About opening hook**: the first ~250 characters (above "see more") say who the student is, what they study, and what they are aiming for. | LLM | pdf_export | major | none | C (fold length [L16]) / D | [L16], [L13] |
| LI-GEN-09 | **About is specific, written in first person, and evidence-based**, not a list of adjectives ("passionate, hard-working, team player"). | HYBRID (RULE: cliché lexicon density; LLM judge) | pdf_export | major | none | B ([L13] "concise and confident about your qualifications") / D | [L13] |
| LI-GEN-10 | **Every Experience entry has a description** (≥ 1 sentence/bullet) saying what the student did and a result; no title-only entries. | RULE (count entries with empty description) + LLM for quality | pdf_export | major | 1st: minor | D (supported by AI-search reading full text [L10], [L11]) | [L10], [L11] |
| LI-GEN-11 | **Experience dates complete and consistent**: month and year start/end; past roles have end dates; no overlapping "Present" roles that are actually finished. | RULE (date parser; >1 "Present" role flagged; internship "Present" > 6 months flagged) | pdf_export | major | none | C (Recruiter years-of-experience is calculated from these dates [L22]) | [L21], [L22] |
| LI-GEN-12 | **Education complete**: institution, degree and subject, start and expected end year (graduation year is a recruiter filter); grade or predicted grade where strong. | RULE (fields present; end year present) + RULE (grade regex, optional) | pdf_export | critical | masters: also requires undergrad entry (major) | A (education in LinkedIn guide [L13] and profile meter [L8]; school is a Recruiter filter [L21]) | [L8], [L13], [L21] |
| LI-GEN-13 | **Location set to the UK city where the student wants to work** (or studies), not blank or a home country they are not targeting. | RULE (location string present; matches UK place list) + self_report for target city | pdf_export | major | none | A (location in profile meter [L8]; location is a Recruiter filter [L9], [L21]) | [L8], [L9], [L21] |
| LI-GEN-14 | **Skills section populated**: ≥ 10 skills overall, including the core skills for the target sector, with 3–5 chosen as top skills. | HYBRID (self_report count; PDF "Top Skills" sidebar parsed; sector skill bank match) | self_report + pdf_export (partial) | major | 1st: threshold 5 | A (skills in profile meter [L8]; skills matched to opportunities [L4]) / threshold D | [L4], [L8] |
| LI-GEN-15 | **Skills are evidenced**: each top skill appears in at least one Experience, Education, Project or About description. | HYBRID (string/synonym match top skills → body text; LLM for paraphrase) | pdf_export | major | none | D (aligns with semantic AI search [L10]) | [L4], [L10] |
| LI-GEN-16 | **Featured or Projects section shows at least one work sample** (project link, GitHub, portfolio, write-up, competition result). | self_report or screenshot (presence + link type) | screenshot / self_report | minor | penultimate, final, masters: major for software_eng, data_analytics, product, marketing_growth, research (sector files decide) | A (LinkedIn feature and student guide [L6], [L13]) | [L6], [L13] |
| LI-GEN-17 | **At least one recommendation** from a manager, supervisor, lecturer or society lead. | self_report (count + relationship) | self_report (pdf_export unreliable, §3) | minor | 1st, 2nd: skip; final, masters: minor | B (LinkedIn 2013 student guide [L13]) | [L13] |
| LI-GEN-18 | **Some professional activity in the last 90 days** (a post, a substantive comment, or a reshare with own commentary). | self_report | self_report | minor | none | B/C (LinkedIn [L13]; OU [L14]); no outcome data | [L13], [L14] |
| LI-GEN-19 | **Network of ≥ 50 relevant connections** (classmates, colleagues, society members, alumni), built deliberately; no target of 500+. | self_report or screenshot (connection count) | screenshot / self_report | minor | 1st: threshold 20 | C (OU [L14]) / D | [L14] |
| LI-GEN-20 | **Open to Work set to "Recruiters only"** with target job titles, locations (UK cities) and start dates, when the student is actively applying. Public frame is the student's choice, not scored. | self_report | self_report | major | 1st: minor | A (mechanic [L2], [L9]) / B (40% InMail claim, M4) | [L2], [L9], [L15] |
| LI-GEN-21 | **Consistent with the CV**: same employers, titles, dates, degree and grade as the CV Placed already holds; no role on one and not the other without reason. | HYBRID (RULE: fuzzy-match entities and dates against parsed CV; LLM explains mismatches) | pdf_export | critical | none | D (recruiters compare the two; "everything on there is fair game" logic from CV rules FCQ-11) | — |
| LI-GEN-22 | **No placeholder or broken text**: no "Lorem", "[Company]", "TBD", duplicated paragraphs, or text pasted with broken bullets/encoding. | RULE (regex + duplicate-paragraph detection + mojibake check) | pdf_export | major | none | D | — |
| LI-GEN-23 | **Spelling and grammar clean** (UK English) across headline, About and Experience. | HYBRID (spell-check; LLM grammar) | pdf_export | major | none | A (by analogy with CV rules FCQ-05; D for LinkedIn specifically) | — |
| LI-GEN-24 | **No generic AI-written voice**: About and descriptions read as specific to this student, not interchangeable boilerplate. | LLM (genericness) + RULE (cliché lexicon shared with CV GEN-09) | pdf_export | minor | none | C/D | [L11] (recruiters now get AI-written outreach; mirror concern) |
| LI-GEN-25 | **Verification badge** (identity via Persona passport, or education/workplace where offered). | self_report or screenshot | screenshot / self_report | minor | none | A (mechanic) / B (60% claim, M5) | [L7] |

**Weighting suggestion (D):** critical 15 points, major 6, minor 2, normalised to 100 per sector after sector files add or re-weight rules. A rule whose input is unavailable (e.g. no screenshot uploaded) is `not_applicable` and is excluded from the denominator, but the UI shows "not checked: upload a screenshot to check your photo".

### 6.1 LLM rule questions (pass / fail examples)

**LI-GEN-04.** Q: "Does the headline say what field or role the student is targeting AND give at least one concrete differentiator (skill, experience, achievement)?"
- Pass: "Maths & CS @ UCL | Python, SQL | Summer analyst intern @ Barclays 2026"
- Fail: "Student at University College London"

**LI-GEN-05.** Q: "Do the first 70 characters of the headline, on their own, tell a recruiter the student's field or target role?"
- Pass: "Economics BSc (LSE) | Aspiring M&A analyst | Investment Society VP ..." (first 70 chars name field + role)
- Fail: "✨ Passionate lifelong learner who loves challenges, people and growth | Economics..." (field appears after char 70)

**LI-GEN-06** (tie-break only). Q: "Is the headline only a job-seeking statement with no field, skill or experience?"
- Pass (rule passes): "Seeking 2027 software internships | Java, React | Hackathon winner"
- Fail: "Looking for opportunities"

**LI-GEN-08.** Q: "Within the first 250 characters, does the About say what the student studies, where, and what they are aiming for?"
- Pass: "I'm a second-year Physics student at Imperial looking for 2027 quant research internships. I've built ... "
- Fail: "Ever since I was young I have always been fascinated by how the world works and the people in it..."

**LI-GEN-09.** Q: "Does the About section give at least two specific, checkable facts (a project, a result, a number, a named activity) rather than only adjectives?"
- Pass: "Led a 6-person team to 2nd place in the UCL Trading Challenge; built a Python backtester (GitHub link)."
- Fail: "I am a passionate, hard-working, motivated team player with excellent communication skills."

**LI-GEN-10** (quality part). Q: "Does this Experience description say what the student personally did and at least one result or scope?"
- Pass: "Cleaned and analysed 40k rows of sales data in SQL; dashboard used weekly by the regional team."
- Fail: "Various tasks in the office." / (empty)

**LI-GEN-15** (paraphrase part). Q: "Is the skill '<skill>' shown being used anywhere in the profile text (even in different words)?"
- Pass: Skill "Financial Modelling"; Experience: "Built a 3-statement model for a society stock pitch."
- Fail: Skill "Machine Learning"; nowhere else mentioned.

**LI-GEN-21.** Q: "Do the LinkedIn profile and the CV disagree on any employer, title, date (by more than one month), degree or grade?" (yes = fail)
- Pass: Both say "Summer Analyst, Barclays, Jun–Aug 2026".
- Fail: CV says "Intern, Jun–Sep 2026"; LinkedIn says "Analyst, May 2026–Present".

**LI-GEN-24.** Q: "Could this About section be pasted onto another student's profile in the same sector with only the name changed?" (yes = fail)
- Pass: mentions the student's actual modules, projects and societies by name.
- Fail: "Driven and results-oriented individual eager to leverage my skills in a dynamic environment."

---

## 7. Implementation notes for the scorer (D)

1. **Input detection.** Confirm the uploaded PDF is a LinkedIn export (layout markers such as a sidebar "Contact" with a `linkedin.com/in/` URL, "Top Skills", page footer "Page x of y"). If not, tell the student and offer the CV scorer instead.
2. **Language gate.** The export only works for English profiles [L1]. If the student's profile is in another language, offer a screenshot/paste path.
3. **Freshness.** The PDF has no date [L25]. Ask "When did you download this?" and warn if older than 30 days.
4. **Privacy.** The PDF holds contact details. Store only the parsed fields Placed needs; never store email/phone from it; redact in logs (same as CV pipeline).
5. **Coverage meter.** Show "Checked from PDF: 17 rules · Needs a screenshot: 4 · Needs your answer: 4" so the 0–100 score is honest about what it could see.
6. **Fixtures first.** Contested items in §3 (skills list, recommendations, projects, volunteering) must be resolved with ≥5 real exports before LI-GEN-14/17 read from the PDF.

---

## 8. Citations (all accessed 2026-10-14)

| Tag | Title | Publisher | Year | URL |
|---|---|---|---|---|
| L1 | Save a profile as a PDF | LinkedIn Help | 2026 (live page) | https://www.linkedin.com/help/linkedin/answer/a541960 |
| L2 | Let recruiters know you're open to work | LinkedIn Help | 2026 (live page) | https://www.linkedin.com/help/linkedin/answer/67405 |
| L3 | Customize your public profile URL | LinkedIn Help | 2026 (live page) | https://www.linkedin.com/help/linkedin/answer/87 |
| L4 | Add and remove skills on your profile | LinkedIn Help (LinkedIn Learning help centre) | 2026 (live page) | https://www.linkedin.com/help/learning/answer/a549047 |
| L5 | Skill endorsements | LinkedIn Help | 2026 (live page) | https://www.linkedin.com/help/linkedin/answer/31888 |
| L6 | Manage featured samples of your work on your LinkedIn profile | LinkedIn Help | 2026 (live page) | https://www.linkedin.com/help/linkedin/answer/111587 |
| L7 | Verifications on your LinkedIn profile | LinkedIn Help | 2026 (live page) | https://www.linkedin.com/help/linkedin/answer/140551 |
| L8 | Use the profile level meter to update your profile | LinkedIn Help (LinkedIn Learning help centre) | 2026 (live page) | https://www.linkedin.com/help/learning/answer/391 |
| L9 | How to use LinkedIn Recruiter to search for candidates | LinkedIn Talent Solutions | n.d. (live page) | https://business.linkedin.com/hire/resources/talent-acquisition/how-to-use-linkedin-recruiter |
| L10 | 2025 LinkedIn Hiring Release, Wave 2 | LinkedIn Talent Solutions | 2025 | https://business.linkedin.com/hire/product-update/wave2-2025 |
| L11 | 2026 LinkedIn Hiring Release: What's New and What's Next | LinkedIn Talent Community | 2026 | https://tcommunity.linkedin.com/product-updates/2026-linkedin-hiring-release-2275 |
| L13 | Building a Great Student Profile (hosted copy) | LinkedIn Corporation (hosted by NC State Poole College) | 2013 | https://poole.ncsu.edu/undergraduate/wp-content/uploads/sites/23/2023/06/LinkedIn-Building-a-Great-Student-Profile.pdf |
| L14 | Your guide to making the most of LinkedIn | The Open University Careers & Employability Services | 2020 | https://help.open.ac.uk/students/_data/documents/careers/your-guide-to-making-the-most-of-LinkedIn.pdf |
| L15 | 40 million people are using LinkedIn's #OpenToWork badge right now, but recruiters say it can look desperate | Fortune | 2024 | https://fortune.com/2024/09/05/linkedin-opentowork-badge-recruiters-job-search/ |
| L16 | LinkedIn Character Limits in 2026 (Complete Reference for Every Field) | UniLink (trade) | 2026 | https://www.unilink.us/blog/linkedin-character-limits-2026 |
| L17 | LinkedIn character limits | AuthoredUp (trade; via search snippet, not fetched) | 2026 | https://authoredup.com/blog/linkedin-character-limit |
| L18 | LinkedIn Creator Mode retired (trade summary; via search snippet, not fetched) | Socialk.it / Guiding Tech | 2024–26 | https://socialk.it/en/blog/linkedin-creator-mode-retired ; https://www.guidingtech.com/you-cant-activate-creator-mode-on-linkedin-anymore-heres-what-you-can-do-instead |
| L19 | LinkedIn size guide 2026 (trade; via search snippet, not fetched) | Linearity | 2026 | https://linearity.io/blog/linkedin-size-guide/ |
| L20 | How to add your personal pronouns to your LinkedIn profile (via search snippet, not fetched) | Android Central | n.d. | https://www.androidcentral.com/how-add-your-personal-pronouns-your-linkedin-profile |
| L21 | LinkedIn Recruiter search filters (practitioner; via search snippet, not fetched) | Skylead / Leonar | 2024–26 | https://skylead.io/blog/find-employees-using-linkedin-recruiter-search-filters/ ; https://www.leonar.app/__md/blog/linkedin-recruiter-search-filters.md |
| L22 | YOE in LinkedIn Recruiter Demystified (practitioner; via search snippet, not fetched) | Boolean Strings (Irina Shamaeva) | 2022 | https://booleanstrings.com/2022/04/04/yoe-in-linkedin-recruiter-demystified/ |
| L23 | How to Export Your LinkedIn Profile to PDF (2026 Step-by-Step Guide) | magic-self.dev (trade) | 2026 | https://www.magic-self.dev/blog/how-to-export-linkedin-profile-to-pdf |
| L24 | Save Your LinkedIn Profile as a PDF in Under 2 Minutes (2026) | Aycabtu Blog (trade) | 2026 | https://aycabtu.com/blog/how-to-export-linkedin-profile-pdf |
| L25 | A Profile in a PDF? What, Why and How | Sid Clark, LinkedIn Pulse (practitioner) | n.d. | https://www.linkedin.com/pulse/profile-pdf-what-why-how-sid-clark |

Dead primary sources (redirect to https://www.linkedin.com/blog/member, checked 2026-10-14): `blog.linkedin.com/2020/october/29/the-benefits-of-sharing-with-your-community-you-re-open-to-work` (Open to Work 40%/20%); `blog.linkedin.com/2016/10/26/expert-tips-for-making-skills-on-your-linkedin-profile-stand-out` (skills 17x/33x).

---

## 9. Evidence gaps (to close before promoting rules)

1. No Russell Group / TARGETjobs / Prospects / Bright Network LinkedIn page was successfully fetched (403/404 or search budget exhausted). Needed to lift LI-GEN-04/07/09/18/19 to UK-specific grade A.
2. Save to PDF section list is contested (skills count, recommendations, projects, volunteering). Needs real fixtures.
3. Headline/About/Experience character limits come from trade sources; LinkedIn's help page with those limits was not fetched.
4. No LinkedIn page lists all Recruiter filters, or whether Recruiter Lite sees recruiters-only Open to Work.
5. No outcome data (interviews/offers) linked to any profile feature for UK students. All multipliers in circulation are unverified or LinkedIn marketing claims.
6. ~~Hiring Assistant GA date~~ Resolved 2026-10-18: LinkedIn Newsroom confirms English GA by end of September 2025. LinkedIn engineers' *Semantic Search at LinkedIn* (arXiv 2602.07309, Feb 2026, https://arxiv.org/html/2602.07309v1) describes semantic people search over summarised profiles plus network features.
7. Photo and banner specs are trade-sourced only.
