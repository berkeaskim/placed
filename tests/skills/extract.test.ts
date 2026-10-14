import { describe, it, expect } from "vitest";
import { extractSkills, canonicalize, SKILLS } from "@/lib/skills/extract";

describe("canonicalize", () => {
  it("maps aliases to canonical names", () => {
    expect(canonicalize("JS")).toBe("JavaScript");
    expect(canonicalize("ml")).toBe("Machine Learning");
    expect(canonicalize("MS Excel")).toBe("Excel");
    expect(canonicalize("unknownthing")).toBeNull();
  });
});

describe("extractSkills", () => {
  it("finds lowercase and symbol-heavy skills with word boundaries", () => {
    const s = extractSkills("Built a dashboard in python and sql; some C++ and C# work; used Node.js.");
    expect(s).toEqual(expect.arrayContaining(["Python", "SQL", "C++", "C#", "Node.js"]));
  });
  it("does not match substrings inside other words", () => {
    expect(extractSkills("Javanese culture and rapport building")).not.toContain("Java");
    expect(extractSkills("Rapport")).not.toContain("R");
  });
  it("matches single-letter R only in skill-like context", () => {
    expect(extractSkills("Statistical modelling in R and Python")).toContain("R");
  });
  it("de-duplicates aliases", () => {
    expect(extractSkills("Excel, MS Excel, Microsoft Excel").filter((x) => x === "Excel")).toHaveLength(1);
  });
  it("covers every archetype with at least 8 skills", () => {
    const keys = ["software_eng", "data_analytics", "quant_trading", "consulting", "product", "finance_banking", "marketing_growth", "research"];
    for (const k of keys) expect(SKILLS.filter((s) => s.archetypes.includes(k as never)).length).toBeGreaterThanOrEqual(8);
  });
  it("does not match R&D as R", () => {
    expect(extractSkills("Worked in Marketing, R&D")).not.toContain("R");
  });
  it("does not match common prose with skill-like words", () => {
    const text = "Improved retention and increased revenue; launched a new brand";
    const skills = extractSkills(text);
    expect(skills).toEqual([]);
  });
  it("keeps lower-case aliases of case-sensitive entries insensitive", () => {
    expect(extractSkills("Used PySpark at scale")).toContain("Spark");
    expect(extractSkills("Used pyspark at scale")).toContain("Spark");
  });
  it("matches acronym aliases only in upper case", () => {
    expect(extractSkills("IMO silver medal")).toContain("UKMT");
    expect(extractSkills("BMO round 2")).toContain("UKMT");
    expect(extractSkills("EGMO team")).toContain("UKMT");
    expect(extractSkills("Ran PCR assays")).toContain("Lab Techniques");
    expect(extractSkills("in my imo opinion, the pcr was")).toEqual([]);
  });
  it("does not match generic prose containing framework-like words", () => {
    const text = "The nature of the role: express interest, spring term, rest of team. Science fair… macro team on rates and credit; the fund signal later published a paper";
    const skills = extractSkills(text);
    expect(skills).toEqual([]);
  });
  it("does not match prose with removed ambiguous aliases", () => {
    const text = "We did a hack on the framework, then synthesis of slides for the cluster launch; the ra wrote a paper";
    const skills = extractSkills(text);
    expect(skills).toEqual([]);
  });
  it("does not match C as a skill in C-suite", () => {
    expect(extractSkills("C-suite leadership")).not.toContain("C");
  });
  it("does not match Go as a skill in informal prose", () => {
    expect(extractSkills("Go to market strategy")).not.toContain("Go");
  });
  it("matches C++ and C# with symbols", () => {
    const skills = extractSkills("Experienced in C++ and C# development");
    expect(skills).toContain("C++");
    expect(skills).toContain("C#");
  });
  it("matches Express.js and Spring Boot as qualified forms", () => {
    const skills = extractSkills("Building with Express.js and Spring Boot");
    expect(skills).toContain("Express.js");
    expect(skills).toContain("Spring Boot");
  });
  it("matches REST API and RESTful", () => {
    const skills = extractSkills("Designing REST APIs and RESTful services");
    expect(skills).toContain("REST API");
  });
  it("does not match CV as Computer Vision", () => {
    expect(extractSkills("See my CV for details")).toEqual([]);
  });
  it("matches Excel when mentioned", () => {
    const skills = extractSkills("Proficient in Excel and data analysis");
    expect(skills).toContain("Excel");
  });
  it("matches Python when mentioned", () => {
    const skills = extractSkills("Experience with Python and data science");
    expect(skills).toContain("Python");
  });
  it("matches PostgreSQL only, not SQL alias", () => {
    const skills = extractSkills("Using PostgreSQL and postgresql databases");
    expect(skills).toEqual(["PostgreSQL"]);
  });
  it("does not match false positives from case-insensitive probe", () => {
    const text = "imo it was a swift move in Moscow; I spent a spark of time on prototyping and newsletters, a PCR test, welcome to the team";
    const skills = extractSkills(text);
    expect(skills).toEqual(["Lab Techniques"]); // "a PCR test" legitimately yields Lab Techniques now
  });
  it("matches Swift when capitalized", () => {
    const skills = extractSkills("Built an iOS app in Swift");
    expect(skills).toContain("Swift");
  });
  it("matches Spark when capitalized", () => {
    const skills = extractSkills("Used Apache Spark for data processing");
    expect(skills).toContain("Spark");
  });
  it("matches MoSCoW prioritization method", () => {
    const skills = extractSkills("Prioritised with MoSCoW method");
    expect(skills).toContain("Prioritisation");
  });
  it("extracts realistic tech stack", () => {
    const skills = extractSkills("Built a Python and SQL dashboard in Tableau; used Excel and PowerPoint for a DCF valuation; deployed a React app with Docker on AWS; ran A/B testing");
    expect(skills).toEqual(["Python", "SQL", "Tableau", "Excel", "PowerPoint", "DCF", "Valuation", "React", "Docker", "AWS", "A/B Testing"]);
  });
});

