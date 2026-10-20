import type { Archetype } from "@/lib/types";
import type { Citation, CvRule } from "../types";
import { BRIGHTON_STEM_CV, NEWCASTLE_ENG_CV } from "./placement";

/**
 * Engineering (ENG) and science/pharma (SCI) rules, plus the STEM rules both share (STM).
 * Design and evidence: research/placement-year/07-engineering-science-sectors.md §2–§5. Grades are the doc's own.
 * Sources the doc could read only through search snippets (403/404) carry " (unverified)" in the title.
 * Professional bodies (IMechE, IET, ICE, RSC, RSB) publish no student CV guide, so the conventions come from
 * university careers services, TARGETjobs and employer adverts.
 */
const ENG: Archetype[] = ["engineering"];
const SCI: Archetype[] = ["science_pharma"];
const STEM: Archetype[] = ["engineering", "science_pharma"];

const BRAND = "Never score employer or university brand.";

export const TJ_ENG_CV: Citation = { title: "CVs and covering letters for engineering graduate jobs", publisher: "TARGETjobs", year: "2026", url: "https://targetjobs.co.uk/careers-advice/engineering/cvs-and-covering-letters-convince-engineering-recruiters-youre-perfect-their-graduate-job" };
const BROOKES_SKILLS_CV: Citation = { title: "Skills-based CV examples", publisher: "Oxford Brookes University", year: "current", url: "https://www.brookes.ac.uk/getmedia/e485d0d7-6d11-4f5a-8fd4-6711643ebd52/skills-based-cv-examples.pdf" };
const BATH_CV: Citation = { title: "CV advice: rinse and repeat (part one) (unverified)", publisher: "University of Bath Careers", year: "2019", url: "https://blogs.bath.ac.uk/careers/2019/11/12/cv-advice-rinse-and-repeat-part-one/" };
const TEESSIDE_GRAD_CV: Citation = { title: "Graduate CV guide (unverified)", publisher: "Teesside University", year: "current", url: "https://www.tees.ac.uk/docs/docrepo/student%20futures/CVgradguide.pdf" };
const UCC_CV: Citation = { title: "Career Services CV guide 2023 (unverified)", publisher: "University College Cork", year: "2023", url: "https://www.ucc.ie/en/media/training/UCC-Career-Services-CV-Guide-2023.pdf" };
const IMECHE_FS: Citation = { title: "Formula Student: the challenge", publisher: "Institution of Mechanical Engineers", year: "current", url: "https://imeche.org/events/formula-student/about-formula-student/the-challenge" };
const IMECHE_AFFILIATE: Citation = { title: "Free affiliate membership for Formula Student participants", publisher: "Institution of Mechanical Engineers", year: "2022", url: "https://imeche.org/news/news-article/free-affiliate-membership-for-fs-challenge-participants" };
const ENGC_FRAUD: Citation = { title: "Fraudulent claims (protected titles)", publisher: "Engineering Council", year: "current", url: "https://www.engc.org.uk/professional-registration/fraudulent-claims/" };
const ENGC_UKSPEC: Citation = { title: "UK-SPEC third edition: key revisions (unverified)", publisher: "Engineering Council", year: "2020", url: "https://www.engc.org.uk/engcdocuments/internet/website/UK-SPEC%20third%20edition%20key%20revisions.pdf" };
const JLR_TCS: Citation = { title: "Industrial Placement 2027–2028, Vehicle Performance (Jaguar TCS Racing) (unverified)", publisher: "TARGETjobs", year: "2026", url: "https://targetjobs.co.uk/jobs/industrial-placement-2027-2028-vehicle-performance-strategy-software-jaguar-tcs-racing-239127" };

