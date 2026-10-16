import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getExplanation } from "@/app/(app)/jobs/[id]/actions";

/**
 * The job page's explanation, fetched by ExplainPanel. A route rather than a server action: Next runs server actions one
 * at a time, so a slow first explanation (one Gemini call) made Save, Tailor and Autopilot wait behind it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const r = await getExplanation(jobId);
  return NextResponse.json(r, { headers: { "Cache-Control": "private, no-store" } });
}
