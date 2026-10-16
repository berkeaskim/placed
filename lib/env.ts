export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  gmailTokenKey: process.env.GMAIL_TOKEN_KEY ?? "",
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "1",
  autopilot: process.env.NEXT_PUBLIC_AUTOPILOT === "1",
  // Chrome Web Store listing for the Autopilot extension; until it is set, the site offers the packed zip instead.
  autopilotStoreUrl: process.env.NEXT_PUBLIC_AUTOPILOT_STORE_URL ?? "",
};
