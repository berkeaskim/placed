import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Signs this browser out only (scope "local"): a global sign-out would also kick every other device on the account. */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/", request.url), 303);
}
