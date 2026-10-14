# LinkedIn Profile Rules: Consulting (archetype `consulting`)

Scope: UK undergraduates and taught masters targeting strategy/management consulting (McKinsey, BCG, Bain, Oliver Wyman, Kearney, L.E.K.), Big 4 advisory/consulting (PwC, Deloitte, EY, KPMG) and boutiques, for insight days, internships (Bain ACI, BCG summer), and graduate schemes in the 2026-27 cycle.
Compiled: 2026-10-14. Status: research input for the Placed LinkedIn scorer. Not recruiting advice.
Conventions: same as `docs/research/cv-rules-finance-consulting.md` section 0 (check types RULE / LLM / HYBRID; severity critical / major / minor; evidence A-D). Citation tags [Lx] refer to section 10. Every source was accessed 2026-10-14.

---

## 0. Honest caveats up front

1. **No consulting firm I could check says it uses LinkedIn profiles to screen students.** BCG UK [L1], Bain London [L2], L.E.K. [L3] and Oliver Wyman [L4] careers pages describe an online application plus tests and case interviews. They list campus events, not LinkedIn. TARGETjobs' guide to applying to McKinsey covers CV, cover letter, the Solve game and interviews, with nothing on LinkedIn [L5]. Absence of evidence is not proof: these pages simply do not cover it.
2. **So for consulting, LinkedIn is mainly a networking and research tool, not a screening document.** This matches the UK careers services I could fetch (LSE [L6], Cambridge [L7], Manchester [L8]). The scorer should say this plainly in the UI, and weight "network-readiness" and "consistency with the CV" over "being found by recruiters".
3. **Search was constrained.** The web-search budget for this session ran out partway through, and firecrawl returned 402. I fetched known URLs directly instead. I could **not** retrieve: McKinsey's students page (timeout), Kearney careers, Oliver Wyman's UK student page (404), PwC early-careers tips (403), Bright Network consulting guides (403), Deloitte/EY/KPMG student pages. Claims about those firms are unverified.
4. **Popular statistics are weak.**
   - "Profiles with a photo get 21x more views and 9x more connection requests" is LinkedIn's own marketing claim (LinkedIn Business "Picture Perfect" article, as cited by secondary sites). I did not fetch the original and no methodology is published. Aberdeen's careers page quotes a *different* figure, "14 times more likely" [L9]. Treat any multiplier as **unverified vendor data**; never show it as a fact in the UI.
   - "Applicants with a comprehensive LinkedIn profile are 71% more likely to get a callback" is attributed to a ResumeGo study. The study URL returned 404, so I could not check sample, country or method. **Unverified; do not use.**
   - Aberdeen's "Engaging on 4 posts per day can increase your profile views by 200%-2000%!" [L9] has no source on the page. **Unverified; do not use.**
5. **What a "Save to PDF" export contains.** LinkedIn says the feature saves a profile "as a resume in a PDF from the introduction section", English-language profiles only, desktop only [L10]. From my own knowledge of the export layout (grade D, **verify against a real export before shipping**): it contains contact/URL, Top Skills (3), Languages, Certifications, Honors-Awards, Summary (About), Experience (with descriptions), Education. It does **not** contain the photo, banner, Featured, recommendations, activity/posts, endorsement counts or follower numbers. Rules that need those are tagged `screenshot` or `self_report`.
6. Practitioner sources (PrepLounge, Management Consulted) are **C** at best and often US-centric (US campus recruiting depends much more on networking than UK MBB online applications do).

---

## 1. How much LinkedIn matters for consulting

**Verdict: medium.** Low as a screening input, high as a networking and research channel, moderate as "the page a consultant sees after you message them".

| Function | Importance | Evidence | Notes |
|---|---|---|---|
| **Sourcing** (recruiters find you via LinkedIn search) | Low for students at MBB/tier-2; low-to-medium at Big 4 and boutiques | D | All MBB/tier-2 pages I fetched route students through online applications with fixed deadlines (BCG UK graduate roles open 9 Sep, close 18 Oct 2026; internships open 1 Jan, close 24 Jan 2027 [L1]; Bain London full-time deadline 15 Oct, ACI applications from Nov 2026 [L2]). Inbound recruiter sourcing of undergraduates is not described anywhere I could verify. |
| **Screening** (profile read during selection) | Low, and unverified | D | No firm states it reviews LinkedIn. Consultants you network with will likely look at your profile before replying or referring, but I found no source that quantifies this. |
| **Networking** (alumni, consultants, referrals, events) | **High** | B | 87% of students interested in consulting employers use LinkedIn for careers purposes, among the highest of any sector (Cibyl Graduate Research UK 2022, n = 65,432, reported by TARGETjobs [L11]). LSE calls LinkedIn "an incredible source of potential contacts" for reaching alumni [L6]. Cambridge recommends filtering the alumni group by employer and job area [L7]. Practitioner sources say referrals help at MBB (C) [L12]. |
| **Research** (firm knowledge for applications) | Medium | B | Consulting recruiters say many applications fail because applicants "do not show sufficient knowledge of the firm" [L11]. Following firms, reading consultants' posts and talking to alumni feed directly into this. |

