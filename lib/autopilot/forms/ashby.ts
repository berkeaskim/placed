import { FormUnavailableError, type FieldType, type FormField, type NormalizedForm } from "./types";
import { wordLimitOf } from "./limits";

const TYPE: Record<string, FieldType> = {
  String: "text", Email: "text", Phone: "text", LongText: "textarea", File: "file", Boolean: "boolean",
  ValueSelect: "select", MultiValueSelect: "multiselect", Date: "date", Location: "location", Number: "text",
};
type AField = { path: string; title: string; type: string; selectableValues?: { label: string; value: string; isArchived?: boolean }[] };

export function ashbyRef(url: string): { org: string; id: string } | null {
  const m = url.match(/ashbyhq\.com\/([^/?#]+)\/([0-9a-f-]{36})/i);
  return m ? { org: m[1], id: m[2] } : null;
}

export const ASHBY_QUERY = "query ApiJobPosting($organizationHostedJobsPageName:String!,$jobPostingId:String!){jobPosting(organizationHostedJobsPageName:$organizationHostedJobsPageName,jobPostingId:$jobPostingId){title applicationForm{sections{fieldEntries{field isRequired}}}}}";

export function parseAshby(json: unknown, org: string, id: string): NormalizedForm {
  const jp = (json as { data?: { jobPosting?: { applicationForm?: { sections: { fieldEntries: { field: AField; isRequired: boolean }[] }[] } } | null } })?.data?.jobPosting;
  if (!jp?.applicationForm) throw new FormUnavailableError();
  const fields: FormField[] = [];
  const seen = new Set<string>();
  for (const s of jp.applicationForm.sections) for (const { field, isRequired } of s.fieldEntries) {
    const type = TYPE[field.type];
    if (!type || seen.has(field.path)) continue;
    seen.add(field.path);
    fields.push({
      key: field.path, target: field.path, label: field.title.trim(), type, required: isRequired,
      options: (field.selectableValues ?? []).filter((v) => !v.isArchived).map((v) => ({ label: v.label, value: v.value })),
      wordLimit: type === "textarea" ? wordLimitOf(field.title) : undefined,
    });
  }
  return { ats: "ashby", url: `https://jobs.ashbyhq.com/${org}/${id}/application`, fields };
}
