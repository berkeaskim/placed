/**
 * Creates (or re-passwords) an email + password account for the login form. Accounts are made by hand, no self sign-up:
 *   npm run user:add -- someone@ucl.ac.uk 'their-password' "Full Name"
 * The email is confirmed on creation, so the person can sign in straight away. Never touches the live demo account.
 */
import { scriptClient } from "./db";
import { findUserByEmail, isAlreadyRegistered } from "@/lib/demo/admin";

async function main() {
  const [rawEmail, password, ...nameParts] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  const fullName = nameParts.join(" ").trim();
  if (!email?.includes("@") || !password) throw new Error('usage: npm run user:add -- <email> <password> ["Full Name"]');
  if (password.length < 6) throw new Error("password must be at least 6 characters (Supabase minimum)");
  if (email === process.env.DEMO_EMAIL?.trim().toLowerCase()) throw new Error("that's the live demo account; leave it alone");
  const db = scriptClient();
  const meta = fullName ? { full_name: fullName } : {};
  const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
  if (!error) return console.log(`created: ${email}`);
  if (!isAlreadyRegistered(error.message)) throw new Error(`creating ${email} failed: ${error.message}`);
  const u = await findUserByEmail(db, email);
  if (!u) throw new Error(`Supabase says ${email} exists, but it isn't in the user list`);
  if (u.user_metadata?.demo === true) throw new Error("that's the live demo account; leave it alone");
  const up = await db.auth.admin.updateUserById(u.id, { password, email_confirm: true, user_metadata: { ...u.user_metadata, ...meta } });
  if (up.error) throw new Error(`updating ${email} failed: ${up.error.message}`);
  console.log(`already existed, password updated: ${email}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
