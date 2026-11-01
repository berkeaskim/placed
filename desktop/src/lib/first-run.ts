import { dialog } from "electron";
import { mkdirSync } from "node:fs";
import { firstRunPlan, hasPlacedDb, importDataFolder } from "./data-folder";

const WELCOME = {
  message: "Welcome to Placed",
  detail:
    "Start fresh, or import the data folder from a copy of Placed you ran from the repo (it is copied, your original is untouched).",
  buttons: ["Start fresh", "Import existing data…"],
};

/** Make sure `dataDir` is ready before the server starts: keep it, import into it, or start it fresh. */
export async function prepareDataFolder({
  dataDir,
  env,
  log,
}: {
  dataDir: string;
  env: Record<string, string | undefined>;
  log: (line: string) => void;
}): Promise<void> {
  let plan = firstRunPlan({ dataHasDb: hasPlacedDb(dataDir), env });

  if (plan.kind === "import") {
    try {
      importDataFolder(plan.from, dataDir);
      log(`imported data from ${plan.from}`);
      return;
    } catch (err) {
      log(`PLACED_IMPORT_FROM ignored: ${(err as Error).message}`);
      plan = firstRunPlan({ dataHasDb: false, env: { ...env, PLACED_IMPORT_FROM: undefined } });
    }
  }

  if (plan.kind === "ask") await askAndImport(dataDir, log);
  mkdirSync(dataDir, { recursive: true });
  if (plan.kind === "fresh") log("first run: starting fresh");
}

async function askAndImport(dataDir: string, log: (line: string) => void): Promise<void> {
  for (;;) {
    const { response } = await dialog.showMessageBox({ type: "info", ...WELCOME, defaultId: 0, cancelId: 0 });
    if (response === 0) {
      log("first run: starting fresh");
      return;
    }
    if (await pickAndImport(dataDir, log)) return;
  }
}

/** Directory picker until a valid Placed data folder is copied in. False when the user cancels the picker. */
async function pickAndImport(dataDir: string, log: (line: string) => void): Promise<boolean> {
  for (;;) {
    const picked = await dialog.showOpenDialog({
      title: "Import Placed data",
      message: "Choose the data folder of your existing Placed (it contains placed.db).",
      buttonLabel: "Import",
      properties: ["openDirectory"],
    });
    const from = picked.filePaths[0];
    if (picked.canceled || !from) return false;
    try {
      importDataFolder(from, dataDir);
      log(`imported data from ${from}`);
      return true;
    } catch (err) {
      await dialog.showMessageBox({
        type: "warning",
        message: "That folder can't be imported",
        detail: `${(err as Error).message} Pick the "data" folder inside your Placed repo.`,
        buttons: ["Choose another folder"],
      });
    }
  }
}
