import { describe, expect, it } from "vitest";
import { MarkerParser, type Marked } from "@/lib/cover-letter/stream-parse";

function run(deltas: string[]) {
  const p = new MarkerParser();
  let visible = "";
  const closed: Marked[] = [];
  const visibleAfterEach: string[] = [];
  for (const d of deltas) {
    const r = p.push(d);
    visible += r.visible;
    closed.push(...r.closed);
    visibleAfterEach.push(visible);
  }
  closed.push(...p.end());
  return { visible, closed, visibleAfterEach };
}

describe("MarkerParser", () => {
  it("never shows a marker split across three deltas", () => {
    const { visibleAfterEach, visible, closed } = run(["I ran the desk.⟦me:b1", "2,b", "14⟧ Next."]);
    for (const v of visibleAfterEach) {
      expect(v).not.toContain("⟦");
      expect(v).not.toContain("b12");
    }
    expect(visibleAfterEach[0]).toBe("I ran the desk.");
    expect(visible).toBe("I ran the desk. Next.");
    expect(closed[0]).toEqual({ text: "I ran the desk.", about: "me", refs: ["b12", "b14"] });
  });

  it("holds back a lone opening bracket and a partial kind", () => {
    const p = new MarkerParser();
    expect(p.push("Hi.⟦").visible).toBe("Hi.");
    expect(p.push("th").visible).toBe("");
    expect(p.push("em:f1⟧").visible).toBe("");
  });

  it("splits two marked sentences with the right refs", () => {
    const { closed } = run(["I ran the desk.⟦me:b12,b14⟧ Your rotation…⟦them:fact2⟧"]);
    expect(closed).toEqual([
      { text: "I ran the desk.", about: "me", refs: ["b12", "b14"] },
      { text: "Your rotation…", about: "them", refs: ["fact2"] },
    ]);
  });

  it("closes unmarked text at a paragraph break with about null", () => {
    const { closed, visible } = run(["No marker here.\n\nNext.⟦you:x_1⟧"]);
    expect(closed).toEqual([
      { text: "No marker here.", about: null, refs: [] },
      { text: "Next.", about: "you", refs: ["x_1"] },
    ]);
    expect(visible).toBe("No marker here.\n\nNext.");
  });

  it("detects a paragraph break split across deltas", () => {
    const { closed } = run(["Plain.\n", "\nMore.⟦me:a⟧"]);
    expect(closed.map((c) => c.about)).toEqual([null, "me"]);
  });

  it("flushes trailing unmarked text on end()", () => {
    const { closed } = run(["Trailing words"]);
    expect(closed).toEqual([{ text: "Trailing words", about: null, refs: [] }]);
  });

  it("treats a malformed marker as literal text", () => {
    const { visible, closed } = run(["A ⟦bogus:x⟧ b.⟦me:r1⟧"]);
    expect(visible).toBe("A ⟦bogus:x⟧ b.");
    expect(closed).toEqual([{ text: "A ⟦bogus:x⟧ b.", about: "me", refs: ["r1"] }]);
  });

  it("visible equals the input with markers removed, for any chunking", () => {
    const input = "One.⟦me:b1⟧ Two.⟦them:f1,f2⟧\n\nThree.⟦you:p-1⟧ Four";
    const expected = "One. Two.\n\nThree. Four";
    for (let size = 1; size <= input.length; size++) {
      const chunks: string[] = [];
      for (let i = 0; i < input.length; i += size) chunks.push(input.slice(i, i + size));
      const { visible, closed } = run(chunks);
      expect(visible).toBe(expected);
      expect(closed.map((c) => c.about)).toEqual(["me", "them", "you", null]);
    }
  });

  it("drops a marker left unfinished at end() without showing it", () => {
    const { visible, closed } = run(["Done.⟦me:b1"]);
    expect(visible).toBe("Done.");
    expect(closed).toEqual([{ text: "Done.", about: null, refs: [] }]);
  });
});