const AZ_UIPS: Citation = { title: "12 Month University Industrial Placement, Analytical Chemistry", publisher: "AstraZeneca (WORK180)", year: "2024", url: "https://work180.com/en-gb/for-women/employer/astrazeneca-uk/job/646218/12-month-university-industrial-placement-stud" };
const AZ_UIPS_CV_CAP: Citation = { title: "University Industrial Placement (2-page CV limit) (unverified)", publisher: "AstraZeneca (huntr)", year: "2025", url: "https://huntr.co/job/68b51f76b0b40d004b1cc1ce" };
const ABERDEEN_BMS_CV: Citation = { title: "Sample CV: Biomedical Sciences with Industrial Placement", publisher: "University of Aberdeen Careers", year: "current", url: "https://abdn.ac.uk/uploads/careers/resources/documents/4185.pdf" };
const NOTTINGHAM_TECH_CV: Citation = { title: "Example technical skills CV", publisher: "University of Nottingham Careers", year: "2025", url: "https://www.nottingham.ac.uk/careers/documents/students/example-cvs-cls/technicalskills2025.pdf" };
const LEEDS_FBS: Citation = { title: "FBS placements blog (unverified)", publisher: "University of Leeds", year: "current", url: "https://fbsplacements.leeds.ac.uk/category/uncategorized/" };
const GSK_TIPS: Citation = { title: "GSK application process and tips (unverified)", publisher: "Gradcracker", year: "current", url: "https://www.gradcracker.com/hub/91/gsk/additional-content/2449/application-process-and-tips" };
const GSK_REVIEW: Citation = { title: "GSK analytical chemistry industrial placement review (unverified)", publisher: "RateMyPlacement", year: "current", url: "https://www.ratemyplacement.co.uk/placement-review/173687/gsk/analytical-chemistry-industrial-placement-student" };
const TORONTO_HMB: Citation = { title: "Tailoring your CV for research (unverified)", publisher: "University of Toronto, HMB", year: "current", url: "https://www.hmb.utoronto.ca/node/289" };
const CHARLES_RIVER: Citation = { title: "Industrial Placement (GLP, SOP data recording) (unverified)", publisher: "Charles River", year: "current", url: "https://careers.criver.com/job/Industrial-Placement/1367334700" };
const STAFFS_RSB: Citation = { title: "CVs and cover letters (slides, hosted by The Biologist) (unverified)", publisher: "University of Staffordshire / Royal Society of Biology", year: "current", url: "https://thebiologist.rsb.org.uk/images/CVs__Cover_letters_-_Janet_Turner_Staffs.pdf" };
const DURHAM_COSHH: Citation = { title: "Risk and COSHH assessments (unverified)", publisher: "Durham University Chemistry", year: "current", url: "https://chemsafety.webspace.durham.ac.uk/risk/" };
const RSC_PLACEMENTS: Citation = { title: "Undergraduate placements guide (unverified)", publisher: "Royal Society of Chemistry", year: "current", url: "https://edu.rsc.org/download?ac=535710" };
const RSC_PROFILE: Citation = { title: "Student member profile (unverified)", publisher: "Royal Society of Chemistry", year: "2017", url: "https://www.rsc.org/news-events/profiles/2017/nov/winnie-mac" };

