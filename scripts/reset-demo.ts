/**
 * Wipes the demo user's data (CVs, scores, matches, applications, XP, badges, confirmed facts, stored files) and resets
 * the profile to "not onboarded", reusing lib/db/reset.ts resetUserData (C14b). The auth account is kept.
 * Run right before presenting: npm run demo:reset
 * Fails with a clear message when a required migration hasn't been applied.
 */
import { scriptClient } from "./db";
import { resetUserData } from "@/lib/db/reset";
import { demoCredentials, demoPreflight, findUserByEmail } from "@/lib/demo/admin";

async function main() {
  const { email } = demoCredentials(process.env);
  const db = scriptClient();
  const problems = await demoPreflight(db);
  const blocking = problems.filter((p) => !p.startsWith("the demo job"));
  if (blocking.length) throw new Error(`the database isn't ready for the demo:\n- ${blocking.join("\n- ")}`);
  for (const p of problems) console.warn(`warning: ${p}`);
  const u = await findUserByEmail(db, email);
  if (!u) throw new Error(`demo user ${email} not found: run npm run demo:user first`);
  await resetUserData(db, u.id);
  console.log(`demo user reset: ${email}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