**Which firms say what**

| Firm | What their own page says (relevant to LinkedIn) | Source |
|---|---|---|
| BCG UK | 2:1 minimum; wants "Excellence in areas outside of academics"; Sep-Oct campus events, CV workshops with consultants, insight days for under-represented groups. No LinkedIn mention. | [L1] |
| Bain London | Wants "curiosity, drive, and potential" and a "record of initiative, leadership, and teamwork"; on-campus and virtual events; contact via UniversityHiring.London email. No LinkedIn mention. | [L2] |
| McKinsey (via TARGETjobs) | Looks for "evidence of impact, leadership, entrepreneurship, problem solving and an overall orientation towards achievement". No LinkedIn mention. | [L5] |
| L.E.K. | "exceptionally smart and aspirational yet decidedly humble and down-to-earth". No LinkedIn mention for students. | [L3] |
| Oliver Wyman | Links its LinkedIn company page in the footer; values people who "challenge the norm". No student LinkedIn guidance. | [L4] |
| Kearney, PwC, Deloitte, EY, KPMG | Not retrieved (see caveat 3). | — |

**Implication for Placed:** the consulting score should answer "If a consultant you messaged opens this profile, does it make them want to reply and refer you?" rather than "Will a recruiter find you?"

---

## 2. What a strong consulting student profile looks like, section by section

### 2.1 Headline (220 characters)

Formula (grade B for the components, D for the ordering): **[Degree] at [University] | [Direction: strategy / management consulting] | [1-2 proof points: role + result]**.
TARGETjobs: "Explain your current role or where and what you study, interests, and what you're hoping to find." [L13]. Aberdeen: make it "more than just your course title" [L9].

Good:
1. `Economics BSc, UCL | Strategy & management consulting | VP, UCL Consulting Society | Winner, 2026 [Firm] Case Challenge`
2. `History MA (Hons), Edinburgh | Interested in public-sector & strategy consulting | Led 5-person pro-bono project for a Leith charity (180 Degrees Consulting)`
3. `MSc Business Analytics, Imperial | Consulting & data | SQL, Excel, Power BI | Ex-intern, Deloitte Consulting (Technology)`

Bad:
1. `Student at University of Manchester` (no direction, no proof).
2. `Aspiring McKinsey Consultant | Future Leader | Passionate Problem Solver` (single-firm target, clichés, no evidence).
3. `MECE thinker | Hypothesis-driven | Synergy-focused strategist | 80/20` (jargon string; reads as performative, and a 2nd-year cannot back it up).

Do not name one target firm in the headline. You will apply to several firms, and a consultant at BCG reading "Future McKinsey analyst" is unlikely to refer you (D). PrepLounge advises a headline that "showcases your interest in the consulting industry and target firms" [L12]. Interest in the industry is fine; naming one firm is the risk. Treat this as contested.

### 2.2 About (up to 2,600 characters)

- Length: about 600-1,200 characters (3 short paragraphs). Longer is fine but rarely read (D).
- Structure, answer first, which is how consultants communicate (grade D synthesis; McKinsey's "problem solving" and "impact" [L5], TARGETjobs' communication skill [L14]):
  1. Who you are + what you are aiming for (1-2 sentences).
  2. 2-3 evidence points with numbers (leadership, a problem you solved, a case competition result).
  3. What you want to talk about / are looking for (e.g. "happy to chat with anyone who moved from history into consulting").
- First person, authentic [L9]. TARGETjobs: introduce yourself "as at a networking event" [L13].
- No jargon or buzzword strings (mirrors CV rule CON-09 and FCQ-12 in the CV doc).

### 2.3 Experience bullets: how they differ from CV bullets

| | CV bullet | LinkedIn bullet |
|---|---|---|
| Length | 1-2 lines, strict one-page budget | Can be 2-4 short lines per role, or one short paragraph + 2-3 bullets |
| Voice | Implied first person, no pronoun | First person OK ("I led...") |
| Content | Every bullet is an outcome | One context line (what the organisation/project is) + outcome lines |
| Confidentiality | Client named only if public | Same, and stricter: a public page is searchable (see LI-CONSULTING-14) |

What stays the same: personal contribution ("use 'I' rather than 'we'" [L13]), a quantified outcome, and "why your work mattered" [L5]. Every role on LinkedIn must match the CV's dates and title (LI-CONSULTING-11).

