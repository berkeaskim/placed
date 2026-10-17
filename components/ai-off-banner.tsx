import Link from "next/link";

/** Shown on every app page while no AI provider is set up: AI features are off until one is chosen. */
export function AiOffBanner() {
  return (
    <div role="status" className="border-b-2 border-[#F2C94C] bg-[#FFF8E1] px-4 py-2.5 text-sm text-[#5C4A00] sm:px-8">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-2">
        <span><strong>AI isn&apos;t set up.</strong> CV scoring, tailoring and cover letters need a model.</span>
        <Link href="/settings/ai" className="font-bold underline">Set up AI</Link>
      </div>
    </div>
  );
}
