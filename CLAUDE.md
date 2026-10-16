## LIVE DEMO: read before running any script or test

- The "Try the demo" persona (Ayşe, `DEMO_EMAIL`) is the **live public demo** on prod. Real people and judges use it. It is not a test account.
- There is one Supabase project: local dev, scripts and Playwright (`.env.local`) all hit the **production database**.
- Never run `demo:reset`, `demo:user`, `demo:tracker`, or the demo e2e specs without Berke's explicit OK. They refuse unless `PLACED_ALLOW_LIVE_DEMO_WRITE=1`; never set it yourself.
- For testing, use the e2e test persona (`E2E_USER_EMAIL` / `E2E_USER_PASSWORD`), never the demo account.

