import { cpSync, existsSync, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

/** True when `dir` holds a `placed.db` file: the marker of a Placed data folder. */
export function hasPlacedDb(dir: string): boolean {
  const db = resolve(dir, "placed.db");
  return existsSync(db) && statSync(db).isFile();
}

export type FirstRunPlan = { kind: "ready" } | { kind: "import"; from: string } | { kind: "fresh" } | { kind: "ask" };

/**
 * What to do before the server starts. A data folder with a database needs nothing. Otherwise
 * PLACED_IMPORT_FROM imports without a dialog, PLACED_SKIP_FIRST_RUN_DIALOG=1 (QA only) starts fresh, else ask. Pure.
 */
export function firstRunPlan({
  dataHasDb,
  env,
}: {
  dataHasDb: boolean;
  env: Record<string, string | undefined>;
}): FirstRunPlan {
  if (dataHasDb) return { kind: "ready" };
  if (env.PLACED_IMPORT_FROM) return { kind: "import", from: env.PLACED_IMPORT_FROM };
  if (env.PLACED_SKIP_FIRST_RUN_DIALOG === "1") return { kind: "fresh" };
  return { kind: "ask" };
}

/** Copy an existing Placed data folder into `dataDir`. The source is never modified. */
export function importDataFolder(from: string, dataDir: string): void {
  if (!hasPlacedDb(from)) throw new Error(`${from} has no placed.db, so it is not a Placed data folder.`);
  if (resolve(from) === resolve(dataDir)) throw new Error("That folder is already Placed's data folder.");
  mkdirSync(dataDir, { recursive: true });
  cpSync(from, dataDir, { recursive: true });
}
