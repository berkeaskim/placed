# LinkedIn Profile Rules: Finance & Banking (`finance_banking`)

Scope: UK undergraduates and master's students targeting investment banking (IBD/M&A, ECM/DCM, Leveraged Finance), Sales & Trading / Markets, Research, Asset Management, and student routes into PE/VC. Firms in view: Goldman Sachs, J.P. Morgan, Morgan Stanley, Barclays, HSBC, Rothschild & Co, Lazard, Evercore, plus mid-market/boutique banks and asset managers. Recruiting cycle 2026-27 (spring weeks / insight weeks, summer internships, off-cycles, graduate analyst programmes).
Compiled: 2026-10-14. Status: research input for the Placed LinkedIn scorer. Not recruiting advice.
Rule IDs: `LI-FINANCE_BANKING-xx`. They override or add to the generic LinkedIn baseline (identity, headline, About, experience, skills, Featured, recommendations, activity, CV consistency).

---

## 0. Conventions

Same as `docs/research/cv-rules-finance-consulting.md` §0:

- **Check**: `RULE` (deterministic), `LLM` (one yes/no question with pass/fail examples), `HYBRID` (code extracts, LLM grades).
- **Input**: which input can check the rule. `pdf_export` = LinkedIn "Save to PDF" export; `screenshot` = profile screenshots the user uploads; `self_report` = user answers a question in Placed. We never scrape LinkedIn.
- **Severity**: `critical` (a recruiter or banker viewing the profile would likely discount the candidate on this alone), `major`, `minor`.
- **Evidence**: A = employer's own guidance or consistent across several top-tier UK careers sources; B = one top-tier source; C = practitioner/trade press; D = my synthesis, no source.
- Citations `[Lx]` refer to §10. CV-doc citations `[Sx]` refer to `cv-rules-finance-consulting.md` §9.

### What the Save-to-PDF export contains (important for input tagging)

LinkedIn's help page confirms the feature exists (desktop only, English-language profiles, a monthly download cap) but **does not list which sections are included** [L13]. From observed exports (evidence D, verify against a real 2026 export before shipping), the PDF carries: name, headline, location, contact/profile URL, "Top Skills" (about 3), Languages, Certifications, Honors-Awards, Summary (About), Experience with descriptions and dates, Education. It does **not** carry: photo, banner, Featured, Activity/posts, Recommendations text, endorsement counts, connection/follower count, Open-to-Work status, custom URL quality is visible only as text. So every rule about photo, banner, Featured, posting or recommendations is tagged `screenshot` or `self_report`.

---

## 1. How much LinkedIn matters in finance and banking

**Short answer: LinkedIn matters for networking and information, a little for credibility checks, and very little for formal screening. It is not how banks source or select students.**

| Function | Weight for students | Evidence |
|---|---|---|
| **Sourcing** (recruiters find you) | **Low.** Banks fill student programmes through their own application portals and event/talent-network sign-ups, not inbound LinkedIn search. GS tells students to "Register at My GS Events" and uses LinkedIn to broadcast jobs ("Follow us on LinkedIn for the latest open roles and news") [L2]. JPMorganChase points students to its own Talent Network [L3]. Barclays' hints-and-tips page does not mention LinkedIn at all [L4]. Off-cycle and boutique roles, and headhunters for PE/HF, do source on LinkedIn, but that is mostly post-graduate. | A (employer pages, by what they say and omit) |
| **Screening** (a reviewer looks at your profile when assessing the application) | **Low to medium, unverified.** No bank page I could fetch says it reviews student LinkedIn profiles. Selection is CV/application form + online tests + video interview + superday [S4][S6]. It is plausible that interviewers and the people you network with look you up; treat the profile as a **credibility check that must not contradict the CV**, not as a scoring stage. | D (no employer source either way) |
| **Networking** (alumni outreach, coffee chats, follow-ups after spring weeks and events) | **High.** This is the main use. Cambridge's banking guide tells students to follow firms on LinkedIn for timelines and events and to attend networking events [L1]. Newcastle tells finance students to use LinkedIn's Alumni tool and ask to connect for advice [L8]. LSE recommends personalised connection notes [L9]. Morgan Stanley's own networking article (aimed at experienced staff) tells readers to keep the profile up to date and engage weekly [L5]. Rothschild's insight weeks explicitly include networking [L14]. | A |
| **Posting / personal brand** | **Neutral to risky.** Banks are actively discouraging employee influencer content; eFinancialCareers (Mar 2026) reports Goldman discouraging analysts from day-in-the-life content [L7]. For students this means: posting is not expected, and some content types (deal chatter, "incoming at X" hype, stock tips) are negative. | B/C |

**Implication for Placed:** in this sector, the LinkedIn score should reward a **clean, consistent, credible, well-networked profile** and penalise risk. It should *not* reward posting volume, "personal brand", creator mode or follower counts. Tell users plainly: "Your LinkedIn will not get you a spring week. Your application will. LinkedIn is where you find and thank the people who help you."

---

## 2. What a strong student profile looks like, section by section

