import { getFile, isBucket } from "@/lib/files";

/** Serves a stored file (local, single user: the server binds to 127.0.0.1). `?download=name.pdf` forces a download. */
export async function GET(req: Request, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path } = await params;
  if (!isBucket(bucket)) return new Response("Not found", { status: 404 });
  let file: Awaited<ReturnType<typeof getFile>>;
  try {
    file = await getFile(bucket, path.join("/"));
  } catch {
    return new Response("Bad path", { status: 400 });
  }
  if (!file) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.get("download");
  const headers: Record<string, string> = {
    "Content-Type": file.contentType,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (download) headers["Content-Disposition"] = `attachment; filename="${download.replace(/[^\w.\- ]/g, "_")}"`;
  return new Response(new Uint8Array(file.bytes), { headers });
}
