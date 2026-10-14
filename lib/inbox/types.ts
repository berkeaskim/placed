import type { AppStatus } from "@/lib/types";

export const INBOX_KINDS = ["received", "assessment", "interview", "offer", "rejection", "other"] as const;
export type InboxKind = (typeof INBOX_KINDS)[number];
export type InboxEffect = "moved" | "suggested" | "none" | "undone";

/** One email as the agent sees it: never stored in full (spec §2.2, §4). `date` is ISO 8601. */
export type RawEmail = { id: string; from: string; subject: string; date: string; text: string };

export type Classification = {
  kind: InboxKind; company: string | null; roleHint: string | null;
  deadline: string | null; actionUrl: string | null; confidence: number;
};

export type AppRef = { id: string; jobId: string; status: AppStatus; company: string; title: string };
