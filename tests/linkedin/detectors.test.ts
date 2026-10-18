import { describe, expect, it } from "vitest";
import {
  FINFLUENCER_PROMO_RE, GRADE_RE, PLACEHOLDER_RE, RANKED_RE, hasPortfolioLink, headlineRepeats, headlineSegments,
  isCompetitionLine, isDefaultSlug, isUkLocation, mentionsRLanguage,
} from "@/lib/linkedin-score/detectors";

/** Fixture tables from the audit (08 #5-#8, #14, #16-#18, #30, #31): at least 10 positive and 10 negative cases each. */
const table = (name: string, fn: (s: string) => boolean, yes: string[], no: string[]) =>
  describe(name, () => {
    expect(yes.length).toBeGreaterThanOrEqual(10);
    expect(no.length).toBeGreaterThanOrEqual(10);
    it.each(yes)("matches %s", (s) => expect(fn(s)).toBe(true));
    it.each(no)("does not match %s", (s) => expect(fn(s)).toBe(false));
  });

table("GRADE_RE (08 #8)", (s) => GRADE_RE.test(s), [
  "Grade: First", "First Class Honours", "2:1", "Predicted 2:1", "Upper Second Class Honours", "Expected First",
  "On track for a First", "68% average", "Year 1 average: 72.5%", "GPA 3.8", "CGPA: 3.62", "Distinction", "Merit",
  "Lower Second", "2.1 (predicted)", "IB 38/45", "38/45 points", "BSc Economics (First, Y1)", "Grade: 1st",
], [
  "Expected graduation: June 2027", "Average module size 30", "Predicted", "First year student", "First-year modules: Statistics, Calculus",
  "Grade: TBC", "Expected June 2027", "GPA", "2027", "Python 3.11", "Merit scholarship recipient", "Modules: Algorithms, Databases",
  "Version 2.10 of the society app", "Activities: Finance Society",
]);

describe("headline segments and repeats (08 #5)", () => {
  // The playbook's own "Good" headlines (00-playbook.md §5): every one must pass LI-GEN-08.
  const good = [
    "2nd-year CS @ UCL | Backend: Go, Python, PostgreSQL | Built a society ticketing app used by 1,200 students | Seeking Summer 2027 SWE internships",
    "MSc Computer Science @ Edinburgh (conversion from Physics) | Python, TypeScript, AWS | Ex-data engineering intern @ [fintech] | Graduate SWE roles 2027",
    "Maths & Stats @ UCL (2nd yr) | Aspiring Data Analyst | SQL · Python (pandas) · Power BI | Seeking 2027 summer internship",
    "Economics @ Manchester | Insight & Analytics placement 2027-28 | Excel · SQL · Tableau | Built NHS A&E wait-time dashboard",
    "Maths & Computer Science @ UCL (2028) | BMO Round 1 Distinction | IMC Prosperity 3: top 5% | Python, C++",
    "MSci Physics, Imperial | Codeforces Expert (1,850) | Probability, statistics, ML",
    "Economics BSc, UCL | Strategy & management consulting | VP, UCL Consulting Society | Winner, 2026 [Firm] Case Challenge",
    "MSc Business Analytics, Imperial | Consulting & data | SQL, Excel, Power BI | Ex-intern, Deloitte Consulting (Technology)",
    "Economics @ UCL '27 | Product & growth | Built a society booking app used by 400+ students | Seeking APM / product internships, Summer 2027",
    "CS @ Imperial '27 | Product + data | Shipped a Chrome extension (1.2k weekly users) · SQL · A/B testing | Product Manager Intern 2027",
    "Economics BSc @ UCL (First, Y1) | Aspiring IBD Analyst | Spring Week @ Barclays '26 | VP, UCL Investment Society",
    "MSc Finance, LSE | Ex-Summer Analyst, Rothschild & Co (M&A) | Seeking 2027 Graduate Analyst roles in Advisory",
    "Aspiring Brand Marketer | Business & Management @ UCL '28 | Grew MarketSoc Instagram 1.2k → 4.8k",
    "Growth & Performance Marketing | Economics, LSE '27 | Ran £300 Meta Ads test at 2.1x ROAS for student startup",
    "MSc Statistics, UCL | Causal inference for health data | R, Stan | Applying for PhDs 2027",
    "Economics BSc, LSE | Interested in labour markets & inequality | Stata, survey data | Research intern, [think tank]",
  ];
  it.each(good)("passes %s", (h) => {
    expect(headlineSegments(h).length).toBeLessThanOrEqual(4);
    expect(headlineRepeats(h)).toEqual([]);
  });
  const stuffed = [
    "Python | SQL | Excel | Tableau | Power BI | Data",
    "Data | Analytics | SQL | Python | Machine Learning",
    "Student • Analyst • Python • SQL • Tableau",
    "Finance | Banking | M&A | Valuation | Modelling | Excel",
    "Marketing | Growth | Brand | Content | Social | SEO",
    "CS • AI • ML • Data • Cloud",
    "Data Science | Data Analytics | Data Engineering | Big Data",
  ];
  it.each(stuffed)("flags %s", (h) => expect(headlineSegments(h).length > 4 || headlineRepeats(h).length > 0).toBe(true));
  it("treats Maths/CS and A/B as words, not separators", () => {
    expect(headlineSegments("Maths/CS @ UCL | A/B testing").length).toBe(2);
  });
});

