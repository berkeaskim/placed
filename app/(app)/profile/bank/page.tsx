import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/local-user";
import { ensureBank } from "@/lib/bank/import";
import { aiMode } from "@/lib/ai/config";
import { getBank, listSourceMeta, listSources, listSuggestions } from "@/lib/bank/store";
import type { CandidateEntry, MergeIntoPayload, NewBulletPayload, NewEntryPayload } from "@/lib/bank/types";
import { ImportPanel } from "./import-panel";
import { SuggestionsList, type SuggestionGroup, type SuggestionView } from "./suggestions-list";
import { BankView, type BadgeLabel } from "./bank-view";
import { ProfileTabs } from "../tabs";

export const metadata: Metadata = { title: "Experience bank · Placed" };

const BADGE: Record<string, BadgeLabel> = {
  cv: "CV", linkedin_capture: "LinkedIn", linkedin_export: "LinkedIn", linkedin_post: "Post", manual: "Manual",
};

const SOURCE_LABEL: Record<string, string> = {
  cv: "Another CV", linkedin_capture: "LinkedIn profile", linkedin_export: "LinkedIn PDF", linkedin_post: "LinkedIn post",
};

/** /profile/bank: everything the student has done, with source badges, pin/hide, reorder and inline editing. */
export default async function BankPage() {
  const { user } = await requireUser();
  const { bootstrapped } = await ensureBank(user.id);
  const bank = getBank(user.id);
  const kinds = listSources(user.id);
  const pendingList = listSuggestions(user.id, "pending");
  const pending = pendingList.length;
  const meta = listSourceMeta(user.id);
  const label = (id: string) => { const e = bank.entries.find((x) => x.id === id); return e ? `${e.org} — ${e.title}` : null; };
  const view = (c: CandidateEntry) => ({ section: c.section, org: c.org, title: c.title, dates: c.dates, location: c.location, bullets: c.bullets.map((b) => b.text) });
  const groupMap = new Map<string, SuggestionGroup>();
  for (const s of pendingList) {
    const m = meta.get(s.sourceId);
    let item: SuggestionView;
    if (s.kind === "new_bullet") {
      const p = s.payload as NewBulletPayload;
      const target = s.targetEntryId ? label(s.targetEntryId) : null;
      if (!target) continue; // its entry was deleted; nothing to add to
      item = { id: s.id, kind: s.kind, target, text: p.text, sourceText: m?.kind === "linkedin_post" ? p.sourceText : undefined };
    } else if (s.kind === "merge_into") {
      const p = s.payload as MergeIntoPayload;
      item = { id: s.id, kind: s.kind, entry: view(p.candidate), targets: p.targets.flatMap((id) => { const l = label(id); return l ? [{ id, label: l }] : []; }) };
    } else {
      item = { id: s.id, kind: "new_entry", entry: view((s.payload as NewEntryPayload).candidate) };
    }
    const g = groupMap.get(s.sourceId) ?? {
      sourceId: s.sourceId, label: SOURCE_LABEL[m?.kind ?? ""] ?? "Import", isPost: m?.kind === "linkedin_post",
      importedAt: m ? new Date(m.importedAt.includes("T") ? m.importedAt : `${m.importedAt.replace(" ", "T")}Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "",
      items: [],
    };
    g.items.push(item);
    groupMap.set(s.sourceId, g);
  }
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
      <ImportPanel aiOff={aiMode() === "off"} />
      <section id="suggestions" aria-label="Suggestions" data-slot="bank-suggestions">
        {pending > 0 && (
          <Link href="#suggestions" className="mb-4 inline-flex min-h-11 items-center rounded-full border-2 border-[#E6E6EF] bg-white px-5 text-sm font-bold hover:bg-[#F6F6FA]">
            {pending} suggestion{pending === 1 ? "" : "s"} to review
          </Link>
        )}
        <SuggestionsList groups={[...groupMap.values()]} />
      </section>
      <BankView entries={entries} />
    </>
  );
}
