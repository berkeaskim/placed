import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { fetchJobs } from "@/lib/ingest/providers";
import { ingestCompany, type CompanyRow } from "@/lib/ingest/run";
import { supabaseStore } from "@/lib/ingest/store";
import { batchSlice, parseBatch } from "@/lib/ingest/batch";
import { tagJob } from "@/lib/ai/tagJob";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!env.cronSecret || request.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const batch = parseBatch(new URL(request.url).searchParams.get("batch"));
  if (batch === "invalid") return NextResponse.json({ error: "batch must be an integer >= 0" }, { status: 400 });

  const db = createAdminClient();
  const store = supabaseStore(db);
  const { data: companies } = await db.from("companies").select("*").eq("enabled", true).order("id");
  const list = (companies ?? []) as CompanyRow[];
  const log: string[] = [];

  async function run(c: CompanyRow) {
    try {
      const r = await ingestCompany(c, { fetchJobs, tagJob, store });
      log.push(`${c.slug}: kept ${r.kept}, tagged ${r.tagged}, dead ${r.dead}`);
    } catch (e) {
      log.push(`${c.slug}: ERROR ${(e as Error).message}`);
    }
  }

  // Explicit batch: ~10 companies per call, no cursor.
  if (batch !== null) {
    for (const c of batchSlice(list, batch)) await run(c);
    return NextResponse.json({ batch, total: list.length, log });
  }

  // Vercel Cron: resume from the stored cursor, time-boxed.
  const { data: state } = await db.from("ingest_state").select("cursor").eq("id", 1).single();
  let cursor = (state?.cursor ?? 0) % Math.max(1, list.length);
  const started = Date.now();
  while (Date.now() - started < 250_000 && list.length) {
    await run(list[cursor]);
    cursor = (cursor + 1) % list.length;
    if (cursor === 0) break;
  }
  await db.from("ingest_state").update({ cursor, updated_at: new Date().toISOString() }).eq("id", 1);
  return NextResponse.json({ cursor, log });
}
