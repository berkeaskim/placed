import { redirect } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";

/** No landing page: the local user goes straight to onboarding, or to the feed once onboarded. */
export default async function Home() {
  await connection();
  const { user } = await requireUser();
  const p = db.select({ onboarded: profiles.onboarded }).from(profiles).where(eq(profiles.user_id, user.id)).get();
  redirect(p?.onboarded ? "/feed" : "/onboarding");
}
