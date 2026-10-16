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
      <p className={P}>Last updated 16 October 2026. This covers the Placed app running on your computer and the Placed Autopilot Chrome extension.</p>

      <h2 className={H2}>What is stored, and where</h2>
      <ul className={UL}>
        <li>The CVs you upload, their scores and the tailored versions you create.</li>
        <li>Your profile, saved jobs, tracked applications and progress (XP, badges).</li>
        <li>Your Autopilot answers (the Answer Vault): the details you enter once so forms can be filled for you.</li>
        <li>Your LinkedIn Score: the profile text it was built from (headline, About, experience, education, skills) and the result.</li>
        <li>The AI keys you enter in Settings, encrypted.</li>
      </ul>
      <p className={P}>Everything stays on your computer, in the <code>data/</code> folder of your Placed install. There is no Placed server and no account; nothing is sent to us.</p>

      <h2 className={H2}>AI processing</h2>
      <p className={P}>
        To score and tailor your CV and draft answers, the relevant text is sent to the AI you choose in Settings: Anthropic (Claude) or
        Google (Gemini) with your own key, or a local model through Ollama, in which case nothing leaves your computer. Tailoring never
        invents experience: every claim must trace back to your CV.
      </p>

      <h2 className={H2}>The Autopilot extension</h2>
      <ul className={UL}>
        <li>It runs only on Greenhouse, Ashby and Lever application pages, LinkedIn profile pages, and your local Placed app (to show it is installed).</li>
        <li>When you press <strong>Open &amp; fill</strong> in Placed, it collects a one-time pack of your answers (valid once, for 10 minutes) and your tailored CV, and fills the form in your browser.</li>
        <li>It never presses Submit and never sends your data to the employer. You review the form and submit it yourself.</li>
        <li>On LinkedIn it does nothing unless you press <strong>Score my LinkedIn</strong> in Placed. Then it reads only your own profile and your skills list, once, and sends that text to your local Placed app. It never edits anything on LinkedIn and never reads your contact info, messages or other people&apos;s profiles.</li>
        <li>It does not read your browsing history or any other page, and it does not collect analytics.</li>
        <li>The <code>debugger</code> permission is used only to click dropdowns that ignore ordinary clicks, inside the form field Autopilot marked. It is detached when filling ends.</li>
        <li>Diversity questions, consent boxes and declarations are always left for you.</li>
      </ul>

      <h2 className={H2}>Your control</h2>
      <p className={P}>
        You can reset all your data at any time from <strong>Settings</strong>, or delete the <code>data/</code> folder. Removing the extension
        stops all form filling immediately.
      </p>

      <h2 className={H2}>Contact</h2>
      <p className={P}>Questions or issues: open an issue on the project&apos;s GitHub repository.</p>
    </main>
  );
}