export const STEM_RULES: CvRule[] = [
  // ---------- §2.4 Engineering (ENG) ----------
  {
    id: "ENG-01", sectors: ENG, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Show the engineering tools your discipline uses, grouped in a Technical Skills section: CAD (SolidWorks, CATIA, Siemens NX, Fusion 360), analysis (MATLAB/Simulink, ANSYS, Abaqus, FEA or CFD), and discipline tools (AutoCAD/Revit for civil, PLC/LabVIEW/Altium for electrical, Aspen HYSYS for chemical).",
    llmGuidance: `Does the CV name at least two engineering software tools or methods relevant to the candidate's discipline (CAD, simulation/analysis, programming for engineers, or discipline-specific tools) in a labelled skills or technical section? Office software alone does not count. Never require a specific tool or vendor. ${BRAND}`,
    passExample: "Technical: SolidWorks (CSWA), MATLAB/Simulink, ANSYS Mechanical (FEA), Python",
    failExample: "IT skills: Microsoft Word, PowerPoint, Excel",
    yearAdjust: { "1st": { severity: "minor" } },
    citations: [NEWCASTLE_ENG_CV, BRIGHTON_STEM_CV, JLR_TCS],
  },
  {
    id: "ENG-02", sectors: ENG, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Write up at least one design, build or test project (a group design project, your dissertation, Formula Student, an IMechE or ESA challenge) with your part in it, the tools or method you used and a technical outcome: a test result, a spec met, mass or cost saved, a mark or a placing.",
    llmGuidance: `Is at least one engineering project described with (1) the candidate's own role or component, (2) a named tool or method (CAD, FEA, CFD, hand calculations, prototyping, testing), and (3) a technical outcome (test or simulation result, requirement met, quantity improved, mark, ranking)? Group work passes if the candidate's own part is clear. ${BRAND}`,
    passExample: "Formula Student (suspension sub-team): redesigned the front upright in SolidWorks; FEA showed 1.8 safety factor at 2.5 g braking; 210 g lighter than 2025 car",
    failExample: "Took part in a group design project on suspension",
    yearAdjust: { "1st": { severity: "minor" } },
    citations: [TJ_ENG_CV, BATH_CV, BROOKES_SKILLS_CV, IMECHE_FS],
  },
  {
    id: "ENG-03", sectors: ENG, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "Show hands-on practical skills where you have them: workshop and manufacturing (CNC, lathe, milling, welding, 3D printing, soldering, wiring), lab testing, or site experience for civil roles.",
    llmGuidance: `Does the CV show at least one hands-on practical engineering skill (workshop or manufacturing processes, building or wiring hardware, rig or lab testing, site work) tied to where it was done? A bare word list with no context fails. ${BRAND}`,
    passExample: "Machined the gearbox housing on a manual mill and lathe in the department workshop (Engineering Practice module)",
    failExample: "Practical skills: hands-on, good with tools",
    citations: [BRIGHTON_STEM_CV, BROOKES_SKILLS_CV, IMECHE_FS],
  },
  {
    id: "ENG-04", sectors: ENG, dimension: "impact", check: "llm", severity: "minor", evidence: "C",
    statement: "Show safety, quality or sustainability awareness through something you did, such as writing the risk assessment for a test, working to a standard (Eurocodes, ISO, BS), or designing for lower material or energy use. Don't just write 'safety-conscious'.",
    llmGuidance: `Does the CV show at least one concrete action involving health and safety, risk, quality or sustainability (a risk assessment written, a safety induction or training completed, a standard worked to, a design choice made for sustainability), rather than an adjective alone? ${BRAND}`,
    passExample: "Wrote the risk assessment for the wind-tunnel test campaign; 12 test days with no incidents",
    failExample: "Health and safety aware; passionate about sustainability",
    yearAdjust: { "1st": { skip: true } },
    citations: [ENGC_UKSPEC, BRIGHTON_STEM_CV, TEESSIDE_GRAD_CV],
  },
  {
    id: "ENG-05", sectors: ENG, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "Show engineering beyond the syllabus: Formula Student, Engineers Without Borders, IMechE/IET/ESA challenges, a personal build (Arduino, drone, 3D printer), STEM Ambassador work, or a role in an engineering society.",
    llmGuidance: `Does the CV show at least one self-driven engineering activity outside required coursework (student competition team, engineering challenge, personal hardware or software build, STEM outreach, engineering society role)? Membership alone with no activity is thin but passes if an event or contribution is named. Never require a paid activity. ${BRAND}`,
    passExample: "Built a 3D-printed robotic arm controlled by an Arduino; demoed at the EngSoc open day",
    failExample: "Interests: engineering, cars, technology",
    yearAdjust: { final: { severity: "minor" }, masters: { severity: "minor" } },
    citations: [IMECHE_FS, BROOKES_SKILLS_CV],
  },
  {
    id: "ENG-06", sectors: ENG, dimension: "impact", check: "llm", severity: "minor", evidence: "B",
    statement: "Show teamwork and communication inside technical work: your role in a multidisciplinary team, handing over to another sub-team, or explaining a design to non-engineers.",
    llmGuidance: `Is at least one teamwork or communication claim shown through a concrete technical example (a named team role, an interface with another sub-team, a design review or presentation to non-specialists), not as an adjective? ${BRAND}`,
    passExample: "Presented the brake-system design review to the 30-person team and faculty judges; agreed a mounting interface with the chassis sub-team",
    failExample: "Excellent team player with strong communication skills",
    citations: [TJ_ENG_CV, IMECHE_FS],
  },
  {
    id: "ENG-07", sectors: ENG, dimension: "relevance", check: "llm", severity: "minor", evidence: "C",
    statement: "For design, product or civil roles, a link to a short portfolio (CAD renders, drawings, test videos) next to your contact details helps. It's optional.",
    llmGuidance: `Does the CV link to an engineering portfolio, project page or showcase (personal site, Behance, GrabCAD, a project video)? (Bonus rule: answer not_applicable rather than fail when absent.) ${BRAND}`,
    passExample: "linkedin.com/in/jbloggs · jbloggs-portfolio.co.uk (CAD and test videos)",
    failExample: "Portfolio available",
    citations: [BRIGHTON_STEM_CV],
  },

  // ---------- §3.4 Science and pharma (SCI) ----------
  {
    id: "SCI-01", sectors: SCI, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Name your lab techniques specifically and group them in a Laboratory Skills section: chromatography (HPLC, GC), spectroscopy (NMR, IR, UV-Vis), mass spectrometry, PCR/qPCR, ELISA, gel electrophoresis, cell culture, microscopy, titration, aseptic technique.",
    llmGuidance: `Does the CV name at least three specific laboratory techniques or instruments (not 'lab skills' in general) in a labelled section? Not applicable if the CV shows no lab-based degree or lab work at all (for example a non-lab degree applying to regulatory or clinical operations). Never require a specific technique. ${BRAND}`,
    passExample: "Laboratory: HPLC (Agilent 1260), TLC, NMR interpretation, recrystallisation, aseptic technique",
    failExample: "Good laboratory skills",
    yearAdjust: { "1st": { severity: "minor" } },
    citations: [AZ_UIPS, ABERDEEN_BMS_CV, NOTTINGHAM_TECH_CV],
  },
  {
    id: "SCI-02", sectors: SCI, dimension: "relevance", check: "llm", severity: "major", evidence: "B", allowPartial: true,
    statement: "For each technique, say where you used it and how independently (\"ran independently in the final-year project\", \"observed\"), and list only what you could explain at interview. A long list of techniques you only watched reads as padding.",
    llmGuidance: `Are the listed lab techniques tied to where they were used (module practical, project, placement, job) for most items, with no sign of inflation (techniques only observed presented as skills, or more than ~15 techniques with no context)? Partial: context given for at least 1 but fewer than half of the techniques. ${BRAND}`,
    passExample: "HPLC: method set-up and 40+ runs, final-year project (Dr Smith group); ELISA: 2nd-year immunology practical",
    failExample: "PCR, qPCR, Western blot, flow cytometry, CRISPR, mass spec, NMR, X-ray crystallography, cryo-EM",
    citations: [NOTTINGHAM_TECH_CV, GSK_REVIEW, TORONTO_HMB],
  },
  {
    id: "SCI-03", sectors: SCI, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Write up your lab or research project like a job: the aim, the techniques you used, your own contribution and the result (a yield, purity, assay or test result, or the mark).",
    llmGuidance: `Is at least one lab, practical or research project described with its aim or topic, named techniques, the candidate's own part and a result or mark? ${BRAND}`,
    passExample: "Final-year project: synthesised 3 ibuprofen analogues (62–78% yield), characterised by NMR and HPLC (>98% purity); report 71%",
    failExample: "Did a lab project in organic chemistry",
    yearAdjust: { "1st": { severity: "minor" } },
    citations: [NOTTINGHAM_TECH_CV, LEEDS_FBS],
  },
  {
    id: "SCI-04", sectors: SCI, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "Show you can work to protocols and record data properly: following SOPs, keeping a lab notebook, and GLP or GMP if you've genuinely worked under it. Teaching labs count for SOPs and notebooks, not for GMP.",
    llmGuidance: `Does the CV show the candidate worked to written protocols or SOPs and recorded data properly (lab notebook, electronic lab notebook, data checked or reviewed), or has genuine GLP/GMP exposure (training, a regulated lab or placement)? A bare 'knowledge of GMP' with no context fails. Never require GMP or GLP for a student. ${BRAND}`,
    passExample: "Followed SOPs and kept a bound lab notebook for 10 weeks of QC testing; results second-checked by a supervisor",
    failExample: "Familiar with GMP and GLP",
    citations: [AZ_UIPS, CHARLES_RIVER, STAFFS_RSB],
  },
  {
    id: "SCI-05", sectors: SCI, dimension: "impact", check: "llm", severity: "minor", evidence: "B",
    statement: "Show lab safety through something you did: wrote or followed a COSHH or risk assessment, completed safety training, or handled hazardous materials safely under supervision.",
    llmGuidance: `Does the CV show at least one concrete lab-safety action (risk or COSHH assessment written or followed, safety training completed, safe handling of a named hazard class), not an adjective? Not applicable if the CV shows no lab work. ${BRAND}`,
    passExample: "Wrote COSHH assessments for my project's reagents; completed departmental Cat 2 microbiology training",
    failExample: "Safety-conscious in the lab",
    citations: [ABERDEEN_BMS_CV, DURHAM_COSHH],
  },
  {
    id: "SCI-06", sectors: SCI, dimension: "relevance", check: "llm", severity: "minor", evidence: "B",
    statement: "Name the software you use to analyse and present results: Excel, GraphPad Prism, R or Python, SPSS, ImageJ, ChemDraw, MestReNova, and say what for.",
    llmGuidance: `Does the CV name at least one scientific data-analysis or scientific software tool (beyond Word/PowerPoint) with what it was used for? ${BRAND}`,
    passExample: "GraphPad Prism (dose-response curves, IC50), R (t-tests, ANOVA for project data), ChemDraw",
    failExample: "IT: Microsoft Office",
    citations: [NOTTINGHAM_TECH_CV, ABERDEEN_BMS_CV, LEEDS_FBS],
  },
  {
    id: "SCI-07", sectors: SCI, dimension: "impact", check: "llm", severity: "minor", evidence: "C",
    statement: "Show you can communicate science: a poster, a talk, a lab report mark, a science-outreach role or writing for a student magazine.",
    llmGuidance: `Does the CV show at least one concrete science-communication item (poster, presentation, outreach or STEM Ambassador role, published or marked report, science writing)? ${BRAND}`,
    passExample: "Poster on the Energy for Life module project, presented at the departmental showcase",
    failExample: "Strong written and verbal communication skills",
    citations: [ABERDEEN_BMS_CV, NOTTINGHAM_TECH_CV],
  },
  {
    id: "SCI-08", sectors: SCI, dimension: "uk", check: "llm", severity: "minor", evidence: "C",
    statement: "List funded research or awards, such as an RSC Undergraduate Research Bursary, a summer studentship, or a departmental prize.",
    llmGuidance: `Does the CV list at least one research bursary, studentship, scholarship or academic prize? (Bonus rule: answer not_applicable rather than fail when absent.) ${BRAND}`,
    passExample: "RSC Undergraduate Research Bursary, summer 2026 (8-week project)",
    failExample: "Awards: none",
    citations: [RSC_PLACEMENTS],
  },

  // ---------- §2.5 Shared STEM rules (STM) ----------
  {
    id: "STM-01", sectors: STEM, dimension: "relevance", check: "llm", severity: "major", evidence: "B",
    statement: "List 3–6 modules relevant to this role, with your marks where they're strong (\"Mechanical Design (70%)\"), and a few words on what each covered if it isn't obvious.",
    llmGuidance: `Does the Education entry name at least three modules relevant to the target role? Pass if relevant modules are named, even without marks. Never judge the university's name or prestige, and never fail because marks are absent or modest. ${BRAND}`,
    passExample: "Modules: Thermofluids (68%), Mechanical Design (70%), Materials Engineering (63%)",
    failExample: "BEng Mechanical Engineering, University of X, 2024–2028",
    yearAdjust: { "1st": { severity: "minor" } },
    sectorAdjust: {
      science_pharma: {
        statement: "List 3–6 modules relevant to this role, with marks where they're strong, and say which had substantial practical lab work.",
        citations: [NOTTINGHAM_TECH_CV, ABERDEEN_BMS_CV],
      },
    },
    citations: [TJ_ENG_CV, BRIGHTON_STEM_CV, ABERDEEN_BMS_CV, NOTTINGHAM_TECH_CV, UCC_CV],
  },
  {
    id: "STM-02", sectors: STEM, dimension: "uk", check: "code", checker: "protected_titles", severity: "major", evidence: "B",
    statement: "Don't use professional titles or member grades you don't hold. CEng, IEng and EngTech are protected, and so are member grades like MIMechE. As a student, write 'Student member, IMechE' or 'MEng (IMechE-accredited)'.",
    llmGuidance: "Evidence A for the engineering titles (Engineering Council); the science titles (CChem, CSci, MRSC, MRSB) are unverified, so the rule is graded B overall.",
    sectorAdjust: {
      science_pharma: {
        statement: "Don't use titles or member grades you don't hold (CChem, CSci, MRSC, MRSB). As a student, write 'Student member, Royal Society of Chemistry'.",
      },
    },
    citations: [ENGC_FRAUD],
  },
  {
    id: "STM-03", sectors: STEM, dimension: "relevance", check: "llm", severity: "minor", evidence: "C",
    statement: "If you're a member of a professional body, name it in full with your grade (\"Student member, Institution of Mechanical Engineers\"; \"Student member, Royal Society of Chemistry\"). IMechE affiliate membership is free for STEM undergraduates.",
    llmGuidance: "If a professional body membership is listed, is the body named in full (or a standard acronym expanded once) with the correct student grade? (Bonus rule: answer not_applicable rather than fail when no membership is listed.)",
    passExample: "Professional membership: Student member, The Physiological Society",
    failExample: "Member: IMechE, IET, RSC",
    citations: [BRIGHTON_STEM_CV, ABERDEEN_BMS_CV, IMECHE_AFFILIATE, RSC_PROFILE],
  },
];

