import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const LOG_ROTATE_BYTES = 5 * 1024 * 1024;

export const shouldRotate = (sizeBytes: number) => sizeBytes > LOG_ROTATE_BYTES;

/** The last `n` lines of a log, without the trailing newline. Pure. */
export function tailLines(text: string, n: number): string {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.slice(-n).join("\n");
}

/** Ensure `<logsDir>/<name>` exists, truncating it first when it has grown past 5 MB. Returns its path. */
export function prepareLogFile(logsDir: string, name: string): string {
  mkdirSync(logsDir, { recursive: true });
  const file = join(logsDir, name);
  if (!existsSync(file) || shouldRotate(statSync(file).size)) writeFileSync(file, "");
  return file;
}

export function readLogTail(file: string, n: number): string {
  try {
    return tailLines(readFileSync(file, "utf8"), n);
  } catch {
    return "";
  }
}

/** One timestamped line from the shell itself, in the same file as the server's output. */
export function appendLogLine(file: string, line: string): void {
  try {
    appendFileSync(file, `${new Date().toISOString()} [desktop] ${line}\n`);
  } catch {
    // Logging must never take the app down.
  }
}
