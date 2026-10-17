import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Fredoka } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });
const quest = Fredoka({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-quest" });

export const metadata: Metadata = {
  title: "Placed — internships that actually fit you",
  description: "Find UK internships, score your CV, tailor it honestly.",
  // <meta name="placed-app" content="1">: the Autopilot extension's placed-bridge.js looks for it to learn which
  // localhost origin the app runs on, so Open & fill still works when the port changes.
  other: { "placed-app": "1" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body className={`${font.variable} ${quest.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
