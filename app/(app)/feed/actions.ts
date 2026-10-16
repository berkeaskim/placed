"use server";
import { refresh, updateTag } from "next/cache";
import { JOBS_TAG } from "@/lib/feed/jobs-cache";

/** After a Refresh jobs run: drop the cached job list so the feed re-renders with the new postings. */
export async function refreshFeed(): Promise<void> {
  updateTag(JOBS_TAG);
  refresh();
}
