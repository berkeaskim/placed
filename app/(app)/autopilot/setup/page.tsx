import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getActiveCv, getProfile } from "@/lib/db/queries";
import { getVault } from "@/lib/autopilot/server";
import { prefillCore } from "@/lib/autopilot/vault";
import { SetupForm } from "./setup-form";

export default async function AutopilotSetupPage() {
  if (!env.autopilot) notFound();
  const { supabase, user } = await requireUser();
  const [vault, profile, cv] = await Promise.all([getVault(createAdminClient(), user.id), getProfile(supabase, user.id), getActiveCv(supabase, user.id)]);
  const prefill = prefillCore({ email: user.email ?? null, year: profile.year, cv: cv?.parsed ?? null, needsVisa: profile.needs_visa });
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Set up Autopilot</h1>
      <p className="text-[15px] text-[#4A4A57]">Answer these once. Autopilot uses them to fill application forms for you, and you always press Submit yourself.</p>
      <SetupForm initial={{ ...prefill, ...vault.core }} unlocked={vault.completed} needsVisaHint={profile.needs_visa} />
      <section id="extension" className="scroll-mt-20 rounded-2xl border border-[#E8E8EE] bg-white p-5">
        <h2 className="text-lg font-extrabold tracking-tight">Get the Chrome extension</h2>
        <p className="mt-1 text-[14px] text-[#4A4A57]">Autopilot fills the form through a small Chrome extension. It never presses Submit.</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-[14px] text-[#4A4A57]">
          <li>Open <code>chrome://extensions</code> and switch on <strong>Developer mode</strong>.</li>
          <li>Click <strong>Load unpacked</strong> and choose the <code>extension/</code> folder from the Placed repository.</li>
          <li>Come back to a job, press <strong>Autopilot this application</strong>, then <strong>Open &amp; fill</strong>.</li>
        </ol>
      </section>
    </div>
  );
}
