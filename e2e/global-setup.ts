import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createServerClient } from "@supabase/ssr";
import type { FullConfig } from "@playwright/test";
import { makePdf, REALISTIC_CV } from "./fixtures/make-pdf";
import { assertSeparateE2eUser } from "../lib/demo/guard";

// Session cookies live outside the repo so they can never be committed.
const TMP = path.join(os.tmpdir(), "placed-e2e");
const AUTH_FILE = path.join(TMP, "e2e-auth.json");
const FIX_DIR = path.join(TMP, "generated");

export default async function globalSetup(config: FullConfig) {
  assertSeparateE2eUser(process.env);
  fs.mkdirSync(FIX_DIR, { recursive: true });
  fs.writeFileSync(path.join(FIX_DIR, "realistic-cv.pdf"), makePdf(REALISTIC_CV));
  fs.writeFileSync(path.join(FIX_DIR, "image-only-cv.pdf"), makePdf([], { textless: true }));
  fs.writeFileSync(path.join(FIX_DIR, "not-a-pdf.txt"), "This is my CV as plain text. Python, SQL, Excel.\n");
  // A .pdf name + application/pdf type but not real PDF bytes (magic-number check).
  fs.writeFileSync(path.join(FIX_DIR, "fake.pdf"), "Hello, I am definitely a PDF.\n");

  // Sign the e2e test user (never the live demo account) in with a password (the UI only offers magic link / Google)
  // and convert the @supabase/ssr cookies into a Playwright storageState.
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key, E2E_USER_EMAIL: email, E2E_USER_PASSWORD: password } = process.env;
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  if (!url || !key || !email || !password) {
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }
  const jar = new Map<string, string>();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`E2E user sign-in failed: ${error.message}`);
  const cookies = [...jar].map(([name, value]) => ({
    name, value, domain: "localhost", path: "/", expires: Math.floor(Date.now() / 1000) + 3600,
    httpOnly: false, secure: false, sameSite: "Lax" as const,
  }));
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies, origins: [] }, null, 2));
  void config;
}
