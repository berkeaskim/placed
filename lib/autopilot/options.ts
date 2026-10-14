import type { FieldOption } from "./forms/types";
import { vaultValue, type Core, type VaultKey } from "./vault";

export type OptionMatch = { value: string; label: string } | { ambiguous: true; candidates: FieldOption[] };
export const CONFIRM_KEYS: ReadonlySet<VaultKey> = new Set<VaultKey>(["rtw_uk", "needs_sponsorship"]);

const RTW_RULES: Record<Core["rtw_uk"], (t: string) => boolean> = {
  citizen_or_settled: (t) => /citizen|settled|permanent residen|indefinite leave/.test(t) && !/visa/.test(t) && !/\bnot\b|\bnon-/.test(t),
  visa_permanent: (t) => /visa|permit/.test(t) && /permanent/.test(t),
  visa_temporary: (t) => /visa|permit/.test(t) && /temporar|limited/.test(t),
  needs_sponsorship: (t) => /sponsor/.test(t) && !/\bdo\s+not\s+have|\bno\s+sponsor|\bnot\s+(need|require).*?sponsor|\bwithout\s+sponsor/.test(t),
};
const norm = (s: string) => s.toLowerCase().replace(/[\u2018\u2019]/g, "'").trim(); // fold curly apostrophes

function one(options: FieldOption[], pred: (t: string) => boolean): OptionMatch {
  const hits = options.filter((o) => pred(norm(o.label)));
  return hits.length === 1 ? { value: hits[0].value, label: hits[0].label } : { ambiguous: true, candidates: options };
}

export function matchOption(key: VaultKey, core: Partial<Core>, options: FieldOption[]): OptionMatch {
  if (key === "rtw_uk" && core.rtw_uk) return one(options, RTW_RULES[core.rtw_uk]);
  if (key === "needs_sponsorship" && core.needs_sponsorship) {
    const want = core.needs_sponsorship === "yes" ? /^yes\b/ : /^no\b/;
    return one(options, (t) => want.test(t));
  }
  if (key === "grad_year" && core.grad_year) return one(options, (t) => new RegExp(`\\b${core.grad_year}\\b`).test(t));
  const v = vaultValue(core, key);
  if (!v) return { ambiguous: true, candidates: options };
  return one(options, (t) => t === norm(v));
}
