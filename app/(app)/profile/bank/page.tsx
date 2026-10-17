import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/local-user";
import { ensureBank } from "@/lib/bank/import";
import { getBank, listSources, listSuggestions } from "@/lib/bank/store";
import { BankView, type BadgeLabel } from "./bank-view";
import { ProfileTabs } from "../tabs";

export const metadata: Metadata = { title: "Experience bank · Placed" };

const BADGE: Record<string, BadgeLabel> = {
  cv: "CV", linkedin_capture: "LinkedIn", linkedin_export: "LinkedIn", linkedin_post: "Post", manual: "Manual",
};

/** /profile/bank: everything the student has done, with source badges, pin/hide, reorder and inline editing. */
export default async function BankPage() {
  const { user } = await requireUser();
  const { bootstrapped } = await ensureBank(user.id);
  const bank = getBank(user.id);
  const kinds = listSources(user.id);
  const pending = listSuggestions(user.id, "pending").length;
  // sourceIds hold bank_sources ids or the literal "manual"; resolve them to display badges here so the client gets plain strings.
  const badges = (ids: string[]): BadgeLabel[] => {
    const out = new Set<BadgeLabel>();
    for (const id of ids) {
      const label = id === "manual" ? BADGE.manual : BADGE[kinds.get(id) ?? ""];
      if (label) out.add(label);
    }
    return [...out];
  };
  const entries = bank.entries.map((e) => ({
    id: e.id, section: e.section, org: e.org, title: e.title, dates: e.dates, location: e.location,
    pinned: e.pinned, hidden: e.hidden, badges: badges(e.sourceIds),
    bullets: e.bullets.map((b) => ({ id: b.id, text: b.text, pinned: b.pinned, hidden: b.hidden, badges: badges(b.sourceIds) })),
  }));
  return (
    <>
      <ProfileTabs active="/profile/bank" />
      {bootstrapped && (
        <p role="status" className="mb-4 rounded-2xl border-2 border-[#E6E6EF] bg-[#F6F6FA] p-4 text-sm font-semibold">
          We filled this from your CV. Add more from LinkedIn or your old CVs.
        </p>
      )}
      {/* Task 11: import panel (LinkedIn export, old CVs, posts) mounts here. */}
      <div data-slot="bank-import" />
      {/* Task 11: pending suggestions review list mounts here; the counter below links to it. */}
      <section id="suggestions" aria-label="Suggestions" data-slot="bank-suggestions">
        {pending > 0 && (
          <Link href="#suggestions" className="mb-4 inline-flex min-h-11 items-center rounded-full border-2 border-[#E6E6EF] bg-white px-5 text-sm font-bold hover:bg-[#F6F6FA]">
            {pending} suggestion{pending === 1 ? "" : "s"} to review
          </Link>
        )}
      </section>
      <BankView entries={entries} />
    </>
  );
}
