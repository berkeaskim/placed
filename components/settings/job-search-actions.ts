"use server";
import { revalidatePath } from "next/cache";
import { INTERVAL_CHOICES, setIngestDailyAt, setIngestIntervalHours } from "@/lib/ingest/scheduler";

function revalidate() {
  revalidatePath("/settings");
  revalidatePath("/feed");
}

export async function setJobSearchInterval(hours: number): Promise<{ ok: boolean }> {
  if (!(INTERVAL_CHOICES as readonly number[]).includes(hours)) return { ok: false };
  setIngestIntervalHours(hours);
  revalidate();
  return { ok: true };
}

/** "HH:MM": one run a day at that local time. */
export async function setJobSearchDailyAt(at: string): Promise<{ ok: boolean }> {
  try {
    setIngestDailyAt(at);
  } catch {
    return { ok: false };
  }
  revalidate();
  return { ok: true };
}

export type FindCompaniesResult = { ok: true; added: string[]; suggested: number } | { ok: false; error: string };

/** Settings → "Find new companies": the AI company search, now (lib/ingest/discover.ts). */
export async function findNewCompanies(): Promise<FindCompaniesResult> {
  const { DiscoveryUnavailableError, runDiscovery } = await import("@/lib/ingest/discover");
  try {
    const s = await runDiscovery();
    revalidate();
    return { ok: true, added: s.added.map((a) => a.name), suggested: s.suggested };
  } catch (e) {
    if (e instanceof DiscoveryUnavailableError) return { ok: false, error: e.message };
    console.error("discover: failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "The company search failed. Try again." };
  }
}

export async function stopWatchingCompany(id: number): Promise<{ ok: boolean }> {
  const { dropDiscovered } = await import("@/lib/ingest/discover");
  const ok = Number.isInteger(id) && dropDiscovered(id);
  if (ok) revalidate();
  return { ok };
}
