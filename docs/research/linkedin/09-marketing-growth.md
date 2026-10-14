# LinkedIn Profile Rules: Marketing, Brand & Growth (`marketing_growth`)

Scope: UK undergraduates and masters students targeting brand/marketing internships, insight weeks, placements and graduate schemes at FMCG/beauty (Unilever, P&G, L'Oréal, Mars, Diageo, Reckitt), agencies and holding groups (WPP and its agencies such as Ogilvy, Publicis, Omnicom, Dentsu; media agencies), and growth/performance/content roles at startups and scale-ups, 2026-27 cycle.
Compiled: 2026-10-14. Status: research input for the Placed LinkedIn scorer. Not recruiting advice.
Rule ID prefix: `LI-MARKETING_GROWTH-xx`. These rules override or add to the generic LinkedIn baseline (identity, headline, About, experience, skills, Featured, recommendations, activity, CV consistency).

---

## 0. How to read this document

Same conventions as `docs/research/cv-rules-finance-consulting.md` §0.

- **Check**: `RULE` = deterministic (regex, counts, section parser); `LLM` = model judgement, phrased as one yes/no question with pass and fail examples; `HYBRID` = code extracts, LLM grades.
- **Input**: which input can verify the rule. `pdf_export` = LinkedIn "Save to PDF"; `screenshot` = user-uploaded screenshots of the live profile; `self_report` = user answers a question in Placed. Where several are listed, the first is the preferred one.
- **Severity**: `critical` = likely to cost the student an interview or a recruiter click on its own; `major` = materially weaker than peers; `minor` = polish.
- **Evidence**: A = employer's own guidance or consistent across several top-tier UK careers sources; B = one top-tier source; C = practitioner/trade-press; D = my synthesis, no source (tunable default).
- Citation tags [Sx] refer to §10. Quotes are verbatim, at most 25 words, and only from pages I fetched on 2026-10-14. Where I only saw a search-engine snippet, I say so and do not quote.

### 0.1 What the LinkedIn PDF export can and cannot see (important for Input tags)

LinkedIn's help centre confirms you can "save a copy of your profile ... as a resume in a PDF from the introduction section", desktop only, English-character profiles only [S16]. The help page does **not** list which sections are included. From the export format as commonly produced (my observation, **evidence D, verify against 3-5 real exports before shipping**), the PDF contains: contact/profile URL, name, headline, location, "Top Skills" (only ~3), Languages, Certifications, Honors & Awards, Summary (= About), Experience (titles, dates, descriptions), Education. It does **not** contain: profile photo, banner, Featured, Activity/posts, Recommendations, the full Skills list, endorsement counts, follower/connection counts, Open to Work status, or custom URL vanity checks beyond the printed link.

Consequence for marketing: the sections that matter **more** in marketing than in other sectors (Featured, activity, banner, photo) are exactly the ones the PDF misses. The scorer must ask for 1-2 screenshots (top card + Featured) or self-report, and must degrade gracefully (mark `not_applicable`, not `fail`) when they are absent.

### 0.2 Honest caveats up front

1. **Firm-level LinkedIn guidance for marketing is very thin.** No FMCG or agency careers page I could reach tells students how to write their LinkedIn profile. The only verified firm-level LinkedIn touchpoint: Unilever's UK Future Leaders Programme (Marketing) application lets candidates fill details "using your LinkedIn profile" [S11]. That means the profile can literally become the application form, which makes CV-profile consistency more important for Unilever applicants.
2. **P&G's published process does not mention LinkedIn at all**: application form, online assessments, virtual interviews [S12]. For FMCG schemes, LinkedIn is mainly a **networking and credibility check**, not the screening instrument. The scorer should say this to users.
3. **Most of the "LinkedIn matters for marketing" case is from UK careers services**, not employers: Warwick, Portsmouth, York, Newcastle, TARGETjobs, Prospects [S2-S9]. They agree with each other (so grade A for the general direction), but none gives data.
4. **Popular stats are mostly untraceable.** "Profiles with a photo get 21x more views" is a LinkedIn company statement with no methodology or date published [S19]. "Complete profiles are 40x more likely to receive opportunities" appeared in a search snippet with no primary source at all. "Over 45% of recruiters search by skills" is attributed to LinkedIn's *Future of Recruiting 2025*, but I could not open the PDF text, so it is **unverified**. "70% of employers screen social media" is a 2017 **US** Harris Poll for CareerBuilder (2,380 US hiring managers) [S20], not UK and not student-specific. None of these should appear in Placed UI as fact.
5. **US-centric sources** dominate creator/personal-brand advice. I discarded most of it. UK-specific difference that matters: UK CVs have no photo, but a LinkedIn photo is expected (Imperial says this explicitly [S1]).
6. **Search budget ran out** before I could fetch L'Oréal's and WPP's UK early-careers pages directly. L'Oréal and WPP details below come from search snippets of their own job pages (flagged as such). Treat as B- at best.

---

## 1. How much LinkedIn matters in marketing (sourcing vs screening vs networking)

| Use | How much it matters in marketing_growth | Evidence |
|---|---|---|
| **Sourcing** (recruiters find you) | **Low for FMCG/agency grad schemes** (they recruit through campus/job boards and application forms with fixed windows). **Medium-high for startups/scale-ups** hiring growth/content/performance interns and juniors, where founders and in-house recruiters search LinkedIn and post roles there. | Process pages: P&G [S12], Unilever [S11] (form + assessments). Startup sourcing claim: D (no UK source found). Warwick notes "Companies can find you" [S7], without data. |
| **Screening** (profile read as part of the decision) | **Medium.** Not a formal step at P&G/Unilever, but (a) Unilever's form can be pre-filled from LinkedIn [S11]; (b) interviewers and agency hiring managers commonly look up candidates; (c) in marketing, the profile is itself a sample of how well you market yourself. Several UK careers services frame it exactly that way. | TARGETjobs: "build your personal brand via any social media you use" [S3]. Warwick: marketing and PR "are very competitive and having an online professional profile can help you get ahead" [S7]. Portsmouth: "keep it up to date and professional – it's important to control your online presence" [S6]. |
| **Networking** (alumni, informational chats, speculative routes into agencies and small firms) | **High.** Small agencies and startups often do not advertise; careers services push LinkedIn alumni search, sector groups and following companies. | Newcastle: "Join sector-specific groups on LinkedIn to keep up to date" [S9]; York: "Use LinkedIn to make connections, follow organisations of interest" [S8]; Prospects: "word of mouth and networking are other ways of finding out about opportunities" [S5]; TARGETjobs on speculative applications [S3]. |
| **Portfolio host** | **Higher than any other archetype.** Marketing employers want evidence of campaigns, content and data; LinkedIn Featured + posts are a free portfolio. | Prospects: "Building a portfolio of campaigns, content, or data projects is one of the best ways to demonstrate your skills" [S4]; Portsmouth on blogs, podcasts and LinkedIn groups demonstrating "communication and digital technology" skills [S6]. |

**Bottom line for the scorer:** LinkedIn matters **more** for marketing_growth than for finance/quant, mainly as (1) a networking tool and (2) a portfolio/proof surface, and less as a formal screen at big FMCG schemes. `linkedinImportance = high` for startups/agencies, `medium-high` for FMCG schemes.

### 1.1 What employers say they want (useful for keyword bank and LLM rubrics)

- **Unilever UFLP Marketing UK** lists skills "Brand Advocacy", "Media and Strategy Planning", "Brand visioning and planning", "Performance Marketing", "Commercial Acumen", plus Microsoft Office (Excel, Outlook, Word, PowerPoint). Looks for "commitment, real people skills and a deep-seated interest in the business as a whole". No set degree subject [S11].
- **P&G Brand Management Summer Internship 2027**: "Evidence of passion and achievements in academic and/or non-academic activities"; "Demonstrated leadership skills and strong analytical capability"; "Strong verbal and written English language skills" [S12]. Search snippets of P&G listings add "analytical thinking, strategic envisioning, creative curiosity" and past intern projects (Gillette on Amazon, TikTok strategy for Herbal Essences); not verified verbatim.
- **L'Oréal UK Marketing Management Trainee** (search snippet of its careers page, not fetched): ambition, resilience, creativity; up to 40 graduates per year from diverse degrees; office experience preferred. The L'Oréal careers page I did fetch stresses "curious, creative" and an entrepreneurial mindset [S13].
- **WPP / agencies** (search snippets only): a WPP recruiter interview describes curiosity "over and above the job", activities outside coursework, competitions; WPP Media's grad scheme cover letter asks about a brand campaign that inspired you [S14]. The IPA says no degree is required and warns that if everyone uses "the same generator, the agency will be looking desperately for something different" [S10].
- **Prospects sector overview (Feb 2026)**: employers want "Content creation and digital storytelling, email, search engine optimisation (SEO), and social media" and "Data analytics and campaign measurement" [S4].

---

## 2. What a strong student profile looks like, section by section

### 2.1 Photo and banner
- **Photo**: professional headshot, face clearly visible, only you, eye contact. Expected on LinkedIn even though UK CVs omit photos [S1]. TARGETjobs: profile and cover photo "will likely be the first thing that people notice" [S2]. In marketing a slightly warmer, more personable photo is fine; party/holiday crops are not. Avoid the public green #OpenToWork frame for scheme applications (see LI-MG-14).
- **Banner**: the one sector where a custom banner earns points. Good: clean branded banner with a one-line positioning statement or a strip of campaign visuals you made (Canva is fine). Bad: default blue banner (neutral, not fatal), or a cluttered stock image. Evidence C/D. Input: screenshot only.

### 2.2 Headline
LinkedIn allows 220 characters (third-party sources; LinkedIn help page not fetched), but only the first ~50-60 show in search snippets, so the target role and strongest proof must come first. Imperial recommends under 120 characters and gives a formula: who you are + something distinctive + what you are seeking [S1]. TARGETjobs compares it to a social bio [S2].

**Formula for marketing_growth:** `[Target role/area] + [Degree, University, grad year] + [one proof point: campaign result, channel, cert or society role]`

Good:
1. `Aspiring Brand Marketer | Business & Management @ UCL '28 | Grew MarketSoc Instagram 1.2k → 4.8k`
2. `Growth & Performance Marketing | Economics, LSE '27 | Ran £300 Meta Ads test at 2.1x ROAS for student startup`
3. `Content & Social Marketing | English, Leeds '27 | TikTok creator (18k followers) | Google Digital Marketing certified`

Bad:
1. `Student at University of Manchester` (no target, no proof, wastes the most-read line)
2. `Passionate, creative, results-driven marketing enthusiast 🚀✨ | Storyteller | Visionary` (adjectives, no evidence; IPA "same generator" problem [S10])
3. `Seeking opportunities | Open to work | Marketing | Finance | Consulting | Tech` (unfocused; signals no sector commitment, which P&G/Unilever explicitly screen for [S11][S12])

### 2.3 About
- Imperial: 100-250 words, bullet points allowed, a summary not a document [S1]. TARGETjobs: write it as if introducing yourself at a networking event [S2]. Platform max is 2,600 characters (third-party sources).
- **Marketing-specific structure (D, tunable):** (1) hook line showing a marketing point of view or the problem you like solving (1-2 sentences); (2) 2-4 proof bullets with numbers (campaign, channel, audience, result); (3) tools/channels line (GA4, Meta Ads Manager, Canva, HubSpot, SQL/Excel); (4) what you are looking for and when (e.g. "Summer 2027 brand or growth internship, London"). 120-250 words.
- In marketing the About is read as a **writing sample**. Grammar, rhythm and specificity matter more than in tech. Clichés ("passionate", "creative storyteller", "results-driven") without proof should be penalised harder here than in the baseline.

### 2.4 Experience (how it differs from CV bullets)
- Same core rule as the CV: "Focus on what you have done personally (use 'I' rather than 'we')" and give specific achievements [S2].
- Differences from CV bullets: (a) LinkedIn entries can be **slightly longer and first-person**, 2-4 bullets or a 2-3 line paragraph; (b) attach **media** to the entry (the campaign deck, a post, the website you built), which the CV cannot do; (c) include **society, freelance, own-brand and creator work as Experience entries** with a title (e.g. "Social Media Lead, UCL Marketing Society"), because in marketing these are the main experience most students have; (d) add the 3-5 most relevant **skills to each role** (LinkedIn lets you tag skills on positions; those do not count toward the 100-skill limit per search-indexed LinkedIn help, not fetched).
- **Marketing metrics that make a bullet strong**: reach/impressions, follower growth, engagement rate, CTR, open rate, sign-ups/conversion, CAC/CPA, ROAS, event attendance, revenue, A/B test lift, budget managed. Vanity metrics without base or timeframe ("went viral") are weak.
- Part-time retail/hospitality jobs: keep them, framed around customers, sales and commercial awareness (Unilever "Commercial Acumen" [S11]).

### 2.5 Featured (highest sector-specific value)
- Featured lets you pin posts, articles, links and uploaded media near the top of the profile. This is the marketing student's portfolio slot. Prospects: a portfolio of "campaigns, content, or data projects" is one of the best ways to show skills [S4]; Portsmouth: own website, SEO, analytics and CMS experience give "an advantage over those who have not" [S6].
- Strong Featured items (2-4): campaign case study PDF (problem, insight, idea, execution, result); a society campaign carousel with results; a Forage/virtual-experience deliverable that you redid in your own words; a personal blog/newsletter/Substack; a short analysis of a brand's campaign (useful for WPP-style "a campaign that inspired you" questions [S14]); a link to own TikTok/Instagram if it is on-brand.
- Weak: certificate images only; a group project PDF with no explanation of your role; anything confidential from an internship.
- Input: screenshot only (not in PDF).

### 2.6 Skills (top 10 for this sector)
Imperial notes endorsements feed LinkedIn search ranking [S1] (mechanism claim, not verified with LinkedIn). LinkedIn allows up to 100 skills (search-indexed LinkedIn help). Recommend 15-30, with the top 5 pinned to the target sub-area.

| # | Skill (use LinkedIn's canonical name) | Table-stakes or differentiator | Notes |
|---|---|---|---|
| 1 | Social Media Marketing | table-stakes | Expected of everyone; only scores if evidenced in Experience/Featured |
| 2 | Content Creation / Copywriting | table-stakes | Prospects lists copywriting [S5] |
| 3 | Marketing Strategy / Brand Management | table-stakes for FMCG | Matches Unilever "Brand visioning and planning" [S11] |
| 4 | Microsoft Excel | table-stakes | Unilever lists Office explicitly [S11] |
| 5 | Market Research / Consumer Insights | differentiator if evidenced (survey, interviews) | P&G "analytical capability" [S12] |
| 6 | Data Analysis / Google Analytics (GA4) | differentiator | Prospects "Data analytics and campaign measurement" [S4] |
| 7 | Performance Marketing / Paid Social (Meta Ads, Google Ads) | differentiator, essential for growth roles | Unilever lists "Performance Marketing" [S11] |
| 8 | Search Engine Optimization (SEO) | differentiator | Prospects [S4], Portsmouth [S6] |
| 9 | A/B Testing / Experimentation (and SQL for growth roles) | strong differentiator for startups | D (no UK source fetched) |
| 10 | Canva / Adobe Creative Suite / CapCut | table-stakes for content roles | Prospects names Photoshop and Canva [S5] |

Also valid: Email Marketing, CRM (HubSpot), Commercial Awareness, Public Speaking, Event Management, AI tools for content (with ethics caveat, see Prospects on "ethical judgement ... when working with AI generated content" [S4]).

### 2.7 Certifications: worth listing vs noise
| Worth listing | Why | Evidence |
|---|---|---|
| Google Digital Marketing / Fundamentals of Digital Marketing (Digital Garage) | Free; Google says it is accredited by IAB Europe and The Open University | B (Google's own blog [S18]) |
| Google Analytics (GA4) certification, Google Ads certifications | Directly tied to measurement and paid search skills employers list [S4] | C/D |
| HubSpot Academy (Inbound, Content, Email Marketing) | Common in startups using HubSpot; signals CRM literacy | C (search-snippet mentions only) |
| Meta Blueprint (if passed exam) | Paid social | D |
| CIM qualifications (Certificate L4, Diploma L6) | The UK professional body; "advantageous but not always required" for grads | A (TARGETjobs [S3], Prospects [S5], York CIM AI course [S8]) |
| Forage / Bright Network virtual experiences (Unilever, L'Oréal etc.) | Fine as **evidence of interest** if 1-2 and paired with what you produced | C |

Noise: 10+ LinkedIn Learning badges; generic "Digital Marketing Masterclass" certificates from unknown course vendors; certificates with no relation to the target; listing a certificate as a top-of-profile achievement when there is no applied work. Rule: certifications **support** evidence, they do not replace it. Cert count above ~6 with no applied work is a negative signal (D).

### 2.8 Education
- List degree, university, expected graduation year. Grades: P&G and Unilever do not publish hard grade cut-offs on the pages I read [S11][S12]; L'Oréal and agencies stress diverse backgrounds [S10][S13]. Listing a 2:1/First or a strong first-year average is a **plus, not a requirement** in this sector (contrast finance). TARGETjobs: anything on top of degree and dates "will help to differentiate yourself" [S2].
- Modules: list 2-4 relevant ones (Consumer Behaviour, Marketing Analytics, Digital Marketing, Statistics) for non-marketing degrees especially; York says you do not need a marketing degree [S8] and the IPA says no degree is required [S10], so module evidence helps humanities/STEM students show relevance.

### 2.9 Activities and societies
Societies are the main experience source for 1st/2nd years. Strongest: marketing/comms/social media roles on society committees with numbers (followers, ticket sales, sponsors), Enactus, student media, running a small brand, case competitions (L'Oréal Brandstorm and similar). WPP-style "curiosity ... outside coursework" and P&G "achievements in ... non-academic activities" back this [S12][S14]. Put real roles in Experience, not only in the Education "Activities" line.

### 2.10 Recommendations
TARGETjobs: "Recruiters and professionals looking at your profile will take notice of this section" [S2]; Imperial: they add credibility and completeness [S1]. Marketing nuance: one recommendation from an internship manager, society president or client (freelance) that names a specific campaign/result beats five generic peer ones. Not required for 1st years. Input: screenshot or self_report (not in PDF).

### 2.11 Activity and posting norms
- **Marketing is the one archetype where posting is positively expected-to-neutral, not risky**, provided it is substantive. Portsmouth explicitly frames blogs, podcasts and LinkedIn discussion as demonstrating communication and digital skills [S6]; Warwick says LinkedIn "is a great platform to share your work and achievements" for marketing/PR (search snippet; page fetch confirmed the sector framing) [S7]; Newcastle and York push following brands and sector news [S8][S9].
- **What counts as good activity**: 1-2 posts a month analysing a campaign, sharing a project result with what you learned, writing up an event with an insight; thoughtful comments on brand/agency leaders' posts.
- **Risky**: engagement-bait, "I'm humbled to announce" posts for trivial achievements, AI-generated generic posts (IPA "same generator" [S10]), posting confidential internship information, controversial takes about a brand you are applying to, and anything unprofessional (Portsmouth: control your online presence [S6]). Old US data on employers rejecting candidates for social content exists but is US and 2017 [S20].
- Posting is **not mandatory**; zero posts should never be scored as a fail. It is a bonus dimension (see weights).

---

## 3. Sector-specific red flags and myths

**Red flags (scorer should catch)**
1. Headline is "Student at X" or a list of 4+ unrelated sectors (no commitment signal).
2. Adjective-heavy self-description with zero numbers ("creative, passionate storyteller").
3. Claims of social media expertise with no link, handle, metric or Featured item to back it.
4. Follower/engagement numbers without baseline, timeframe or platform ("grew account massively").
5. Certificates outnumber real experience entries 3:1 or more.
6. Profile copy that is visibly AI-generic (identical cadence, buzzwords, emoji bullets) [S10].
7. Inconsistency with the CV: titles, dates or metrics differ (risky for Unilever because the form can be pre-filled from LinkedIn [S11]).
8. Unprofessional or off-brand Featured content (party photos, controversial reposts).
9. Public #OpenToWork frame while applying to schemes (signals generic job hunting; mild) [S15].
10. Typos in About/headline: in marketing your writing is the product (Prospects copywriting [S5]; P&G "written English" [S12]).

**Myths (do not encode as rules)**
- "You must post daily / build a big audience to get a marketing job." No UK employer source says this. P&G and Unilever processes don't involve LinkedIn activity at all [S11][S12].
- "Profiles with a photo get 21x more views." LinkedIn company claim, no methodology or date [S19]. Keep the photo rule for professional reasons, not this stat.
- "All-Star / complete profiles are 40x more likely to get opportunities." No traceable primary source found.
- "You need a marketing degree." Contradicted by York [S8], IPA [S10], Unilever [S11].
- "Google/HubSpot certificates get you hired." They are supporting evidence; Prospects' marketing executive page does not even mention Google certificates and stresses work experience and CIM [S5].
- "Recruiters only read the headline / 6 seconds." No traceable study.
- "Endorsement counts matter to recruiters." Imperial says endorsements feed search ranking [S1]; no source says humans weigh endorsement counts. Don't score counts.

---

## 4. Differences by year

| Year | What "good" looks like | Scorer adjustments |
|---|---|---|
| **1st year** (targets: insight days, spring/discovery programmes, society roles) | Complete basics: photo, headline with target area, short About (80-150 words), education with modules, part-time job, 1 society entry. Following 10+ brands/agencies; some alumni connections. Optional: Google Digital Marketing cert. | Featured, recommendations, posting: skip or minor. Metrics in bullets: minor. |
| **Penultimate / 2nd year** (targets: P&G/Unilever/L'Oréal summer internships, agency summer schemes, startup internships) | Headline formula with one proof point; About with 2-4 quantified bullets; at least one marketing-relevant experience (society comms role, freelance, own channel, startup part-time) with numbers; Featured with 1-3 items; 10-20 focused skills; 1-3 relevant certs. | Full rule set. Metrics critical-ish (major); Featured major; recommendations minor. |
| **Final year / masters** (targets: graduate schemes, junior roles, startup growth roles) | All of the above plus a completed internship/placement written with results, 1+ recommendation from a manager, clear sub-area (brand vs growth vs content vs media), consistent with CV. Masters in Marketing: list dissertation topic and method (e.g. consumer survey n=300). | Recommendation rule major; experience-with-metrics critical; generic profile = major. For growth roles, evidence of data tools (GA4/SQL/Excel modelling) major. |

---

## 5. Rule set (overrides/additions to the baseline)

| ID | Rule | Check | Input | Severity | Year adjust | Evidence | Citations |
|---|---|---|---|---|---|---|---|
| LI-MARKETING_GROWTH-01 | **Headline names a marketing target area** (brand, marketing, growth, performance, content, social, media, comms, advertising) in the first 60 characters, and does not list more than 2 unrelated sectors. | RULE: keyword match within chars 0-60 from the marketing bank; count of sector words from other archetypes ≥3 → fail. | pdf_export, screenshot | major | 1st: minor | A | [S1][S2][S3] |
| LI-MARKETING_GROWTH-02 | **Headline contains one concrete proof point** (metric, channel result, notable role, recognised cert or competition) rather than only adjectives. LLM Q: "Does the headline include at least one specific, checkable fact about the student's marketing work?" Pass: "Brand Marketing \| UCL '28 \| Grew MarketSoc IG 1.2k→4.8k". Fail: "Creative, passionate marketing enthusiast". | HYBRID: digit/proper-noun detection, LLM confirms it is a proof point. | pdf_export, screenshot | minor | final: major | C | [S1][S10] |
| LI-MARKETING_GROWTH-03 | **About reads as a strong writing sample**: no typos, clear structure (hook, proof, tools, goal), 100-250 words. LLM Q: "Would a brand manager read this About as well-written, specific and free of clichés?" Pass: "I like finding the one insight that changes a brief. Last term I ran MarketSoc's freshers campaign: 3 TikToks, 210k views, 640 sign-ups (+38% YoY)..." Fail: "I am a highly motivated, passionate and creative individual with a keen interest in marketing and a proven track record of success." | HYBRID: RULE word count (<60 or >350 → fail) + spell-check + cliché density; LLM grades quality. | pdf_export | major | 1st: minor | A | [S1][S2][S5][S12] |
| LI-MARKETING_GROWTH-04 | **About states what the student is looking for and when** (e.g. "Summer 2027 brand or growth internship, London"). | RULE: regex for season/year + (internship\|placement\|graduate\|spring\|insight) in About. | pdf_export | minor | — | D | — |
| LI-MARKETING_GROWTH-05 | **At least one marketing-relevant experience entry** (paid, society, freelance, own channel/brand, startup, competition) appears as an Experience item with a title, not just in Activities. | HYBRID: RULE detects Experience items with marketing keywords in title/description; LLM decides relevance for ambiguous titles. | pdf_export | major | 1st: minor; final: critical | A | [S3][S4][S5][S8][S9] |
| LI-MARKETING_GROWTH-06 | **Marketing bullets carry outcome metrics with a base or timeframe** (reach, followers from→to, engagement rate, CTR, sign-ups, ROAS, budget, attendance). ≥50% of marketing-relevant experience entries have ≥1 such metric. LLM Q: "Is at least one result in this entry quantified with a baseline, timeframe or comparison?" Pass: "Grew society Instagram from 1.2k to 4.8k followers in 6 months; Reels averaged 6.1% engagement". Fail: "Managed social media and increased engagement significantly". | HYBRID: RULE digit/%/£/→ density per entry; LLM checks base/timeframe and attribution ("I" not "we"). | pdf_export | major | 1st: minor; final: critical | A | [S2][S4][S12] |
| LI-MARKETING_GROWTH-07 | **Social/creator claims are backed** by a handle, link, Featured item or metric. LLM Q: "For every claim of social media or content skill, is there a link, handle or number that a recruiter could check?" Pass: "Run @ucl.eats (TikTok, 18k followers); best video 1.1M views". Fail: "Experienced content creator across all platforms". | LLM (on About + Experience + Featured if provided). | pdf_export, screenshot | major | — | B | [S4][S6] |
| LI-MARKETING_GROWTH-08 | **Featured section contains 1-4 portfolio items** (campaign case study, content sample, analysis, website/blog) with the student's role clear. Certificates alone don't count. | HYBRID: from screenshot, count Featured items and classify type; LLM checks it shows the student's own work. If no screenshot: ask self_report "Do you have a Featured item showing a campaign or content you made?" | screenshot, self_report | major | 1st: skip; final: major | A | [S4][S6][S7] |
| LI-MARKETING_GROWTH-09 | **Top/visible skills match the target sub-area**: ≥3 of the top 5 visible skills (PDF "Top Skills" or screenshot) come from the marketing keyword bank (§7), and total skills 10-50. | RULE: keyword match against bank; count. | pdf_export (top skills only), screenshot, self_report (count) | minor | — | B | [S1][S4][S11] |
| LI-MARKETING_GROWTH-10 | **At least one data/measurement skill is evidenced** (GA4, Excel analysis, A/B test, survey analysis, SQL, Looker Studio) in an experience or project, not only listed. For growth/performance targets, raise to major. LLM Q: "Does the profile show the student measuring a marketing result with data, not just creating content?" Pass: "Set up GA4 events for the society site; found 70% mobile drop-off at checkout and fixed the form, lifting ticket conversion from 2.3% to 3.9%". Fail: Skills list says "Google Analytics" with no use anywhere. | HYBRID: RULE keyword find; LLM checks evidence. | pdf_export | minor (brand/content) / major (growth/performance) | 1st: skip | A | [S4][S11][S12] |
| LI-MARKETING_GROWTH-11 | **Certifications are relevant and proportionate**: listed certs are from the worth-listing set (§2.7) or clearly relevant, and the profile has more applied work than certificates (certs ≤ 2× number of marketing-relevant experience/project entries; ≤ ~8 total). | RULE: parse Certifications section, match whitelist, ratio. | pdf_export | minor | 1st: skip ratio check | C | [S3][S5][S18] |
| LI-MARKETING_GROWTH-12 | **No AI-generic or cliché-saturated copy** across headline, About and experience. LLM Q: "Does the profile contain specific details (names, numbers, platforms, outcomes) in most sentences rather than generic buzzwords?" Pass: sentences anchored in named campaigns and numbers. Fail: "Leveraging innovative strategies to drive impactful results in a dynamic landscape." | HYBRID: RULE cliché-list density (passionate, driven, dynamic, leverage, synergy, storyteller, results-driven, innovative, 🚀) > threshold; LLM confirms. | pdf_export | major | — | B | [S10][S4] |
| LI-MARKETING_GROWTH-13 | **Professional photo present and a non-default or neutral banner.** Photo: face clearly visible, only the student. Banner: custom on-brand banner is a bonus, cluttered/unprofessional banner is a fail; default banner passes neutral. | LLM vision on screenshot; self_report fallback ("Do you have a profile photo?"). | screenshot, self_report | major (photo) / minor (banner) | — | A (photo) / D (banner) | [S1][S2] |
| LI-MARKETING_GROWTH-14 | **No public #OpenToWork frame** while targeting graduate schemes or internships at named firms; use "Recruiters only" instead. | LLM vision on screenshot (green frame); self_report fallback. | screenshot, self_report | minor | — | D (rule) / A (mechanism, LinkedIn help) | [S15] |
| LI-MARKETING_GROWTH-15 | **Recent activity, if present, is substantive and on-brand**: posts/comments about campaigns, projects, sector news; no engagement-bait or unprofessional content. Zero activity = not_applicable (not fail). LLM Q: "Do the student's recent posts show marketing thinking (an insight, result or analysis) rather than generic announcements or bait?" Pass: "Why Surreal's billboard campaign works: 3 things I'd steal for our society freshers push..." Fail: "Agree? 👇 Comment 'YES' if you believe in hustle!" | LLM on screenshot of Activity; self_report ("How often do you post?"). | screenshot, self_report | minor (bonus up to +5 in Activity dimension) | 1st: skip | B | [S6][S7][S9] |
| LI-MARKETING_GROWTH-16 | **Recommendation that names specific marketing work** from a manager, society lead or client. | LLM on screenshot; self_report ("Do you have a recommendation from someone who supervised your marketing work?"). | screenshot, self_report | minor | 1st: skip; final: major | B | [S1][S2] |
| LI-MARKETING_GROWTH-17 | **CV-profile consistency** on job titles, dates, employers and metrics (stronger for Unilever, whose form can import LinkedIn). Discrepancy in a metric or title → fail. | HYBRID: RULE field-level diff vs the Placed CV parse; LLM judges whether differences are contradictions or just extra detail. | pdf_export (+ stored CV) | major | — | B | [S11] |
| LI-MARKETING_GROWTH-18 | **Evidence of sector interest beyond coursework**: follows/engages with brands or agencies, competitions (e.g. brand case challenges), virtual experiences, sector events. LLM Q: "Does the profile show at least one marketing activity the student chose to do outside their degree?" Pass: "Finalist, L'Oréal Brandstorm UK 2026" or "Unilever marketing virtual experience: built a launch plan for a Dove line extension". Fail: no marketing activity outside required modules. | HYBRID: keyword bank (competition, Brandstorm, Forage, virtual experience, Advertising Unlocked, society) + LLM. | pdf_export, self_report | major | 1st: minor | A | [S8][S9][S12][S14] |

Count: 18 rules.

### 5.1 Baseline rules this file overrides (severity changes)
- **Baseline "Featured section present"**: raise from minor to **major** for marketing_growth (penultimate/final).
- **Baseline "Activity/posting"**: keep as bonus-only, but allow up to +5 for marketing (vs +2 baseline) via LI-MARKETING_GROWTH-15.
- **Baseline "About quality/typos"**: raise to **major** (writing is the product).
- **Baseline "Banner"**: from not scored to minor bonus.
- **Baseline "Grades in Education"**: keep minor (do not import finance's stricter grade rules).

---

## 6. Scoring weights suggestion (relative to a baseline of equal-ish weights)

Assumed baseline (out of 100): identity/photo 10, headline 12, About 12, experience 25, skills 10, Featured 6, recommendations 5, activity 5, CV consistency 15.

| Dimension | Baseline | marketing_growth | Why |
|---|---|---|---|
| Identity (photo, banner, URL, location) | 10 | 10 | Photo matters; banner adds a small bonus inside this bucket |
| Headline | 12 | 12 | Same weight, stricter content |
| About | 12 | **15** | Read as writing sample [S5][S12] |
| Experience (incl. society/freelance/creator) | 25 | 25 | Still the core, but metrics rule stricter |
| Skills & certifications | 10 | **8** | Table-stakes skills are noisy; certs are support only |
| Featured / portfolio | 6 | **12** | Portfolio evidence is the sector's distinctive signal [S4][S6] |
| Recommendations | 5 | 4 | Nice to have |
| Activity / posting | 5 | **6** (bonus-weighted, never negative for zero posts) | Expected-to-neutral in marketing [S6][S7] |
| CV consistency | 15 | **8** | Still matters (Unilever import [S11]) but LinkedIn here is less a formal screen than in banking |

Totals 100. When Featured/activity can't be checked (PDF only), renormalise across available dimensions and show "score based on PDF only; upload a screenshot of Featured to unlock up to 18 points".

---

## 7. Keyword bank (what recruiters search / what JDs use)

**Role titles**: brand marketing, brand management, assistant brand manager, marketing assistant, marketing executive, marketing coordinator, growth marketing, performance marketing, digital marketing, content marketing, social media, community, CRM, lifecycle, email marketing, media planning, media buying, account executive, account management, strategy/planning (agency), PR, communications, influencer marketing, partnerships, ecommerce, shopper marketing, customer marketing.

**Skills/terms**: brand strategy, brand positioning, consumer insight, market research, segmentation, go-to-market, product launch, campaign management, integrated campaign, content creation, copywriting, storytelling (only with evidence), social media strategy, TikTok, Instagram Reels, YouTube Shorts, community management, influencer, paid social, paid search, PPC, SEO, SEM, programmatic, media planning, retail media, Amazon, ecommerce, CRM, email, A/B testing, experimentation, conversion rate optimisation (CRO), funnel, acquisition, retention, activation, CAC, LTV, ROAS, CTR, CPA, attribution, KPIs, dashboard, commercial awareness, P&L, budget, stakeholder management, presentation, PowerPoint.

**Tools**: Google Analytics 4, Google Ads, Meta Ads Manager, TikTok Ads Manager, LinkedIn Campaign Manager, Google Tag Manager, Looker Studio, Excel (pivot tables, XLOOKUP), SQL (growth), HubSpot, Mailchimp, Klaviyo, Salesforce Marketing Cloud, Hootsuite/Sprout Social/Later, Canva, Adobe Photoshop/Illustrator/Premiere, CapCut, Figma, WordPress, Shopify, Semrush/Ahrefs, Brandwatch/Talkwalker, ChatGPT/Claude/Midjourney (with judgement).

**Credentials**: Google Digital Marketing (Digital Garage), Google Analytics certification, Google Ads certification, HubSpot Inbound/Content/Email, Meta Certified Digital Marketing Associate, CIM Certificate/Diploma, IPA Foundation Certificate (agency hires; usually taken on the job).

**Activity signals**: L'Oréal Brandstorm, Unilever/P&G/L'Oréal virtual experiences, IPA Advertising Unlocked, Enactus, marketing society, student media/radio, own brand/Etsy/Depop shop, creator account.

Sub-area emphasis: **brand/FMCG** → consumer insight, brand, launch, commercial awareness, Excel, retail; **agency** → campaigns, clients, media, creative, presentation; **growth/startup** → acquisition, funnel, experiments, SQL/GA4, CAC/ROAS, paid social.

---

## 8. Worked example: weak 2nd-year profile → improved

**Student**: Aisha, 2nd-year BSc Management, University of Leeds, targeting summer 2027 brand internships (P&G, Unilever, L'Oréal) and startup growth internships. Fictional.

### 8.1 Before (as it appears in the PDF export + screenshot)

- **Photo**: cropped group photo from a ball. **Banner**: default.
- **Headline**: `Student at University of Leeds`
- **About** (68 words): "I am a passionate and highly motivated second year Management student with a keen interest in marketing, finance and consulting. I am a creative thinker and a team player who loves storytelling. I am always eager to learn new things and take on new challenges. Feel free to connect with me!"
- **Experience**:
  - Sales Assistant, Zara (2024-present): "Helped customers. Worked on tills. Restocked shelves."
- **Education**: University of Leeds, BSc Management, 2025-2028. Activities: "Marketing Society, Netball".
- **Skills (top 3 in PDF)**: Teamwork, Communication, Leadership. (12 skills total, all soft.)
- **Certifications**: LinkedIn Learning "Marketing Foundations"; LinkedIn Learning "Excel Essential Training"; LinkedIn Learning "Time Management"; Coursera "Learning How to Learn"; "Digital Marketing Masterclass" (Udemy).
- **Featured**: none. **Recommendations**: none. **Activity**: reposted three company announcements. **Open to Work**: public green frame.

**Score (marketing_growth, penultimate)**: approx. **31/100**.
Failing rules: 01 (no target), 02, 03 (clichés, 68 words), 04, 05 (marketing society not an Experience entry), 06, 08, 09, 10, 11 (5 certs, 0 applied work, several irrelevant), 12, 13 (group photo), 14, 18 (no evidence outside coursework beyond a membership).

### 8.2 After

- **Photo**: head-and-shoulders, plain background. **Banner**: Canva banner, "Brand & growth marketing | consumer insight → campaigns that move numbers", with two small thumbnails of her society campaign. Open to Work switched to "Recruiters only".
- **Headline** (96 chars): `Brand & Growth Marketing | Management, Leeds '28 | Ran MarketSoc freshers campaign: 640 sign-ups`
- **About** (162 words):
  "I like finding the one consumer insight that changes a brief, then proving it with numbers.
  - **Leeds Marketing Society, Social Media Lead**: planned our freshers campaign (3 TikToks, 4 Reels, 1 stall). 210k views, 640 sign-ups, up 38% on last year.
  - **Zara, Sales Assistant**: top-3 in my store for add-on sales in Q4 2025; learned what makes shoppers trade up.
  - **Unilever marketing virtual experience**: built a launch plan for a Dove body-wash extension, sized at ~£4m year-one sales from Kantar-style assumptions.
  Tools: GA4, Meta Ads Manager, Canva, CapCut, Excel (pivots, XLOOKUP).
  I'm looking for a Summer 2027 brand or growth marketing internship in London or Manchester. Happy to talk about student marketing, TikTok formats or why own-label is winning."
- **Experience**:
  - *Social Media Lead, Leeds University Marketing Society* (Sep 2025-present): "Grew Instagram from 1.2k to 3.4k followers in 8 months (Reels avg 6.1% engagement vs 2.4% for static posts). Planned and shot the freshers campaign: 210k views, 640 sign-ups (+38% YoY). Ran a £150 Meta Ads test for our careers fair: £0.42 per registration, 2.1x the organic sign-up rate." Media attached: campaign recap PDF. Skills tagged: Social Media Marketing, Meta Ads, Content Creation.
  - *Sales Assistant, Zara* (Sep 2024-present, part-time): "Top 3 of 22 in store for add-on sales, Q4 2025. Fed weekly customer feedback on fit and sizing to the store manager, which led to a new in-store size guide."
- **Education**: University of Leeds, BSc Management, expected 2028 (must match the CV). Year 1 average 68%. Modules: Consumer Behaviour (74%), Marketing Principles, Business Statistics.
- **Skills (top 5 pinned)**: Social Media Marketing, Brand Management, Consumer Insights, Google Analytics, Microsoft Excel. 18 skills total.
- **Certifications**: Google Digital Marketing (Digital Garage); Google Analytics Certification; HubSpot Content Marketing. (LinkedIn Learning badges removed.)
- **Featured**: (1) Freshers campaign case study PDF (brief, insight, idea, results); (2) LinkedIn post "3 things Surreal's billboards teach student societies"; (3) Unilever virtual-experience launch plan, rewritten in her own words.
- **Recommendation**: from the Marketing Society president, naming the freshers campaign results.
- **Activity**: 2 posts/month (campaign breakdowns), comments on brand/agency posts.

**Score**: approx. **82/100**. Remaining gaps: no paid marketing internship yet (expected for a 2nd year); SQL/experiment evidence would push growth-role fit higher (rule 10 major for startup targets).

---

## 9. Implementation notes for Placed

- Sub-area detection: ask the user (brand/FMCG, agency, growth/startup, content/social) or infer from target jobs; rule 10 severity and keyword-bank emphasis depend on it.
- For PDF-only input, mark 08, 13, 14, 15, 16 as `not_applicable` and show an upload prompt, rather than failing them.
- Metric checks (06, 07, 10) must flag implausible numbers for a student (e.g. "managed £2m budget") for a soft "can you defend this in interview?" warning, mirroring FCQ-11.
- Do not show any of the stats in §0.2 point 4 as facts in the UI.

---

## 10. Citations (all accessed 2026-10-14)

- [S1] "LinkedIn", Imperial College London Careers Service, n.d. (live page), https://imperial.ac.uk/careers/applications-and-interviews/linkedin
- [S2] "The graduate's guide to creating the perfect LinkedIn profile", targetjobs editorial team, 2026 (updated 11 Aug 2026), https://targetjobs.co.uk/careers-advice/finding-a-job/graduates-guide-creating-perfect-linkedin-profile
- [S3] "How do I get a graduate job in marketing?", targetjobs editorial team, 2025 (8 Jul 2025), https://targetjobs.co.uk/careers-advice/marketing-advertising-and-pr/how-do-i-get-graduate-job-marketing
- [S4] "Overview of the UK's marketing, advertising and PR sector", Prospects (Jisc), 2026 (Feb 2026), https://prospects.ac.uk/jobs-and-work-experience/job-sectors/marketing-advertising-and-pr/overview-of-the-uks-marketing-advertising-and-pr-sector
- [S5] "Marketing executive job profile", Prospects (Jisc), 2025 (updated Nov 2025), https://www.prospects.ac.uk/job-profiles/marketing-executive
- [S6] "Marketing, advertising and PR career guide", University of Portsmouth (MyPort), n.d., https://myport.port.ac.uk/guidance-and-support/careers-support/getting-into-your-chosen-career/career-guides/marketing-advertising-and-pr
- [S7] "Should students bother with LinkedIn?", University of Warwick Student Opportunity blog (A. Shoker), 2021, revised 2025, https://warwick.ac.uk/services/careers/blog/should_students_bother_with_linkedin
- [S8] "Advertising, marketing and PR", University of York Careers and Placements, n.d., https://york.ac.uk/students/work-volunteering-careers/options/sectors/advertising
- [S9] "Advertising", Newcastle University Careers Service, n.d., https://www.ncl.ac.uk/careers/explore-your-options/occupations/advertising/
- [S10] "Careers in advertising FAQs", IPA (Institute of Practitioners in Advertising), n.d., https://ipa.co.uk/talent-diversity/careers-in-advertising/a-career-for-you/careers-in-advertising-faqs/
- [S11] "Unilever Future Leadership Programme – Marketing UK" (job posting, 2025 intake cycle; read via WORK180 mirror because careers.unilever.com returned 404), Unilever, 2025, https://work180.com//en-gb/for-women/employer/qualcomm/job/755438/unilever-future-leadership-programme---market (original: https://careers.unilever.com/job/united-kingdom/unilever-future-leadership-programme-marketing-uk/34155/86160028416)
- [S12] "Brand Management Summer Internship 2027" (P&G listing), targetjobs, 2026, https://targetjobs.co.uk/jobs/brand-management-summer-internship-2027-248785
- [S13] "Marketing Graduate Scheme – start date July 26 or Jan 27" / L'Oréal careers, L'Oréal, 2025-26, https://careers.loreal.com/es_ES/jobs/JobDetail/Marketing-Graduate-Scheme-start-date-July-26-or-Jan-27/218455 (fetched page returned generic careers content; scheme details from search snippet only)
- [S14] WPP recruiter interview (BusinessBecause "Inside view: WPP", US MBA context, URL returned 404) and WPP Media "Thrive" future talent scheme listing; search snippets only, not verified: https://businessbecause.com/news/inside-view-top-jobs/2912/inside-view-wpp-mba-recruiter ; https://job-boards.greenhouse.io/wppmedia/jobs/5112213008
- [S15] "Let recruiters know you're open to work", LinkedIn Help, n.d., https://www.linkedin.com/help/linkedin/answer/67405
- [S16] "Save a profile as a PDF", LinkedIn Help, n.d., https://www.linkedin.com/help/linkedin/answer/a541960
- [S17] LinkedIn Help skills articles (100-skill limit; search-indexed, not fetched), LinkedIn, n.d., https://www.linkedin.com/help/linkedin/answer/35265
- [S18] "New partners and courses to develop tomorrow's workforce", Google (The Keyword blog), year not shown on fetch (c. 2019-20), https://www.blog.google/around-the-globe/google-europe/new-partners-and-courses-develop-tomorrows-workforce/
- [S19] "Get more views on your LinkedIn page by using a profile picture", Press and Journal, n.d., https://www.pressandjournal.co.uk/fp/news/1202209/get-views-linkedin-page-using-profile-picture/ (source of the "21x" claim; LinkedIn statement, no methodology)
- [S20] CareerBuilder/Harris Poll social media screening survey, 2017 (US, n=2,380), reported by Staffing Industry Analysts (fetch returned 403; figures from search snippets), https://www.staffingindustry.com/news/global-daily-news/social-media-candidate-screening-record-high-survey-finds
- [S21] "Future of Recruiting 2025", LinkedIn Talent Solutions, 2025, https://business.linkedin.com/content/dam/me/business/en-us/talent-solutions/resources/pdfs/future-of-recruiting-2025-stff.pdf (PDF text not readable on fetch; skills-search statistic unverified)
