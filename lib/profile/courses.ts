/** Pure (no database): safe to import from client components. */
import { FIELDS } from "@/lib/validation/onboarding";

export type Field = (typeof FIELDS)[number];

/** Common UK degree names offered as suggestions, each with the broad field Placed files it under. Not exhaustive: any course can be typed. */
export const COURSES: readonly (readonly [string, Field])[] = [
  ["Economics", "Economics"], ["Economics and Statistics", "Economics"], ["Economics and Finance", "Economics"],
  ["Economics and Management", "Economics"], ["Econometrics and Mathematical Economics", "Economics"],
  ["Philosophy, Politics and Economics (PPE)", "Economics"], ["Philosophy and Economics", "Economics"],
  ["Computer Science", "Computer Science"], ["Software Engineering", "Computer Science"], ["Artificial Intelligence", "Computer Science"],
  ["Computer Science and Mathematics", "Computer Science"], ["Information Management for Business", "Computer Science"], ["Cyber Security", "Computer Science"],
  ["Mathematics", "Mathematics"], ["Mathematics with Economics", "Mathematics"], ["Mathematics and Physics", "Mathematics"],
  ["Mathematics, Operational Research, Statistics and Economics (MORSE)", "Mathematics"], ["Actuarial Science", "Mathematics"],
  ["Mechanical Engineering", "Engineering"], ["Electrical and Electronic Engineering", "Engineering"], ["Civil Engineering", "Engineering"],
  ["Chemical Engineering", "Engineering"], ["Aerospace Engineering", "Engineering"], ["Biomedical Engineering", "Engineering"],
  ["General Engineering", "Engineering"], ["Engineering and Management", "Engineering"],
  ["Physics", "Physics"], ["Theoretical Physics", "Physics"], ["Astrophysics", "Physics"],
  ["Management", "Management"], ["Business Management", "Management"], ["Business Administration", "Management"],
  ["International Business", "Management"], ["Marketing", "Management"], ["Management Science", "Management"],
  ["Accounting and Finance", "Finance & Accounting"], ["Finance", "Finance & Accounting"], ["Banking and Finance", "Finance & Accounting"],
  ["Financial Mathematics", "Finance & Accounting"], ["Accounting", "Finance & Accounting"],
  ["Statistics", "Statistics & Data Science"], ["Data Science", "Statistics & Data Science"], ["Statistics, Economics and Finance", "Statistics & Data Science"],
  ["Mathematics and Statistics", "Statistics & Data Science"],
  ["Law (LLB)", "Law"], ["Law with French Law", "Law"], ["Law and Business", "Law"],
  ["Psychology", "Psychology"], ["Psychology and Language Sciences", "Psychology"], ["Experimental Psychology", "Psychology"],
  ["Politics and International Relations", "Politics & IR"], ["International Relations", "Politics & IR"], ["Politics", "Politics & IR"],
  ["European Social and Political Studies", "Politics & IR"], ["Government", "Politics & IR"],
  ["History", "History"], ["Ancient History", "History"], ["History and Politics", "History"],
  ["Natural Sciences", "Natural Sciences"], ["Chemistry", "Natural Sciences"], ["Biology", "Natural Sciences"],
  ["Biochemistry", "Natural Sciences"], ["Biomedical Sciences", "Natural Sciences"], ["Geography", "Natural Sciences"],
  ["Earth Sciences", "Natural Sciences"], ["Neuroscience", "Natural Sciences"],
  ["Medicine", "Other"], ["English Literature", "Other"], ["Modern Languages", "Other"], ["Philosophy", "Other"],
  ["Architecture", "Other"], ["Sociology", "Other"], ["Anthropology", "Other"], ["Classics", "Other"], ["Music", "Other"],
];

const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Degree prefixes and suffixes that say nothing about the subject: "BSc (Hons) Economics" is Economics. */
const DEGREE_WORDS = /\b(bsc|ba|beng|meng|msci|mmath|mphys|mchem|msc|ma|mres|mphil|llb|llm|mba|bba|hons|with honours|degree in|joint honours)\b/g;
export const courseCore = (s: string) => norm(s).replace(DEGREE_WORDS, " ").replace(/\s+/g, " ").trim();

/** Suggestions for what the student typed: names starting with it first, then names containing every word. */
export function searchCourses(query: string, limit = 8): string[] {
  const words = courseCore(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  return COURSES
    .map(([name]) => ({ name, n: norm(name) }))
    .filter(({ n }) => words.every((w) => n.split(" ").some((t) => t.startsWith(w))))
    .sort((a, b) => Number(!a.n.startsWith(words[0])) - Number(!b.n.startsWith(words[0])) || a.n.length - b.n.length)
    .slice(0, limit)
    .map((x) => x.name);
}

/** Keyword rules for a course we don't list. When several match, the one earliest in the name wins (see fieldForCourse). */
const RULES: [RegExp, Field][] = [
  [/\bppe\b|\b(econometric|economic)/, "Economics"],
  [/\b(computer|computing|software|artificial intelligence|machine learning|cyber|informatics)/, "Computer Science"],
  [/\b(data science|statistic|analytics)/, "Statistics & Data Science"],
  [/\b(actuar|accounting|finance|financial|banking)/, "Finance & Accounting"],
  [/\b(math|maths|mathematics|mathematical)/, "Mathematics"],
  [/\b(engineering|mechatronic|robotics)/, "Engineering"],
  [/\b(physics|astrophysics|astronomy)/, "Physics"],
  [/\b(law|legal|llb|llm)\b/, "Law"],
  [/\b(psycholog)/, "Psychology"],
  [/\b(politic|international relations|government|public policy)/, "Politics & IR"],
  [/\b(history|historical)/, "History"],
  [/\b(natural science|chemistry|biology|biochem|biomedical|geograph|geology|earth science|neuroscience|environmental science|pharmac|zoology|genetics)/, "Natural Sciences"],
  [/\b(business|management|marketing|commerce|entrepreneur)/, "Management"],
];

/** The broad field a course belongs to: an exact suggestion, else the first subject in it we recognise, else null (ask the AI). */
export function fieldForCourse(course: string): Field | null {
  // A bare degree name ("LLB") is all signal: keep it when stripping degree words leaves nothing.
  const core = courseCore(course) || norm(course);
  if (!core) return null;
  const listed = COURSES.find(([name]) => (courseCore(name) || norm(name)) === core);
  if (listed) return listed[1];
  // The subject named first leads: "Mathematics with Economics" is Mathematics, "Economics with Mathematics" is Economics.
  let best: { at: number; field: Field } | null = null;
  for (const [re, field] of RULES) {
    const m = core.match(re);
    if (m && m.index !== undefined && (!best || m.index < best.at)) best = { at: m.index, field };
  }
  return best?.field ?? null;
}
