/**
 * Demo persona (spec §12): renders the FICTIONAL "Ayşe Demir" CV with the app's own ATS-safe renderer and writes
 * the fixtures that make fixture mode replay her exactly:
 *   seed/demo/ayse-demir-cv.pdf
 *   fixtures/ai/parseCV/<contentHash(base64).slice(0,12)>.json        (parseCV key, see profile/build/actions.ts)
 *   fixtures/ai/judgeCvRules/<textHash.slice(0,16)>-<sector>.json     (from the hand labels in seed/demo/judge-labels.json)
 * The PDF embeds a creation date, so every run changes the parseCV key (the old persona fixture is removed); the judge
 * keys depend only on the text. Re-run whenever ayse.json or the labels change and commit the PDF and fixtures together.
 * Run: npm run demo:cv (node scripts/run-ts.mjs scripts/make-demo-cv.ts; not tsx, see scripts/run-ts.mjs)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderCvPdf } from "@/lib/pdf/cv-document";
import { toTailored } from "@/lib/verify/tailoring";
import { ParsedCvOutput, JudgeOutput } from "@/lib/ai/schemas";
import type { ParsedCV } from "@/lib/types";
import {
  DEMO_CV_PATH, DEMO_JUDGE_LABELS_PATH, DEMO_PERSONA_PATH, DEMO_SECTORS, judgeFixtureKey, parseFixtureKey, uploadedRawText,
} from "@/lib/fixtures/persona";

async function main() {
  const cv = ParsedCvOutput.parse(JSON.parse(readFileSync(DEMO_PERSONA_PATH, "utf8"))) as ParsedCV;
  const pdf = new Uint8Array(await renderCvPdf(toTailored(cv), cv));
  writeFileSync(DEMO_CV_PATH, pdf);

  const parseKey = parseFixtureKey(pdf);
  mkdirSync("fixtures/ai/parseCV", { recursive: true });
  // The PDF's creation date changes the content hash on every run: drop earlier parse fixtures of this persona.
  for (const f of readdirSync("fixtures/ai/parseCV")) {
    if (f === `${parseKey}.json` || !f.endsWith(".json")) continue;
    const prev = JSON.parse(readFileSync(path.join("fixtures/ai/parseCV", f), "utf8")) as { name?: string; email?: string };
    if (prev.name === cv.name && prev.email === cv.email) rmSync(path.join("fixtures/ai/parseCV", f));
  }
  writeFileSync(`fixtures/ai/parseCV/${parseKey}.json`, JSON.stringify(cv, null, 1) + "\n");
  console.log(`${DEMO_CV_PATH} written; parseCV fixture ${parseKey}.json`);

  const raw = await uploadedRawText(pdf);
  if (raw.flagged) throw new Error("The demo CV tripped the safety scan: fix ayse.json before recording fixtures.");
  if (!existsSync(DEMO_JUDGE_LABELS_PATH)) {
    console.log(`no ${DEMO_JUDGE_LABELS_PATH}: judge fixtures skipped`);
    return;
  }
  const labels = JSON.parse(readFileSync(DEMO_JUDGE_LABELS_PATH, "utf8")) as Record<string, unknown>;
  mkdirSync("fixtures/ai/judgeCvRules", { recursive: true });
  const written: string[] = [];
  for (const sector of DEMO_SECTORS) {
    if (!labels[sector]) continue;
    const out = JudgeOutput.parse(labels[sector]);
    const key = judgeFixtureKey(cv, raw.text, sector);
    writeFileSync(`fixtures/ai/judgeCvRules/${key}.json`, JSON.stringify(out, null, 1) + "\n");
    written.push(`${key}.json`);
    console.log(`judgeCvRules fixture ${key}.json (${out.verdicts.length} hand-labelled verdicts)`);
  }

  const stale = (dir: string, keep: string[], match: (f: string) => boolean) =>
    readdirSync(dir).filter((f) => match(f) && !keep.includes(f)).map((f) => path.join(dir, f));
  const old = [
    ...stale("fixtures/ai/judgeCvRules", written, (f) => DEMO_SECTORS.some((s) => f.endsWith(`-${s}.json`))),
  ];
  if (old.length) console.log(`older demo judge fixtures (delete if they came from a previous run):\n  ${old.join("\n  ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