### 2.1 Photo and banner
- **Photo:** plain, well-lit head-and-shoulders, business or smart-casual dress (banking skews conservative: suit or blazer is safest; no sunglasses, nights out, group crops). TARGETjobs advises a professional but approachable headshot and warns against passport-style or party photos [L10]. LSE says a professional photo increases views and to use the same photo across platforms [L9]. (Grade A for "have a professional photo"; the dress-code detail is D.)
- **The "21x more profile views with a photo" statistic is unverified.** It is widely repeated (e.g. a 2019 Towson University post attributes it to LinkedIn) but I could not trace a primary LinkedIn publication [L18]. Do not show it in the UI as fact.
- **Banner:** a neutral image (city skyline, university, plain colour) is fine. A banner is minor. Avoid: trading-screen/"wolf" imagery, crypto graphics, Lamborghinis, motivational quotes. (D)

### 2.2 Headline (220 characters; first ~60-70 visible in search and messages)
LinkedIn now allows ~220 characters [L17, grade C, third-party]; UK careers pages still say 120 [L9][L10], which is outdated, so **optimise the first ~70 characters** and treat the rest as optional.

Formula: **`[Degree] @ [University] | [Target area] | [1-2 proof points: spring week / internship / society role / grade]`**

Good:
1. `Economics BSc @ UCL (First, Y1) | Aspiring IBD Analyst | Spring Week @ Barclays '26 | VP, UCL Investment Society`
2. `Mathematics & Statistics, Warwick | Interested in Sales & Trading | Off-cycle Intern, HSBC Global Markets | Python, VBA`
3. `MSc Finance, LSE | Ex-Summer Analyst, Rothschild & Co (M&A) | Seeking 2027 Graduate Analyst roles in Advisory`

Bad:
1. `Student at University College London` (no target, no proof)
2. `Future Goldman Sachs Banker 🚀💰 | Wolf of Wall Street in the making | Crypto Investor` (hype, firm-name presumption, risk signal)
3. `Incoming Summer Analyst @ J.P. Morgan | CFA Level I | Ex-Morgan Stanley` (where "Ex-MS" was a 1-day virtual experience and "CFA Level I" breaks CFA Institute naming rules [L11]: overclaiming)

Naming a specific bank you have *not* worked for as a goal ("Aspiring Goldman analyst") is a mild negative: it reads badly to every other bank you network with. Prefer the division ("Aspiring IBD Analyst"). (D)

"Incoming [role] @ [bank]" is common and factual once you have a signed offer. Forum culture calls it cringe, but that is C-grade opinion; Placed should accept it if true and consistent with the experience section.

### 2.3 About (2,600 characters; ~300 visible before "see more")
LinkedIn gives ~2,600 characters [L17]; UK careers sources suggest something short, first person, with a strong opening two lines [L9]. For banking, **80-200 words, three short paragraphs:**
1. Who you are + what you want: degree, university, year, target division and timeline ("seeking 2027 summer analyst roles in M&A / Markets").
2. Evidence of commitment: the 2-3 most relevant items (spring week, society role, stock pitch or valuation competition result, relevant modules, financial modelling course).
3. Skills + a human line: technical skills you can defend, languages, one interest with substance.

Tone: factual, understated. Banking readers dislike buzzwords ("passionate", "driven", "synergy") and grandiose claims. No market calls or investment opinions (compliance risk and easy to get wrong). (D, consistent with CV guidance on specificity [S1][S3])

### 2.4 Experience entries vs CV bullets
- Same facts, same dates, same titles as the CV. **Inconsistency is the main risk** (see LI-FINANCE_BANKING-02).
- LinkedIn entries can be **slightly longer and more narrative** than CV bullets: 2-4 bullets or 2-3 sentences, first person, still outcome-led and quantified [L10][L9].
- **Confidentiality is stricter than on a CV.** A CV goes to one recruiter; LinkedIn is public. Never name live or unannounced clients/deals, internal tickers, or non-public numbers from an internship. Describe the work generically ("Built a trading comps set for a £300m UK industrials sell-side mandate" is fine only if the deal is public; otherwise "a mid-cap industrials sell-side process"). (D; grounded in banks' confidentiality culture and the FCA's position that financial promotion rules apply on social media [L12], but no bank policy quote was retrievable.)
- Spring weeks and insight weeks go under Experience with accurate titles: "Spring Insight Programme", "Spring Week Intern", not "Investment Banking Intern". Virtual experiences (e.g. Forage job simulations) are fine but must be labelled as virtual/simulation; listing them as employment at the bank is overclaiming. (D)
- Part-time and non-finance jobs belong here too: TARGETjobs says include part-time roles and volunteering [L10].

### 2.5 Skills (top 10 for this sector)
TARGETjobs suggests 5-10 key skills relevant to your sector [L10]. Only the top ~3 appear in the PDF export, so **pin the three most relevant**.

