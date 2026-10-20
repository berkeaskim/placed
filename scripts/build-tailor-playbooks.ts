/**
 * Builds lib/tailor/playbook-data.json from the verified research files
 * (docs/research/tailor-playbooks-*.json). Never edit playbook-data.json by hand.
 * Keeps only the prompt-facing guidance (evidence and sources stay in docs/). Exits non-zero on a malformed archetype.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TailorPlaybook } from "@/lib/tailor/playbooks";
import { ARCHETYPES } from "@/lib/types";

const ROOT = path.resolve(__dirname, "..");
const FILES = ["docs/research/tailor-playbooks-tech-product.json", "docs/research/tailor-playbooks-finance-consulting.json", "docs/research/tailor-playbooks-stem.json"];

const out: Record<string, unknown> = {};
for (const f of FILES) {
  const p = path.join(ROOT, f);
  if (!existsSync(p)) { console.warn(`skip: ${f} not found`); continue; }
  const raw = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
  for (const key of ARCHETYPES) {
    if (!(key in raw)) continue;
    const parsed = TailorPlaybook.safeParse(raw[key]);
    if (!parsed.success) { console.error(`${f} ${key}:`, parsed.error.issues.slice(0, 3)); process.exit(1); }
    out[key] = parsed.data;
  }
}
const missing = ARCHETYPES.filter((a) => !(a in out));
if (missing.length) console.warn(`no tailoring playbook for: ${missing.join(", ")}`);
writeFileSync(path.join(ROOT, "lib/tailor/playbook-data.json"), `${JSON.stringify(out, null, 1)}\n`);
console.log(`wrote ${Object.keys(out).length} playbooks`);
