import { basename, extname, join } from "node:path";

/** A save path in `dir` for `suggested` that never overwrites: "cv.pdf", "cv (1).pdf", "cv (2).pdf"… Pure. */
export function uniqueDownloadPath(dir: string, suggested: string, exists: (path: string) => boolean): string {
  const name = basename(suggested) || "download";
  const ext = extname(name);
  const stem = name.slice(0, name.length - ext.length);
  let candidate = join(dir, name);
  for (let n = 1; exists(candidate); n++) candidate = join(dir, `${stem} (${n})${ext}`);
  return candidate;
}
