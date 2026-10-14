import type { FieldOption } from "./forms/types";
import { vaultValue, type Core, type VaultKey } from "./vault";

export type OptionMatch = { value: string; label: string } | { ambiguous: true; candidates: FieldOption[] };
export const CONFIRM_KEYS: ReadonlySet<VaultKey> = new Set<VaultKey>(["rtw_uk", "needs_sponsorship"]);

const RTW_RULES: Record<Core["rtw_uk"], (t: string) => boolean> = {
  citizen_or_settled: (t) => /citizen|settled|permanent residen|indefinite leave/.test(t) && !/visa/.test(t),
  visa_permanent: (t) => /visa|permit/.test(t) && /permanent/.test(t),
  visa_temporary: (t) => /visa|permit/.test(t) && /temporar|limited|student|graduate/.test(t) && !/sponsor/.test(t),
  needs_sponsorship: (t) => /sponsor/.test(t) && !/\b(not|no|don'?t|won'?t)\b.*(need|require)/.test(t),
};
const norm = (s: string) => s.toLowerCase().replace(/['']/g, "'").trim();

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
  if (key === "grad_year" && core.grad_year) return one(options, (t) => t.includes(core.grad_year!));
  const v = vaultValue(core, key);
  if (!v) return { ambiguous: true, candidates: options };
  return one(options, (t) => t === norm(v));
}
