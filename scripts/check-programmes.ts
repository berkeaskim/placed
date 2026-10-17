// Checks seed/programmes.yml: every row loads without a warning, passes the ingest title and location filters,
// is unique per employer and kind, and its url answers 2xx/3xx. Sequential, one request at a time.
import { readFileSync } from "node:fs";
import { loadProgrammes } from "@/lib/ingest/curated";
import { passesLocationFilter, passesTitleFilter } from "@/lib/ingest/filter";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function status(url: string): Promise<string> {
  const req = (method: string) =>
    fetch(url, { method, redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "user-agent": UA, accept: "text/html,*/*" } });
  try {
    let res = await req("HEAD");
    if (res.status >= 400) {
      await sleep(500);
      res = await req("GET");
    }
    await res.body?.cancel();
    return String(res.status);
  } catch (e) {
    return `ERR ${(e as Error).name}: ${(e as Error).message}`;
  }
}

async function main() {
  const warnings: string[] = [];
  const rows = loadProgrammes(readFileSync("seed/programmes.yml", "utf8"), (m) => warnings.push(m));
  const problems = [...warnings];
  const seen = new Set<string>();
  for (const p of rows) {
    const key = `${p.employer}:${p.season}:${p.kind}`;
    if (seen.has(key)) problems.push(`duplicate ${key}`);
    seen.add(key);
    if (!passesTitleFilter(p.title)) problems.push(`${key}: title fails filter: "${p.title}"`);
    if (!passesLocationFilter(p.location, false, p.description).pass) problems.push(`${key}: location fails filter: "${p.location}"`);
  }
  const lines: string[] = [];
  for (const p of rows) {
    const s = await status(p.url);
    const ok = /^[23]\d\d$/.test(s);
    if (!ok) problems.push(`${p.employer}:${p.kind}: ${p.url} -> ${s}`);
    lines.push(`${ok ? "OK  " : "FAIL"} ${p.employer.padEnd(14)} ${p.kind.padEnd(11)} ${p.opens}  ${(p.closes ?? "-").padEnd(10)} ${s.padEnd(4)} ${p.url}`);
    console.log(lines.at(-1));
    await sleep(1_000);
  }
  console.log(`\n${rows.length} programmes, ${new Set(rows.map((p) => p.employer)).size} employers`);
  if (problems.length) {
    console.error(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  console.log("all OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