Include part-time jobs, volunteering and society roles as Experience; TARGETjobs says to include them [L13]. In consulting, a commercially framed retail or tutoring role counts (see FIN-05 / CON rules in the CV doc).

### 2.4 Featured (screenshot / self_report only)

Optional. Good: a case competition deck or certificate, a society event write-up, a published article or dissertation summary (no confidential data). Bad: a generic "My CV" PDF (duplicates the profile and exposes your phone number), certificates for 30-minute courses. Grade D. Not visible in a PDF export.

### 2.5 Skills: top 10 for consulting

TARGETjobs: pick "between five and ten key skills" worth highlighting [L13]. The PDF export shows only the top 3, so **pin the top 3** (D).

| # | Skill | Tier | Basis |
|---|---|---|---|
| 1 | Problem solving | Table stakes | [L5][L14] |
| 2 | Data analysis / analytical skills | Table stakes | [L1][L14] |
| 3 | Microsoft Excel | Table stakes | CV doc CON-11 (Bright Network) |
| 4 | Microsoft PowerPoint / presentation skills | Table stakes | [L14] (communication); D |
| 5 | Communication / stakeholder management | Table stakes | [L14] |
| 6 | Market research / market sizing | Differentiator for 1st-2nd years | D |
| 7 | Financial modelling | Differentiator (strategy, L.E.K./PE-facing commercial due diligence) | D |
| 8 | SQL / Python / Power BI / Tableau | Differentiator; strong for Big 4 technology and data consulting | CV doc CON-11; D |
| 9 | Project management | Differentiator if evidenced by a society/project role | Prospects [L15] |
| 10 | Languages (with level) | Differentiator for international offices | D |

Rule: every listed skill should be evidenced somewhere in Experience, Projects or Education (mirrors FCQ-11 "don't claim what you can't defend").

### 2.6 Certifications: worth listing vs noise

