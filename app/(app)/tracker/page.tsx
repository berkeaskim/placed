import { requireUser } from "@/lib/supabase/server";
import { isAppStatus } from "@/lib/tracker/status";
import { Board, type Card } from "./board";

export default async function Tracker() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("applications").select("id, job_id, status, jobs(title, companies(name))")
    .eq("user_id", user.id).order("updated_at", { ascending: false });
  const cards: Card[] = (data ?? []).filter((a) => isAppStatus(a.status)).map((a) => {
    const j = a.jobs as unknown as { title: string; companies: { name: string } | null } | null;
    return { id: a.id, jobId: a.job_id, status: a.status, title: j?.title ?? "Role", company: j?.companies?.name ?? "" };
  });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[28px] font-extrabold tracking-tight">Your applications</h1>
      {cards.length === 0
        ? <p className="card-quest p-6 font-semibold">Save a role from your feed to start tracking.</p>
        : <Board cards={cards} />}
    </div>
  );
}
