import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./db/paths";

/** Local replacement for the Supabase Storage buckets: `<dataDir>/files/<bucket>/<path>`. */
export const BUCKETS = ["cvs", "tailored"] as const;
export type Bucket = (typeof BUCKETS)[number];

const CT_SUFFIX = ".content-type";
const BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const isBucket = (b: string): b is Bucket => (BUCKETS as readonly string[]).includes(b);

/** Absolute file path for bucket + relative path. Throws on unknown buckets, absolute paths and `..`/`.`/empty segments. */
export function resolveFile(bucket: string, rel: string): string {
  if (!isBucket(bucket)) throw new Error(`files: unknown bucket "${bucket}"`);
  if (!rel || rel.includes("\0") || rel.includes("\\") || path.isAbsolute(rel) || rel.startsWith("/")) throw new Error("files: invalid path");
  const parts = rel.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) throw new Error("files: invalid path");
  if (rel.endsWith(CT_SUFFIX)) throw new Error("files: invalid path");
  const root = path.join(dataDir(), "files", bucket);
  const full = path.resolve(root, ...parts);
  if (!full.startsWith(root + path.sep)) throw new Error("files: invalid path");
  return full;
}

export async function putFile(bucket: Bucket, rel: string, bytes: Uint8Array | Buffer, contentType?: string): Promise<void> {
  const full = resolveFile(bucket, rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  if (contentType) await writeFile(full + CT_SUFFIX, contentType);
  else await rm(full + CT_SUFFIX, { force: true });
}

/** null when the file does not exist. contentType: the one given to putFile, else inferred from the extension. */
export async function getFile(bucket: Bucket, rel: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const full = resolveFile(bucket, rel);
  let bytes: Buffer;
  try {
    bytes = await readFile(full);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT" || (e as NodeJS.ErrnoException).code === "EISDIR") return null;
    throw e;
  }
  const stored = await readFile(full + CT_SUFFIX, "utf8").catch(() => null);
  return { bytes, contentType: stored?.trim() || BY_EXT[path.extname(full).toLowerCase()] || "application/octet-stream" };
}

/** Missing files are not an error. */
export async function deleteFile(bucket: Bucket, rel: string): Promise<void> {
  const full = resolveFile(bucket, rel);
  await rm(full, { force: true });
  await rm(full + CT_SUFFIX, { force: true });
}

/** Same-origin URL served by app/api/files/[bucket]/[...path]/route.ts. */
export function fileUrl(bucket: Bucket, rel: string): string {
  resolveFile(bucket, rel);
  return `/api/files/${bucket}/${rel.split("/").map(encodeURIComponent).join("/")}`;
}
