import { FormUnavailableError, type FieldType, type FormField, type NormalizedForm } from "./types";
import { wordLimitOf } from "./limits";

const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const CARD_TYPE: Record<string, FieldType> = { text: "text", textarea: "textarea", "multiple-choice": "select", dropdown: "select", "multiple-select": "multiselect" };

export function leverRef(url: string): { site: string; id: string } | null {
  const m = url.match(/jobs\.lever\.co\/([^/?#]+)\/([0-9a-f-]{36})/i);
  return m ? { site: m[1], id: m[2] } : null;
}

type Tpl = { fields: { type: string; text: string; required: boolean; options?: { text: string }[] }[] };

export function parseLever(html: string, site: string, id: string): NormalizedForm {
  if (!/name="email"/.test(html)) throw new FormUnavailableError();
  const fields: FormField[] = [];
  const std: [string, string, FieldType, boolean][] = [
    ["resume", "Resume/CV", "file", true], ["name", "Full name", "text", true], ["email", "Email", "text", true],
    ["phone", "Phone", "text", false], ["location", "Current location", "location", false], ["org", "Current company", "text", false],
  ];
  for (const [name, label, type, required] of std) if (html.includes(`name="${name}"`)) fields.push({ key: name, target: name, label, type, required, options: [] });
  for (const m of html.matchAll(/name="(urls\[([^\]]+)\])"/g)) fields.push({ key: m[1], target: m[1], label: m[2], type: "text", required: false, options: [] });
  // Attribute order varies: value before name (recorded fixture) or name before value.
  const cards: [string, string][] = [];
  for (const m of html.matchAll(/value="([^"]*)"\s+name="cards\[([0-9a-f-]+)\]\[baseTemplate\]"/g)) cards.push([m[2], m[1]]);
  for (const m of html.matchAll(/name="cards\[([0-9a-f-]+)\]\[baseTemplate\]"\s+value="([^"]*)"/g)) cards.push([m[1], m[2]]);
  for (const [cardId, raw] of cards) {
    let tpl: Tpl;
    try { tpl = JSON.parse(unescape(raw)) as Tpl; } catch { continue; } // e.g. "(trimmed)"
    (tpl.fields ?? []).forEach((f, i) => {
      const type = CARD_TYPE[f.type];
      if (!type) return;
      const target = `cards[${cardId}][field${i}]`;
      fields.push({ key: target, target, label: f.text.trim(), type, required: f.required,
        options: (f.options ?? []).map((o) => ({ label: o.text, value: o.text })), wordLimit: type === "textarea" ? wordLimitOf(f.text) : undefined });
    });
  }
  if (/name="comments"/.test(html)) fields.push({ key: "comments", target: "comments", label: "Additional information", type: "textarea", required: false, options: [] });
  return { ats: "lever", url: `https://jobs.lever.co/${site}/${id}/apply`, fields };
}
