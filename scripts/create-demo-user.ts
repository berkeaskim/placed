/**
 * Creates (or updates) the demo auth user for the FICTIONAL persona Ayşe Demir via the Supabase admin API.
 * Credentials come from DEMO_EMAIL / DEMO_PASSWORD in .env.local (never printed). Run by a human, once:
 *   npm run demo:user
 * Then `npm run demo:reset` before each demo. The app's "Try the demo" button signs in with the same pair.
 */
import { scriptClient } from "./db";
import { DEMO_FULL_NAME, demoCredentials, demoPreflight, findUserByEmail, isAlreadyRegistered } from "@/lib/demo/admin";

async function main() {
  const { email, password } = demoCredentials(process.env);
  const db = scriptClient();
  const meta = { full_name: DEMO_FULL_NAME, demo: true };
  const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
  if (error) {
    if (!isAlreadyRegistered(error.message)) throw new Error(`creating the demo user failed: ${error.message}`);
    const u = await findUserByEmail(db, email);
    if (!u) throw new Error(`Supabase says ${email} exists, but it isn't in the user list`);
    const up = await db.auth.admin.updateUserById(u.id, { password, email_confirm: true, user_metadata: meta });
    if (up.error) throw new Error(`updating the demo user failed: ${up.error.message}`);
    console.log(`demo user updated: ${email} (password reset to DEMO_PASSWORD)`);
  } else {
    console.log(`demo user created: ${email}`);
  }
  const problems = await demoPreflight(db);
  for (const p of problems) console.warn(`warning: ${p}`);
  if (!problems.length) console.log("database ready for the demo");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
