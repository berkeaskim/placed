/**
 * The demo persona (DEMO_EMAIL) is the LIVE public demo on prod, and .env.local points dev, scripts and tests at the
 * one production Supabase project. Anything that writes to that account (or resets its password, which logs out
 * everyone using the demo) must be opted into explicitly, every run, whatever NODE_ENV says.
 */
export const LIVE_DEMO_OPT_IN = "PLACED_ALLOW_LIVE_DEMO_WRITE";

export const liveDemoWriteAllowed = (env: Record<string, string | undefined>) => env[LIVE_DEMO_OPT_IN] === "1";

/** Throws unless PLACED_ALLOW_LIVE_DEMO_WRITE=1. Call before creating any Supabase client. */
export function assertLiveDemoWriteAllowed(env: Record<string, string | undefined>, what: string): void {
  if (liveDemoWriteAllowed(env)) return;
  throw new Error(
    `Refusing to run ${what}: it writes to the demo account, which is the LIVE public demo (real people and judges use it ` +
    `on prod), and .env.local points at the production database. Only run it with Berke's explicit OK: ` +
    `${LIVE_DEMO_OPT_IN}=1 npm run <script>. For testing, use the e2e persona (E2E_USER_EMAIL / E2E_USER_PASSWORD).`,
  );
}

/** Throws if the e2e persona is the demo account: tests must never sign in as the live demo. */
export function assertSeparateE2eUser(env: Record<string, string | undefined>): void {
  const e2e = env.E2E_USER_EMAIL?.trim().toLowerCase();
  const demo = env.DEMO_EMAIL?.trim().toLowerCase();
  if (e2e && demo && e2e === demo) {
    throw new Error(
      "E2E_USER_EMAIL is the demo account (DEMO_EMAIL), which is the LIVE public demo on the production database. " +
      "Point E2E_USER_EMAIL / E2E_USER_PASSWORD at the dedicated e2e test account instead.",
    );
  }
}
