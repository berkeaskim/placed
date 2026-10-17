// Streaming parser for inline source markers: ⟦me:b12,b14⟧ at the end of a sentence.
// Strips markers from the displayable text and attaches their refs to the sentence
// that precedes them, even when a marker is split across stream chunks.

export type Marked = { text: string; about: "me" | "them" | "you" | null; refs: string[] };

const OPEN = "⟦";
const CLOSE = "⟧";
const KNOWN = /^\u27E6\s*(me|them|you)\s*:\s*([^\u27E7]{0,80})\u27E7$/i;
// A held buffer longer than this is released as literal text, which bounds the stall.
const MAX_HELD = 120;

export class MarkerParser {
  private pending = ""; // sentence text since the last marker or paragraph break
  private held = ""; // possible marker prefix, starting with ⟦, not yet shown

  push(delta: string): { visible: string; closed: Marked[] } {
    let visible = "";
    const closed: Marked[] = [];
    const show = (s: string) => {
      visible += s;
      this.pending += s;
      if (/\r?\n\r?\n$/.test(this.pending)) {
        this.closeSentence(closed, null, []);
      }
    };

    for (const ch of delta) {
      if (this.held) {
        this.held += ch;
        if (ch === CLOSE) {
          const m = KNOWN.exec(this.held);
          if (m) {
            const refs = m[2].split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
            this.closeSentence(closed, m[1].toLowerCase() as "me" | "them" | "you", refs);
          } else {
            // Unrecognised marker: swallow it so it never reaches the UI.
            this.closeSentence(closed, null, []);
          }
          this.held = "";
        } else if (this.held.length > MAX_HELD) {
          const text = this.held;
          this.held = "";
          show(text);
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
