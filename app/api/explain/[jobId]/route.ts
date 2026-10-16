import { NextResponse } from "next/server";
import { getExplanation } from "@/app/(app)/jobs/[id]/actions";

/**
 * The job page's explanation, fetched by ExplainPanel. A route rather than a server action: Next runs server actions one
 * at a time, so a slow first explanation (one model call) made Save, Tailor and Autopilot wait behind it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const r = await getExplanation(jobId);
  return NextResponse.json(r, { headers: { "Cache-Control": "private, no-store" } });
}