table("isUkLocation (08 #6, #31)", isUkLocation, [
  "London, England, United Kingdom", "Greater Reading Area", "Hatfield, England", "Stoke-on-Trent, England", "Swansea, Wales",
  "Edinburgh, Scotland", "Belfast, Northern Ireland", "Manchester Area, United Kingdom", "Guildford", "Cambridge, England, United Kingdom",
  "Canterbury, Kent", "United Kingdom",
], [
  "Lagos, Nigeria", "Mumbai, Maharashtra, India", "New York, United States", "Cambridge, Massachusetts, United States", "Greater Boston Area",
  "Toronto, Ontario, Canada", "Dublin, Ireland", "Singapore", "Karachi, Pakistan", "Hong Kong SAR", "Durham, North Carolina, United States",
]);

table("isDefaultSlug (08 #17)", isDefaultSlug, [
  "ayse-demir-4b7a91c2", "jane-doe-1a2b3c4d", "john-smith-a1b2c3", "aisha-khan-9f8e7d6c", "sam-lee-12345678", "priya-patel-0a1b2c3d4",
  "tom-wu-b2c3d4e5", "li-wei-123456", "emma-jones-7c6b5a49", "omar-ali-ab12cd34", "x-y-1234567890",
], [
  "jane-doe-2003", "aisha-khan-2027", "ayse-demir", "jane-abbade", "jsmith", "jane-doe-mba2027", "tom-wu-ucl2026", "sam-lee-123",
  "emma-jones-cfa", "omar-ali-ucl", "li-wei-design",
]);

table("isCompetitionLine (08 #16)", isCompetitionLine, [
  "UKMT Senior Mathematical Challenge: Gold", "British Mathematical Olympiad Round 1", "STEP 2: Grade S", "MAT score 85", "Kaggle competition 2025",
  "IMC Prosperity trading competition", "ICPC UKIEPC 2025", "Codeforces rating 1850", "HackLondon hackathon", "Stock-pitch Challenge, UCL Investment Society",
  "STEP III: 1",
], [
  "My first step into trading", "Next step: a summer internship", "Bought a yoga mat for the society", "Overcame the challenge of remote work",
  "Took the step to lead the team", "Format: mat-based workshops", "Faced tough challenges in retail", "Stepped up as treasurer",
  "Step-by-step guide to DCF", "Mathematics BSc, UCL",
]);

