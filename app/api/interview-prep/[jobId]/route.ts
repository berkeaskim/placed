import { NextResponse } from "next/server";
import { getInterviewPrep } from "@/app/(app)/jobs/[id]/prep-actions";

// A first generation runs a grounded web search (~35-60 s, more if Gemini retries a 503).
export const maxDuration = 300;

/**
 * The job page's interview prep, fetched by InterviewPrepPanel. A route rather than a server action: Next runs server
 * actions one at a time, so a slow first pack would make Save, Tailor and Apply wait behind it (same reason as
 * /api/explain). POST only: building a pack can cost a paid generation, so a prefetch must never trigger it.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const r = await getInterviewPrep(jobId);
  return NextResponse.json(r, { headers: { "Cache-Control": "private, no-store" } });
}
