import Link from "next/link";
import { DeleteDataForm } from "./delete-data-form";
import { JobSearchSettings } from "@/components/settings/job-search";
import { UniversityForm } from "@/components/settings/university-form";
import { requireUser } from "@/lib/auth/local-user";
import { universityFor } from "@/lib/profile/university";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { aiProvider } from "@/lib/ai/config";

const PROVIDER_LABEL = { anthropic: "Claude", gemini: "Gemini", ollama: "Ollama (local)" } as const;

export default async function Settings() {
  const provider = aiProvider();
  const { user } = await requireUser();
  const saved = db.select({ u: profiles.university }).from(profiles).where(eq(profiles.user_id, user.id)).get()?.u ?? null;
  const detected = universityFor(user.id);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-[28px] font-extrabold tracking-tight">Settings</h1>
      <section className="card-quest flex flex-col gap-3 p-5">
        <h2 className="font-bold">AI</h2>
        <p className="text-sm text-muted-foreground">
          {provider ? `Using ${PROVIDER_LABEL[provider]}.` : "No AI set up yet, so Placed uses sample answers."} Pick Claude, Gemini or a local model.
        </p>
        <Link href="/settings/ai" className="inline-flex h-11 items-center self-start rounded-[14px] border-2 border-border bg-white px-5 font-bold transition-colors hover:bg-muted">
          AI settings
        </Link>
      </section>
      <section className="card-quest flex flex-col gap-3 p-5">
        <h2 className="font-bold">You</h2>
        <UniversityForm saved={saved} fromCv={saved ? null : detected} />
      </section>
      <JobSearchSettings />
      <section className="card-quest flex flex-col gap-3 p-5">
        <h2 className="font-bold">Your data</h2>
        <p className="text-sm text-muted-foreground">Everything is stored on this computer, in the <code>data/</code> folder.</p>
        <DeleteDataForm />
      </section>
    </div>
  );
}
