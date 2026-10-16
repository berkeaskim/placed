import { requireUser } from "@/lib/supabase/server";
import Link from "next/link";
import { DeleteDataForm } from "./delete-data-form";
import { aiProvider } from "@/lib/ai/config";

const PROVIDER_LABEL = { anthropic: "Claude", gemini: "Gemini", ollama: "Ollama (local)" } as const;

export default async function Settings() {
  const { user } = await requireUser();
  const provider = aiProvider();
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-[28px] font-extrabold tracking-tight">Settings</h1>
      <section className="card-quest flex flex-col gap-3 p-5">
        <h2 className="font-bold">Account</h2>
        <p className="text-sm text-muted-foreground">
          {user.is_anonymous
            ? "You're a guest. Signing out now loses your progress, so save your account first."
            : `Signed in as ${user.email}.`}
        </p>
        <form action="/auth/signout" method="post">
          <button type="submit" className="h-11 rounded-[14px] border-2 border-border bg-white px-5 font-bold transition-colors hover:bg-muted">
            Sign out
          </button>
        </form>
      </section>
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
        <h2 className="font-bold">Your data</h2>
        <p className="text-sm text-muted-foreground">Your CV is stored privately and only used to score and tailor it for you.</p>
        <DeleteDataForm />
      </section>
    </div>
  );
}
