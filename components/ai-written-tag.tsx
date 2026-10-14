/**
 * Small inline tag for model-written free text (why you fit, how to close a gap, interview questions), so a
 * suggestion is never presented as a verified fact. Server- and client-safe.
 */
export function AiWrittenTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-[#F4F1FF] px-2 py-0.5 text-[11px] font-bold text-[#3A20C4] ${className}`}
      title="Written by AI from your CV and the posting. A suggestion to check, not a verified fact."
    >
      AI-written
      <span className="sr-only">: a suggestion to check, not a verified fact</span>
    </span>
  );
}
