import type { DefendQuestion, DefendSource } from "@/lib/tailor/view";
import { AiWrittenTag } from "@/components/ai-written-tag";
import { Stagger, StaggerItem } from "@/components/agent/reveal";
import { ChatIcon } from "./icons";

/** C13 "Be ready to defend this": one likely interview question per accepted line. */
export function DefendList({ bullets, questions, source = "ai" }: { bullets: { id: string; after: string }[]; questions: DefendQuestion[]; source?: DefendSource }) {
  const byId = new Map(questions.map((q) => [q.bulletId, q]));
  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {source === "ai" ? (
          <><AiWrittenTag />Likely questions suggested by AI. Use them to prepare, not as a script.</>
        ) : (
          <>The AI was unavailable, so these are automatic suggestions based on each line.</>
        )}
      </p>
      <Stagger as="ul" className="flex flex-col gap-2 text-sm">
        {bullets.map((b) => {
          const q = byId.get(b.id);
          if (!q) return null;
          return (
            <StaggerItem as="li" key={b.id} className="flex flex-col gap-1 rounded-xl bg-[#F6F6FA] p-3">
              <span className="text-xs italic text-muted-foreground">&ldquo;{b.after}&rdquo;</span>
              <span className="flex gap-1.5 font-bold"><ChatIcon size={16} className="mt-0.5 shrink-0 text-[#5B3DF5]" />{q.question}</span>
              <span className="text-xs text-[#4A4A57]"><span className="font-bold">Why they ask: </span>{q.whyTheyAsk}</span>
              <span className="text-xs text-[#4A4A57]"><span className="font-bold">Prepare: </span>{q.prepTip}</span>
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}
