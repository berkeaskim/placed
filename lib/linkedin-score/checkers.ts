import type { LiResolvedRule } from "@/lib/linkedin-rules/types";
import type { LiContext, RuleResult } from "./context";
import { GRADE_RE, PLACEHOLDER_RE, RANKED_RE, hasPortfolioLink, headlineRepeats, headlineSegments, isCompetitionLine, isDefaultSlug, isUkLocation, mentionsRLanguage } from "./detectors";

type Out = Omit<RuleResult, "ruleId">;
const ok = (): Out => ({ status: "pass", evidenceLine: null, fix: null });
const na = (detail?: string): Out => ({ status: "not_applicable", evidenceLine: null, fix: null, ...(detail ? { detail } : {}) });
const fail = (evidenceLine: string | null, fix: string): Out => ({ status: "fail", evidenceLine, fix });

const threshold = (c: LiContext, r: LiResolvedRule, fallback: number) => r.yearAdjust?.[c.year]?.threshold ?? r.params?.threshold ?? fallback;

const about = (c: LiContext) => c.li.about ?? "";
/** The input doesn't show the skills list (public page, archive without Skills.csv): rules that read it can't be decided (not a fail). */
const skillsHidden = (c: LiContext) => c.li.skillsScope === "none" || c.li.warnings.includes("public_view_no_skills");
/** The input carries the full skills list, not just the few LinkedIn shows first. */
const fullSkills = (c: LiContext) => c.li.skillsScope === "all";
/** Not assessable from this input: counted in the coverage meter, never a fail (08 #4). */
const notFromInput = (why: string) => na(`input:${why}`);
const expText = (c: LiContext) => c.li.experience.map((e) => `${e.title}\n${e.description}`).join("\n");
const projText = (c: LiContext) => (c.li.projects ?? []).map((p) => `${p.title}\n${p.description}`).join("\n");
const eduText = (c: LiContext) => c.li.education.map((e) => `${e.degree ?? ""}\n${e.details}`).join("\n");
/** Everything a skill could be evidenced in: skills, headline, About, Experience, Education, certifications. */
const allText = (c: LiContext) => [c.li.headline ?? "", c.li.topSkills.join("\n"), about(c), expText(c), projText(c), eduText(c), c.li.certifications.join("\n"), c.li.honors.join("\n")].join("\n");
const linkText = (c: LiContext) => [about(c), projText(c)].join("\n");
const linkHay = (c: LiContext) => [...c.li.links, linkText(c)].join("\n");

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const NOISE_SKILL_RE = /^(Microsoft (Office|Word|Excel|PowerPoint|365)|MS Office|Word|Excel|PowerPoint|Communication|Teamwork|Team Work|Leadership|Social Media|Time Management|Customer Service|Hard[- ]working|Problem Solving|Public Speaking)$/i;
const OFFICE_RE = /^(Microsoft (Office|Word|PowerPoint|Excel|365)|MS Office|Word|PowerPoint|Excel)$/i;
const COMPLETION_CERT_RE = /\b(Coursera|Udemy|LinkedIn Learning|Forage|Job Simulation|Virtual Experience|edX|Codecademy|freeCodeCamp|DataCamp|Great Learning|Simplilearn|Certificate of Completion)\b/i;
const VENDOR_CERT_RE = /\b(AWS|Amazon Web Services|Azure|AZ-\d{3}|DP-\d{3}|PL-300|Google Cloud|GCP|Tableau (Desktop )?(Specialist|Certified)|Databricks|Snowflake|Oracle Certified|CompTIA)\b/i;
const MARKETING_CERT_RE = /\b(Google (Digital|Ads|Analytics)|GA4|Fundamentals of Digital Marketing|HubSpot|Meta (Blueprint|Certified)|Facebook Blueprint|CIM|Chartered Institute of Marketing|Semrush|Hootsuite|TikTok Academy)\b/i;
const MOJIBAKE_RE = /Ã[\u0080-¿]|â€[™œ\u009d“”˜]|�/;

function anyLine(text: string, re: RegExp): string | null {
  return text.split("\n").find((l) => re.test(l))?.trim() ?? null;
}
function lexHits(text: string, terms: string[]): string[] {
  return terms.filter((t) => new RegExp(`(?<![A-Za-z])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\ /g, "\\s+")}(?![A-Za-z])`, "i").test(text));
}

