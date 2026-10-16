/** Shown the instant a link inside the app is clicked, while the server renders the next page. */
export default function Loading() {
  const bar = "rounded-full bg-[#ECECF3] motion-safe:animate-pulse";
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <div className="flex gap-2" aria-hidden="true">
        {[112, 120, 96].map((w) => <div key={w} className={`h-11 ${bar}`} style={{ width: w }} />)}
      </div>
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className={`h-8 w-2/3 max-w-[480px] ${bar}`} />
        <div className={`h-4 w-1/2 max-w-[360px] ${bar}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]" aria-hidden="true">
        <div className="card-quest flex h-56 flex-col gap-3 p-5">
          <div className={`h-5 w-24 ${bar}`} />
          <div className={`h-28 w-28 ${bar}`} />
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-[14px] bg-[#F3F3F8] motion-safe:animate-pulse" />)}
        </div>
      </div>
    </div>
  );
}
