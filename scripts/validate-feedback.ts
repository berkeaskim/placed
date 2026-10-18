/**
 * Rule-review report from "I disagree" feedback (audit 2026-10-18, 04#25): every rule shown as a fix, ranked by how
 * often it was disputed, with a 95% Wilson interval. Rules over 15% disputes on at least 20 showings are flagged.
 *
 *   npm run validate:feedback                 print the report
 *   npm run validate:feedback -- --out <md>   also write it to a file
 *
 * Reads your local database (./data or PLACED_DATA_DIR) and changes nothing. No AI calls. The report holds rule ids
 * and counts only, never CV text.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { disputeReport, loadDisputeData, renderDisputeReport } from "@/lib/cv-score/feedback";

const i = process.argv.indexOf("--out");
const out = i >= 0 ? process.argv[i + 1] : undefined;
const md = renderDisputeReport(disputeReport(loadDisputeData()), new Date().toISOString().slice(0, 10));
console.log(md);
if (out) {
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, md);
  console.error(`report: ${out}`);
}
