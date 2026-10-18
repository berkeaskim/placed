import type { BANK_SECTION_VALUES, BANK_SOURCE_KIND_VALUES, BANK_SUGGESTION_KIND_VALUES, BANK_SUGGESTION_STATUS_VALUES } from "../db/schema";

export type BankSection = (typeof BANK_SECTION_VALUES)[number];
export type BankSourceKind = (typeof BANK_SOURCE_KIND_VALUES)[number];
export type BankSuggestionKind = (typeof BANK_SUGGESTION_KIND_VALUES)[number];
export type BankSuggestionStatus = (typeof BANK_SUGGESTION_STATUS_VALUES)[number];

export type BankBullet = {
  id: string; entryId: string; text: string; position: number; pinned: boolean; hidden: boolean;
  sourceIds: string[]; sourceText: string | null; updatedAt: string;
};
export type BankEntry = {
  id: string; section: BankSection; org: string; title: string; dates: string;
  startYm: string | null; endYm: string | null; location: string; pinned: boolean; hidden: boolean;
  sourceIds: string[]; bullets: BankBullet[]; updatedAt: string;
};
export type Bank = { entries: BankEntry[] };

export type CandidateBullet = { text: string; sourceText: string };
export type CandidateEntry = {
  section: BankSection; org: string; title: string; dates: string;
  startYm: string | null; endYm: string | null; location: string; bullets: CandidateBullet[];
};

export type NewEntryPayload = { candidate: CandidateEntry };
export type NewBulletPayload = { text: string; sourceText: string };
export type MergeIntoPayload = { candidate: CandidateEntry; targets: string[] };
export type BankSuggestionPayload = NewEntryPayload | NewBulletPayload | MergeIntoPayload;

export type BankSuggestion = {
  id: string; sourceId: string; kind: BankSuggestionKind; targetEntryId: string | null;
  payload: BankSuggestionPayload; status: BankSuggestionStatus; createdAt: string;
};
