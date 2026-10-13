import type { ParsedCV, CvEntry } from "@/lib/types";

const entries = (list: CvEntry[], p: string): CvEntry[] =>
  list.map((e, i) => ({ ...e, id: `${p}${i}`, bullets: e.bullets.map((b, j) => ({ ...b, id: `${p}${i}-b${j}` })) }));

export function assignIds(cv: ParsedCV): ParsedCV {
  return {
    ...cv,
    education: cv.education.map((e, i) => ({ ...e, id: `e${i}`, details: e.details.map((d, j) => ({ ...d, id: `e${i}-d${j}` })) })),
    experience: entries(cv.experience, "x"),
    projects: entries(cv.projects, "p"),
    leadership: entries(cv.leadership, "l"),
  };
}
