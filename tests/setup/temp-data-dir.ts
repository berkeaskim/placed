import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

/**
 * Runs before every test file: points PLACED_DATA_DIR at a fresh temp dir, so tests never touch ./data and each file
 * starts from an empty, freshly migrated SQLite. Closes any DB a previous file left open on globalThis (the
 * `__placedDb` holder in lib/db/client.ts) without importing it, so vi.mock of the client still works.
 */
type Holder = { db: { $client: { close(): void } } };
const g = globalThis as typeof globalThis & { __placedDb?: Holder };

function closeDb() {
  g.__placedDb?.db.$client.close();
  g.__placedDb = undefined;
}

const dir = mkdtempSync(path.join(tmpdir(), "placed-test-"));
closeDb();
process.env.PLACED_DATA_DIR = dir;

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});
