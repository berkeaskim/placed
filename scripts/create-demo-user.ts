/**
 * Creates the demo auth user for the FICTIONAL persona Ayşe Demir via the Supabase admin API, if it is missing.
 * Credentials come from DEMO_EMAIL / DEMO_PASSWORD in .env.local (never printed). Run by a human, once, with Berke's OK:
 *   PLACED_ALLOW_LIVE_DEMO_WRITE=1 npm run demo:user
 * An existing account is never given a new password: that revokes every session and logs out everyone on the live demo.
 * An existing account not yet marked as the demo account (user_metadata.demo) is only marked with --force.
 */
import { scriptClient } from "./db";
import { DEMO_FULL_NAME, canOverwriteExistingUser, demoCredentials, demoPreflight, findUserByEmail, hasForceFlag, isAlreadyRegistered } from "@/lib/demo/admin";
import { assertLiveDemoWriteAllowed } from "@/lib/demo/guard";

async function main() {
  assertLiveDemoWriteAllowed(process.env, "demo:user");
  const { email, password } = demoCredentials(process.env);
  const db = scriptClient();
  const meta = { full_name: DEMO_FULL_NAME, demo: true };
  const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
  if (error) {
    if (!isAlreadyRegistered(error.message)) throw new Error(`creating the demo user failed: ${error.message}`);
    const u = await findUserByEmail(db, email);
    if (!u) throw new Error(`Supabase says ${email} exists, but it isn't in the user list`);
    if (u.user_metadata?.demo !== true) {
      const allowed = canOverwriteExistingUser(u, hasForceFlag(process.argv));
      if (!allowed.ok) throw new Error(allowed.reason);
      // Metadata only: a password or email change would revoke the account's sessions.
      const up = await db.auth.admin.updateUserById(u.id, { user_metadata: { ...u.user_metadata, ...meta } });
      if (up.error) throw new Error(`marking the demo user failed: ${up.error.message}`);
      console.log(`demo user marked: ${email} (password unchanged)`);
    } else {
      console.log(`demo user already exists: ${email} (left unchanged; its password is never reset here)`);
    }
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