/** research/placement-year/07 §2.3 and §3.3: sector wording on shared rules (merged into each rule's sectorAdjust). */
export const STEM_SECTOR_ADJUST = {
  "G-11": {
    engineering: {
      statement: "One or two full A4 pages is normal for engineering. TARGETjobs and university STEM templates set two pages as the maximum; don't spill a few lines onto page two.",
      citations: [TJ_ENG_CV, BRIGHTON_STEM_CV],
    },
    science_pharma: {
      statement: "One or two full A4 pages is normal for science and pharma placements; AstraZeneca caps CVs at two pages. Don't spill a few lines onto page two.",
      citations: [AZ_UIPS_CV_CAP, ABERDEEN_BMS_CV],
    },
  },
  "G-07": {
    engineering: {
      severity: "major",
      statement: "HR often screens engineering CVs before an engineer does. Write tools and terms in full the first time (\"finite element analysis (FEA)\") and say what each project was for in plain words.",
      citations: [NEWCASTLE_ENG_CV, TJ_ENG_CV],
    },
    science_pharma: {
      severity: "major",
      statement: "Write techniques and terms in full the first time (\"high-performance liquid chromatography (HPLC)\"); GSK asks for few acronyms and a simple layout.",
      citations: [GSK_TIPS],
    },
  },
  "G-21": {
    engineering: {
      statement: "Make bullets show what happened because of you: action, context, then result. Results can be a test result, a spec you met, mass or cost saved, a mark, or a placing, not only money.",
      citations: [BROOKES_SKILLS_CV, IMECHE_FS],
    },
    science_pharma: {
      statement: "Make bullets show what happened because of you: action, context, then result. Results can be a yield, purity, assay result, a validated method, samples processed, or a mark, not only money.",
      citations: [NOTTINGHAM_TECH_CV],
    },
  },
} as const satisfies Record<string, Partial<Record<Archetype, NonNullable<CvRule["sectorAdjust"]>[Archetype]>>>;
