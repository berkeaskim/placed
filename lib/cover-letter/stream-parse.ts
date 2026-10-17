// Streaming parser for inline source markers: ⟦me:b12,b14⟧ at the end of a sentence.
// Strips markers from the displayable text and attaches their refs to the sentence
// that precedes them, even when a marker is split across stream chunks.

export type Marked = { text: string; about: "me" | "them" | "you" | null; refs: string[] };

const OPEN = "⟦";
const CLOSE = "⟧";
const MARKER = /^⟦(me|them|you):([a-z0-9_,:-]+)⟧$/;
// A buffer that could still grow into a valid marker (no closing bracket yet).
const MARKER_PREFIX = /^⟦(?:m|me|t|th|the|them|y|yo|you|(?:me|them|you):[a-z0-9_,:-]*)?$/;

export class MarkerParser {
  private pending = ""; // sentence text since the last marker or paragraph break
  private held = ""; // possible marker prefix, starting with ⟦, not yet shown

  push(delta: string): { visible: string; closed: Marked[] } {
    let visible = "";
    const closed: Marked[] = [];
    const show = (s: string) => {
      visible += s;
      this.pending += s;
      if (this.pending.endsWith("\n\n")) {
        this.closeSentence(closed, null, []);
      }
    };

    for (const ch of delta) {
      if (this.held) {
        this.held += ch;
        if (ch === CLOSE) {
          const m = MARKER.exec(this.held);
          if (m) {
            this.closeSentence(closed, m[1] as "me" | "them" | "you", m[2].split(",").filter(Boolean));
          } else {
            show(this.held);
          }
          this.held = "";
        } else if (!MARKER_PREFIX.test(this.held)) {
          // Cannot become a marker: release it as ordinary text.
          const text = this.held;
          this.held = "";
          if (ch === OPEN) {
            show(text.slice(0, -1));
            this.held = OPEN;
          } else {
            show(text);
          }
        }
      } else if (ch === OPEN) {
        this.held = OPEN;
      } else {
        show(ch);
      }
    }
    return { visible, closed };
  }

  /** Flush trailing unmarked text. A marker left unfinished is dropped; it was never shown. */
  end(): Marked[] {
    const closed: Marked[] = [];
    this.held = "";
    this.closeSentence(closed, null, []);
    return closed;
  }

  private closeSentence(out: Marked[], about: Marked["about"], refs: string[]) {
    const text = this.pending.trim();
    this.pending = "";
    if (text) out.push({ text, about, refs });
  }
}
