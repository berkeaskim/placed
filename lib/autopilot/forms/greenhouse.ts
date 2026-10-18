import { FormUnavailableError, type FieldType, type FormField, type NormalizedForm } from "./types";
import { wordLimitOf } from "./limits";

type GhField = { name: string; type: string; values?: { label: string; value: number | string }[] };
type GhQ = { label: string; required: boolean; fields: GhField[] };
// Demographic survey (live Monzo form, 2026-10-17): served apart from `questions`; each renders as a react-select whose
// input id is the bare question id (e.g. #627), plus a consent checkbox #gdpr_demographic_data_consent_given_1.
type GhDemoQ = { id: number; label: string; required?: boolean; type: string; answer_options?: { id: number; label: string }[] };
type GhJson = {
  questions?: GhQ[]; location_questions?: GhQ[]; company_name?: string;
  demographic_questions?: { questions?: GhDemoQ[] } | null;
  data_compliance?: { demographic_data_consent_applies?: boolean }[];
};
const TYPE: Record<string, FieldType | null> = {
  input_text: "text", textarea: "textarea", input_file: "file", input_hidden: null,
  multi_value_single_select: "select", multi_value_multi_select: "multiselect",
};

export function greenhouseRef(url: string): { board: string; id: string } | null {
  const a = url.match(/greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/);
  if (a) return { board: a[1], id: a[2] };
  const b = url.match(/[?&]for=([^&]+).*?[?&]token=(\d+)/);
  return b ? { board: b[1], id: b[2] } : null;
}

export function parseGreenhouse(json: unknown, board: string, id: string): NormalizedForm {
  const j = json as GhJson;
  if (!Array.isArray(j?.questions)) throw new FormUnavailableError();
  const fields: FormField[] = [];
  const seen = new Set<string>();
  for (const q of [...j.questions, ...(j.location_questions ?? [])]) {
    const f = q.fields?.find((x) => x.type === "input_file") ?? q.fields?.[0];
    if (!f || seen.has(f.name)) continue;
    let type = TYPE[f.type] ?? null;
    if (!type) continue;
    if (f.name === "location") type = "location";
    seen.add(f.name);
    fields.push({
      key: f.name, target: f.name, label: String(q.label ?? "").trim(), type, required: q.required,
      options: (f.values ?? []).map((v) => ({ label: v.label, value: String(v.value) })),
      wordLimit: type === "textarea" ? wordLimitOf(String(q.label ?? "")) : undefined,
    });
  }
  fields.push(...demographicFields(j, seen));
  return { ats: "greenhouse", url: `https://job-boards.greenhouse.io/${board}/jobs/${id}`, fields };
}

/** The separate identity survey: EEO selects the student answers once (and Autopilot remembers), plus the survey's consent box, which stays theirs. */
function demographicFields(j: GhJson, seen: Set<string>): FormField[] {
  const raw = j.demographic_questions?.questions;
  const qs = Array.isArray(raw) ? raw : [];
  const out: FormField[] = [];
  for (const q of qs) {
    const type = TYPE[q.type];
    const key = `demographic_${q.id}`;
    if ((type !== "select" && type !== "multiselect") || seen.has(key) || !q.answer_options?.length) continue;
    seen.add(key);
    out.push({
      key, target: String(q.id), label: String(q.label ?? "").trim(), type, required: Boolean(q.required),
      options: q.answer_options.map((o) => ({ label: String(o.label).trim(), value: String(o.id) })),
    });
  }
  if (out.length && j.data_compliance?.some((c) => c.demographic_data_consent_applies)) {
    const who = String(j.company_name ?? "").trim() || "the employer";
    out.push({
      key: "gdpr_demographic_data_consent_given", target: "gdpr_demographic_data_consent_given_1", type: "boolean", required: false, options: [],
      label: `I consent to ${who} collecting, storing and processing my demographic survey answers`,
    });
  }
  return out;
}
