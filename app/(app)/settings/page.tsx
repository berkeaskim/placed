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
import { dataDir, db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { aiProvider } from "@/lib/ai/config";
import { PROVIDER_LABEL, shortModel } from "@/lib/ai/labels";
import { codexModel, currentModelId } from "@/lib/ai/models";
import { readHealth } from "@/lib/ai/health";
import { AppIcon, Group, Row, StatusDot } from "@/components/ui/apple";
import { isDesktop } from "@/lib/desktop";
import { DesktopSettings } from "@/components/settings/desktop";


export default async function Settings() {
  const provider = aiProvider();
  const { user } = await requireUser();
  const row = db.select({ u: profiles.university, course: profiles.course, year: profiles.year, grad: profiles.grad_year, placement: profiles.placement_status, secureBy: profiles.placement_secure_by, workAuth: profiles.work_auth, needsVisa: profiles.needs_visa }).from(profiles).where(eq(profiles.user_id, user.id)).get();
  const saved = row?.u ?? null;
  const detected = universityFor(user.id);
  const envKey = process.env.SERPER_API_KEY?.trim();
  const savedKey = envKey ? null : getSecret(SERPER_SECRET);
  const smart = provider ? currentModelId("smart").split(":").slice(1).join(":") : null;
  const health = provider ? readHealth(provider, "smart") : null;
  const healthy = health && health.model === (provider === "codex" ? (codexModel("smart") ?? "default") : smart) ? health.ok : null;
  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-6 pb-10 [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text',system-ui,sans-serif] antialiased">
      <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-0.025em] text-black/90">Settings</h1>

      <Group title="AI" footer="One OpenRouter key reaches Claude, Gemini, GPT and more; ChatGPT and local models work too.">
        <Row
          href="/settings/ai"
          icon={<AppIcon kind={provider ?? "off"} />}
          title={provider ? PROVIDER_LABEL[provider] : "AI is off"}
          subtitle={provider ? <span className="font-mono">{smart === "default" ? "Codex default model" : shortModel(smart ?? "")}</span> : "Set up AI to score, tailor and write"}
          trailing={
            provider ? (
              <span className="flex items-center gap-1.5">
                <StatusDot state={healthy === null ? "unknown" : healthy ? "ok" : "fail"} />
                {healthy === null ? "Not checked" : healthy ? "Working" : "Not working"}
              </span>
            ) : (
              "Set up"
            )
          }
        />
      </Group>

      <Group title="You">
        <UniversityForm saved={saved} fromCv={saved ? null : detected} />
        <CourseForm saved={row?.course ?? null} />
        <StudyForm year={row?.year ?? null} gradYear={row?.grad ?? null} placement={row?.placement ?? null} secureBy={row?.secureBy ?? null} workAuth={row ? workAuthOf({ work_auth: row.workAuth, needs_visa: row.needsVisa }) : null} options={gradYearOptions(todayLondon())} />
      </Group>

      <JobSearchSettings />

      <Group
        title="People search"
        id="people-search"
        footer="Optional. With a search key, roles you've applied to show real alumni, team members and recruiters to message (Inside Track). Searches send the company, role and your university to Serper; nothing else leaves this computer."
      >
        <SearchKeyForm source={envKey ? "env" : savedKey ? "saved" : null} last4={(envKey ?? savedKey)?.slice(-4) ?? null} />
      </Group>

      {isDesktop() && <DesktopSettings />}

      <Group title="Your data" footer={<>Everything is stored on this computer, in <code className="break-all">{dataDir()}</code>.</>}>
        <DeleteDataForm />
      </Group>
    </div>
  );
}
