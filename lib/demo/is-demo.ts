/** The demo persona's account (DEMO_EMAIL). Its inbox is the fixture set, so the stage demo never needs real Gmail. */
export function isDemoEmail(email: string | null | undefined): boolean {
  const demo = process.env.DEMO_EMAIL?.trim().toLowerCase();
  return !!demo && !!email && email.trim().toLowerCase() === demo;
}
