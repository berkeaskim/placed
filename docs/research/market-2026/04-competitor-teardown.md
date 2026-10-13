# 04 — Competitor teardown: CV scoring and tailoring (2025–2026)

Researcher 4 of 6 · written 2026-10-13 · all URLs accessed 2026-10-13 unless stated otherwise.

**Source labels used throughout**

| Label | Meaning |
|---|---|
| **[V]** | Verified on the product's own page, help centre or official announcement, fetched today |
| **[3P]** | Third-party review or press. Usually also an affiliate or competitor blog, so treat it with care |
| **[UR]** | User-reported anecdote (Reddit, Trustpilot, reviews quoting users). Not verified |
| **[NV]** | Could not verify (page 403/404, or only stale data found) |

Pricing is in USD unless stated otherwise, and it changes often. Use these numbers for positioning, not for exact quotes.

---

## 0. TL;DR

- **The market has three kinds of score, and none of them explains *why* a rule matters.**
  1. **JD keyword-match %:** Jobscan, Teal, Simplify, Resume Worded "Targeted", Enhancv, Kickresume.
  2. **Generic rubric score:** Resume Worded (30–40 checks), Rezi (23 audits), Enhancv (27 checks), Kickresume (20+), CV360 (58 checks), VMock (3 dimensions), CareerSet.
  3. **LLM categorical fit:** LinkedIn (high / medium / low), Huntr (Poor → Great).

  No product we found cites external evidence (recruiter studies, employer guidance) for its rules. None separates evidence-backed rules from convention.
- **Tailoring is everywhere, and honesty is mostly a disclaimer.**
  - Huntr is the only one that markets anti-fabrication ("can't invent titles, numbers, or skills") [V]. Even Huntr shows no verification report to the user.
  - LinkedIn tells users to verify the AI's output themselves [V].
  - Simplify's tailoring doc makes no honesty statement at all [V].
  - A 2026 test caught a checker inventing "Reduced regressions by 20%" [3P].
- **Score targets push students towards keyword stuffing.** Published targets: Jobscan ≥75% [V], Simplify ≥70% [3P summary of help doc], Resume Worded Targeted ≥85% [3P], Kickresume ≥75% [V]. Reviewers note that chasing 95% makes CVs robotic [3P].
- **UK university tools are generic and institution-licensed:** VMock, CV360, CareerSet, Shortlist.me. They score on a 0–100 scale with a "green zone" (VMock 86+, CV360 85+). None weights by UK sector (IB / consulting / quant / tech), and none offers tailoring with provenance.
- **Employers are reacting.** ISE reports 140 applications per graduate vacancy, a "sea of sameness" from AI use, and firms such as Shoosmiths asking candidates *how* they used AI [V]. Honest, traceable tailoring is a credible counter-position, not just a feature.

---

## 1. Per-product notes

### 1.1 Jobscan — the archetypal keyword-match scanner

**What the score measures (keyword match %, [V] jobscan.co home):**
- Priorities, in order: hard skills → education level (only if the JD asks for an advanced degree) → job title → soft skills → other keywords.
- "Resume word count and measurable results are not factored into the match rate."
- Source: https://www.jobscan.co/

