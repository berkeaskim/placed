import Link from "next/link";
import { DeleteDataForm } from "./delete-data-form";
import { JobSearchSettings } from "@/components/settings/job-search";
import { UniversityForm } from "@/components/settings/university-form";
import { CourseForm } from "@/components/settings/course-form";
import { StudyForm } from "@/components/settings/study-form";
import { workAuthOf } from "@/lib/profile/work-auth";
import { gradYearOptions } from "@/lib/profile/cycle";
import { todayLondon } from "@/lib/scoring/dates";
import { SearchKeyForm } from "@/components/settings/search-key-form";
import { SERPER_SECRET } from "@/lib/inside-track/find";
import { getSecret } from "@/lib/settings/store";
import { requireUser } from "@/lib/auth/local-user";
import { universityFor } from "@/lib/profile/university";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { aiProvider } from "@/lib/ai/config";

const PROVIDER_LABEL = { anthropic: "Claude", gemini: "Gemini", ollama: "Ollama (local)", codex: "ChatGPT (Codex CLI)" } as const;

export default async function Settings() {
  const provider = aiProvider();
  const { user } = await requireUser();
  const row = db.select({ u: profiles.university, course: profiles.course, year: profiles.year, grad: profiles.grad_year, placement: profiles.placement_status, workAuth: profiles.work_auth, needsVisa: profiles.needs_visa }).from(profiles).where(eq(profiles.user_id, user.id)).get();
  const saved = row?.u ?? null;
  const detected = universityFor(user.id);
  const envKey = process.env.SERPER_API_KEY?.trim();
  const savedKey = envKey ? null : getSecret(SERPER_SECRET);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-[28px] font-extrabold tracking-tight">Settings</h1>
      <section className="card-quest flex flex-col gap-3 p-5">
        <h2 className="font-bold">AI</h2>
        <p className="text-sm text-muted-foreground">
          {provider ? `Using ${PROVIDER_LABEL[provider]}.` : "No AI set up yet, so AI features (scoring, tailoring, cover letters) are off."} Pick Claude, Gemini, ChatGPT or a local model.
        </p>
        <Link href="/settings/ai" className="inline-flex h-11 items-center self-start rounded-[14px] border-2 border-border bg-white px-5 font-bold transition-colors hover:bg-muted">
          AI settings
        </Link>
      </section>
      <section className="card-quest flex flex-col gap-3 p-5">
        <h2 className="font-bold">You</h2>
        <UniversityForm saved={saved} fromCv={saved ? null : detected} />
        <CourseForm saved={row?.course ?? null} />
        <StudyForm year={row?.year ?? null} gradYear={row?.grad ?? null} placement={row?.placement ?? null} workAuth={row ? workAuthOf({ work_auth: row.workAuth, needs_visa: row.needsVisa }) : null} options={gradYearOptions(todayLondon())} />
      </section>
      <section className="card-quest flex flex-col gap-3 p-5" id="people-search">
        <h2 className="font-bold">People search</h2>
        <p className="text-sm text-muted-foreground">
          Optional. With a search key, roles you&apos;ve applied to show real alumni, team members and recruiters to message (Inside Track).
          Without one, you get LinkedIn search links instead.
        </p>
        <SearchKeyForm source={envKey ? "env" : savedKey ? "saved" : null} last4={(envKey ?? savedKey)?.slice(-4) ?? null} />
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
