import type { LiResolvedRule } from "@/lib/linkedin-rules/types";
import type { LiContext, RuleResult } from "./context";

type Out = Omit<RuleResult, "ruleId">;
const ok = (): Out => ({ status: "pass", evidenceLine: null, fix: null });
const na = (detail?: string): Out => ({ status: "not_applicable", evidenceLine: null, fix: null, ...(detail ? { detail } : {}) });
const fail = (evidenceLine: string | null, fix: string): Out => ({ status: "fail", evidenceLine, fix });

const threshold = (c: LiContext, r: LiResolvedRule, fallback: number) => r.yearAdjust?.[c.year]?.threshold ?? r.params?.threshold ?? fallback;

const about = (c: LiContext) => c.li.about ?? "";
const expText = (c: LiContext) => c.li.experience.map((e) => `${e.title}\n${e.description}`).join("\n");
const eduText = (c: LiContext) => c.li.education.map((e) => `${e.degree ?? ""}\n${e.details}`).join("\n");
/** Everything a skill could be evidenced in: skills, headline, About, Experience, Education, certifications. */
const allText = (c: LiContext) => [c.li.headline ?? "", c.li.topSkills.join("\n"), about(c), expText(c), eduText(c), c.li.certifications.join("\n"), c.li.honors.join("\n")].join("\n");
const linkHay = (c: LiContext) => [...c.li.links, about(c)].join("\n");