| # | Skill | Table-stakes or differentiator |
|---|---|---|
| 1 | Financial Modelling | Table-stakes for IBD/PE (if you can defend it) |
| 2 | Microsoft Excel | Table-stakes (but IMC/quant firms say don't bother listing it; for banking it is still searched) [S15] |
| 3 | Valuation (DCF, comparables, precedent transactions) | Differentiator in 1st year, table-stakes for penultimate IBD |
| 4 | Financial Analysis / Financial Statement Analysis | Table-stakes |
| 5 | Mergers & Acquisitions | Differentiator (only with evidence: course, competition, internship) |
| 6 | Equity Research | Differentiator (stock pitches, society research) |
| 7 | Python (pandas) or VBA | Differentiator for S&T, quant-leaning AM, markets |
| 8 | Microsoft PowerPoint | Table-stakes for IBD (pitchbooks) |
| 9 | Bloomberg Terminal / Capital IQ / FactSet | Differentiator (only if trained; Bloomberg Market Concepts certificate is easy evidence) |
| 10 | Languages (business-level) | Differentiator for EMEA desks and coverage teams |

Soft skills ("Teamwork", "Communication", "Leadership") are fine but should not take the pinned top 3. Rule: **every listed technical skill should be evidenced somewhere** (experience, education, certification, project), matching the CV rule FCQ-11 [S5][S15].

### 2.6 Certifications: worth listing vs noise
Worth listing (in roughly this order of signal for students):
- **CFA Program** progress, worded correctly: "CFA Program candidate" (only if registered for an upcoming exam) or "Passed Level I of the CFA Program". CFA Institute prohibits "CFA Level I" as a designation and any wording implying you have or will earn the charter: "You should not imply you have earned any portion of the CFA charter or that you will earn it by a future date." [L11]
- **CFA Investment Foundations / Claritas**, **CISI** qualifications, **IMC** (Investment Management Certificate; mainly for AM and graduates).
- **Bloomberg Market Concepts (BMC)**, **Wall Street Prep / BIWS / CFI (FMVA)** financial modelling courses, **Excel/VBA** certificates with hours.
- **Virtual experience programmes** (Forage etc.) in the Licences & Certifications section rather than Experience.

Noise (minor negatives if they crowd the section): generic "LinkedIn Learning: Time Management", unrelated MOOCs, dozens of 1-hour badges, crypto/day-trading courses, "Certified Stock Market Expert" type products. (D/C)

### 2.7 Education
- List degree, university, expected graduation year. **State grades**: First / 2:1 / current average (e.g. "Year 1: 71% (First)"). Banks still signal 2:1+ [S1][S7][S8]; a missing grade on LinkedIn is less serious than on a CV (the CV is what gets screened), so this is **major**, not critical.
- A-levels: optional on LinkedIn (customary on the CV). Including them is fine if strong; leave off if weak. (D)
- **Relevant modules** (Corporate Finance, Financial Accounting, Econometrics, Derivatives) are useful keywords; 3-6, not a full transcript.
- Scholarships and prizes go in Honors-Awards (exported in PDF).
- Societies can be listed under Education "Activities and societies" or as Experience entries; **committee roles deserve an Experience entry** with outcomes.

### 2.8 Activities, societies, volunteering
Finance/investment society roles, trading or stock-pitch competitions, student-managed funds, SEO London / GAIN / Rare programmes [L1] are strong commitment signals. Membership alone is weak; committee roles with numbers (members, event attendance, fund AUM, competition placing) are strong. Mirrors CV rule FIN-04 [S9][S7].

### 2.9 Recommendations
Nice to have, not expected for students. One recommendation from an internship manager, society president or academic is a plus. LSE says recommendations are underused but valuable [L9]; TARGETjobs says they carry weight [L10]. Never ask a banker you met once on a spring week for a recommendation. Not visible in the PDF export. (B)

### 2.10 Activity and posting norms
**Neutral to risky.** The safest pattern is: low-volume, professional engagement (congratulating peers, sharing a society event, a short reflection after a spring week that thanks the team without disclosing anything internal).
- Banks discourage employee influencer content [L7]. An industry source quoted by eFC says: "if you want to work in finance and have a long term career, it's generally frowned upon to have a social media presence" [L7]. This is one person's view (C), but it matches the employer behaviour reported.
- FCA rules on financial promotions apply to social media as to any channel, and the FCA's 2024 guidance targets influencers who promote financial products [L12]. A student posting stock tips or crypto promotions is not breaking FCA rules by opinion alone, but **promoting a specific investment product, affiliate links or "signals" is a real risk and a red flag to banks.**
- Do not post about live deals, client names, office photos with screens/documents visible, or offer-letter screenshots with compensation.
- Morgan Stanley's line "engage with people on the site at least once a week" [L5] is aimed at experienced staff networking, not at students producing content; read it as "be reachable and responsive", not "post weekly".

### 2.11 Networking behaviour (self-report, coaching not scoring)
- Personalised connection notes (LSE [L9]); target alumni via the Alumni tool (Newcastle [L8]); network across levels, not just MDs (GS diversity recruiting tips, seen via search excerpt only, not fetched) [L6].
- Connect with people you met at spring weeks and events afterwards (eFC spring-week advice, C, search excerpt only) [L16].
- Coffee-chat requests: short, specific, one ask. Don't ask for a referral in the first message. (D)
- These are behaviours, not profile fields. Placed can ask about them (`self_report`) and coach, but should weight them lightly in the score.

---

## 3. Red flags and myths

**Red flags (sector-specific)**
1. Overclaiming titles: "Investment Banking Intern" for a spring week, insight day or virtual simulation; "Analyst" for a society role without context. (critical; D, mirrors CV FCQ-11 [S5])
2. CFA misuse: "CFA Level I", "CFA Candidate" when not registered, "CFA (expected 2027)" [L11]. (major; A as a rule from the trademark owner)
3. Confidential information: client names, unannounced deals, internal numbers, offer letters with pay. (critical; D)
4. Investment promotion / finfluencer content: stock tips, crypto shilling, trading "signals", affiliate links, "DM me to learn how I made 40%". (critical; B/C [L7][L12])
5. Profile contradicts the CV: different dates, titles, grades. (critical; D, but logically the strongest risk because interviewers and contacts do look)
6. Hype tone: emojis, "Wolf of Wall Street", "future MD", "hustle". (major; D)
7. Unprofessional photo or none. (major; A for having a professional photo [L9][L10])
8. Empty profile when actively networking: no headline beyond "Student", no About, no experience descriptions. Contacts you message will look you up. (major; D)
9. "Open to Work" green photo frame. Opinion is divided and there is no source either way for students; the recruiter-only visibility setting has no downside. Treat the public frame as neutral for students, mild negative for experienced hires. (minor; D)

**Myths**
- "Recruiters will find you on LinkedIn for a spring week / summer internship." Not how big banks recruit students; they use portals and events [L2][L3][L4].
- "You need to post regularly to stand out." Not in banking; can backfire [L7].
- "Profiles with a photo get 21x more views." No traceable primary source [L18].
- "All-Star profile status matters." LinkedIn's completeness meter is a product nudge; TARGETjobs says more complete profiles rank higher in recruiter search [L10], which is plausible, but recruiter search is not how students get into banks.
- "More connections = better." 500+ is a vanity number. Quality (alumni, people met at events, society peers) matters more. (D)
- "Endorsements prove skills." Endorsement counts are noise; evidenced skills matter. (D)

---

## 4. Differences by year

| | 1st year (3-yr course) / 2nd year (4-yr) | Penultimate year | Final year / master's |
|---|---|---|---|
| Main goal | Spring weeks / insight programmes (apply Sept-Oct) [L15][L8] | Summer internships (the main pipeline to grad offers) [S1] | Graduate analyst roles, off-cycles, AM/PE entry |
| Headline | Degree + university + "Interested in IB/Markets" + one proof point (society, school leadership) | Degree + target division + spring week/insight + society role | Target division + internship(s) + "Seeking 2027 Graduate Analyst" or "Incoming ..." |
| Experience expected | None in finance. Part-time jobs, volunteering, school leadership fully credited | ≥1 finance signal (spring week, insight, society committee, competition, virtual programme) | Prior internship expected for top schemes |
| About | 60-120 words; focus on curiosity + evidence of initiative | 100-200 words; division focus + evidence | 100-200 words; experience-led |
| Skills | Excel, PowerPoint, a modelling course | + valuation, modelling, Bloomberg/BMC | + deal/desk-specific skills you used |
| Certifications | BMC, Forage virtual programmes OK | Modelling courses, CFA Program candidate if registered | CFA Level I passed / IMC (esp. AM) |
| Grades | Predicted/A-levels OK | Y1 average | Y2/Y3 average or degree class; master's grade |
| Posting | Not expected | Not expected; a short thank-you post after a spring week is fine | Not expected; "incoming" post fine once offer signed |
| Networking intensity | Start: follow firms, connect with society alumni | Peak: alumni chats before applications, follow-ups after events | Targeted: specific teams, off-cycle leads |

Year adjust in the rule table refers to these columns.

---

## 5. Sector rule set: `LI-FINANCE_BANKING-xx`

| ID | Rule | Check | Input | Severity | Year adjust | Evidence | Citations |
|---|---|---|---|---|---|---|---|
| LI-FINANCE_BANKING-01 | **Headline names a finance target area and at least one proof point.** Must include degree/university and a division or area (IBD, M&A, Markets, S&T, Asset Management, Equity Research, PE). LLM question: "Does the headline state a finance target area and at least one concrete credential (spring week, internship, society role, grade)?" Pass: `Economics @ UCL | Aspiring IBD Analyst | Spring Week @ Barclays`. Fail: `Student at UCL`. | HYBRID (RULE: keyword match against the target-area list; LLM: proof point) | pdf_export | major | 1st year: proof point optional (minor) | B | [L9][L10] |
| LI-FINANCE_BANKING-02 | **Profile is consistent with the CV**: same employers, titles, dates (±1 month), grades and university. Any contradiction fails. | HYBRID (RULE: entity/date alignment with the uploaded CV; LLM resolves title synonyms) | pdf_export (+ CV in Placed) | critical | none | D (no source; logically highest risk) | [S3] (CV is "fair game"), [S5] |
| LI-FINANCE_BANKING-03 | **No overclaimed titles.** Spring weeks, insight days and virtual simulations are labelled as such, never as "Intern/Analyst at [Bank]". LLM question: "Is every finance experience titled in a way that matches its real format and length?" Pass: `Spring Insight Programme, J.P. Morgan (1 week)`. Fail: `Investment Banking Intern, J.P. Morgan` with dates spanning 3 days, or a Forage simulation listed as employment at Goldman Sachs. | HYBRID (RULE: duration < 3 weeks + title contains Intern/Analyst flags; LLM confirms) | pdf_export | critical | none | D (mirrors CV FCQ-11, A) | [S5][S15] |
| LI-FINANCE_BANKING-04 | **CFA references follow CFA Institute wording.** Allowed: "CFA Program candidate" (only if registered), "Passed Level I of the CFA Program". Forbidden: "CFA Level I", "CFA candidate", "CFA (expected 20xx)", "Level I CFA" after the name. | RULE (regex on headline, name, About, certifications) | pdf_export | major | none | A (trademark owner's rule) | [L11] |
| LI-FINANCE_BANKING-05 | **No confidential or deal-sensitive information.** LLM question: "Does any experience entry or post name a non-public client/deal, internal figures, or offer/pay details?" Pass: `Built trading comps for a mid-cap industrials sell-side process`. Fail: `Worked on Project Falcon, the confidential £1.2bn sale of [named company] to [named buyer]`. | LLM | pdf_export, screenshot | critical | none | D | [L12] (context), [L7] |
| LI-FINANCE_BANKING-06 | **No investment-promotion or finfluencer content.** Headline, About and visible posts contain no stock tips, crypto promotion, trading "signals", affiliate links, or return claims ("made 40% this year"). LLM question: "Does the profile promote specific investments or trading returns?" Pass: `Run a paper portfolio for the society's research team; wrote 6 equity notes`. Fail: `Crypto trader | 300% returns | DM for signals`. | HYBRID (RULE: lexicon `signals|DM me|% returns|crypto|forex|NFT|affiliate`; LLM confirms) | pdf_export, screenshot | critical | none | B/C | [L7][L12] |
| LI-FINANCE_BANKING-07 | **Professional tone, no hype.** No emojis or slogans in headline/About; no "future MD", "Wolf of Wall Street", "hustle", rocket/money emojis. | RULE (emoji + lexicon detection) | pdf_export | major | none | D | — |
| LI-FINANCE_BANKING-08 | **About section is 80-200 words, first person, opens with degree + target division, and includes ≥2 concrete finance-commitment items.** LLM question: "Do the first two sentences state who the student is and which finance area they target, and does the About cite at least two specific finance activities?" Pass: `I'm a second-year Economics student at UCL targeting 2027 M&A internships. I attended Barclays' spring week and lead the UCL Investment Society's equity research team...`. Fail: `Passionate, driven individual with a keen interest in the world of finance and a strong work ethic.` | HYBRID (RULE: word count; LLM: content) | pdf_export | major | 1st year: 60-120 words, one commitment item | B | [L9][L10] |
| LI-FINANCE_BANKING-09 | **Demonstrated commitment to finance is visible** (Experience, Education activities or Certifications): spring/insight week, society committee role, competition placing, student fund, modelling course, BMC. | HYBRID (RULE: keyword bank hits in Experience/Education/Certs; LLM: depth member vs committee vs organiser) | pdf_export | major | 1st year: minor; final/master's: absence of any internship is major | B | [S9][S7][L1] |
| LI-FINANCE_BANKING-10 | **Experience entries are outcome-led and quantified, first person, 2-4 bullets each**, not duty lists. LLM question: "Does each finance or leadership entry state what the student personally did and a result with a number?" Pass: `Led a 4-person team in the society stock pitch; placed 2nd of 18 teams`. Fail: `Responsible for research. Attended meetings.` | HYBRID (RULE: digit density per entry; LLM: ownership + outcome) | pdf_export | major | 1st year: non-finance jobs count fully | A | [L10][S1][S3] |
| LI-FINANCE_BANKING-11 | **Grades stated in Education** (classification, current average, or predicted) for at least the current degree. | RULE (regex `First|2:1|2.1|Upper Second|\d{2}%|Distinction|Merit|predicted`) | pdf_export | major | 1st year: A-levels/predicted acceptable | A (2:1 norm) | [S1][S7][S8] |
| LI-FINANCE_BANKING-12 | **Top (pinned) skills are sector-relevant and evidenced.** Of the 3 exported Top Skills, ≥2 are from the sector skill list (§2.5), and each listed technical skill appears in an experience, course or certification. | HYBRID (RULE: Top Skills ∩ sector list; LLM/RULE evidence lookup) | pdf_export (top 3); screenshot (full list) | major | 1st year: ≥1 sector skill | B | [L10][S15] |
| LI-FINANCE_BANKING-13 | **Certifications are signal, not noise.** At most ~6 listed; no day-trading/crypto "expert" products; relevant ones (CFA Program, IMC, CISI, BMC, modelling courses, virtual experience programmes) appear here rather than as jobs. | HYBRID (RULE: count + blocklist; LLM classifies unknown items) | pdf_export | minor | none | D | [L11] |
| LI-FINANCE_BANKING-14 | **Conservative, professional photo present**: single person, face visible, neutral background, business or smart-casual dress. LLM question (vision): "Is this a clear, single-person headshot in professional or smart-casual dress, without party, sunglasses or holiday context?" | LLM (vision) | screenshot | major | none | A (have a professional photo); D (dress norm) | [L9][L10] |
| LI-FINANCE_BANKING-15 | **Activity is low-risk.** Recent posts/comments (last ~90 days) contain no deal chatter, office/screen photos, offer-letter pay, political rants, or investment promotion. Posting nothing passes. | LLM | screenshot, self_report | major | none | B/C | [L7][L12] |
| LI-FINANCE_BANKING-16 | **Profile is network-ready**: custom URL (no random suffix), location set to UK city, ≥50 connections including alumni/society contacts, and the user can name ≥3 finance professionals they have contacted in the last term. Scored lightly; mainly drives coaching. | HYBRID (RULE: URL pattern + location from PDF; self_report for outreach) | pdf_export, self_report | minor | 1st year: connections threshold 20 | A (networking matters) / D (thresholds) | [L1][L8][L9][L5] |
| LI-FINANCE_BANKING-17 | **No hype-score inputs.** Do not reward follower count, post frequency, creator mode, or endorsement counts in this sector. (Scorer configuration rule, not a user-facing check.) | n/a (config) | n/a | n/a | none | B/C | [L7] |

Notes for implementation:
- 05, 06 and 15 should surface as "risk" findings with stronger UI treatment than ordinary improvements.
- 02 requires the CV to be in Placed; if no CV, skip (not_applicable).
- 14 and 15 need screenshots; if missing, show "not checked" and do not penalise.

---

## 6. Scoring weights for `finance_banking` (vs generic baseline)

Assumed generic baseline dimensions (equal-ish weights). Suggested sector weights (sum 100) and direction vs baseline:

| Dimension | Baseline (assumed) | Finance & banking | Why |
|---|---|---|---|
| Identity (photo, name, URL, location) | 10 | 10 (=) | Photo matters for credibility; banner almost irrelevant |
| Headline | 15 | 15 (=) | First thing contacts see in messages/search [L9] |
| About | 15 | 10 (−) | Read by networking contacts, rarely by screeners |
| Experience | 20 | 25 (+) | Accuracy, outcomes and commitment signals carry the profile |
| Skills & certifications | 10 | 10 (=) | Modest; correctness (CFA wording) matters more than volume |
| Featured | 5 | 0-2 (−) | Not expected in banking; a stock pitch PDF can be a small plus, but public research notes are a mild compliance consideration |
| Recommendations | 5 | 3 (−) | Not expected for students |
| Activity / posting | 10 | 5 (−), scored as **risk only** | Posting is not rewarded; risky content penalised |
| CV consistency & integrity (overclaiming, confidentiality, CFA wording) | 10 | 20 (+) | Biggest real-world downside in this sector |

Critical findings (02, 03, 05, 06) should cap the overall score (e.g. max 60) until fixed, regardless of weighted total.

---

## 7. Keyword bank (terms recruiters and bankers search or expect)

**Divisions / roles:** Investment Banking, IBD, M&A, Mergers and Acquisitions, ECM, DCM, Equity Capital Markets, Debt Capital Markets, Leveraged Finance, Restructuring, Coverage, Sales & Trading, S&T, Global Markets, FICC, Equities, Rates, FX, Credit, Commodities, Structuring, Equity Research, Asset Management, Portfolio Management, Wealth Management, Private Equity, Venture Capital, Corporate Finance, Transaction Services, Summer Analyst, Off-cycle, Spring Week, Spring Insight, Insight Programme, Graduate Analyst.

**Technical skills:** Financial Modelling, Three-statement model, DCF, Discounted Cash Flow, Valuation, Trading Comparables, Precedent Transactions, LBO, Leveraged Buyout, Merger Model, Accretion/Dilution, Financial Statement Analysis, Accounting, Credit Analysis, Equity Research, Stock Pitch, Portfolio Construction, Risk Management, Derivatives, Options, Fixed Income, Bond Pricing, Econometrics, Excel, VBA, PowerPoint, Python, pandas, SQL, R, MATLAB, Bloomberg, Capital IQ, FactSet, Refinitiv/LSEG Workspace, PitchBook.

**Credentials:** CFA Program, Passed Level I of the CFA Program, IMC, Investment Management Certificate, CISI, Bloomberg Market Concepts, BMC, FMVA, Wall Street Prep, BIWS, Forage virtual experience.

**Commitment / activities:** Investment Society, Finance Society, Trading Society, Student-managed fund, Stock pitch competition, Trading competition, Case competition, SEO London, GAIN, Rare Recruitment, Bright Network, Financial Times, commercial awareness.

**Soft/behavioural (lower weight):** Attention to detail, Client service, Teamwork, Leadership, Communication, Analytical, Resilience.

Synonym handling: treat `M&A ≡ Mergers and Acquisitions`, `S&T ≡ Sales and Trading ≡ Markets`, `IBD ≡ Investment Banking`, `Spring Week ≡ Spring Insight ≡ Insight Programme`.

---

## 8. Worked example: weak 2nd-year profile → improved

**Student:** Aisha, 2nd year BSc Economics, University of Bristol (3-year course, so penultimate year). Y1 average 68%. Attended a 1-week spring insight programme at Barclays (Apr 2026). Treasurer of Bristol Investment Society. Part-time barista. Did a Forage JPMorgan IB virtual experience. Registered for CFA Level I Feb 2027.

### Before (as exported)
- **Headline:** `Student at University of Bristol | Future Banker 🚀💰`
- **About:** `Passionate and driven individual with a keen interest in finance and the markets. I love a challenge and always give 110%. Looking for opportunities!` (26 words)
- **Experience:**
  - `Investment Banking Intern, Barclays` · Apr 2026 – Apr 2026 · `Shadowed bankers. Learnt about M&A.`
  - `Investment Banking Analyst, J.P. Morgan` · Jun 2025 · (no description) ← this was the Forage simulation
  - `Barista, Costa Coffee` · 2024 – present · (no description)
- **Education:** `University of Bristol, BSc Economics, 2024 – 2027` (no grade, no modules, societies not listed)
- **Top skills:** Teamwork, Communication, Leadership
- **Certifications:** `CFA Level I` ; `LinkedIn Learning: Time Management Fundamentals`
- **Activity (screenshot):** reposted a crypto "10x coin" post; a photo from the Barclays office with a screen visible.

Findings: 03 critical (two overclaimed titles), 04 major (CFA wording; also not passed), 06 critical (crypto promotion repost), 15 major (office screen photo), 07 major (emojis/hype), 01 major, 08 major, 10 major, 11 major, 12 major, 09 partially met but hidden. Score capped at 60 by criticals; weighted estimate ~35/100.

### After
- **Headline:** `Economics BSc, University of Bristol (Y1: 68%) | Targeting 2027 IBD & M&A Summer Internships | Spring Insight @ Barclays '26 | Treasurer, Bristol Investment Society`
- **About (≈140 words):**
  `I'm a second-year Economics student at the University of Bristol, applying for 2027 summer internships in investment banking, with a focus on M&A.`
  `In April 2026 I attended Barclays' Spring Insight Programme, where my team pitched a mid-cap acquisition idea to a panel of bankers. As Treasurer of the Bristol Investment Society, I manage a £12k budget and organised a valuation workshop with 85 attendees. I have also completed J.P. Morgan's Investment Banking virtual experience on Forage and I am registered for the CFA Level I exam in February 2027.`
  `Relevant modules: Corporate Finance, Financial Accounting, Econometrics. Skills: Excel (three-statement models, DCF), PowerPoint, Bloomberg Market Concepts.`
  `Outside finance I've worked 12 hours a week as a barista since 2024 and run for the university cross-country team.`
- **Experience:**
  - `Spring Insight Programme, Barclays (Investment Bank)` · Apr 2026 (1 week) · `Rotated through M&A, DCM and Markets; worked in a team of 5 to pitch an acquisition target, chosen as one of 2 finalist teams out of 12.`
  - `Treasurer, Bristol Investment Society` · Jun 2025 – present · `Manage a £12k annual budget and sponsor reporting; organised a DCF workshop with 85 attendees; grew sponsorship income by 30% (£2.4k) through 3 new firm partners.`
  - `Barista (part-time), Costa Coffee` · 2024 – present · `Trained 4 new starters; handle 200+ orders per shift at peak.`
- **Education:** `University of Bristol, BSc Economics, 2024–2027. Year 1 average: 68% (2:1). Modules: Corporate Finance, Financial Accounting, Econometrics. Activities: Bristol Investment Society (Treasurer), Cross-country.`
- **Top skills (pinned):** Financial Modelling, Valuation, Microsoft Excel. Others: PowerPoint, Financial Statement Analysis, Bloomberg, Python (basic).
- **Licences & certifications:** `CFA Program candidate (Level I, Feb 2027 exam)` ; `Bloomberg Market Concepts, Bloomberg, 2026` ; `Investment Banking Job Simulation, J.P. Morgan via Forage, 2025`.
- **Activity:** crypto repost and office photo deleted; one post thanking the Barclays spring insight team (no internal details).
- **Photo:** headshot in blazer, plain background. **URL:** linkedin.com/in/aisha-khan-bristol. **Connections:** 140, including 12 Bristol alumni in banking contacted for coffee chats this term.

Result: all criticals cleared; remaining minors (no recommendation, banner default). Weighted estimate ~82/100.

---

## 9. Evidence gaps and honest caveats

1. **No bank says how (or whether) it reviews student LinkedIn profiles.** The "LinkedIn is for networking, not screening" conclusion rests on what employer pages say (events, talent networks, LinkedIn for news) and on omission. That is decent evidence of what banks emphasise, not proof of what individual reviewers do.
2. **No retrievable bank social media policy text for interns.** The posting-risk position rests on eFC's March 2026 report [L7] and the FCA's social media guidance [L12], which is about financial promotions, not employee personal posts in general.
3. **Save-to-PDF section coverage is not documented by LinkedIn** [L13]. Verify with a fresh export before relying on which fields exist.
4. **Character limits** (220 headline / 2,600 About) come from third-party trackers [L17]; UK careers pages still quote 120 for the headline [L9][L10].
5. **Goldman Sachs networking tips [L6] and eFC spring-week advice [L16]** were seen only in search excerpts (the GS page returned 403/404 on fetch). No verbatim quotes are used from them.
6. **The "21x views with a photo" stat** has no primary source I could trace [L18].
7. TARGETjobs and LSE quotes were retrieved through a summarising fetch tool; before showing any quote in the product UI, re-check wording against the live page.
8. Much US content (Wall Street Oasis, Mergers & Inquisitions, Vault) recommends heavy LinkedIn networking in "recruiting season"; UK timelines differ (spring weeks in year 1, applications Sept-Oct). I excluded US-only advice except where UK sources agreed.
9. Dress code, emoji, Open-to-Work and connection-count thresholds are my synthesis (D) and should be tunable.

---

## 10. Sources

Accessed 2026-10-14 unless stated.

| Tag | Title | Publisher | Year | URL | Grade | Fetched? |
|---|---|---|---|---|---|---|
| L1 | Banking & Financial Markets: Short Guide to Recruitment 2025-2026 (PDF; "Stay Informed: Follow firms on social media and LinkedIn to keep up with recruitment timelines, news, and events.") | University of Cambridge Careers Service | 2025 (updated Jul 2025) | https://www.careers.cam.ac.uk/sites/default/files/Banking%20and%20Financial%20Markets%20Short%20Guide%20to%20Recruitment%202025%20-%202026.pdf | A | Yes (PDF text) |
| L2 | Prepare (Students) ("Follow us on LinkedIn for the latest open roles and news.") | Goldman Sachs | live 2026 | https://www.goldmansachs.com/careers/students/prepare | A | Yes |
| L3 | How we hire | JPMorganChase | live 2026 | https://www.jpmorganchase.com/careers/how-we-hire | A | Yes |
| L4 | Hints and tips | Barclays | undated, live 2026 | https://search.jobs.barclays/hints-and-tips | A | Yes (no LinkedIn mention) |
| L5 | Networking Like a Pro ("Ensure your LinkedIn profile is always up-to-date and engage with people on the site at least once a week if not more.") | Morgan Stanley | 2021 (27 Sep) | https://www.morganstanley.com/articles/professional-networking-tips | A (employer), audience experienced hires | Yes |
| L6 | Connecting with Black Undergrads and High School Students During Summer Event (Megan Hogan networking tips) | Goldman Sachs Careers Blog | undated | https://www.goldmansachs.com/careers/blog/posts/black-economic-alliance-event.html | B | No (search excerpt only) |
| L7 | As banking clamps down on influencers, consulting pays its interns to post on LinkedIn (Alex McMurray) | eFinancialCareers | 2026 (5 Mar) | https://www.efinancialcareers.com/news/bankers-influencers-consulting | C | Yes |
| L8 | Careers in banking and finance ("Use LinkedIn's Alumni tool to find out what Newcastle graduates are doing now.") | Newcastle University Careers Service | undated, live 2026 | https://www.ncl.ac.uk/careers/explore-your-options/occupations/banking-finance/ | A | Yes |
| L9 | LinkedIn ("Add a personalised note to your request to connect: this will greatly increase your chances of acceptance.") | LSE Careers | undated, live 2026 | https://info.lse.ac.uk/current-students/careers/information-and-resources/looking-for-work/linkedIn | A | Yes |
| L10 | The graduate's guide to creating the perfect LinkedIn profile | TARGETjobs | 2026 (updated Aug) | https://targetjobs.co.uk/careers-advice/finding-a-job/graduates-guide-creating-perfect-linkedin-profile | B | Yes |
| L11 | How to Share Your Achievements (CFA marks guidance) ("You should not imply you have earned any portion of the CFA charter or that you will earn it by a future date.") | CFA Institute | 2026 | https://www.cfainstitute.org/en/about/governance/policies/trademark-usage-guide-for-cfa-charterholders | A | Yes |
| L12 | FG24/1: Finalised guidance on financial promotions on social media | Financial Conduct Authority | 2024 (26 Mar) | https://www.fca.org.uk/publications/finalised-guidance/fg24-1-finalised-guidance-financial-promotions-social-media | A (regulator; context only) | Yes |
| L13 | Save a profile as a PDF | LinkedIn Help | live 2026 | https://www.linkedin.com/help/linkedin/answer/a541960 | A (product fact) | Yes |
| L14 | Students and Graduates (Insight Week Programmes include networking) | Rothschild & Co | live 2026 | https://www.rothschildandco.com/en/careers/students-and-graduates/ | A | Yes |
| L15 | First Year Advice for Securing an Internship | University of Warwick, Dept of Economics | undated, live 2026 | https://warwick.ac.uk/fac/soc/economics/current/careers/first-year-advice | B | Yes |
| L16 | Spring weeks at banks (articles) | eFinancialCareers | various | https://www.efinancialcareers.co.uk/news/spring-week-bank | C | No (search excerpt only) |
| L17 | LinkedIn character limits in 2026 (third-party references) | Unilink / Eden (trade blogs) | 2026 | https://www.unilink.us/blog/linkedin-character-limits-2026 | C | No (search excerpt only) |
| L18 | LinkedIn profiles with a photo get 21x more views (repost of the claim; no primary source traced) | Towson University (TU Today) | 2019 | https://tutoday.towson.edu/2019/02/11/linkedin-profiles-with-a-photo-get-21x-more-views-update-yours | Myth/unverified | No (search excerpt only) |

CV-doc sources reused: [S1] Cambridge banking guide, [S3] Goldman Sachs resume transcript, [S4] GS Prepare, [S5] Barclays hints and tips, [S6] JPMC how we hire, [S7] eFC Inside Knowledge 2025/26, [S8] eFC banking CV 2026, [S9] Bright Network IB CV, [S15] IMC CV advice. See `docs/research/cv-rules-finance-consulting.md` §9.
