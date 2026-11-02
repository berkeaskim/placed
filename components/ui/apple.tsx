"use client";
import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import type { ActionResult } from "@/app/(app)/settings/ai/actions";

/*
 * Settings → AI follows macOS System Settings: grouped inset lists on a grey ground, hairline inset separators, small
 * rounded-square icons, the value or state on the trailing edge, and instant press feedback. Accent = the app tint.
 */

const press = "transition-[background-color,transform,box-shadow] duration-100 ease-out active:scale-[0.97] motion-reduce:active:scale-100";
export const btn = `inline-flex min-h-10 sm:min-h-8 items-center justify-center gap-1.5 rounded-[9px] bg-black/[0.055] px-3.5 text-[13px] font-semibold text-foreground hover:bg-black/[0.085] disabled:cursor-not-allowed disabled:opacity-45 ${press}`;
export const btnPrimary = `inline-flex min-h-10 sm:min-h-8 items-center justify-center gap-1.5 rounded-[9px] bg-[#5B3DF5] px-3.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(91,61,245,0.35)] hover:bg-[#4F33E8] disabled:cursor-not-allowed disabled:opacity-45 ${press}`;
export const field =
  "min-h-10 sm:min-h-8 w-full rounded-[9px] border border-black/[0.12] bg-white px-3 py-1.5 text-base sm:text-[13px] outline-none transition-[border-color,box-shadow] duration-100 placeholder:text-black/35 focus:border-[#5B3DF5] focus:ring-[3px] focus:ring-[#5B3DF5]/20";

/** Runs a server action in a transition and keeps its last result for display. */
export function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setResult(null);
      try {
        setResult(await fn());
      } catch {
        setResult({ ok: false, error: "Something went wrong. Please try again." });
      }
    });
  return { pending, result, run, clear: () => setResult(null) };
}

export function ResultLine({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return result.ok ? (
    <p role="status" className="text-[13px] font-medium text-[#248A3D]">{result.message ?? "Done."}</p>
  ) : (
    <p role="alert" className="break-words text-[13px] font-medium text-[#D70015]">{result.error}</p>
  );
}

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[9px] bg-black/[0.045] px-3 py-1.5">
      <code className="min-w-0 flex-1 truncate font-mono text-xs">{command}</code>
      <button
        type="button"
        className="shrink-0 text-xs font-semibold text-[#5B3DF5] hover:underline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // clipboard blocked (e.g. non-secure context): the command stays visible to copy by hand
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** A titled inset group of rows, with an optional footnote under it (System Settings style). */
export function Group({ title, footer, children, id }: { title?: string; footer?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="flex flex-col gap-1.5 scroll-mt-20">
      {title ? <h2 className="px-3 text-[13px] font-semibold text-black/50">{title}</h2> : null}
      <div className="overflow-hidden rounded-[12px] bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.09),0_1px_3px_rgba(0,0,0,0.05)]">{children}</div>
      {footer ? <div className="px-3 text-[12px] leading-[1.45] text-black/50">{footer}</div> : null}
    </section>
  );
}

/** Hairline separator inset past the icon, hidden on the last row. */
const rowSep = "relative after:pointer-events-none after:absolute after:bottom-0 after:right-0 after:h-px after:bg-black/[0.07] last:after:hidden";

type RowProps = {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  /** Makes the row a button (selection lists, disclosure rows). */
  onClick?: () => void;
  /** Makes the row a navigation link (with a chevron), like a System Settings pane row. */
  href?: string;
  disabled?: boolean;
  selected?: boolean;
  children?: ReactNode;
  className?: string;
};

export function Row({ icon, title, subtitle, trailing, onClick, href, disabled, selected, children, className = "" }: RowProps) {
  const inset = icon ? "after:left-[52px]" : "after:left-4";
  const header = (
    <span className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5">
      {icon}
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="text-[14px] font-medium leading-tight tracking-[-0.01em] text-black/90">{title}</span>
        {subtitle ? <span className="mt-0.5 text-[12px] leading-snug text-black/50">{subtitle}</span> : null}
      </span>
      {trailing || href ? (
        <span className="flex shrink-0 items-center gap-2 text-[13px] text-black/50">
          {trailing}
          {href ? <Chevron /> : null}
        </span>
      ) : null}
    </span>
  );
  // Only the header is interactive; expanded content (forms, pickers) sits beside it, never inside a button or link.
  const interactive = "block w-full transition-colors duration-75 hover:bg-black/[0.025] active:bg-black/[0.06] focus-visible:bg-[#5B3DF5]/[0.07] focus-visible:outline-none";
  const head = href ? (
    <Link href={href} className={interactive}>
      {header}
    </Link>
  ) : onClick ? (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected} className={`${interactive} disabled:cursor-wait`}>
      {header}
    </button>
  ) : (
    header
  );
  return (
    <div className={`${rowSep} ${inset} ${className}`}>
      {head}
      {children}
    </div>
  );
}

const ICON_BG: Record<string, string> = {
  openrouter: "from-[#6E5BFF] to-[#4B32E0]",
  codex: "from-[#2A2A2E] to-[#0D0D10]",
  ollama: "from-[#8E8E93] to-[#5E5E63]",
  anthropic: "from-[#E0896A] to-[#C46647]",
  gemini: "from-[#4F8DF7] to-[#2563D9]",
  off: "from-[#C7C7CC] to-[#AEAEB2]",
  autopilot: "from-[#7B61FF] to-[#5B3DF5]",
  chrome: "from-[#5AC8FA] to-[#007AFF]",
  memory: "from-[#FFB340] to-[#FF9500]",
  story: "from-[#FF6482] to-[#FF2D55]",
};

