import { FormUnavailableError, type FieldType, type FormField, type NormalizedForm } from "./types";
import { wordLimitOf } from "./limits";

type GhField = { name: string; type: string; values?: { label: string; value: number | string }[] };
type GhQ = { label: string; required: boolean; fields: GhField[] };
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
  const j = json as { questions?: GhQ[]; location_questions?: GhQ[] };
  if (!j?.questions) throw new FormUnavailableError();
  const fields: FormField[] = [];
  const seen = new Set<string>();
  for (const q of [...j.questions, ...(j.location_questions ?? [])]) {
    const f = q.fields[0];
    if (!f || seen.has(f.name)) continue;
    let type = TYPE[f.type] ?? null;
    if (!type) continue;
    if (f.name === "location") type = "location";
    seen.add(f.name);
    fields.push({
      key: f.name, target: f.name, label: q.label.trim(), type, required: q.required,
      options: (f.values ?? []).map((v) => ({ label: v.label, value: String(v.value) })),
      wordLimit: type === "textarea" ? wordLimitOf(q.label) : undefined,
    });
  }
  return { ats: "greenhouse", url: `https://job-boards.greenhouse.io/${board}/jobs/${id}`, fields };
}