table("RANKED_RE (08 #16)", (s) => RANKED_RE.test(s), [
  "Gold, top 1%", "Placed 2nd of 18 teams", "Ranked 14 of 400", "Silver medal", "Finalist", "Winner, 2026 Case Challenge",
  "Codeforces rating 1850", "Codeforces Expert", "STEP 2: Grade S", "MAT score 85", "Honourable mention", "Top 5%",
], [
  "Kaggle competition 2025", "UKMT Senior Mathematical Challenge", "Took part in IMC Prosperity", "Hackathon in my 1st year",
  "ICPC 2024", "Competed in the Trading Challenge", "Joined a Kaggle contest", "BMO Round 1, 2023", "Participant", "Kaggle competition, 3000 teams entered",
]);

describe("hasPortfolioLink (08 #18)", () => {
  const yes = [
    "Code: github.com/aysedemir", "See https://aysedemir.dev", "Dashboard at public.tableau.com/app/profile/ayse", "kaggle.com/aysed", "aysedemir.github.io",
    "Live at bookit.vercel.app", "www.aysedemir.co.uk", "Portfolio: https://ayse.me/work", "huggingface.co/ayse", "orcid.org/0000-0002-1825-0097",
  ];
  const no = [
    "I manage a portfolio of society events", "Built with Socket.io and Chart.js", "Portfolio management module", "Investment portfolio analysis",
    "Used Node.js and Express", "My portfolio is available on request", "Worked on a portfolio of 40 clients", "React.js, Vue.js", "Socket.io chat app",
    "Read my blog on instagram.com/ayse", "Follow me: twitter.com/ayse",
  ];
  it.each(yes)("finds a link in %s", (t) => expect(hasPortfolioLink([], t)).toBe(true));
  it.each(no)("finds no link in %s", (t) => expect(hasPortfolioLink([], t)).toBe(false));
  it("counts any non-social Contact website", () => {
    expect(hasPortfolioLink(["aysedemir.com"], "")).toBe(true);
    expect(hasPortfolioLink(["instagram.com/ayse"], "")).toBe(false);
  });
});

table("mentionsRLanguage (08 #18)", (t) => mentionsRLanguage(t, []), [
  "Analysed survey data in R", "R programming", "RStudio", "tidyverse and ggplot2", "Python and R", "Python & R", "R, Python, SQL",
  "Built a Shiny app (R)", "using R for regressions", "dplyr pipelines", "R Markdown reports",
], [
  "R&D Intern, GSK", "R&D team", "Computed R-squared", "Product R&D", "Worked in R&D", "Room R101", "R-squared of 0.8",
  "Python, SQL", "Rust developer", "Ran the society's R&D budget",
]);

table("PLACEHOLDER_RE (08 #30)", (t) => PLACEHOLDER_RE.test(t), [
  "Lorem ipsum dolor sit amet", "[Company]", "Analyst at [Employer]", "[Insert achievement]", "[your result]", "TBD", "TBC.", "Team: [TBC]",
  "[xxx]", "Worked at [role]", "lorem",
], [
  "Start date TBC", "Incoming Analyst (team TBC)", "Offer accepted, location TBD", "Graduating 2027", "Analyst at Barclays", "[fintech]",
  "Built a dashboard", "TBC on the rota for June", "Summer 2027 (dates TBC)", "IBD or Markets (TBD after rotation)",
]);

table("FINFLUENCER_PROMO_RE (08 #14)", (t) => FINFLUENCER_PROMO_RE.test(t), [
  "Crypto trader | 300% returns | DM for signals", "Join my Telegram: t.me/ayse_trades", "discord.gg/stonks", "Use my referral link for £20 free shares",
  "Affiliate link in bio", "Free forex signals daily", "Join my paid group", "VIP signals channel", "Copy my trades on eToro", "DM me for tips",
  "Use my code AYSE10",
], [
  "Run a paper portfolio for the society's research team", "Signal processing module", "Signals and Systems (Year 2)", "Made 40% on my ISA this year",
  "Referral from a former manager", "Equity research analyst, UCL Investment Society", "Joined the society's Discord as treasurer",
  "Built a trading signal backtester in Python", "Employee referral programme lead", "Discussed market signals in weekly pitches",
]);
