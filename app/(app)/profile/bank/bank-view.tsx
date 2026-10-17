"use client";

import { useState, useTransition } from "react";
import { entryLabel } from "@/lib/bank/label";
import {
  addManualBullet, addManualEntry, deleteBulletAction, deleteEntryAction, editBullet, editEntry, moveBullet, toggleBullet, toggleEntry, type BankActionResult,
} from "./actions";

export type BadgeLabel = "CV" | "LinkedIn" | "Post" | "Manual";
type Section = "experience" | "projects" | "leadership";
type ViewBullet = { id: string; text: string; pinned: boolean; hidden: boolean; badges: BadgeLabel[] };
type ViewEntry = {
  id: string; section: Section; org: string; title: string; dates: string; location: string;
  pinned: boolean; hidden: boolean; badges: BadgeLabel[]; bullets: ViewBullet[];
};

const SECTIONS: { key: Section; label: string }[] = [
  { key: "experience", label: "Experience" }, { key: "projects", label: "Projects" }, { key: "leadership", label: "Leadership" },
];
const btn = "flex min-h-11 items-center rounded-full border-2 border-[#E6E6EF] bg-white px-4 text-sm font-bold hover:bg-[#F6F6FA] disabled:opacity-50";
const input = "min-h-11 w-full rounded-xl border-2 border-[#E6E6EF] bg-white px-3 text-sm";

function Badges({ labels }: { labels: BadgeLabel[] }) {
  return <>{labels.map((l) => <span key={l} className="rounded-full bg-[#F6F6FA] px-2 py-0.5 text-xs font-bold">{l}</span>)}</>;
}

function Toggle({ label, on, onClick, disabled }: { label: string; on: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} disabled={disabled}
      className={`${btn} ${on ? "!bg-foreground !text-background" : ""}`}>{label}</button>
  );
}

