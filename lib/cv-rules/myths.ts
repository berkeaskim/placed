/**
 * Debunked or overstated CV myths — docs/research/cv-rules-general.md §3 (M1–M11), plus M12–M13 from the
 * 2026-10-13 amendments (market-2026 report 03 §3 N3 and report 02 §3).
 */
export const MYTHS: { id: string; myth: string; verdict: string; sources: string }[] = [
  {
    id: "M1",
    myth: "75% of CVs are rejected by ATS before a human sees them.",
    verdict:
      "Unsupported. The figure traces back to a 2012 sales claim by Preptel, a CV-optimisation company that closed in 2013 and never published a method or sample. ATS software parses, stores, searches and ranks; auto-rejection mainly happens through knockout questions (right to work, location). Rigid filters can still screen people out, so \"ATS never matters\" is also wrong.",
    sources:
      "HiringThing blog citing Christine Assaf's investigation (2022), https://blog.hiringthing.com/applicant-tracking-system-myths; Enhancv recruiter interviews (2025, n=25 US, vendor) via IT Brief UK, https://itbrief.co.uk/story/study-reveals-ats-rarely-auto-rejects-cvs-debunks-75-myth; HR Dive on HBS/Accenture Hidden Workers (2021), https://www.hrdive.com/news/report-applicant-tracking-systems-may-exclude-whole-segments-of-candidates/606614/; University of Nottingham Careers (2026)",
  },
  {
    id: "M2",
    myth: "Recruiters read your CV for exactly 6 / 7.4 seconds.",
    verdict:
      "Overstated. It comes from Ladders, which sells CV-writing services: the 2012 study had 30 recruiters and was not peer-reviewed, and the 2018 follow-up published no sample or protocol. Treat it as a reason to make key facts scannable, not as a law.",
    sources:
      "Ladders eye-tracking report (2012), https://www.bu.edu/com/files/2018/10/TheLadders-EyeTracking-StudyC2.pdf; HR Dive (2018); ERE, \"Is the 6-second resume scan a myth?\", https://www.ere.net/articles/is-the-6-second-resume-scan-a-myth",
  },
  {
    id: "M3",
    myth: "ATS can't read PDFs, always send Word.",
    verdict:
      "False for major ATS. Greenhouse, Workday, Lever, iCIMS and Taleo all support PDF. The real risks are image-based PDFs, columns/tables and content in headers or footers. Follow the employer's stated format.",
    sources: "Greenhouse, Workday and Oracle Taleo documentation (see G-01)",
  },
  {
    id: "M4",
    myth: "A UK CV must be one page.",
    verdict:
      "Sector-dependent. The UK norm is up to two A4 pages. One page suits most early students and is expected in banking; some employers find one page too thin.",
    sources: "Prospects (2025); University of Manchester Careers; LSE Careers",
  },
  {
    id: "M5",
    myth: "Paste the job description in white text to beat the ATS.",
    verdict:
      "Counterproductive. The parsed text is what recruiters search and see, and the original file is kept for human review. There is no evidence it works.",
    sources: "Greenhouse Support, \"Search resumes for keywords\"; University of Nottingham Careers (2026)",
  },
  {
    id: "M6",
    myth: "Employers don't care about a couple of typos.",
    verdict: "False. Two errors cost about 7 percentage points of interview probability, and five errors about 19 points.",
    sources: "Sterkens et al. (2023), PLOS ONE, https://doi.org/10.1371/journal.pone.0283280",
  },
  {
    id: "M7",
    myth: "Every graduate employer requires a 2:1.",
    verdict:
      "No longer true for most. 47% of large UK graduate employers required a 2:1 in 2024/25 (71% in 2015/16); 20% accept a 2:2 and 23% set no minimum. State your grade whatever it is: forms ask anyway.",
    sources: "ISE via Prospects Luminate, \"Early careers recruitment in 2025\" (Oct 2025), https://luminate.prospects.ac.uk/early-careers-recruitment-in-2025-integrity-inclusion-entry-standards",
  },
  {
    id: "M8",
    myth: "Add a photo to stand out.",
    verdict:
      "Not UK convention: UK careers services say a photo isn't usual on a UK CV, and it invites bias. Use the space for evidence instead.",
    sources: "University of Manchester Careers (\"It is not usual practice to use a photograph on a UK CV\"); LSE Careers; Nuffield College CSI/GEMM (2019) on ethnic penalties in UK callbacks",
  },
  {
    id: "M9",
    myth: "AI screens and scores every UK student application.",
    verdict:
      "Overstated for the UK. 95% of students believe employers use AI to shortlist, but ISE reports employer AI use in hiring is currently minimal and assessment is mostly human-led.",
    sources: "ISE (2026), https://ise.org.uk/knowledge/insights/569/students_use_ai_to_compete_yet_oppose_ai_assessment",
  },
  {
    id: "M10",
    myth: "A personal statement is mandatory.",
    verdict:
      "Optional. TARGETjobs argues most graduate profiles are generic and add little; Prospects explains how to write a good one. A generic profile is worse than none.",
    sources: "TARGETjobs (2023); Prospects (2025)",
  },
  {
    id: "M11",
    myth: "Quantified CVs get 40% / 4x more callbacks.",
    verdict:
      "Unverified marketing figures. Quantifying is widely recommended, but these specific numbers come from CV-builder blogs with no published method. Don't use them in product copy.",
    sources: "n/a (identified to avoid)",
  },
  {
    id: "M12",
    myth: "Aim for a 75–80% keyword match score.",
    verdict:
      "No evidence base. No ATS vendor publishes a match-percentage threshold; vendors use per-job bands or grades (Strong/Good/Partial/Limited, A–D). The 75–80% figure comes from Jobscan's own product blog, and Jobscan itself warns that going above 75% may require overstuffing.",
    sources:
      "Jobscan, \"What Jobscan match rate should I aim for?\" (commercial), https://www.jobscan.co/blog/what-jobscan-match-rate-should-i-aim-for/; ATS vendor documentation reviewed in market-2026 report 03 (F17)",
  },
  {
    id: "M13",
    myth: "Recruiters spend 6 seconds on a CV.",
    verdict:
      "The \"6 seconds\" figure comes from a commercial study with an unpublished method. One recruiter dataset (experienced engineers, US tech) found a median of about 30 seconds. Either way the first look is short and focuses on titles, organisations, dates and education. In a Swedish study, longer dwell time didn't predict a higher rating.",
    sources:
      "interviewing.io (2024, commercial, experienced US engineers), https://interviewing.io/blog/are-recruiters-better-than-a-coin-flip-at-judging-resumes; Osanami Törngren et al., Frontiers in Sociology (2024, dwell time vs rating only), https://www.frontiersin.org/journals/sociology/articles/10.3389/fsoc.2024.1222850/full; Ladders eye-tracking report (2012, commercial), https://www.bu.edu/com/files/2018/10/TheLadders-EyeTracking-StudyC2.pdf",
  },
];