const STOPWORDS = new Set(["and", "the", "for", "with", "student", "university"]);
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const GRADE_RE = /\b(First(?:[- ]class)?|2:1|2\.1|Upper Second|2:2|Distinction|Merit|predicted|expected|average|GPA|\d{2}(?:\.\d)?\s?%)/i;
const UK_PLACE_RE = /\b(United Kingdom|UK|England|Scotland|Wales|Northern Ireland|London|Manchester|Birmingham|Leeds|Bristol|Edinburgh|Glasgow|Cambridge|Oxford|Liverpool|Nottingham|Sheffield|Newcastle|Cardiff|Belfast|Coventry|Leicester|Southampton|Brighton|Bath|York|Durham|Warwick|Reading|Exeter|Lancaster|St Andrews|Aberdeen|Dundee|Surrey|Guildford|Canterbury|Norwich|Loughborough)\b/i;
const NOISE_SKILL_RE = /^(Microsoft (Office|Word|Excel|PowerPoint|365)|MS Office|Word|Excel|PowerPoint|Communication|Teamwork|Team Work|Leadership|Social Media|Time Management|Customer Service|Hard[- ]working|Problem Solving|Public Speaking)$/i;
const OFFICE_RE = /^(Microsoft (Office|Word|PowerPoint|Excel|365)|MS Office|Word|PowerPoint|Excel)$/i;
const COMPLETION_CERT_RE = /\b(Coursera|Udemy|LinkedIn Learning|Forage|Job Simulation|Virtual Experience|edX|Codecademy|freeCodeCamp|DataCamp|Great Learning|Simplilearn|Certificate of Completion)\b/i;
const VENDOR_CERT_RE = /\b(AWS|Amazon Web Services|Azure|AZ-\d{3}|DP-\d{3}|PL-300|Google Cloud|GCP|Tableau (Desktop )?(Specialist|Certified)|Databricks|Snowflake|Oracle Certified|CompTIA)\b/i;
const MARKETING_CERT_RE = /\b(Google (Digital|Ads|Analytics)|GA4|Fundamentals of Digital Marketing|HubSpot|Meta (Blueprint|Certified)|Facebook Blueprint|CIM|Chartered Institute of Marketing|Semrush|Hootsuite|TikTok Academy)\b/i;
const PLACEHOLDER_RE = /\b(lorem ipsum|lorem)\b|\[(company|employer|role|title|insert[^\]]*|your [^\]]*|x+)\]|\b(TBD|TBC)\b/i;
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
    const seps = (h.match(/[|·•/]/g) ?? []).length;
    const words: string[] = h.toLowerCase().match(/[a-z][a-z+#.]{2,}/g) ?? [];
    const repeats = words.filter((w, i) => words.indexOf(w) !== i && !STOPWORDS.has(w));
    if (seps > threshold(c, r, 3)) return fail(h, "Cut the headline to one readable phrase with at most 3 separators. Keep the field or target first and one proof point.");
    if (new Set(repeats).size >= 2) return fail(h, `The headline repeats "${[...new Set(repeats)].slice(0, 2).join('", "')}". Say each thing once.`);
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
    if (!loc) return fail(null, "Set your location to the UK city you want to work in (or where you study). Recruiters filter by location.");
    if (!UK_PLACE_RE.test(loc)) return fail(loc, "If you are targeting UK roles, set your location to the UK city you want to work in or study in. If you aren't, ignore this.");
    return ok();
  },
  "LI-GEN-11": (c) => {
    const url = c.li.profileUrl;
    if (!url) return na("no profile URL in export");
    const slug = url.replace(/\/$/, "").split("/in/")[1] ?? "";
    if (/-[0-9a-f]{6,}$/i.test(slug) || /\d{4,}$/.test(slug)) return fail(url, "Claim a custom URL (Edit public profile & URL), e.g. linkedin.com/in/firstname-lastname, and put it on your CV.");
    return ok();
  },
  "LI-GEN-12": (c) => {
    const n = c.li.name;
    if (!n) return na("no name found");
    if (EMOJI_RE.test(n) || /\b(student|hiring|open to work|seeking|intern)\b/i.test(n)) return fail(n, "Keep only your name in the name field. Put your target and status in the headline instead.");
    return ok();
  },
  "LI-GEN-15": (c) => {
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
    if (/github\.com\/|gitlab\.com\/|devpost\.com\/|\.vercel\.app|\.netlify\.app|\.dev\b|\.io\b|portfolio/i.test(linkHay(c))) return ok();
    return fail(null, "Add your GitHub or portfolio under Contact info > Website (or in About) so a reader can see your code in one click.");
  },
  "LI-SOFTWARE_ENG-06": (c) => {
    const top = c.li.topSkills.slice(0, 3);
    if (!top.length) return na("no Top Skills in export");
    const noise = top.find((s) => NOISE_SKILL_RE.test(s.trim()));
    if (noise) return fail(noise, `Pin technical skills (languages, frameworks, CS fundamentals) as your top 3 instead of "${noise}".`);
    return ok();
  },
  "LI-SOFTWARE_ENG-11": (c) => {
    const cur = c.li.education[0];
    if (!cur) return na("no education");
    if (!cur.endYear) return fail(cur.degree, "Add your expected graduation date.");
    const t = `${cur.degree ?? ""}\n${cur.details}`;
    const modules = lexHits(t, ["Algorithms", "Data Structures", "Operating Systems", "Databases", "Distributed", "Compilers", "Machine Learning", "Software Engineering", "Networks", "Computer Architecture", "Security"]);
    if (!GRADE_RE.test(t) && modules.length === 0 && c.year !== "1st")
      return fail(cur.degree, "Add your grade or year average (if 2:1 or above) and 3-6 relevant modules or your group project with its stack.");
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
    const sql = /\b(SQL|PostgreSQL|MySQL|T-SQL|BigQuery|SQLite|Snowflake)\b/i;
    if (c.li.topSkills.some((s) => sql.test(s))) return ok();
    const where = anyLine(allText(c), sql);
    return fail(where, where ? "You use SQL already. Pin it as one of your top 3 skills." : "Add SQL to your skills and pin it, if you can back it with a project or role.");
  },
  "LI-DATA_ANALYTICS-04": (c) => {
    const t = allText(c);
    const lang = /\b(Python|R)\b|\bpandas\b/.test(t);
    const viz = /\b(Power BI|Tableau|Looker|Excel|Data Studio|matplotlib|seaborn|Plotly)\b/i.test(t);
    if (lang && viz) return ok();
    return fail(null, `Show ${!lang ? "Python or R" : "a visualisation/BI tool (Power BI, Tableau, Looker)"} in your skills and in a project where you used it.`);
  },
  "LI-DATA_ANALYTICS-07": (c) => {
    if (/github\.com\/|public\.tableau\.com|kaggle\.com\/|app\.powerbi\.com|observablehq\.com|streamlit\.app|\.github\.io|portfolio/i.test(linkHay(c))) return ok();
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
    const t = [c.li.honors.join("\n"), about(c), expText(c)].join("\n");
    const comp = /\b(olympiad|UKMT|IMO|BMO|MAT|STEP|Putnam|ICPC|Codeforces|AtCoder|Kaggle|competition|challenge|contest|hackathon)\b/i;
    const lines = t.split("\n").filter((l) => comp.test(l));
    if (!lines.length) return na("no competitions listed");
    const ranked = /top \d+%|\b\d+(st|nd|rd|th)\b|medal|distinction|merit|rating|\b\d{3,4}\b|finalist|winner|honourable mention|gold|silver|bronze|rank/i;
    const unranked = lines.find((l) => !ranked.test(l));
    if (unranked) return fail(unranked.trim(), "Add the rank, medal, percentile or rating, and the field size if you know it.");
    return ok();
  },
  "LI-QUANT_TRADING-04": (c) => {
    if (/github\.com\/|gitlab\.com\/|\.github\.io|\.dev\b|\.io\b/i.test(linkHay(c))) return ok();
    if (/\b(project|built|implemented|backtest|simulator|engine|bot)\b/i.test(`${about(c)}\n${expText(c)}`)) return fail(null, "You mention projects: link the code (GitHub or a personal site) under Contact info so it can be checked.");
    return na("no projects claimed");
  },
  "LI-QUANT_TRADING-07": (c, r) => {
    const hits = lexHits(allText(c), ["Python", "Probability", "Statistics", "Linear algebra", "C++", "Algorithms"]);
    const need = threshold(c, r, 3);
    if (hits.length >= need) return ok();
    return fail(null, `Only ${hits.length} of Python, probability, statistics, linear algebra, C++ and algorithms appear. Show at least ${need} where you actually use them.`);
  },
  "LI-QUANT_TRADING-08": (c) => {
    const office = c.li.topSkills.find((s) => OFFICE_RE.test(s.trim()));
    if (office) return fail(office, `Drop "${office}" from your skills; quant firms read office tools as padding.`);
    return ok();
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
      return fail(cur.degree, "Add your grade or average (if 2:1+) and 2-4 relevant modules (HCI, statistics, ML, economics, entrepreneurship).");
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
      return fail(bad, "Use CFA Institute wording: 'CFA Program candidate' (if registered) or 'Passed Level I of the CFA Program'.");
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
  "LI-FINANCE_BANKING-11": (c) => {
    const cur = c.li.education[0];
    if (!cur) return fail(null, "Add your degree to Education with your grade, current average or predicted grade.");
    const t = `${cur.degree ?? ""}\n${cur.details}`;
    if (GRADE_RE.test(t) || (c.year === "1st" && /A[- ]?levels?|IB|A\*/i.test(eduText(c)))) return ok();
    return fail(cur.degree, "State your grade (classification, current average or predicted) on your current degree.");
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
    const hasOutput = c.li.publications.length > 0 || /\b(paper|preprint|arXiv|poster|publication|dissertation|github|code)\b/i.test(`${about(c)}\n${expText(c)}`);
    if (!hasOutput) return na("no outputs or code mentioned");
    if (/orcid\.org\/\d{4}-|scholar\.google|github\.com\/|\.github\.io|researchgate\.net/i.test(linkHay(c))) return ok();
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

/** Rules the export can't decide (Skills count etc.) stay not_applicable until fixtures confirm the export carries them. */
export function runLiCodeChecks(rules: LiResolvedRule[], c: LiContext): RuleResult[] {
  return rules
    .filter((r) => r.check === "code" && !r.advisory)
    .map((r) => {
      const fn = LI_CHECKERS[r.id];
      if (!fn) return { ruleId: r.id, ...na(r.pdfContested ? "needs full skills list (screenshot)" : "not checkable from the PDF export") };
      return { ruleId: r.id, ...fn(c, r) };
    });
}

