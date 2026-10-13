import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/feed/save-result";

/**
 * Tailored CV download. The application row is read with the user's own client (RLS: only their rows), and the
 * stored path must sit under their own `{userId}/` prefix before the service role signs a 60-second URL.
 */
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUuid(jobId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/login", request.url));
  const { data: app } = await supabase.from("applications").select("tailored_cv_path")
    .eq("user_id", auth.user.id).eq("job_id", jobId).maybeSingle();
  const path = app?.tailored_cv_path as string | null | undefined;
  if (!path || !path.startsWith(`${auth.user.id}/`)) return NextResponse.json({ error: "No tailored CV yet" }, { status: 404 });
  const { data } = await createAdminClient().storage.from("tailored").createSignedUrl(path, 60, { download: "CV-tailored.pdf" });
  if (!data?.signedUrl) return NextResponse.json({ error: "Unavailable right now" }, { status: 503 });
  const res = NextResponse.redirect(data.signedUrl);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
