import type { AppStatus } from "@/lib/types";

/** One colour per stage, used by the pipeline bar, column headers, card accents and the Move menu. */
export const STATUS_COLOR: Record<AppStatus, string> = {
  saved: "#8E8EA3",
  applied: "#5B3DF5",
  interview: "#E8890C",
  offer: "#12A150",
  rejected: "#D92D20",
};

/** Soft tint behind a column while a card is dragged over it. */
export const STATUS_TINT: Record<AppStatus, string> = {
  saved: "#F1F1F6",
  applied: "#EEEAFE",
  interview: "#FFF3E0",
  offer: "#E6F6EC",
  rejected: "#FDECEA",
};