const GLYPH: Record<string, ReactNode> = {
  // a route forking to many models
  openrouter: <path d="M4 12h5l3-5h4M12 12l3 5h4M9 12h3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  // speech bubble
  codex: <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4h0.5A2.5 2.5 0 0 1 5 12.5z" fill="none" strokeWidth={1.9} strokeLinejoin="round" />,
  // laptop
  ollama: <path d="M6 6h12v8H6zM3.5 18h17" fill="none" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />,
  // asterisk
  anthropic: <path d="M12 4v16M5 8l14 8M19 8L5 16" fill="none" strokeWidth={2} strokeLinecap="round" />,
  // four-point star
  gemini: <path d="M12 3c.6 4.6 3.4 7.4 9 9-5.6 1.6-8.4 4.4-9 9-.6-4.6-3.4-7.4-9-9 5.6-1.6 8.4-4.4 9-9z" fill="white" stroke="none" />,
  // paper plane
  autopilot: <path d="M4 11.5L20 4l-6.5 16-2.5-6.5z M11 13.5L20 4" fill="none" strokeWidth={1.9} strokeLinejoin="round" strokeLinecap="round" />,
  // puzzle piece
  chrome: <path d="M6 8h3a2 2 0 1 1 4 0h3v3a2 2 0 1 1 0 4v3H6z" fill="none" strokeWidth={1.9} strokeLinejoin="round" />,
  // clock
  memory: <path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2" fill="none" strokeWidth={1.9} strokeLinecap="round" />,
  // quote
  story: <path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6" fill="none" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />,
  off: <path d="M12 4v8M7.2 7.2a7 7 0 1 0 9.6 0" fill="none" strokeWidth={2} strokeLinecap="round" />,
};

/** Rounded-square app icon, like the sidebar icons in System Settings. */
export function AppIcon({ kind, size = 28 }: { kind: string; size?: number }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-[22%] bg-gradient-to-b shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.25),0_0.5px_1px_rgba(0,0,0,0.2)] ${ICON_BG[kind] ?? ICON_BG.off}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} stroke="white">
        {GLYPH[kind] ?? GLYPH.off}
      </svg>
    </span>
  );
}

export type Health = "ok" | "fail" | "checking" | "unknown";

const DOT: Record<Health, string> = {
  ok: "bg-[#34C759]",
  fail: "bg-[#FF3B30]",
  checking: "bg-[#FF9F0A] animate-pulse motion-reduce:animate-none",
  unknown: "bg-black/25",
};

export function StatusDot({ state }: { state: Health }) {
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${DOT[state]}`} />;
}

export function Checkmark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={17} height={17} className="text-[#5B3DF5]">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Chevron({ open = false }: { open?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={13} height={13} className={`text-black/30 transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "rotate-90" : ""}`}>
      <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Spinner() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={14} height={14} className="animate-spin text-black/40 motion-reduce:animate-none">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={3} />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}

/** iOS-style switch. */
export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5B3DF5]/30 disabled:opacity-45 ${checked ? "bg-[#34C759]" : "bg-black/[0.14]"}`}
    >
      <span
        className={`absolute top-[2px] left-[2px] size-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none ${checked ? "translate-x-4" : ""}`}
      />
    </button>
  );
}

/** "3 min ago" style label for a saved check time. */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** "$0.15 / $0.60" per million input / output tokens. */
export function price(inPerM: number, outPerM: number): string {
  const f = (n: number) => (n === 0 ? "free" : n < 0.1 ? `$${n.toFixed(3)}` : `$${n < 10 ? n.toFixed(2) : n.toFixed(0)}`);
  return inPerM === 0 && outPerM === 0 ? "Free" : `${f(inPerM)} / ${f(outPerM)}`;
}

/** A label on the leading edge and its control on the trailing edge (wraps under the label on narrow screens). */
export function FieldRow({ label, htmlFor, hint, children }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className={`${rowSep} after:left-4 flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4`}>
      <span className="flex min-w-0 flex-col sm:w-[42%] sm:shrink-0">
        <label htmlFor={htmlFor} className="text-[14px] font-medium tracking-[-0.01em] text-black/90">{label}</label>
        {hint ? <span className="mt-0.5 text-[12px] leading-snug text-black/50">{hint}</span> : null}
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2">{children}</span>
    </div>
  );
}

/** Native select styled like a macOS pop-up button. */
export const select =
  "apple-select min-h-10 sm:min-h-8 w-full min-w-0 appearance-none rounded-[9px] border border-black/[0.12] bg-white py-1.5 pr-8 pl-3 text-base sm:text-[13px] outline-none transition-[border-color,box-shadow] duration-100 focus:border-[#5B3DF5] focus:ring-[3px] focus:ring-[#5B3DF5]/20";

/** Status/feedback line under a form (inline validation, saved confirmations). */
export function Note({ tone = "muted", children }: { tone?: "muted" | "ok" | "error"; children: ReactNode }) {
  const c = tone === "ok" ? "text-[#248A3D]" : tone === "error" ? "font-medium text-[#D70015]" : "text-black/50";
  return <p role="status" className={`text-[12px] leading-snug ${c}`}>{children}</p>;
}
