import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Fredoka } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });
const quest = Fredoka({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-quest" });

export const metadata: Metadata = {
  title: "Placed — internships that actually fit you",
  description: "Find UK internships, score your CV, tailor it honestly.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className={`${font.variable} ${quest.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
