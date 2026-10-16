/** Starts a guest session and drops the user into onboarding (app/start/route.ts). A form POST, never a prefetched link. */
export function StartButton({ className, children = "Get started" }: { className?: string; children?: React.ReactNode }) {
  return (
    <form action="/start" method="post">
      <button type="submit" className={className}>{children}</button>
    </form>
  );
}