export const LI_CHECKERS: Record<string, (c: LiContext, r: LiResolvedRule) => Out> = {
  "LI-GEN-08": (c, r) => {
    const h = c.li.headline;
    if (!h) return na("no headline");
    const max = threshold(c, r, 4);
    if (headlineSegments(h).length > max) return fail(h, `Cut the headline to at most ${max} parts separated by | . Keep the field or target first and one proof point; a short "SQL · Python" list inside one part is fine.`);
    const repeats = headlineRepeats(h);
    if (repeats.length) return fail(h, `The headline uses "${repeats[0]}" three or more times. Say each thing once.`);
    return ok();
  },
  "LI-GEN-09": (c) => {
    const ed = c.li.education;
    if (!ed.length) return fail(null, "Add your university in Education with degree, subject, start year and expected graduation year. Recruiters filter on graduation year.");
    const cur = ed[0];
    if (!cur.degree) return fail(cur.school, "Add your degree and subject to this Education entry.");
    if (!cur.endYear) return fail(cur.degree, "Add your expected graduation year. Recruiters filter on it, and a missing year can hide you from searches.");
    if (c.year === "masters" && ed.length < 2) return fail(cur.degree, "Masters students should also list their undergraduate degree.");
    return ok();
  },
  "LI-GEN-10": (c) => {
    const loc = c.li.location;
    if (!loc) return fail(null, "Set your location to the city you want to work in (or where you study). Recruiters filter by location.");
    // A non-UK location is the student's call (they may be targeting home): never a fail (08 #6, playbook §8.6).
    if (!isUkLocation(loc)) return na("non-UK location");
    return ok();
  },
  "LI-GEN-11": (c) => {
    const url = c.li.profileUrl;
    if (!url) return na("no profile URL in export");
    const slug = url.replace(/\/$/, "").split("/in/")[1] ?? "";
    if (isDefaultSlug(slug)) return fail(url, "Claim a custom URL (Edit public profile & URL), e.g. linkedin.com/in/firstname-lastname, and put it on your CV.");
    return ok();
  },
  "LI-GEN-12": (c) => {
    const n = c.li.name;
    if (!n) return na("no name found");
    if (EMOJI_RE.test(n) || /\b(student|hiring|open to work|seeking|intern)\b/i.test(n)) return fail(n, "Keep only your name in the name field. Put your target and status in the headline instead.");
    return ok();
  },
  "LI-GEN-15": (c) => {
    // Experience only: projects have no required dates on LinkedIn (08 #7).
    const ex = c.li.experience;
    if (!ex.length) return na("no experience entries");
    const noMonth = ex.find((e) => !e.start?.month || (e.end && !e.end.month));
    if (noMonth) return fail(noMonth.dates, `Use month and year for both dates on "${noMonth.title}" so the timeline reads clearly.`);
    const present = ex.filter((e) => e.end === null);
    const internLong = present.find((e) => /\b(intern|internship|placement|spring|insight)\b/i.test(e.title) && e.start && monthsSince(e.start, c) > 6);
    if (internLong) return fail(internLong.dates, `"${internLong.title}" still says Present. Add the end date if it has finished.`);
    if (present.length > 3) return fail(present[0].dates, "Several roles say Present. Add end dates to any that have finished.");
    return ok();
  },
  "LI-GEN-18": (c, r) => {
    const min = threshold(c, r, 400);
    const a = about(c).trim();
    if (!a) return fail(null, `Add an About section (aim for ${min}+ characters): what you study, one concrete example with a result, and what you are looking for.`);
    if (a.length < min) return fail(firstLine(a), `Your About is ${a.length} characters. Grow it to ${min}+ with one concrete project or role and the role you want.`);
    return ok();
  },
  "LI-GEN-23": (c) => {
    const t = [c.li.headline ?? "", about(c), expText(c)].join("\n");
    const ph = anyLine(t, PLACEHOLDER_RE);
    if (ph) return fail(ph, "Replace the placeholder text with your real details.");
    const mj = anyLine(t, MOJIBAKE_RE);
    if (mj) return fail(mj, "This text has broken characters from copy-paste. Retype the affected words.");
    const paras = t.split(/\n/).map((p) => p.trim()).filter((p) => p.length > 60);
    const dup = paras.find((p, i) => paras.indexOf(p) !== i);
    if (dup) return fail(dup, "This paragraph appears twice. Keep it in one place.");
    return ok();
  },

  // --- software_eng ---
  "LI-SOFTWARE_ENG-01": (c) => {
    if (hasPortfolioLink(c.li.links, linkText(c))) return ok();
    return fail(null, "Add your GitHub or portfolio under Contact info > Website (or in About) so a reader can see your code in one click.");
  },
  "LI-SOFTWARE_ENG-06": (c) => {
    if (skillsHidden(c)) return na("skills not public");
    // A full list's order isn't known to match what the student shows first: not assessable (08 #4, #12).
    if (fullSkills(c)) return notFromInput("top_skills_unknown");
    const top = c.li.topSkills.slice(0, 3);
    if (!top.length) return na("no Top Skills in export");
    const noise = top.find((s) => NOISE_SKILL_RE.test(s.trim()));
    if (noise) return fail(noise, `Put technical skills (languages, frameworks, CS fundamentals) first instead of "${noise}": add them to the Top skills in your About section and reorder your Skills list.`);
    return ok();
  },
  "LI-SOFTWARE_ENG-11": (c) => {
    const cur = c.li.education[0];
    if (!cur) return na("no education");
    if (!cur.endYear) return fail(cur.degree, "Add your expected graduation date.");
    const t = `${cur.degree ?? ""}\n${cur.details}`;
    const modules = lexHits(t, ["Algorithms", "Data Structures", "Operating Systems", "Databases", "Distributed", "Compilers", "Machine Learning", "Software Engineering", "Networks", "Computer Architecture", "Security"]);
    if (!GRADE_RE.test(t) && modules.length === 0 && c.year !== "1st")
      return fail(cur.degree, "Add 3-6 relevant modules or your group project with its stack. Add your grade or year average too if it's 2:1 or above (optional otherwise).");
    return ok();
  },
  "LI-SOFTWARE_ENG-13": (c) => {
    const completion = c.li.certifications.filter((x) => COMPLETION_CERT_RE.test(x) || !VENDOR_CERT_RE.test(x));
    const described = c.li.experience.filter((e) => e.description.length > 80).length;
    if (completion.length > 3 && described < 2) return fail(completion[0], "Many course certificates and few described projects reads as noise. Keep the 1-2 most relevant and describe what you built.");
    return ok();
  },

  // --- data_analytics ---
  "LI-DATA_ANALYTICS-03": (c) => {
    if (skillsHidden(c)) return na("skills not public");
    const sql = /\b(SQL|PostgreSQL|MySQL|T-SQL|BigQuery|SQLite|Snowflake)\b/i;
    const listed = c.li.topSkills.some((s) => sql.test(s));
    // Full list: absent means it's not among the top skills either; present can't show whether it comes first (08 #4).
    if (listed) return fullSkills(c) ? notFromInput("top_skills_unknown") : ok();
    const where = anyLine(allText(c), sql);
    if (where) return fail(where, "You use SQL already. Add it to the Top skills in your About section (up to 5) and reorder your Skills list so it comes first.");
    return fail(null, "Add SQL to your skills, if you can back it with a project or role, and to the Top skills in your About section.");
  },
  "LI-DATA_ANALYTICS-04": (c) => {
    const t = allText(c);
    const lang = /\bPython\b|\bpandas\b/i.test(t) || mentionsRLanguage(t, c.li.topSkills);
    const viz = /\b(Power BI|Tableau|Looker|Excel|Data Studio|matplotlib|seaborn|Plotly)\b/i.test(t);
    if (lang && viz) return ok();
    return fail(null, `Show ${!lang ? "Python or R" : "a visualisation/BI tool (Power BI, Tableau, Looker)"} in your skills and in a project where you used it.`);
  },
  "LI-DATA_ANALYTICS-07": (c) => {
    if (hasPortfolioLink(c.li.links, linkText(c))) return ok();
    return fail(null, "Add a portfolio link (GitHub, Tableau Public, Kaggle or a personal site) under Contact info > Website or in About.");
  },
  "LI-DATA_ANALYTICS-12": (c) => {
    const certs = c.li.certifications;
    if (certs.length > 6) return fail(certs[0], `You list ${certs.length} certifications. Keep the ~6 most relevant, vendor exams first.`);
    if (certs.length > 3 && !certs.some((x) => VENDOR_CERT_RE.test(x))) return fail(certs[0], "Lead with one proctored or vendor certification (PL-300, Tableau, AWS/Azure/GCP), or tie a certificate to a project.");
    return ok();
  },

  // --- quant_trading ---
  "LI-QUANT_TRADING-03": (c) => {
    const t = [c.li.honors.join("\n"), about(c), expText(c), projText(c)].join("\n");
    const lines = t.split("\n").filter(isCompetitionLine);
    if (!lines.length) return na("no competitions listed");
    const unranked = lines.find((l) => !RANKED_RE.test(l));
    if (unranked) return fail(unranked.trim(), "Add the rank, medal, percentile or rating, and the field size if you know it.");
    return ok();
  },
  "LI-QUANT_TRADING-04": (c) => {
    if (hasPortfolioLink(c.li.links, linkText(c))) return ok();
    if ((c.li.projects ?? []).length || /\b(project|built|implemented|backtest|simulator|engine|bot)\b/i.test(`${about(c)}\n${expText(c)}`)) return fail(null, "You mention projects: link the code (GitHub or a personal site) under Contact info so it can be checked.");
    return na("no projects claimed");
  },
  "LI-QUANT_TRADING-07": (c, r) => {
    const hits = lexHits(allText(c), ["Python", "Probability", "Statistics", "Linear algebra", "C++", "Algorithms"]);
    const need = threshold(c, r, 3);
    if (hits.length >= need) return ok();
    return fail(null, `Only ${hits.length} of Python, probability, statistics, linear algebra, C++ and algorithms appear. Show at least ${need} where you actually use them.`);
  },
  "LI-QUANT_TRADING-08": (c) => {
    if (skillsHidden(c)) return na("skills not public");
    const office = c.li.topSkills.find((s) => OFFICE_RE.test(s.trim()));
    if (office) return fail(office, `Drop "${office}" from your skills; quant firms read office tools as padding.`);
    // From the PDF's few top skills, absence says nothing about the rest of the list (08 #4).
    return fullSkills(c) ? ok() : notFromInput("full_skills_needed");
  },
  "LI-QUANT_TRADING-09": (c) => {
    const t = eduText(c);
    if (/\b(Mathematics|Maths|Math|Physics|Statistics|Computer Science|Engineering|Economics and Statistics|Econometrics|Actuarial|Data Science|Operational Research)\b/i.test(t)) return ok();
    const mods = lexHits(t, ["Probability", "Statistics", "Linear Algebra", "Stochastic", "Algorithms", "Econometrics", "Calculus", "Optimisation", "Optimization", "Numerical", "Machine Learning"]);
    if (mods.length >= 2) return ok();
    return fail(c.li.education[0]?.degree ?? null, "List at least 2 quantitative modules (probability, statistics, linear algebra...) in your Education entry.");
  },

  // --- consulting ---
  "LI-CONSULTING-04": (c, r) => {
    const a = about(c).trim();
    const min = r.params?.threshold ?? 400;
    const max = r.params?.majorThreshold ?? 1600;
    if (!a) return fail(null, `Add a short About (${min}-${max} characters): degree, one example with a result, and your target.`);
    if (a.length < min) return fail(firstLine(a), `Your About is ${a.length} characters. Aim for ${min}-${max}.`);
    if (a.length > max) return fail(firstLine(a), `Your About is ${a.length} characters. Cut it to under ${max}: lead with the answer, keep one example.`);
    return ok();
  },

  // --- product ---
  "LI-PRODUCT-13": (c) => {
    const cur = c.li.education[0];
    if (!cur) return na("no education");
    if (!cur.endYear) return fail(cur.degree, "Add your expected graduation year.");
    const t = `${cur.degree ?? ""}\n${cur.details}`;
    if (c.year !== "1st" && !GRADE_RE.test(t) && lexHits(t, ["HCI", "Human-Computer", "Statistics", "Machine Learning", "Economics", "Entrepreneurship", "Design", "Marketing", "Data"]).length === 0)
      return fail(cur.degree, "Add 2-4 relevant modules (HCI, statistics, ML, economics, entrepreneurship). Add your grade or average too if it's 2:1 or above (optional otherwise).");
    return ok();
  },
  "LI-PRODUCT-15": (c) => {
    const shipped = /\b(launched|shipped|built|users|live|app|extension|prototype|MVP)\b/i.test(`${about(c)}\n${expText(c)}`);
    if (c.li.certifications.length > 5 && !shipped) return fail(c.li.certifications[0], "More certificates than shipped work. Add one thing you built (even small) and trim the certificates.");
    return ok();
  },
  "LI-PRODUCT-17": (c) => {
    const t = [c.li.headline ?? "", about(c), c.li.topSkills.join("\n")].join("\n");
    if (lexHits(t, ["product analyst", "business analyst", "growth", "technology consulting", "tech consulting", "operations", "strategy & operations", "strategy and operations"]).length) return ok();
    return fail(c.li.headline, "Entry-level PM roles are rare. Add one adjacent search term you can back up (product analyst, business analyst, growth, operations) to your headline or About.");
  },

  // --- finance_banking ---
  "LI-FINANCE_BANKING-04": (c) => {
    const t = [c.li.name ?? "", c.li.headline ?? "", about(c), c.li.certifications.join("\n")].join("\n");
    const bad = anyLine(t, /\bCFA\s+(Level|L)\s*(I{1,3}|[123])\b|\bCFA candidate\b|\bCFA\s*\(expected|\bLevel\s+(I{1,3}|[123])\s+CFA\b/i);
    if (bad && !/CFA Program candidate|Passed Level (I{1,3}|[123]) of the CFA Program/i.test(bad))
      return fail(bad, "Use CFA Institute wording: 'CFA Program candidate' (only while registered for an upcoming exam or awaiting results) or 'Passed Level I of the CFA Program'.");
    return ok();
  },
  "LI-FINANCE_BANKING-07": (c) => {
    const t = [c.li.headline ?? "", about(c)].join("\n");
    const emoji = anyLine(t, EMOJI_RE);
    if (emoji) return fail(emoji, "Remove emojis from your headline and About; banking readers expect a plain, professional tone.");
    const hype = anyLine(t, /\b(future MD|wolf of wall street|hustle|grind(set)?|money never sleeps|to the moon)\b/i);
    if (hype) return fail(hype, "Drop the slogan and state your degree, target division and one proof point.");
    return ok();
  },
  // Same policy as CV rule G-32: state the grade if it's 2:1 or above; a missing grade is never a fail (08 #9).
  "LI-FINANCE_BANKING-11": (c) => {
    const cur = c.li.education[0];
    if (!cur) return na("no education");
    const t = `${cur.degree ?? ""}\n${cur.details}`;
    if (GRADE_RE.test(t) || (c.year === "1st" && /A[- ]?levels?|\bIB\b|A\*/i.test(eduText(c)))) return ok();
    return na("no grade stated (optional)");
  },

  // --- skills-count rules: only the full list can decide them (archive, or a capture of /details/skills) ---
  "LI-CONSULTING-09": (c) => {
    if (!fullSkills(c)) return notFromInput("full_skills_needed");
    const sk = c.li.topSkills;
    const stakes = sk.filter((s) => /\b(problem[- ]solving|data analysis|analytics|excel|powerpoint|presentation|communication|financial modell?ing|research|strategy)\b/i.test(s));
    if (sk.length < 5) return fail(null, `You list ${sk.length} skill${sk.length === 1 ? "" : "s"}. Add 5-10 you can back up, including problem solving, data analysis, Excel and presentation.`);
    if (sk.length > 10) return fail(null, `You list ${sk.length} skills. Keep the 5-10 most relevant to consulting.`);
    if (stakes.length < 3) return fail(null, "Include at least 3 consulting basics you can back up: problem solving, data analysis, Excel, PowerPoint/presentation, communication.");
    return ok();
  },
  "LI-PRODUCT-10": (c) => {
    if (!fullSkills(c)) return notFromInput("full_skills_needed");
    const sk = c.li.topSkills;
    const filler = sk.find((s) => /^(Microsoft Office|MS Office|Hard[- ]working|Team ?work|Punctual|Motivated)$/i.test(s.trim()));
    if (sk.length < 5) return fail(null, `You list ${sk.length} skill${sk.length === 1 ? "" : "s"}. Add at least 5 you can back up (user research, SQL, A/B testing, Figma...).`);
    if (sk.length > 30) return fail(null, `You list ${sk.length} skills. Trim to the ~30 most relevant to product.`);
    if (filler) return fail(filler, `Drop "${filler}": it reads as filler on a product profile.`);
    return ok();
  },
  "LI-MARKETING_GROWTH-09": (c) => {
    if (!fullSkills(c)) return notFromInput("full_skills_needed");
    const sk = c.li.topSkills;
    const bank = sk.filter((s) => /\b(marketing|brand|branding|content|copywriting|social media|SEO|SEM|PPC|Google Ads|Meta Ads|GA4|Google Analytics|analytics|email|CRM|HubSpot|campaign|growth|community|PR|public relations|Canva|Adobe|video|influencer)\b/i.test(s));
    if (sk.length < 10) return fail(null, `You list ${sk.length} skills. Aim for 10-50, led by the marketing skills you can show.`);
    if (sk.length > 50) return fail(null, `You list ${sk.length} skills. Trim to the 50 most relevant.`);
    if (bank.length < 3) return fail(null, "Fewer than 3 of your skills are marketing ones. Add the channels and tools you've used (social media, GA4, copywriting...).");
    return ok();
  },

  // --- marketing_growth ---
  "LI-MARKETING_GROWTH-01": (c) => {
    const h = c.li.headline;
    if (!h) return fail(null, "Write a headline that names your marketing area (brand, growth, content, social...) in the first 60 characters.");
    if (/\b(brand|marketing|growth|performance|content|social|media|comms|communications|advertising|PR)\b/i.test(h.slice(0, 60))) return ok();
    return fail(h, "Name your marketing area (brand, growth, content, social, comms...) in the first 60 characters of your headline.");
  },
  "LI-MARKETING_GROWTH-04": (c) => {
    const a = about(c);
    if (!a) return na("no About");
    const when = /\b(summer|autumn|spring|winter|20\d{2}|september|january)\b/i.test(a);
    const what = /\b(internship|placement|graduate|grad scheme|spring week|insight|role|position)\b/i.test(a);
    if (when && what) return ok();
    return fail(lastLine(a), "End your About with what you want and when, e.g. 'Looking for a Summer 2027 brand or growth internship in London.'");
  },
  "LI-MARKETING_GROWTH-11": (c) => {
    const certs = c.li.certifications;
    if (!certs.length) return na("no certifications");
    if (certs.length > 8) return fail(certs[0], `You list ${certs.length} certifications. Keep the most relevant (Google, HubSpot, Meta, CIM) and drop the rest.`);
    const relevant = certs.filter((x) => MARKETING_CERT_RE.test(x)).length;
    if (relevant === 0) return fail(certs[0], "None of your certifications are marketing ones. Keep only those relevant to the role.");
    if (c.year !== "1st") {
      const entries = c.li.experience.filter((e) => /\b(marketing|brand|social|content|campaign|growth|comms|media|ads?)\b/i.test(`${e.title} ${e.description}`)).length;
      if (certs.length > 2 * Math.max(1, entries)) return fail(certs[0], "Certificates outnumber your marketing experience. Add a real campaign, society or freelance entry and trim certificates.");
    }
    return ok();
  },

  // --- research ---
  "LI-RESEARCH-08": (c) => {
    const hasOutput = c.li.publications.length > 0 || /\b(paper|preprint|arXiv|poster|publication|dissertation|github|code)\b/i.test(`${about(c)}\n${expText(c)}\n${projText(c)}`);
    if (!hasOutput) return na("no outputs or code mentioned");
    if (/orcid\.org\/\d{4}-|scholar\.google|github\.com\/|\.github\.io|researchgate\.net/i.test(linkHay(c)) || hasPortfolioLink(c.li.links, linkText(c))) return ok();
    return fail(null, "Link your ORCID iD, GitHub or personal site under Contact info (or in About) so readers can check your work.");
  },
};

function firstLine(t: string): string {
  return t.split("\n").find((l) => l.trim())?.trim() ?? t.slice(0, 120);
}
function lastLine(t: string): string {
  return [...t.split("\n")].reverse().find((l) => l.trim())?.trim() ?? t.slice(-120);
}
function monthsSince(start: { year: number; month: number | null }, c: LiContext): number {
  const now = c.today;
  return (now.getFullYear() - start.year) * 12 + (now.getMonth() + 1 - (start.month ?? 1));
}

/** Code checks for the rules this input can carry. A rule with no checker is not_applicable with detail input:unimplemented. */
export function runLiCodeChecks(rules: LiResolvedRule[], c: LiContext): RuleResult[] {
  return rules
    .filter((r) => r.check === "code" && !r.advisory)
    .map((r) => {
      const fn = LI_CHECKERS[r.id];
      // No checker yet: shown in the coverage meter (input:), never silently dropped (08 #20).
    if (!fn) return { ruleId: r.id, ...na("input:unimplemented") };
      return { ruleId: r.id, ...fn(c, r) };
    });
}