**Report sections ([V] tutorial, modified 2026-06-29, https://www.jobscan.co/jobscan-tutorial):**
- Searchability: contact info, headings, job-title match.
- Hard skills and soft skills.
- Recruiter tips: measurable results, words to avoid, word count.
- Formatting: fonts, margins, images.

**Target:** "We recommend aiming for a match rate of at least 75%." [V, tutorial]

**Tailoring ([V] tutorial):**
- One-Click Optimize: "Click on a missing skill… it will direct you to the resume section where AI integrated it. A single click to accept or reject the suggestion…"
- Edit Mode then gives phrase suggestions for each missing skill.
- The tutorial gives no anti-stuffing or anti-fabrication guidance.

**Pricing [3P]:**
- 5 free scans/month.
- Monthly $49.95.
- Quarterly $89.95 (≈$29.98/mo).
- Source: Interview Guys, 2026-02-03, https://blog.theinterviewguys.com/is-jobscan-worth-it-in-2026/
- The official plan page (app.jobscan.co/plan) needs login [NV].

**Students:** "Jobscan Organizations" is sold to higher-education institutions [V, home]. No individual student discount was found.

**Complaints [3P, citing typical user behaviour]:**
- "Can encourage keyword stuffing."
- "Match rate… looks scientific… dangerously easy to fixate on."
- One-Click output "replac[es] strong specific achievement statements with bland corporate-speak."
- Source: Interview Guys (above).

**UX worth noting:**
- Missing-skill list → jump to location → accept/reject inline.
- Live match % as you edit.

### 1.2 Teal — free-tier-generous builder and tracker

**Match score ([V] tool page, https://www.tealhq.com/tool/resume-job-description-match):**
- "Match score from 0-100%. It analyzes keywords, skills, and experience requirements… highlights missing keywords."
- "Scored against the job description in real time."
- A Teal video covers "Getting Credit for Word Forms and Phrases" and "Turning On Resume Content You Already Have" (https://www.youtube.com/watch?v=SGdJ9V17e7A). This implies stemming / phrase normalisation, plus a content library you toggle into each resume version.

**Tailoring:**
- "AI will help you customize your content… Tailor your bullets, summary, and skills" [V, same page].
- AI is credit-based.

**Pricing ([V] https://www.tealhq.com/pricing):**
- $13 every 7 days, $29 every 30 days, $79 every 90 days.
- Free tier: JD keyword matching "Top 5" keywords, "Basic" analysis, 10 AI credits.
- Teal+: unlimited of each.

**Complaints [3P / UR]:**
- AI output is "generic and requires heavy editing."
- Teal+ is seen as expensive.
- Trustpilot ~4.3 (≈93 reviews, Mar 2026) per a review aggregator.
- Source: https://www.resumecoach.com/reviews/tealhq-resume-builder-review/ ; https://uk.trustpilot.com/review/tealhq.com

**UX worth noting:**
- Match % that updates live.
- Keywords listed in the job tracker.
- A "content library": one master profile with toggles per tailored version. Conceptually close to our `sourceRefs`.

### 1.3 Rezi — rubric score plus keyword targeting

**Rezi Score ([V] help centre, https://intercom.help/rezihelp/en/articles/8383527-using-the-rezi-score):**
- Scale 1–100: "≥90 Excellent", "<89 Needs improvement", "<50 Not ready".
- 5 categories (Content, Format, Optimization, Best Practices, Application Ready) containing 23 audits.
- Content audits cover quantification, verb strength, buzzwords and punctuation.
- Format rules include 1–2 pages, font 8.5–9.5pt, 3–6 bullets per role.
- "Real-time content analysis" updates as you edit.

**Tailoring:** "AI Keyword Targeting… Rezi checks and perfectly tailors your resume with keywords" [V, pricing page https://www.rezi.ai/pricing].

**Pricing [V]:**
- Free: 1 resume, 3 PDF downloads.
- Pro: $29/mo.
- Lifetime: $149.
- Enterprise: $99/mo per 200 users (for universities and agencies).

**Complaints:** Named in the Reddit round-up (§1.15) among tools whose AI output reads generic [UR].

**UX worth noting:**
- Threshold bands with blunt labels ("Not ready").
- Audit-level checklist.
- Score updates live.

### 1.4 Enhancv — rubric plus ATS-style JD score, "bias" checks

**Resume Checker ([V] https://enhancv.com/resources/resume-checker/):**
- A two-tier score: (1) parsability rate, i.e. the % of content parsed; (2) issue detection.
- 27 checks in 7 groups:

| Group | Checks |
|---|---|
| ATS essentials | 6 |
| Sections | 3 |
| Content: parse rate, quantified impact, repetition, spelling, bullet consistency | 5 |
| Job tailoring: hard/soft skills, action verbs, tailored title | 4 |
| Recruiter red flags: credibility, interview-risk signals, peer benchmarking, LinkedIn match | 4 |
| Bias & discrimination: age/date bias, employment gaps | 2 |
| Seniority & impact | 3 |

- It claims to have "reverse-engineered" Greenhouse, Lever and Workday.

**JD score:**
- "Scores your resume against [the job ad] the way an applicant tracking system would… draws on 200+ hours of recruiter interviews, hundreds of pages of ATS documentation" [V, https://enhancv.com/].
- "A tailoring score that guides you instead of just grading you." [V]

**Pricing [3P]:**
- Monthly ≈$24.99–29.
- Quarterly ≈$16.66–19.67/mo.
- Semi-annual ≈$13.33–16.5/mo.
- Sources disagree. See https://pricingsaas.com/companies/enhancv

**Notable:**
- The "interview risk signals" and "credibility" checks are the closest any rubric gets to an honesty check.
- They are AI-judged and opaque.

### 1.5 Kickresume — builder with ATS checker; strongest student giveaway

**Checker ([V] https://www.kickresume.com/en/ats-resume-checker/):**
- "ATS score based on more than 20 different checks": formatting, design, typefaces, structure, content, keywords.
- "Anything from 75% up is generally considered good."
- Compares you "to the best resumes in our database."
- Re-reviews after every edit.

**Student offer [V]:** "Free ATS Resume Checker for All Students… verified students and teachers (ISIC, ITIC…) — Get Free Premium."
- A third party puts this at 6 months of free Premium [3P].

**Pricing [3P]:**
- Monthly ~$19.
- Quarterly ~$10/mo.
- Annual ~$5/mo.
- Source: https://toolradar.com/tools/kickresume/pricing (figures look low, so verify before quoting).

**Tailoring:** "Work in the right keywords and skills from the job ad" [V]. The AI writer is GPT-based [3P].

### 1.6 Resume Worded — closest to "evidence lines"

**Score My Resume ([V] https://resumeworded.com/score):**
- "30+ checks… up to around 40, depending on your career level" (student vs exec).
- "Every check is a specific thing recruiters told us they look for, and **your report shows the exact lines behind each result**."
- 4 groups:
  - Impact (weak verbs like "Assisted/Helped", tense, repetition)
  - Brevity and style (length, filler, buzzwords, passive voice, pronouns, spelling)
  - Growth and leadership signals
  - ATS and formatting
- Score bands: 90–100 Exceptional; 85–89 Strong; 80–84 Solid; <80 Room to grow.
- The score and top fixes are free. Line-by-line feedback and rewriting tools are paid.

**Targeted Resume:**
- Paste a JD → missing keywords plus a relevancy score updating in real time.
- Target ≥85% [3P, https://toolsforhumans.ai/ai-tools/resume-worded].

**Pricing [3P]:** Pro $49/mo, $33/mo quarterly, $19/mo annual. Source: https://www.loopcv.pro/directory/resume-worded/

**Notable:**
- Career-level adjustment. The same idea as our `yearAdjust`.
- Evidence lines. The same idea as our `evidence_line`.
- But the "recruiters told us" rationale is never cited.

### 1.7 Huntr — the competitor closest to our honesty pitch

**Job Match Score ([V] help centre, https://help.huntr.co/en/articles/12241684-job-match-score):**
- Built from:
  - Qualifications ("roughly one-third to one-half")
  - Responsibilities
  - Keywords ("usually account for less than 20%")
  - Job title
- Must-have items are weighted above nice-to-have.
- LLM semantic matching.
- Output is banded: Poor / Weak / Fair / Good / Great.

**Resume Tailor ([V] https://huntr.co/product/resume-tailor):**
- "Rewrites your bullet points, maps your skills to the right keywords."
- Every suggestion shows "why it was made."
- One-click accept/ignore, inline edit, unlimited undo.
- Honesty claims: suggestions are "grounded in what you did", "can't invent titles, numbers, or skills", "rephrases and repositions, it doesn't invent."

**Pricing [V]:**
- Free: 2 tailored resumes.
- Pro: $40/mo; $90/quarter and $160/6 months per the FAQ search snippet.

**Gap vs Placed:**
- The claim is marketing copy. We found no verification report, no per-bullet source line and no blocked/reverted list.
- Placed can *show the receipts*.
- Huntr's de-weighting of keywords (<20%) matches our stance and is a useful external reference.

### 1.8 Careerflow

- **What it offers:** an AI resume builder with an "ATS optimizer", LinkedIn optimisation, mock interviews and a tracker.
- **Pricing [3P]:**
  - Premium ≈$23.99/mo (~$14.41/mo annual).
  - Premium Plus ≈$44.99/mo.
  - Source: https://www.toolsforhumans.ai/ai-tools/careerflow
- **Complaints [3P]:** "ATS parsing sometimes gives inaccurate suggestions"; the free tier is very limited.
- **Product page [NV]:** the pricing page scrape hit a rate limit.

### 1.9 Simplify — internship-heavy autofill plus Copilot keywords (US)

**Keywords Score ([V] help centre, https://help.simplify.jobs/articles/0515607-auto-tailoring-your-resume-with-copilot):**
- A Keywords Score tab on supported job pages: present vs missing keywords plus overall alignment.
- A ≥70% target appears in the search summary of Simplify help docs [3P-ish].

**Auto-tailoring [V]:**
- "Rework[s] existing bullet points and resume sections to naturally include missing keywords."
- "You can review edits before using them."
- "Your original resume is preserved."
- **No honesty / no-invention statement.** The help article makes no such claim.
- Free users see the score and missing keywords. Simplify+ does the rewriting.

**Pricing [NV]:** only a stale 2023 aggregator figure was found. Don't quote it.

**Student focus:** strong in the US (internship lists, autofill). Not UK-specific.

### 1.10 LinkedIn Premium AI (Job Match + Resume Tips)

**Resume Tips ([V] https://www.linkedin.com/help/linkedin/answer/a6813101):**
- Premium only, desktop, English.
- "Review your resume against the job description and suggest ways to enhance your resume."
- Disclaimer: "We strongly recommend that you verify the Resume Tip's responses for authenticity as they may contain inaccuracies."

**Job Match [3P]:**
- AI compares your profile with each required and preferred qualification.
- Premium users get a categorical high / medium / low match.
- Premium ≈$30/mo; launched Jan 2025.
- Source: https://www.socialmediatoday.com/news/linkedin-ai-tools-job-seekers-recruiters-smbs/737481/

**Notable:** it is the biggest distribution channel. Honesty is pushed onto the user.

### 1.11 Indeed (Career Scout)

- **What it is:** a free AI career coach. It includes a career quiz, job recommendations, an AI resume builder, autofill and mock interviews.
  - Launched in Australia; US test data cited.
  - Indeed claims users were "38% more likely to be hired" in a May 2025 US test.
- **Product page:** https://www.indeed.com/careerscout [V exists, details via 3P press: https://itbrief.com.au/story/indeed-launches-ai-career-scout-for-australian-jobseekers].
- **Notable:** quiz → match → resume is the same funnel as Placed's onboarding (quiz → archetype → CV). Indeed has no visible evidence-cited scoring.

### 1.12 Canva / Zety-type builders (brief)

- **Zety:**
  - ATS checker flags "30+ potential issues" [3P].
  - Billing: $1.95 14-day trial that auto-renews at $25.95 every 4 weeks [3P, https://www.loopcv.pro/directory/zety/].
  - Trustpilot reviews repeatedly mention surprise charges and cancellation difficulty [UR].
- **Canva:** design-first templates (often multi-column, graphics). Reddit threads flag these as ATS-risky [UR via VisualCV round-up].
- **Relevance:** students arrive with Canva CVs. Our deterministic "text layer present / single column" checks matter.

### 1.13 Standard Resume

- Could not find current primary-source detail on scoring or tailoring [NV].
- Historically a clean, free, student-friendly builder (US) with shareable web resumes.
- Low relevance to scoring or tailoring.

### 1.14 UK university-licensed tools

| Tool | Where (UK) | Score | Tailoring | Source |
|---|---|---|---|---|
| **VMock Smart Resume** | UCL School of Management, plus many US/AU universities | 0–100 across **Impact / Presentation / Competencies**; "green zone" ≥86; line-level feedback | Limited (generic) | [3P/V uni pages] https://bel.uq.edu.au/for-students/careers/application-support/vmock ; UCL SoM page listed in search, fetch 403 [NV] |
| **CV360** (Abintra → The Access Group "Access Careers Centre") | Liverpool, Bath, Sydney, Macquarie… | **58 checks** across 6 categories (file type, presentation, structure, content, language, skills); red zone <85, green ≥85. Bath careers: "100% is not the goal… dismiss the checks that don't apply to you" | Builder; skills-dominance view | [3P uni pages] https://www.theaccessgroup.com/en-gb/products/cv360/ ; https://blogs.bath.ac.uk/careers/2023/11/13/how-good-is-good-enough-a-guide-for-using-cv360/ (via search snippet; direct fetch 403) |
| **CareerSet** | LSE, KCL, Warwick, Cambridge, Leicester, Royal Holloway, Aberdeen | Scores "clarity, structure, impact, and brevity"; job matching flags "missing skills or keywords"; LSE: "its score is a useful guide, not a final judgement"; recommended for "consulting, banking or corporate roles" | JD match + tips | [V uni] https://info.lse.ac.uk/current-students/careers/information-and-resources/online-tools/CareerSet |
| **Shortlist.me** | Aberystwyth, Manchester | CV Optimiser (structure, content, spelling/grammar), **CV Targeter** (tailor to job), plus AI interview simulator | Targeter | [V uni] https://www.aber.ac.uk/en/careers/students/digital-tools/shortlist-me |
| **JobTeaser AI CV Checker** | Some UK/EU universities | AI review; student is told by email whether the CV "needs improvement" | No | [V help] https://helpcenter.jobteaser.com/hc/en-gb/articles/14735523896604-AI-powered-CV-Checker |
| **Prospects / TARGETjobs** | National graduate sites | No current first-party AI CV checker verified. They mainly publish CV advice and templates. TARGETjobs is described by a third party as offering "AI-powered job matching, CV reviews" | [NV] | https://www.parse.gl/brands/targetjobs-co-uk |
| **Bright Network** | National | CV guidance and templates, including how to make a CV "AI-friendly". No scored checker verified | No | [NV] via search |
| **Handshake** (UK presence) | Global | **Sidekick** ("refine resume with step by step advice, based on industry or role", beta Apr 2026) and resume → profile auto-fill (rolled out 2026-07-21: "review a job seeker's resume and… suggest additions"); AI job-fit assistant | Advice, not a full rewrite | [V] https://updates.joinhandshake.com/announcements/ann_qIT5uQQpqhmOL ; support article 403 [NV] |

**Pattern:**
- Universities buy rubric scorers with traffic-light zones. Careers staff publicly tell students to *ignore* checks that don't apply (Bath) and to treat the score as "a guide, not a judgement" (LSE).
- That is effectively an admission that the scores are not sector-aware or evidence-weighted. **This is the gap Placed's sector profiles and evidence tiers fill.**

### 1.15 Cross-tool complaint evidence

**Fabrication [3P/UR]:**
- Peerlist, Dan Sebastian, 2026-02-05: "We Tested the Same Resume on 3 Popular Resume Checkers."
  - One tool rewrote "Applied basic automated testing… to reduce regressions" into "Reduced regressions by 20%…".
  - Another "turned side projects into fake jobs".
  - A third reported "0% parsed".
  - The tools were not named.
  - https://peerlist.io/soared/articles/resume-checker-accuracy-test
- **This is a ready-made demo test case for `inventedMetrics` / `perBulletDrift`.**

**Reddit round-up [UR] (VisualCV, 2026-06-09, r/resumes, r/humanresources):**
- AI "can invent details or overstate experience"; users advise "triple-checking."
- AI CVs sound "polished but very generic or robotic."
- Many call ATS scores meaningless ("fake news").
- Tools named: Rezi, Teal, Kickresume, Resume.io, Enhancv, Jobscan, Resume Worded, ChatGPT, Canva.
- VisualCV is itself a competitor, which is a bias.
- https://www.visualcv.com/blog/what-reddit-users-say-about-ai-resume-builders-new-graduates/

### 1.16 AI auto-apply entrants and employer reaction

**Auto-apply tools:** LazyApply, JobCopilot, Sonara.
- Complaints [UR/3P]:
  - Wrong or blank form fields and wrongly answered screening questions.
  - Refund and cancellation friction. LazyApply's Trustpilot rating is "in the low 2s"; ~25% of negative reviews cite refunds.
  - JobCopilot: duplicate charges.
- Sources: https://blog.loopcv.pro/lazyapply-review/ ; https://blog.theinterviewguys.com/?p=10535 ; https://au.trustpilot.com/review/lazyapply.com

**Employer reaction [V] (ISE, 2025-10-27, https://ise.org.uk/knowledge/insights/499/how_can_employers_manage_and_adapt_to_mass_applications):**
- Applications per graduate vacancy: ~40 twenty years ago → ~86 (2022/23) → **140 (2024), unchanged in 2025**.
- Recruiters describe a "sea of sameness."
- Tactics:
  - closing application windows earlier;
  - AI detection, which has reliability issues;
  - Shoosmiths asks candidates explicitly *how they used AI*.
- Consensus: "adaptation with transparency beats prohibition."

**Press [3P]:**
- 67% of UK hiring managers say AI-generated applications slowed hiring, citing "fabricated work histories."
- Source: https://www.staffingindustry.com/news/global-daily-news/ai-generated-cvs-flood-employers-and-slow-hiring-in-the-uk (direct fetch 403; figure from search snippet [NV]).

**Implication:**
- Volume tools make the student's problem worse.
- A product that rewards *quality* (XP for tailored, verified applications rather than counts) and produces an AI-use transparency note fits the employer mood. **This supports Placed's "quality over volume" XP rule (§10 of the spec).**

---

## 2. Feature matrix

Legend:
- ✅ = yes (verified)
- ◐ = partial / claimed but not shown
- ❌ = no / not found
- ? = unverified
- "KW%" = keyword-match percentage

| Product | Score type | Score explains *which line* | Cites external evidence for rules | Sector / level aware | JD tailoring | Per-suggestion accept/reject | Reason per change | Anti-fabrication | Verification report shown | Live score update | Student / UK focus | Gamified | Price (indiv.) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Jobscan | KW% + checks | ◐ | ❌ | ❌ | ✅ One-Click | ✅ | ❌ | ❌ | ❌ | ✅ | Inst. licence | ❌ | ~$50/mo [3P] |
| Teal | KW% | ◐ | ❌ | ❌ | ✅ (AI credits) | ◐ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | $13/wk, $29/30d [V] |
| Rezi | Rubric (23) + KW | ◐ | ❌ | ◐ level / field | ✅ | ? | ❌ | ❌ | ❌ | ✅ | Enterprise for unis | Bands | $29/mo, $149 life [V] |
| Enhancv | Rubric (27) + JD | ◐ | ❌ ("200h recruiter interviews") | ◐ seniority | ✅ | ? | ◐ | ◐ "credibility" check | ❌ | ✅ | ❌ | ❌ | ~$25/mo [3P] |
| Kickresume | Rubric (20+) | ? | ❌ | ❌ | ✅ | ? | ❌ | ❌ | ❌ | ✅ | ✅ free for students | ❌ | ~$19/mo [3P] |
| Resume Worded | Rubric (30–40) + KW | ✅ "exact lines" | ❌ ("recruiters told us") | ✅ career level | ✅ Targeted | ? | ◐ | ❌ | ❌ | ✅ | Inst. licence | Bands | $19–49/mo [3P] |
| Huntr | LLM bands (Q / R / K / T) | ◐ | ❌ | ❌ | ✅ | ✅ | ✅ "why it was made" | ◐ claims "can't invent" | ❌ | ✅ | ❌ | ❌ | $40/mo [V] |
| Careerflow | ATS optimiser | ? | ❌ | ❌ | ✅ | ? | ? | ❌ | ❌ | ? | ❌ | ❌ | ~$24/mo [3P] |
| Simplify | KW% | ❌ | ❌ | ❌ | ✅ (paid) | ◐ review before use | ❌ | ❌ (no statement) | ❌ | ✅ | ✅ US interns | ❌ | ? |
| LinkedIn Premium | LLM H/M/L | ◐ per qualification | ❌ | ❌ | ✅ chat | ◐ | ◐ | ❌ "verify yourself" | ❌ | ❌ | ❌ | ❌ | ~$30/mo [3P] |
| Indeed Career Scout | Match / quiz | ? | ❌ | ❌ | ✅ | ? | ? | ? | ❌ | ? | ❌ | ❌ | Free |
| Zety | Checker (30+) | ? | ❌ | ❌ | ◐ | ? | ❌ | ❌ | ❌ | ? | ❌ | ❌ | $25.95/4wk [3P] |
| VMock | Rubric (3 dims) | ✅ line-level | ❌ | ◐ | ❌ | n/a | n/a | n/a | n/a | ✅ on re-upload | ✅ UK unis (UCL SoM) | Green zone | Uni-paid |
| CV360 | Rubric (58) | ◐ | ❌ | ❌ | ◐ | n/a | n/a | n/a | n/a | ✅ | ✅ UK unis | Red / green zone | Uni-paid |
| CareerSet | Rubric + JD | ◐ | ❌ | ◐ (graduate / banking / consulting) | ◐ tips | n/a | n/a | n/a | n/a | ? | ✅ LSE, KCL, Warwick… | ❌ | Uni-paid |
| Shortlist.me | Rubric + Targeter | ? | ❌ | ❌ | ✅ Targeter | ? | ? | ? | ❌ | ? | ✅ UK unis | ❌ | Uni-paid |
| Handshake | Advice / fit | ? | ❌ | ◐ industry / role | ◐ | ✅ (profile suggestions) | ? | ? | ❌ | ❌ | ✅ students | Badges (AI) | Free |
| **Placed (planned)** | Rule library (161) + KW% | ✅ `evidence_line` | ✅ **citation chip + evidence tier A–D** | ✅ **UK sector + year** | ✅ | ✅ (proposed) | ✅ reason + JD requirement | ✅ **deterministic gate** | ✅ **badge + reverted list** | ✅ | ✅ UK students | ✅ XP for quality | Free (hackathon) |

**Reading the matrix:**
- No column has every competitor at ✅ except "JD tailoring".
- The three columns where *nobody* is ✅ are exactly Placed's planned spine:
  1. external evidence;
  2. deterministic anti-fabrication;
  3. a verification report the user can see.

---

## 3. UX patterns worth stealing

1. **Missing-keyword list → jump to the spot → accept/reject inline** (Jobscan One-Click). Click a gap chip, scroll to the bullet where the change happened, and toggle it.
   - *Placed version:* clicking a "🔁 made visible" requirement scrolls to the changed bullet in the diff.
2. **"Why it was made" under every suggestion, plus unlimited undo** (Huntr). This is already in our `changes[].reason`. Add an undo per bullet.
3. **Live score delta while editing** (Jobscan, Teal, Rezi, Resume Worded Targeted).
   - Show "+4" floating on the ring when a fix is accepted.
   - Our score is deterministic code, so this is cheap for `code` rules. LLM rules show "re-check" until the next judge call.
4. **Banded labels with plain words** (Rezi "Not ready / Needs improvement / Excellent"; Resume Worded "Exceptional / Strong / Solid / Room to grow"; Huntr "Poor → Great").
   - Pair the number with a band so students don't chase 100.
   - Put "aim for good enough" in the copy, as the Bath careers advice does.
5. **Green-zone threshold** (VMock 86, CV360 85). A clear finish line works as gamification. We can make "Green zone for Consulting" a badge.
6. **Career-level adjustment** (Resume Worded: 30–40 checks depending on level). We have `yearAdjust`. Surface it explicitly: "Scored as a 2nd-year: the quantification bar is 40%, not 60%."
7. **Content library / master profile with toggles** (Teal). Tailored versions select from verified source bullets. This is the UI metaphor for `sourceRefs`.
8. **"Dismiss checks that don't apply"** (CV360 guidance). Let users mark a rule "N/A for me" with a reason. The score recomputes and the dismissal is shown, never hidden.
9. **Resume → profile suggestions you review before saving** (Handshake, July 2026). This mirrors our parseCV confirm step.
10. **Bias / gap checks** (Enhancv). These fit our UK-conventions dimension: DOB, photo, marital status.

---

## 4. Gaps nobody fills

1. **Evidence-cited scoring.**
   - Every scorer says "recruiters told us", "200h of interviews" or "hiring managers consider important". None links a rule to a source.
   - None separates evidence-backed rules from convention, and none debunks myths. Meanwhile Reddit calls ATS scores "fake news".
2. **Visible, deterministic anti-fabrication.**
   - Huntr *claims* it can't invent. LinkedIn tells you to check it yourself. Simplify says nothing.
   - Nobody shows a per-claim verification report, blocks a render, or lists what was reverted. Third-party tests caught invented metrics.
3. **UK sector-aware weighting.**
   - No product changes weights for IB vs consulting vs quant vs SWE. None knows UK conventions (2:1, predicted grades, A-levels/UCAS, no photo/DOB).
   - None adds sector caveats such as "Big 4 screens on forms and tests, so your CV matters less here".
   - CareerSet's "good for banking/consulting" is a usage note, not weighting.
4. **Year-of-study calibration for internships.** Resume Worded adjusts by career level, but nobody calibrates first-year vs penultimate-year spring-week / summer-internship expectations.
5. **Honest gap handling.** Tools either stuff missing keywords or simply list them. Nobody says "❌ not in your CV, we didn't invent it" and turns the gap into an action (a project or course to close it).
6. **Anti-stuffing incentives.**
   - Every KW% tool rewards density up to 100%. Recommended targets of 70–85% exist, but the UI still rewards pushing higher.
   - Nobody caps credit, flags repetition, or says "past 80%, more keywords won't help".
7. **Gamification of quality.**
   - University tools have green zones. Handshake has AI badges.
   - Nobody rewards *verified* improvements (adding a real number, confirming a fact) or tailored-not-mass applications. Auto-apply tools reward volume, which employers penalise.
8. **AI-use transparency for the employer side.** ISE / Shoosmiths ask how candidates used AI. No tool generates a truthful "what AI changed" note.

---

## 5. Differentiation for Placed — feature ideas ranked by demo impact vs effort

Effort assumes the spec's planned modules exist (§6–§8): rule library, `judgeCvRules`, `tailorCV` with `sourceRefs`, `verifyTailoring`, diff UI.

| # | Feature | Gap filled | Demo impact | Effort | Notes |
|---|---|---|---|---|---|
| 1 | **"Caught it" moment:** show `verifyTailoring` blocking a planted invented metric live. The demo fixture's LLM draft says "Reduced regressions by 20%"; it gets a red strike → "reverted — not in your CV" → badge flips to "✅ every claim traced". | 2 | ★★★★★ | Low (fixture + existing gate) | Use the real Peerlist example as the framing line: "Other tools did this. Ours can't." |
| 2 | **Provenance hover:** every tailored bullet shows its source line(s) from the original CV on hover/tap (from `sourceRefs`), plus the JD requirement it serves. | 2 | ★★★★★ | Low–Med | No competitor shows this; Huntr shows only "why". |
| 3 | **Source chips + "Myth vs evidence" card** on the CV Score: rule → citation, evidence tier A–D, "convention" tag. | 1 | ★★★★☆ | Low (data already in rules.ts) | A pitch line against "ATS rejects 75%" myths that competitors market with. |
| 4 | **Sector switcher:** the same CV scores differently for Consulting vs IB vs SWE, with an animated weight shift and sector caveats. | 3 | ★★★★☆ | Low (planned) | Lead with it in the demo; university tools can't do this. |
| 5 | **Per-suggestion accept/reject with a live score delta** ("+3 Impact") and undo. | UX parity | ★★★★☆ | Med | Table stakes in Jobscan/Huntr, but combined with provenance it is unique. |
| 6 | **"Confirm this number" → XP.** Adding a *real* metric through the 4-outcome dialog earns XP and a "Receipts" badge; invented numbers are impossible. | 2, 7 | ★★★★☆ | Low | Gamifies honesty, not volume. Ties to spec §7.3 and §10. |
| 7 | **Keyword-coverage ceiling and stuffing warning:** credit saturates around 80%; repeated JD terms trigger a warn ("Mentioned 'stakeholder' 5×; recruiters read this as stuffing"). | 6 | ★★★☆☆ | Low (count tokens) | Copy: "We stop rewarding at 80%. So should you." |
| 8 | **Gap → quest:** each "❌ not in your CV" requirement becomes a quest (e.g. "Build a DCF in Excel: +XP, adds a truthful bullet"). | 5, 7 | ★★★☆☆ | Med | Turns honesty into a growth loop rather than a dead end. |
| 9 | **Year-calibrated score banner:** "Scored as a 2nd-year targeting spring weeks: quantification bar 40%." | 4 | ★★★☆☆ | Low (`yearAdjust` exists) | Small UI, strong UK-student signal. |
| 10 | **AI-use transparency note:** a one-click, truthful summary to paste if an employer asks (Shoosmiths-style): "Reordered 3 bullets, rephrased 4 to match JD wording, added no new facts." Generated from `changes[]` plus the verifier verdict. | 8 | ★★★☆☆ | Low (template over existing data) | Employer-side story for judges; cites ISE. |
| 11 | **"Not applicable to me" rule dismissal** with a visible reason (CV360 advice made structural). | 1 | ★★☆☆☆ | Low | Keeps the score honest without hiding caps. |
| 12 | **Interview-defensibility nudge:** for each changed bullet, a "Could you explain this in an interview?" prompt with one likely question. | 2 | ★★☆☆☆ | Med (one LLM call) | Answers the Reddit complaint about being "destroyed in interviews defending resumes they didn't write". |

**Recommended demo order:** #4 sector switch → #3 source chip → tailor → #2 provenance → #1 caught-it → #6 confirm-number XP. Optionally close with #10, a slide citing ISE 140 apps/vacancy plus "sea of sameness".

**Positioning line (draft):**
- "Every other CV tool gives you a number and a rewrite. Placed gives you the receipts: where each rule comes from, and which line of *your* CV backs every claim."
- "If it isn't in your CV, we don't put it there."

---

## 6. Caveats

- Several first-party pages returned 403/404 or needed login: the Jobscan plan page, Careerflow pricing, the UCL SoM VMock page, the Handshake support article, the Bath CV360 blog, and Staffing Industry. The figures from those come from third-party reviews or search snippets and are labelled as such.
- Many third-party reviews are written by competing tools (VisualCV, Loopcv, Resumly, JobShinobi, etc.). Treat their complaints as directional.
- User-reported anecdotes ([UR]) are not representative samples.
- Simplify pricing and Standard Resume details could not be verified for 2026.
