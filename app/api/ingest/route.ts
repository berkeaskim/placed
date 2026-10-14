import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { fetchJobs } from "@/lib/ingest/providers";
import { ingestCompany, type CompanyRow } from "@/lib/ingest/run";
import { supabaseStore } from "@/lib/ingest/store";
import { batchSlice, parseBatch, shouldStartNext } from "@/lib/ingest/batch";
import { tagJob } from "@/lib/ai/tagJob";

export const maxDuration = 300;

function authorized(request: Request): boolean {
  if (!env.cronSecret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${env.cronSecret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const batch = parseBatch(new URL(request.url).searchParams.get("batch"));
  if (batch === "invalid") return NextResponse.json({ error: "batch must be an integer >= 0" }, { status: 400 });

  const db = createAdminClient();
  const store = supabaseStore(db);
  const { data: companies, error: cErr } = await db.from("companies").select("*").eq("enabled", true).order("id");
  if (cErr) return NextResponse.json({ error: `companies: ${cErr.message}` }, { status: 500 });
  const list = (companies ?? []) as CompanyRow[];
  const log: string[] = [];
  const started = Date.now();

  async function run(c: CompanyRow) {
    try {
      const r = await ingestCompany(c, { fetchJobs, tagJob, store });
      log.push(`${c.slug}: kept ${r.kept}, tagged ${r.tagged}, pending ${r.pending}, dead ${r.dead}`);
    } catch (e) {
      log.push(`${c.slug}: ERROR ${(e as Error).message}`);
    }
  }

  // Explicit batch: ~10 companies per call, no cursor, same time budget.
  if (batch !== null) {
    let partial = false;
    for (const c of batchSlice(list, batch)) {
      if (!shouldStartNext(Date.now() - started)) { partial = true; break; }
      await run(c);
    }
    return NextResponse.json({ batch, total: list.length, partial, log });
  }

  // Vercel Cron: resume from the stored cursor, time-boxed, cursor saved after every company.
  const { data: state, error: sErr } = await db.from("ingest_state").select("cursor").eq("id", 1).single();
  if (sErr) return NextResponse.json({ error: `ingest_state: ${sErr.message}` }, { status: 500 });
  // Normalise into [0, n): a negative/corrupt stored cursor must not index list[-1].
  const n = Math.max(1, list.length);
  const stored = Math.trunc(Number(state?.cursor ?? 0)) || 0;
  let cursor = ((stored % n) + n) % n;
  let partial = false;
  const save = () => db.from("ingest_state").update({ cursor, updated_at: new Date().toISOString() }).eq("id", 1);
  try {
    while (list.length) {
      if (!shouldStartNext(Date.now() - started)) { partial = true; break; }
      await run(list[cursor]);
      cursor = (cursor + 1) % list.length;
      await save();
      if (cursor === 0) break;
    }
  } finally {
    await save();
  }
  return NextResponse.json({ cursor, partial, log });
}
