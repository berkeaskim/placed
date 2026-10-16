"use server";
import { revalidatePath } from "next/cache";
import { INTERVAL_CHOICES, setIngestIntervalHours } from "@/lib/ingest/scheduler";

export async function setJobSearchInterval(hours: number): Promise<{ ok: boolean }> {
  if (!(INTERVAL_CHOICES as readonly number[]).includes(hours)) return { ok: false };
  setIngestIntervalHours(hours);
  revalidatePath("/settings");
  revalidatePath("/feed");
  return { ok: true };
}
