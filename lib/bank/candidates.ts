// Pure converters from a parsed CV / LinkedIn profile to bank candidates. No DB imports.
import type { ParsedCV } from "../types";
import type { ParsedLinkedIn } from "../linkedin/parse-export";
import { parseYm } from "./match";
import type { BankSection, CandidateEntry } from "./types";

export type { CandidateEntry } from "./types";

const CV_SECTIONS: BankSection[] = ["experience", "projects", "leadership"];

export function fromParsedCv(cv: ParsedCV): CandidateEntry[] {
  const out: CandidateEntry[] = [];
  for (const section of CV_SECTIONS) {
    for (const e of cv[section] ?? []) {
      const { startYm, endYm } = parseYm(e.dates ?? "");
      out.push({
        section, org: e.org, title: e.title, dates: e.dates ?? "", startYm, endYm, location: e.location ?? "",
        bullets: (e.bullets ?? []).map((b) => ({ text: b.text, sourceText: b.text })),
      });
    }
  }
  return out;
}

const BULLET_START = /^[•·▪\-*]\s*/;

function splitDescription(description: string): string[] {
  return description
    .split("\n")
    .map((l) => l.trim().replace(BULLET_START, "").trim())
    .filter((l) => l.split(/\s+/).filter(Boolean).length >= 4);
}

export function fromLinkedIn(li: ParsedLinkedIn): CandidateEntry[] {
  return (li.experience ?? []).map((e) => {
    const isProject = e.title.startsWith("Project: ");
    const { startYm, endYm } = parseYm(e.dates ?? "");
    return {
      section: isProject ? "projects" : "experience",
      org: e.company,
      title: isProject ? e.title.slice("Project: ".length).trim() : e.title,
      dates: e.dates ?? "",
      startYm, endYm,
      location: e.location ?? "",
      bullets: splitDescription(e.description ?? "").map((text) => ({ text, sourceText: text })),
    };
  });
}