describe("SKILLS vocabulary", () => {
  it("has no duplicate alias mappings", () => {
    const aliasMap = new Map<string, string>();
    const collisions: string[] = [];
    for (const skill of SKILLS) {
      const canonical = skill.canonical.toLowerCase();
      if (aliasMap.has(canonical) && aliasMap.get(canonical) !== skill.canonical) {
        collisions.push(canonical);
      }
      aliasMap.set(canonical, skill.canonical);
      for (const alias of skill.aliases) {
        const lower = alias.toLowerCase();
        if (aliasMap.has(lower) && aliasMap.get(lower) !== skill.canonical) {
          collisions.push(lower);
        }
        aliasMap.set(lower, skill.canonical);
      }
    }
    expect(collisions).toEqual([]);
  });
  it("does not credit skills for generic everyday phrases", () => {
    expect(extractSkills("Ran the data collection script weekly on AWS")).toEqual(["AWS"]);
    expect(extractSkills("Contributor to the student newspaper")).toEqual([]);
    expect(extractSkills("OR for an individual contributor, they develop technical expertise")).not.toContain("Open Source");
    expect(extractSkills("Took a vacation internship at Deloitte")).not.toContain("Research Assistant");
  });
  it("still finds the specific phrasings of those skills", () => {
    expect(extractSkills("Designed a randomised controlled trial with 40 participants")).toContain("Experimental Design");
    expect(extractSkills("Ran a controlled experiment; experimental design in R")).toContain("Experimental Design");
    expect(extractSkills("Open source contributor to pandas")).toContain("Open Source");
    expect(extractSkills("EPSRC vacation bursary in the Physics department")).toContain("Research Assistant");
  });
  it("matches the acronyms MVP, ACL and CPA only in capitals", () => {
    expect(extractSkills("Shipped an MVP in two weeks")).toContain("MVP");
    expect(extractSkills("Shipped a Minimum Viable Product")).toContain("MVP");
    expect(extractSkills("mvp acl cpa")).toEqual([]);
    expect(canonicalize("mvp")).toBe("MVP");
  });
  it("counts ACL only as the NLP conference", () => {
    for (const t of ["Paper accepted at ACL 2026", "First-author paper at ACL", "Published in Findings of ACL", "Reviewer for ACL and EMNLP", "Submitted to the ACL workshop on NLP for education"])
      expect(extractSkills(t), t).toContain("ACL");
    for (const t of ["Recovered from an ACL injury and returned to rugby", "ACL reconstruction rehab", "Configured ACL rules on the firewall", "Rugby captain\nACL tear"])
      expect(extractSkills(t), t).not.toContain("ACL");
  });
  it("counts CPA only as cost per acquisition", () => {
    for (const t of ["Cut CPA by 30% on paid social", "Lowered CPA from £12 to £8", "Tracked CTR, CPA and ROAS weekly", "Optimised CPA across Google Ads campaigns", "Reduced CPA through bid tests"])
      expect(extractSkills(t), t).toContain("CPA");
    for (const t of ["Qualified CPA", "CPA candidate, passed all four exams", "Studying for the CPA exam", "Interned at a CPA firm"])
      expect(extractSkills(t), t).not.toContain("CPA");
  });
});
