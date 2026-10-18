// Lists playbook actions and dated guidance whose reviewBy is more than 30 days past (T7 in the 2026-10-18 audit).
// A maintenance check, not a test: CI must not start failing on a calendar date. The UI already flags stale items
// and hides dated guidance 30 days after reviewBy. Exits 1 when anything is overdue so it can gate a refresh.
import { PLAYBOOKS } from "@/lib/playbooks";
import { ARCHETYPES } from "@/lib/types";

const limit = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
const overdue: string[] = [];
for (const a of ARCHETYPES) {
  for (const x of [...PLAYBOOKS[a].actions, ...PLAYBOOKS[a].yearGuidanceDated]) {
    if (x.reviewBy && x.reviewBy < limit) overdue.push(`${a}: ${"id" in x ? x.id : x.text.slice(0, 50)} (reviewBy ${x.reviewBy})`);
  }
}
if (overdue.length) {
  console.error(`playbooks:freshness: ${overdue.length} item(s) more than 30 days past reviewBy. Re-check the official page and update docs/research/role-playbooks-*.json:\n${overdue.join("\n")}`);
  process.exit(1);
}
console.log("playbooks:freshness: nothing overdue");
