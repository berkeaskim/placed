"use client";
import { useId, useState } from "react";

/**
 * A text box with a suggestion list under it (ARIA combobox). Typing anything is allowed; the suggestions only
 * save typing. Arrow keys move through them, Enter picks one, Escape closes the list.
 */
export function SuggestInput({ label, value, onChange, search, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; search: (q: string) => string[]; placeholder: string; hint: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const options = open ? search(value).filter((o) => o !== value) : [];

  function pick(o: string) {
    onChange(o);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && options.length) { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % options.length); }
    else if (e.key === "ArrowUp" && options.length) { e.preventDefault(); setActive((a) => (a <= 0 ? options.length - 1 : a - 1)); }
    else if (e.key === "Enter" && active >= 0 && options[active]) { e.preventDefault(); pick(options[active]); }
    else if (e.key === "Escape") { setOpen(false); setActive(-1); }
  }

  return (
    // Room for the open list under the box, so opening or closing it never moves the buttons below.
    <div className="flex min-h-80 flex-col gap-2">
      <label htmlFor={`${id}-input`} className="sr-only">{label}</label>
      <div className="relative">
        <input id={`${id}-input`} role="combobox" aria-expanded={options.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={active >= 0 && options[active] ? `${id}-opt-${active}` : undefined} aria-describedby={`${id}-hint`}
          value={value} placeholder={placeholder} maxLength={120} autoComplete="off" autoFocus
          onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown}
          className="card-quest min-h-14 w-full px-4 text-base font-bold outline-none focus:border-primary" />
        <ul id={`${id}-list`} role="listbox" aria-label={label} hidden={!options.length}
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-[14px] border-2 bg-white py-1 shadow-lg">
          {options.map((o, i) => (
            <li key={o} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}
              // mousedown, not click: it fires before the input's blur closes the list.
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              className={`cursor-pointer px-4 py-2.5 text-sm font-semibold ${i === active ? "bg-[#EFEBFF] text-[#3A20C4]" : "hover:bg-muted"}`}>
              {o}
            </li>
          ))}
        </ul>
      </div>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
