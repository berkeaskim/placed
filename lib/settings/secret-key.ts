import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "../db/paths";

const cache = new Map<string, Buffer>();

/** 32-byte AES key from `<dataDir>/secret.key` (base64), generated with mode 0600 on first use. */
export function localSecretKey(): Buffer {
  const file = path.join(dataDir(), "secret.key");
  const hit = cache.get(file);
  if (hit) return hit;
  let b64: string;
  try {
    b64 = readFileSync(file, "utf8").trim();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    try {
      writeFileSync(file, randomBytes(32).toString("base64") + "\n", { mode: 0o600, flag: "wx" });
    } catch (w) {
      if ((w as NodeJS.ErrnoException).code !== "EEXIST") throw w; // another process won the race
    }
    b64 = readFileSync(file, "utf8").trim();
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error(`${file} must hold 32 bytes, base64-encoded`);
  cache.set(file, key);
  return key;
}
