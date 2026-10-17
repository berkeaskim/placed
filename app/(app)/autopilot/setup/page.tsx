import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/local-user";
import { env } from "@/lib/env";
import { getActiveCv, getProfile } from "@/lib/db/queries";
import { getVault } from "@/lib/autopilot/server";
import { prefillCore } from "@/lib/autopilot/vault";
import { SetupForm } from "./setup-form";
import { RememberedAnswers } from "./remembered-answers";
import { SavedStories } from "./saved-stories";
import { listSavedStories } from "./story-actions";
import { ExtensionInstall } from "@/components/autopilot/extension-install";

export default async function AutopilotSetupPage() {
  if (!env.autopilot) notFound();
  const { user } = await requireUser();
  const [vault, profile, cv, stories] = await Promise.all([getVault(user.id), getProfile(user.id), getActiveCv(user.id), listSavedStories()]);
  // The local user has no real email (you@localhost): the CV's email is the prefill.
  const prefill = prefillCore({ email: null, year: profile.year, cv: cv?.parsed ?? null, needsVisa: profile.needs_visa });
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Set up Autopilot</h1>
      <p className="text-[15px] text-[#4A4A57]">Answer these once. Autopilot uses them to fill application forms for you, and you always press Submit yourself.</p>
      <SetupForm initial={{ ...prefill, ...vault.core }} unlocked={vault.completed} needsVisaHint={profile.needs_visa} />
      <RememberedAnswers extra={vault.extra} />
      <SavedStories stories={stories} />
      <ExtensionInstall />
    </div>
  );
}
