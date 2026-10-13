import type { DefendQuestion } from "@/lib/tailor/view";
import { ChatIcon } from "./icons";

/** C13 "Be ready to defend this": one likely interview question per accepted line. */
export function DefendList({ bullets, questions }: { bullets: { id: string; after: string }[]; questions: DefendQuestion[] }) {
  const byId = new Map(questions.map((q) => [q.bulletId, q]));
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {bullets.map((b) => {
        const q = byId.get(b.id);
        if (!q) return null;
        return (
          <li key={b.id} className="flex flex-col gap-1 rounded-xl bg-[#F6F6FA] p-3">
            <span className="text-xs italic text-muted-foreground">&ldquo;{b.after}&rdquo;</span>
            <span className="flex gap-1.5 font-bold"><ChatIcon size={16} className="mt-0.5 shrink-0 text-[#5B3DF5]" />{q.question}</span>
            <span className="text-xs text-[#4A4A57]"><span className="font-bold">Why they ask: </span>{q.whyTheyAsk}</span>
            <span className="text-xs text-[#4A4A57]"><span className="font-bold">Prepare: </span>{q.prepTip}</span>
          </li>
        );
      })}
    </ul>
  );
}