- **Worth listing (minor bonus):** firm-run virtual experiences or case programmes *with what you produced* (e.g. a Forage/firm job simulation, only if you describe the task); Excel/financial modelling courses with an assessed component; Microsoft Office Specialist (Excel Expert); data certificates if targeting tech/data consulting (e.g. Microsoft Power BI Data Analyst); language certificates (CEFR level). Grade D.
- **Noise:** long lists of LinkedIn Learning completions; "Introduction to consulting" webinars; certificates without assessment. Grade D.
- **Not applicable to students:** Chartered Management Consultant (ChMC) typically needs "at least four years' relevant experience" [L15]. CMI Level 5/7 consulting qualifications exist [L15] but are not expected of students; listing one is neutral.
- Membership worth listing: Young MCA (the Management Consultancies Association's young professionals network) [L15], if you actually attend.

### 2.7 Education

- Degree, university, dates, **classification or current average if 2:1 or above** (BCG UK states "at least a 2:1" [L1]; Bain asks for full grades on its form, see CV doc S23). The application form collects grades anyway, so on LinkedIn this is minor, but it must match the CV exactly.
- If the average is below 2:1, leaving it off LinkedIn is acceptable (D). Never round up.
- 2-4 relevant modules (statistics, econometrics, strategy, operations) and a dissertation title if analytical. Aberdeen recommends "relevant modules, projects" [L9].
- A-levels: optional on LinkedIn (space is not constrained, but it clutters). 1st years may include them.

### 2.8 Activities and societies

The core of a consulting student profile. 27% of final-year students interested in consulting held a society leadership position (Cibyl 2022 via TARGETjobs [L11]). Add as Experience entries (not only in Education's "Activities" field) so they get a description and appear in the PDF Experience section:
- Consulting society role (committee > member), with scope (members, events, budget).
- Pro-bono consulting (e.g. 180 Degrees Consulting, university consulting groups): client type, question, recommendation, outcome.
- Case competitions: firm, stage reached, rank. Use Honors & Awards for wins (in PDF export).
- Firm insight days / spring weeks (BCG insight days are listed on its UK page [L1]): list as short Experience entries only if the programme was selective, and say what you did.

### 2.9 Recommendations (screenshot / self_report)

Aberdeen: "Ask people who have worked with or taught you to write a recommendation" [L9]. TARGETjobs: "Recruiters notice this section" [L13]. For consulting, 1-2 recommendations from a society president, project lead or internship manager that mention a concrete outcome are a nice-to-have. Absence is not penalised for 1st years. Grade B for "useful", D for the consulting weighting.

### 2.10 Activity and posting norms

**Neutral; optional.** No source says consulting recruiters expect students to post (D). Reasonable: 1-4 posts a year (case competition result, insight-day learnings without confidential content, a society event). Risky:
- Sharing case-interview content or "my McKinsey case questions" (firms ask candidates not to share assessment material; I could not fetch a specific policy, grade D).
- Complaining about rejections or naming interviewers.
- High-volume "thought leadership" a 2nd-year cannot support; AI-generic posts (FCQ-12 in CV doc).
- Engagement on target-firm posts is fine and helps firm knowledge [L11].

### 2.11 Photo and banner (screenshot)

- Photo: TARGETjobs wants "Professional-looking, approachable, relaxed and friendly"; avoid party photos [L13]. Head and shoulders, business-casual. Grade B.
- Banner: TARGETjobs suggests an image reflecting interests or ambitions [L13]. Default banner is fine; a city skyline or university banner is fine. Avoid firm logos (implies affiliation you do not have). Grade D.
- **Open to Work:** LinkedIn offers "Recruiters only" (no frame) or all members (adds the #OpenToWork frame), and states it "can't guarantee complete privacy" [L16]. For consulting students, the public frame is neutral-to-slightly-negative and adds little because firms recruit through fixed application windows (D). Recruiters-only is fine.

---

## 3. Sector-specific red flags and myths

**Red flags (consulting-specific)**
1. Wrong-firm signals: "Future McKinsey analyst" when networking with BCG; firm logos in the banner.
2. Confidential client details from an internship or pro-bono project posted publicly (client name, figures not public).
3. Jargon strings with no evidence ("MECE", "hypothesis-driven", "synergy", "value creation") in a 1st or 2nd-year headline/About.
4. Grade or date mismatch with the CV. Consulting values attention to detail ("Spotting errors in client documents" is a listed skill [L14]); a mismatch looks like carelessness or inflation.
5. "We"-only descriptions; responsibilities with no result.
6. A public profile that conflicts with the professional image. Cambridge: "Ensure you represent yourself positively in the public domain" [L7].
7. Many skills, no evidence; 50 endorsements from friends on "Strategy".

**Myths**
| Myth | Reality | Evidence |
|---|---|---|
| "MBB recruiters headhunt students on LinkedIn." | No firm page I checked describes this; students apply through online forms with deadlines. | D (based on [L1][L2][L3][L4][L5]) |
| "You need a referral from LinkedIn networking to get an MBB interview." | McKinsey, BCG and Bain UK pages describe open applications. Referrals may help (practitioner view), but are not required. | C [L12]; D |
| "Photos give 21x more views." | LinkedIn marketing claim, no methodology; Aberdeen cites 14x. Use "a photo helps people recognise you" instead. | unverified |
| "71% more callbacks with a complete LinkedIn." | Could not verify the study. | unverified |
| "Post daily to get noticed by consulting firms." | No evidence; posting is neutral in consulting. | D |
| "Send connection requests without a note; research shows notes reduce acceptance." | PrepLounge claims this with no linked study [L12]. For alumni outreach, a short personalised note is what UK careers services describe [L7]. | C vs B; keep a short note |
| "Organisations screen out applicants who don't follow their company page." | Manchester says some organisations that recruit on LinkedIn "sometimes screen out applicants who aren't following their company" [L8]. No consulting firm confirms it. Following is free, so recommend it anyway. | B (one source, not sector-specific) |

---

## 4. Differences by year

| | 1st year (3-yr course) | Penultimate (2nd of 3, 3rd of 4) | Final year / masters |
|---|---|---|---|
| Main goal | Insight days (BCG insight days [L1], Big 4 insight programmes), societies, first connections | Internships: Bain ACI (applications from Nov 2026 [L2]), BCG summer (1-24 Jan 2027 [L1]), Big 4 summer schemes | Grad schemes (BCG 18 Oct 2026, Bain 15 Oct 2026, both days from today); then off-cycle or next cycle |
| Headline | Degree + uni + direction; proof point optional | Must have at least one proof point (society role, case comp, internship) | Must have internship or strongest proof point; masters: name the masters first |
| Consulting evidence (LI-CONSULTING-06) | minor | **major** | major |
| Recommendations | skip | minor | minor |
| Education detail | A-levels OK; 1st-year marks if available | Year 1 average if 2:1+ | Classification/average; masters: undergrad degree + masters modules |
| Networking (LI-CONSULTING-17) | Build alumni connections; follow firms | Active outreach to alumni at 3-5 target firms before applications | Outreach to recent joiners for interview prep |
| Open to Work | off | recruiters-only optional | recruiters-only optional |

---

## 5. Rule set: LI-CONSULTING-xx

These override or add to the generic LinkedIn baseline (identity, headline, About, experience, skills, Featured, recommendations, activity, CV consistency). "Year adjust" uses Y1 / PEN (penultimate) / FIN (final or masters).

| ID | Rule | Check | Input | Severity | Year adjust | Evidence | Citations |
|---|---|---|---|---|---|---|---|
| LI-CONSULTING-01 | **Headline shows degree + university, a consulting/strategy direction, and at least one concrete proof point.** LLM question: "Does the headline state what and where the student studies, signal an interest in consulting or strategy, and give at least one specific achievement or role?" Pass: `Economics BSc, UCL \| Strategy consulting \| VP, UCL Consulting Society`. Fail: `Student at UCL`. | HYBRID (RULE: degree/uni tokens; LLM: direction + proof point) | pdf_export | major | Y1: proof point optional (minor) | B | [L13][L9]; D for proof point |
| LI-CONSULTING-02 | **Headline/About does not name a single target firm as an aspiration and does not use firm logos.** LLM question: "Does the headline or About present the student as aspiring to one named consulting firm (e.g. 'Future McKinsey Analyst')?" (yes = fail). Pass: `Interested in strategy consulting`. Fail: `Aspiring BCG Consultant`. | HYBRID (RULE: firm-name lexicon near aspiring/future/incoming; LLM confirms) | pdf_export (logo: screenshot) | minor | "Incoming [Firm] Analyst" with a real accepted offer passes | D (contested by C [L12]) | [L12] |
| LI-CONSULTING-03 | **About is answer-first and evidenced: opening sentence states who you are and what you are aiming for; at least two specific, quantified evidence points follow.** LLM question: "Does the first sentence state the student's goal, and does the About contain at least two specific achievements with a number or named outcome?" Pass: "Second-year economist aiming for strategy consulting. I led a 5-person 180DC team that cut a charity's donor churn analysis time from 2 weeks to 2 days..." Fail: "I am a passionate, driven individual who loves solving problems and working in teams." | LLM | pdf_export | major | Y1: one evidence point suffices | B / D | [L13][L9][L5]; D for answer-first |
| LI-CONSULTING-04 | **About length 400-1,600 characters** (not empty, not an essay). | RULE | pdf_export | minor | — | D | — |
| LI-CONSULTING-05 | **Each Experience entry has at least one outcome line with personal contribution ("I") and a number or named result.** LLM question: "Does this entry say what the student personally did and what changed as a result?" Pass: "I rebuilt the society's sponsor tracker in Excel; sponsorship income rose from £2k to £6.5k." Fail: "Responsible for sponsorship. We worked with many firms." | HYBRID (RULE: digit/£/% presence, we/I ratio; LLM outcome check) | pdf_export | major | Y1: part-time jobs may have activity-only lines (minor) | A | [L13][L5]; CV doc FCQ-08 |
| LI-CONSULTING-06 | **Consulting-relevant evidence is present and specific:** at least one of consulting society role, pro-bono consulting project, case competition, firm insight day/spring week, consulting internship, with a role, deliverable or rank. LLM question: "Is there at least one consulting-relevant activity that states what the student did or achieved, not just membership?" Pass: "Case competition, [Firm] 2026: semi-finalist of 120 teams; built market-sizing model." Fail: "Member, Consulting Society." | HYBRID (RULE: keyword bank §7; LLM: specificity) | pdf_export | major | Y1: minor; PEN/FIN: major | B | [L11][L1]; CV doc CON-07 |
| LI-CONSULTING-07 | **Leadership with scope**: at least one position of responsibility showing team size, budget, members or change achieved. LLM question: "Does the profile show the student leading people or a project with stated scope and result?" Pass: "Treasurer, Netball Club: managed £14k budget; cut kit costs 18%." Fail: "Committee member." | HYBRID (RULE: leadership lexicon; LLM: scope) | pdf_export | major | Y1: school leadership counts | A | [L2][L5][L11] |
| LI-CONSULTING-08 | **At least one problem-solving arc** (problem, analysis, recommendation, result) somewhere in Experience, Projects or About. LLM question: "Does any entry describe a problem, how the student analysed it, what they recommended or did, and the result?" Pass: "Diagnosed falling footfall at a student café from 400 survey responses; recommended a loyalty card; adopted, +15% repeat visits." Fail: "Worked on a project about café sales." | LLM | pdf_export | major | Y1: minor | A | [L5][L1][L14]; CV doc CON-03 |
| LI-CONSULTING-09 | **Skills section has 5-10 skills, including at least 3 consulting table-stakes skills (problem solving, data analysis, Excel, PowerPoint/presentation, communication), with the top 3 relevant.** | RULE (count; keyword match on Top Skills and Skills) | pdf_export (Top Skills: 3 only; full list: screenshot) | minor | — | B | [L13]; D for top-3 |
| LI-CONSULTING-10 | **Listed skills are evidenced** in Experience, Projects, Education or Certifications. LLM question: "For each of the top skills, is there an entry showing it being used?" Pass: "Financial modelling" + case competition model. Fail: "Financial modelling" with no supporting entry. | HYBRID | pdf_export | minor | — | A (via CV rule) | CV doc FCQ-11 |
| LI-CONSULTING-11 | **Profile matches the CV**: same job titles, employers, dates (to the month), degree, grade. | RULE (field diff against the uploaded CV) | pdf_export + CV | **critical** (override of baseline) | — | B / D | [L14] (attention to detail); D |
| LI-CONSULTING-12 | **Zero typos and consistent formatting** (date formats, capitalisation of titles, UK spelling). | RULE (spell-check) + LLM grammar | pdf_export | **critical** (override) | Y1: major | A | [L14]; CV doc FCQ-05 |
| LI-CONSULTING-13 | **Plain English, no buzzword strings.** LLM question: "Does the headline or About rely on consulting jargon or clichés (e.g. MECE, synergy, passionate, results-driven) without evidence?" (yes = fail). Pass: "I enjoy breaking messy problems into parts..." with an example. Fail: "Hypothesis-driven MECE thinker leveraging synergies." | HYBRID (RULE: cliché/jargon list; LLM confirms) | pdf_export | major | — | B | CV doc CON-09 (TARGETjobs on jargon); FCQ-12 |
| LI-CONSULTING-14 | **No confidential client information**: no non-public client names, figures or project details from internships, pro-bono work or case interviews. LLM question: "Does the profile disclose a client name or figures that appear non-public, or describe case-interview content?" (yes = fail). Pass: "Pro-bono project for a London housing charity: built a volunteer-retention model." Fail: "Internship: helped [named client plc] plan 300 redundancies in Q3." | LLM | pdf_export | **critical** | — | D | — (no firm policy retrieved) |
| LI-CONSULTING-15 | **Education shows classification or current average when 2:1 or above, plus 2-4 relevant modules**; never inflated. | HYBRID (RULE: grade regex; LLM: modules relevant) | pdf_export | minor (grade is collected by forms) | Y1: A-levels or predicted grade acceptable | A (2:1 bar) / D (LinkedIn placement) | [L1]; [L9] |
| LI-CONSULTING-16 | **Professional photo; Open to Work either off or recruiters-only.** LLM question (screenshot): "Is there a clear, head-and-shoulders, professional photo, and is the public #OpenToWork frame absent?" Pass: business-casual headshot, no frame. Fail: no photo, or a night-out crop. | LLM (vision) | screenshot | minor | — | B (photo) / D (frame) | [L13][L16] |
| LI-CONSULTING-17 | **Network-ready**: custom profile URL, location set (UK city), follows target firms, has alumni connections at 2 or more target firms. Ask: "Do you follow the firms you are applying to, and are you connected to at least one alum at each?" | HYBRID (RULE: custom URL and location from PDF contact block; rest self_report) | pdf_export + self_report | minor | Y1: minor; PEN: major (outreach before Nov-Jan windows) | B | [L6][L7][L8] |
| LI-CONSULTING-18 | **Posting, if any, is low-risk**: no case-interview content, no complaints about firms or recruiters, no AI-generic posts. Absence of posting is **not** penalised. | LLM | screenshot / self_report | minor | — | D | [L7]; CV doc FCQ-12 |

---

## 6. Scoring weights (suggested)

Assumed generic baseline (if the baseline file differs, apply the deltas):

| Dimension | Baseline (assumed) | Consulting | Delta | Why |
|---|---|---|---|---|
| Identity (photo, URL, location, name) | 10 | 8 | −2 | Not used for screening; still needed for networking |
| Headline | 15 | 15 | 0 | First thing a messaged consultant reads |
| About | 10 | 12 | +2 | Communication and answer-first structure are core consulting skills [L14] |
| Experience (incl. societies, case comps) | 25 | 30 | +5 | Impact, leadership, problem-solving are what firms state they want [L1][L2][L5] |
| Skills | 10 | 7 | −3 | Generalist sector; skills are checked by tests and cases, not keywords |
| Featured | 5 | 3 | −2 | Not in PDF; low value |
| Recommendations | 5 | 3 | −2 | Nice-to-have only |
| Activity / posting | 5 | 2 | −3 | Neutral in consulting; only risk-checked |
| CV consistency + accuracy | 15 | 20 | +5 | Attention to detail; mismatches read as carelessness or inflation |
| **Total** | 100 | 100 | | All weights grade D |

---

## 7. Keyword bank (consulting)

Use for RULE pre-filters and for "what recruiters and consultants search for". Group synonyms.

- **Consulting activity:** consulting society, consulting club, case competition, case challenge, case study competition, pro bono consulting, 180 Degrees Consulting, 180DC, student consultancy, client project, insight day, insight programme, spring week, virtual experience, job simulation, Young MCA.
- **Problem solving and analysis:** problem solving, structured problem solving, hypothesis, root cause, market sizing, market research, competitor analysis, commercial due diligence, benchmarking, survey design, data analysis, quantitative analysis, qualitative analysis, synthesis, recommendation.
- **Business and finance:** commercial awareness, business strategy, operations, cost reduction, pricing, go-to-market, financial modelling, valuation, P&L, business case.
- **Tools:** Excel (pivot tables, VLOOKUP/XLOOKUP, Power Query), PowerPoint, Power BI, Tableau, SQL, Python, R, Alteryx (Big 4), Visio (D for Big 4 tooling).
- **Big 4 / technology consulting:** digital transformation, change management, process improvement, ERP, SAP, data and analytics, cyber, risk, ESG / sustainability (D).
- **People:** leadership, team leadership, stakeholder management, client-facing, presentation, communication, project management, mentoring, negotiation.
- **Leadership verbs (scope signals):** led, founded, launched, managed (£ / people), organised, recruited, trained, negotiated, recommended, presented to.
- **Jargon to flag if unevidenced (LI-CONSULTING-13):** MECE, 80/20, synergy, value creation, thought leader, results-driven, passionate, guru, ninja, visionary.

---

## 8. Worked example: weak 2nd-year profile to improved version

Student: 2nd-year BA History, University of Bristol (3-year course, so penultimate). Targets: Bain ACI, BCG summer, Big 4 consulting summer schemes.

### 8.1 Before

**Headline:** `History student at University of Bristol | Aspiring McKinsey Consultant | Passionate about strategy`

**About:** "I am a highly motivated and passionate History student with a keen interest in management consulting. I am a strong team player with excellent communication skills and a MECE mindset. I am always looking for new opportunities to grow and learn. Feel free to connect!"

**Experience:**
- *Member, Bristol Consulting Society* (Oct 2025 - present): "Attended events and workshops."
- *Sales Assistant, Waterstones* (Jun 2024 - present): "Helped customers. Worked on the till. Restocked shelves."
- *Volunteer, Food bank* (2023): no description.

**Education:** BA History, University of Bristol, 2025-2028. No grade, no modules.
**Skills (top 3 in PDF):** Leadership, Strategy, Teamwork. Full list: 27 skills including "Management Consulting", "Mergers & Acquisitions".
**Photo:** cropped from a night out. Public #OpenToWork frame.
**Activity:** reshared 15 "I'm thrilled to announce" posts.
**CV mismatch:** CV says Waterstones from Sep 2024; LinkedIn says Jun 2024.

**Score (illustrative, consulting weights): about 38/100.** Fails 01, 02, 03, 05, 06, 07, 08, 10, 11 (critical), 13, 16.

### 8.2 After

**Headline:** `History BA, University of Bristol | Strategy & management consulting | Project lead, 180 Degrees Consulting Bristol | Semi-finalist, 2026 university case competition`

**About:**
"Second-year historian aiming for a strategy consulting internship in summer 2027.

History has trained me to work through large, messy sets of evidence and reach a clear argument. I have used that in two places:
- At 180 Degrees Consulting Bristol, I led a 4-person team for a local food bank. We analysed 18 months of visit data and 60 volunteer surveys and recommended a new shift rota. The food bank adopted it and cut unfilled shifts from 22% to 9%.
- In a 2026 university case competition, our team reached the semi-final (top 8 of 64). I built the market-sizing model in Excel.

I also work 12 hours a week at Waterstones, where I run the store's monthly book-club event (average 25 attendees).

I'm keen to hear from people who moved from humanities into consulting."

(~900 characters; first person; numbers; no jargon.)

**Experience:**
- *Project Lead, 180 Degrees Consulting Bristol* (Jan 2026 - present): "Pro-bono consulting for local non-profits. I led 4 consultants on a 10-week project for a food bank: analysed 18 months of visit data and 60 volunteer surveys in Excel; recommended a new rota; adopted in May 2026, unfilled shifts fell from 22% to 9%."
- *Events Committee, Bristol Consulting Society* (Oct 2025 - present): "I organised 3 firm skills sessions (Big 4 and boutique speakers), 140 total attendees; ran a 6-week case practice group for 20 first-years."
- *Bookseller, Waterstones* (Sep 2024 - present; now matches CV): "I set up and host a monthly book-club evening (average 25 attendees), which the store manager credits with lifting event-night sales; trained 3 new starters on tills and stock."
- *Volunteer, [Food bank]* (2023): "Weekly sorting and distribution shifts, ~4 hours a week for 9 months."

**Honors & Awards:** "Semi-finalist (top 8 of 64), 2026 university case competition, team of 4; built the market-sizing model."
**Education:** BA History, University of Bristol, 2025-2028. "Year 1 average: 68% (2:1)." Modules: Quantitative Methods for Historians; Economic History of Britain 1750-1950; dissertation (planned) on 19th-century railway finance.
**Skills (top 3 pinned):** Problem Solving, Data Analysis, Microsoft Excel. Full list (8): + PowerPoint, Market Research, Stakeholder Management, Presentation Skills, Project Management. Removed "Mergers & Acquisitions" and "Management Consulting" (not evidenced).
**Photo:** daylight head-and-shoulders shot, plain top. Open to Work set to recruiters-only.
**Activity:** one post on the case-competition semi-final, thanking teammates, with no case content.
**Network:** custom URL `linkedin.com/in/firstname-lastname`; follows 8 target firms; connected with 6 Bristol alumni at Bain, BCG, Deloitte and PwC.

**Score (illustrative): about 84/100.** Remaining gaps: no recommendation yet (ask the 180DC client lead); no consulting internship (expected for a 2nd year, not required).

---

## 9. Implementation notes (grade D)

- Detect year from Education dates; apply the year adjustments in §4 and §5.
- For LI-CONSULTING-11, diff structured fields (employer, title, start/end month, degree, grade) between the parsed PDF export and the user's CV in Placed. Treat a month mismatch as a fail with a clear "which is right?" prompt.
- For screenshot rules, accept the absence of a screenshot as `not_applicable`, not `fail`.
- In the UI, say: "Consulting firms hire through online applications and tests; your LinkedIn matters most when you message alumni and consultants."
- Today (2026-10-14) BCG UK graduate deadline is 18 Oct and Bain London's is 15 Oct [L1][L2]. A final-year consulting user should be nudged to the application before polishing LinkedIn.

---

## 10. Sources (all accessed 2026-10-14)

| Tag | Title | Publisher | Year | URL | Grade |
|---|---|---|---|---|---|
| L1 | Associate Jobs: United Kingdom | BCG | live 2026 | https://careers.bcg.com/global/en/locations/united-kingdom/associate-jobs | A |
| L2 | Bain London University Hiring | Bain & Company | live 2026 | https://bain.com/careers/recruiting/london-recruiting | A |
| L3 | Careers at L.E.K. | L.E.K. Consulting | live 2026 | https://www.lek.com/careers | A (thin) |
| L4 | Careers | Oliver Wyman | live 2026 | https://www.oliverwyman.com/careers.html | A (thin) |
| L5 | Applying to McKinsey & Company: CVs, cover letters and interviews | TARGETjobs | 2025 | https://targetjobs.co.uk/careers-advice/business-consulting-and-management/applying-mckinsey-company-cvs-cover-letters-and-interviews | B |
| L6 | Networking (Looking for work) | LSE Careers | undated | https://info.lse.ac.uk/current-students/careers/information-and-resources/looking-for-work/networking | B |
| L7 | Networking | University of Cambridge Careers Service | undated | https://www.careers.cam.ac.uk/node/601 | B |
| L8 | LinkedIn (job search) | University of Manchester Careers Service | undated | https://careers.manchester.ac.uk/findjobs/job-search/linkedin | B |
| L9 | LinkedIn | University of Aberdeen Careers Service | undated | https://abdn.ac.uk/careers/applying/linkedin | B (unsourced stats on page: unverified) |
| L10 | Save a profile as a PDF | LinkedIn Help | live 2026 | https://www.linkedin.com/help/linkedin/answer/a541960 | A (for feature behaviour) |
| L11 | How hard is it to get into consulting? (cites Cibyl Graduate Research UK 2022) | TARGETjobs | 2023 | https://targetjobs.co.uk/careers-advice/business-consulting-and-management/how-hard-is-it-to-get-into-consulting | B |
| L12 | How you can use LinkedIn for your consulting applications | PrepLounge | 2026 | https://www.preplounge.com/en/blog/consulting/interview/linkedin-referrals | C |
| L13 | The graduate's guide to creating the perfect LinkedIn profile | TARGETjobs | 11 Aug 2026 | https://targetjobs.co.uk/careers-advice/finding-a-job/graduates-guide-creating-perfect-linkedin-profile | B |
| L14 | 12 skills that consulting recruiters want in graduates | TARGETjobs | 2025 | https://targetjobs.co.uk/careers-advice/business-consulting-and-management/top-consulting-skills | B |
| L15 | Management consultant job profile | Prospects | Sep 2026 | https://www.prospects.ac.uk/job-profiles/management-consultant | B |
| L16 | Let recruiters know you're open to work | LinkedIn Help | live 2026 | https://www.linkedin.com/help/linkedin/answer/67405 | A (for feature behaviour) |

Referenced but **not verified** (do not cite in the UI): LinkedIn Business "Picture Perfect" (21x/9x photo claim); ResumeGo LinkedIn callback study (71%); Management Consulted networking guide (403).
Cross-references: CV rules CON-01 to CON-13 and FCQ-01 to FCQ-12 in `docs/research/cv-rules-finance-consulting.md`.