export function BankView({ entries }: { entries: ViewEntry[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [newText, setNewText] = useState("");
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const run = (fn: () => Promise<BankActionResult>, onOk?: () => void) => start(async () => {
    const r = await fn();
    if ("error" in r) { setError(r.error); return; }
    setError(null);
    onOk?.();
  });

  async function submitEntry(fd: FormData) {
    const f = (k: string) => String(fd.get(k) ?? "");
    run(() => addManualEntry({ section: f("section") as Section, org: f("org"), title: f("title"), dates: f("dates"), location: f("location") }), () => setShowEntryForm(false));
  }

  function submitEntryEdit(id: string, fd: FormData) {
    const f = (k: string) => String(fd.get(k) ?? "");
    run(() => editEntry(id, { org: f("org"), title: f("title"), dates: f("dates"), location: f("location") }), () => setEditingEntry(null));
  }

  return (
    <div className="space-y-8">
      <p role="alert" className="min-h-0 text-sm font-semibold text-[#B42318]">{error}</p>
      {SECTIONS.map(({ key, label }) => {
        const list = entries.filter((e) => e.section === key);
        if (list.length === 0) return null;
        return (
          <section key={key} aria-labelledby={`sec-${key}`}>
            <h2 id={`sec-${key}`} className="mb-3 text-lg font-extrabold">{label}</h2>
            <ul className="space-y-4">
              {list.map((e) => (
                <li key={e.id} className={`rounded-2xl border-2 border-[#E6E6EF] bg-white p-4 ${e.hidden ? "opacity-60" : ""}`}>
                  {editingEntry === e.id ? (
                    <form action={(fd) => submitEntryEdit(e.id, fd)} className="space-y-2" aria-label={`Edit ${entryLabel(e) || "entry"}`}>
                      <label className="block text-sm font-bold">Organisation<input name="org" defaultValue={e.org} maxLength={120} className={input} /></label>
                      <label className="block text-sm font-bold">Title<input name="title" defaultValue={e.title} required maxLength={120} className={input} /></label>
                      <label className="block text-sm font-bold">Dates<input name="dates" defaultValue={e.dates} maxLength={80} placeholder="Jun 2024 - Aug 2024" className={input} /></label>
                      <label className="block text-sm font-bold">Location<input name="location" defaultValue={e.location} maxLength={80} className={input} /></label>
                      <div className="flex gap-2">
                        <button type="submit" disabled={pending} className={`${btn} !bg-foreground !text-background`}>Save entry</button>
                        <button type="button" onClick={() => setEditingEntry(null)} className={btn}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold">{entryLabel(e) || "Untitled entry"}</h3>
                        <p className="text-sm text-[#5B5B6B]">{[e.dates, e.location].filter(Boolean).join(" · ")}</p>
                        <div className="mt-1 flex gap-1"><Badges labels={e.badges} /></div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Toggle label={e.pinned ? "Pinned" : "Pin"} on={e.pinned} disabled={pending} onClick={() => run(() => toggleEntry(e.id, "pinned"))} />
                        <Toggle label={e.hidden ? "Hidden" : "Hide"} on={e.hidden} disabled={pending} onClick={() => run(() => toggleEntry(e.id, "hidden"))} />
                        <button type="button" className={btn} onClick={() => { setEditingEntry(e.id); setConfirmDelete(null); }}
                          aria-label={`Edit entry: ${entryLabel(e) || "Untitled entry"}`}>Edit</button>
                        {confirmDelete === e.id ? (
                          <>
                            <button type="button" className={`${btn} !border-[#B42318] !text-[#B42318]`} disabled={pending}
                              onClick={() => run(() => deleteEntryAction(e.id), () => setConfirmDelete(null))}>Confirm delete</button>
                            <button type="button" className={btn} onClick={() => setConfirmDelete(null)}>Keep</button>
                          </>
                        ) : (
                          <button type="button" className={btn} disabled={pending} onClick={() => setConfirmDelete(e.id)}
                            aria-label={`Delete entry: ${entryLabel(e) || "Untitled entry"}`}>Delete</button>
                        )}
                      </div>
                    </div>
                  )}
                  <ul className="mt-3 space-y-2">
                    {e.bullets.map((b, i) => (
                      <li key={b.id} className={`rounded-xl bg-[#F6F6FA] p-3 ${b.hidden ? "opacity-60" : ""}`}>
                        {editing === b.id ? (
                          <form action={() => run(() => editBullet(b.id, draft), () => setEditing(null))} className="space-y-2">
                            <label htmlFor={`edit-${b.id}`} className="text-sm font-bold">Edit bullet</label>
                            <textarea id={`edit-${b.id}`} value={draft} onChange={(ev) => setDraft(ev.target.value)} rows={3} maxLength={300}
                              className="w-full rounded-xl border-2 border-[#E6E6EF] bg-white p-3 text-sm" />
                            <div className="flex gap-2">
                              <button type="submit" disabled={pending} className={`${btn} !bg-foreground !text-background`}>Save</button>
                              <button type="button" onClick={() => setEditing(null)} className={btn}>Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <p className="text-sm">{b.text}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badges labels={b.badges} />
                              <Toggle label={b.pinned ? "Pinned" : "Pin"} on={b.pinned} disabled={pending} onClick={() => run(() => toggleBullet(b.id, "pinned"))} />
                              <Toggle label={b.hidden ? "Hidden" : "Hide"} on={b.hidden} disabled={pending} onClick={() => run(() => toggleBullet(b.id, "hidden"))} />
                              <button type="button" className={btn} onClick={() => { setEditing(b.id); setDraft(b.text); }} aria-label={`Edit bullet: ${b.text.slice(0, 40)}`}>Edit</button>
                              <button type="button" className={btn} disabled={pending || i === 0} onClick={() => run(() => moveBullet(b.id, -1))} aria-label="Move bullet up">Up</button>
                              <button type="button" className={btn} disabled={pending || i === e.bullets.length - 1} onClick={() => run(() => moveBullet(b.id, 1))} aria-label="Move bullet down">Down</button>
                              <button type="button" className={btn} disabled={pending} onClick={() => run(() => deleteBulletAction(b.id))} aria-label={`Delete bullet: ${b.text.slice(0, 40)}`}>Delete</button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  {adding === e.id ? (
                    <form action={() => run(() => addManualBullet(e.id, newText), () => { setAdding(null); setNewText(""); })} className="mt-3 space-y-2">
                      <label htmlFor={`add-${e.id}`} className="text-sm font-bold">New bullet</label>
                      <textarea id={`add-${e.id}`} value={newText} onChange={(ev) => setNewText(ev.target.value)} rows={3} maxLength={300}
                        className="w-full rounded-xl border-2 border-[#E6E6EF] bg-white p-3 text-sm" />
                      <div className="flex gap-2">
                        <button type="submit" disabled={pending} className={`${btn} !bg-foreground !text-background`}>Add bullet</button>
                        <button type="button" onClick={() => setAdding(null)} className={btn}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <button type="button" className={`${btn} mt-3`} onClick={() => { setAdding(e.id); setNewText(""); }}>Add a bullet</button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {entries.length === 0 && <p className="text-sm text-[#5B5B6B]">Your bank is empty. Upload a CV or add an entry by hand.</p>}
      {showEntryForm ? (
        <form action={submitEntry} className="space-y-3 rounded-2xl border-2 border-[#E6E6EF] bg-white p-4">
          <h2 className="font-extrabold">Add an entry</h2>
          <label htmlFor="entry-section" className="block text-sm font-bold">Section
            <select id="entry-section" name="section" className={input} defaultValue="experience">
              {SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold">Organisation<input name="org" required maxLength={120} className={input} /></label>
          <label className="block text-sm font-bold">Title<input name="title" required maxLength={120} className={input} /></label>
          <label className="block text-sm font-bold">Dates<input name="dates" maxLength={60} placeholder="Jun 2024 - Aug 2024" className={input} /></label>
          <label className="block text-sm font-bold">Location<input name="location" maxLength={120} className={input} /></label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={`${btn} !bg-foreground !text-background`}>Add entry</button>
            <button type="button" onClick={() => setShowEntryForm(false)} className={btn}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" className={btn} onClick={() => setShowEntryForm(true)}>Add an entry</button>
      )}
    </div>
  );
}
