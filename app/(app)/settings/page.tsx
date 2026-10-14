import { requireUser } from "@/lib/supabase/server";
import { DeleteDataForm } from "./delete-data-form";

export default async function Settings() {
  await requireUser();
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-[28px] font-extrabold tracking-tight">Settings</h1>
      <section className="card-quest flex flex-col gap-3 p-5">
        <h2 className="font-bold">Your data</h2>
        <p className="text-sm text-muted-foreground">Your CV is stored privately and only used to score and tailor it for you.</p>
        <DeleteDataForm />
      </section>
    </div>
  );
}
