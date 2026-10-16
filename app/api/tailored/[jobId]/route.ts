import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { applications } from "@/lib/db/schema";
import { getFile } from "@/lib/files";
import { isUuid } from "@/lib/feed/save-result";

/** Tailored CV download, streamed from the local `tailored` bucket. The stored path must sit under the user's own `{userId}/` prefix. */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUuid(jobId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { user } = await requireUser();
  const app = db.select({ tailored_cv_path: applications.tailored_cv_path }).from(applications)
    .where(and(eq(applications.user_id, user.id), eq(applications.job_id, jobId))).get();
  const path = app?.tailored_cv_path;
  if (!path || !path.startsWith(`${user.id}/`)) return NextResponse.json({ error: "No tailored CV yet" }, { status: 404 });
  const file = await getFile("tailored", path).catch(() => null);
  if (!file) return NextResponse.json({ error: "No tailored CV yet" }, { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="CV-tailored.pdf"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
