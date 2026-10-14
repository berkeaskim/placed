export type Ats = "greenhouse" | "ashby" | "lever";
export type FieldType = "text" | "textarea" | "select" | "multiselect" | "boolean" | "file" | "date" | "location";
export type FieldOption = { label: string; value: string };
export type FormField = { key: string; label: string; type: FieldType; required: boolean; options: FieldOption[]; wordLimit?: number; target: string };
export type NormalizedForm = { ats: Ats; url: string; fields: FormField[] };
export class FormUnavailableError extends Error {
  constructor(msg = "We couldn't read this form.") { super(msg); }
}
