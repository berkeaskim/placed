"use client";
import { useMemo, useSyncExternalStore } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(REDUCED);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/** `prefers-reduced-motion: reduce`, live (false on the server). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(REDUCED).matches, () => false);
}

const PARAGRAPH = /\n[ \t]*\n/;
const SENTENCE_END = /[.!?…]["'’”)\]]?(?=\s|$)/g;

/** The text up to its last finished sentence (or paragraph break), so a reduced-motion reader never sees half a sentence. */
export function upToSentence(text: string): string {
  let cut = 0;
  for (const m of text.matchAll(SENTENCE_END)) cut = m.index + m[0].length;
  const para = text.lastIndexOf("\n\n");
  return text.slice(0, Math.max(cut, para >= 0 ? para + 2 : 0));
}

/** Paragraphs of tokens: words (each keeps its trailing space) or, by sentence, whole sentences. */
export function tokenize(text: string, bySentence: boolean): string[][] {
  if (!text) return [];
  return text.split(PARAGRAPH).map((p) => (bySentence ? p.split(/(?<=[.!?…]["'’”)\]]?\s)/) : p.split(/(?<=\s)/)).filter(Boolean));
}

/**
 * The streamed text as paragraphs of tokens to render as `.w` spans. Each token keeps its index as its React key, so
 * a new delta only mounts the new words (they fade in from blur) and nothing already shown animates again. Under
 * reduced motion the text appears a sentence at a time; once the stream ends everything left is shown.
 */
export function useWordStream(text: string, live: boolean): string[][] {
  const reduced = useReducedMotion();
  return useMemo(() => tokenize(reduced && live ? upToSentence(text) : text, reduced), [text, live, reduced]);
}
