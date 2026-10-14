/**
 * Small inline tag for model-written free text (why you fit, how to close a gap, interview questions), so a
 * suggestion is never presented as a verified fact. Server- and client-safe. A sparkle and a single glint on
 * first paint mark it as the agent's output (CSS only; off under reduced motion).
 */
export function AiWrittenTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-[#F4F1FF] px-2 py-0.5 text-[11px] font-bold text-[#3A20C4] ${className}`}
      title="Written by AI from your CV and the posting. A suggestion to check, not a verified fact."
    >
      <span className="agent-glint -mx-2 -my-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5">
        <svg aria-hidden="true" viewBox="0 0 16 16" width="10" height="10" fill="currentColor"><path d="M8 0l1.6 4.8L14.4 6.4 9.6 8 8 12.8 6.4 8 1.6 6.4 6.4 4.8z" /><path d="M13 10l.7 2.3L16 13l-2.3.7L13 16l-.7-2.3L10 13l2.3-.7z" opacity=".7" /></svg>
        AI-written
      </span>
      <span className="sr-only">: a suggestion to check, not a verified fact</span>
    </span>
  );
}
