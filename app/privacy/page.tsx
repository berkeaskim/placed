import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy — Placed" };

const H2 = "mt-8 text-lg font-extrabold tracking-tight";
const P = "mt-2 text-[15px] leading-relaxed text-[#4A4A57]";
const UL = "mt-2 list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-[#4A4A57]";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm font-semibold text-[#5B3DF5]">← Placed</Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Privacy</h1>
      <p className={P}>Last updated 15 October 2026. This covers the Placed website and the Placed Autopilot Chrome extension.</p>

      <h2 className={H2}>What we store</h2>
      <ul className={UL}>
        <li>Your account email.</li>
        <li>The CVs you upload, their scores and the tailored versions you create.</li>
        <li>Your profile, saved jobs, tracked applications and progress (XP, badges).</li>
        <li>Your Autopilot answers (the Answer Vault): the details you enter once so forms can be filled for you.</li>
        <li>If you connect Gmail: read-only access, used to spot replies from employers about your applications. We never send email.</li>
      </ul>
      <p className={P}>Data is stored with Supabase in the EU (Dublin). We do not sell it or use it for advertising.</p>

      <h2 className={H2}>AI processing</h2>
      <p className={P}>
        To score and tailor your CV and draft answers, the relevant text is sent to our AI providers (Google Gemini and Anthropic).
        Tailoring never invents experience: every claim must trace back to your CV.
      </p>

      <h2 className={H2}>The Autopilot extension</h2>
      <ul className={UL}>
        <li>It runs only on Greenhouse, Ashby and Lever application pages, and on the Placed site (to show it is installed).</li>
        <li>When you press <strong>Open &amp; fill</strong> in Placed, it collects a one-time pack of your answers (valid once, for 10 minutes) and your tailored CV, and fills the form in your browser.</li>
        <li>It never presses Submit and never sends your data to the employer. You review the form and submit it yourself.</li>
        <li>It does not read your browsing history or any other page, and it does not collect analytics.</li>
        <li>The <code>debugger</code> permission is used only to click dropdowns that ignore ordinary clicks, inside the form field Autopilot marked. It is detached when filling ends.</li>
        <li>Diversity questions, consent boxes and declarations are always left for you.</li>
      </ul>

      <h2 className={H2}>Your control</h2>
      <p className={P}>
        You can delete your CVs, scores, applications and progress at any time from <strong>Settings</strong>. Removing the extension stops all
        form filling immediately.
      </p>

      <h2 className={H2}>Contact</h2>
      <p className={P}>Questions about your data: use the contact email on the Placed Autopilot Chrome Web Store listing.</p>
    </main>
  );
}
