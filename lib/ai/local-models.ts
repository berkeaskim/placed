/**
 * Local (Ollama) models we recommend, by machine memory (RAM, or unified memory on Apple Silicon).
 * Researched 2026-10-16 for strict JSON output, CV parsing, job tagging and English CV rewriting. Each tag was checked
 * against the Ollama registry (registry.ollama.ai/v2/library/<model>/manifests/<tag>); sizeGb is that manifest's total
 * download. Sources: ollama.com/library/<model>/tags, the Qwen3.5 model card (huggingface.co/Qwen/Qwen3.5-9B: IFEval /
 * IFBench / BFCL), the Gemma 4 model card (huggingface.co/google/gemma-4-12b-it) and docs.ollama.com/capabilities/thinking.
 * Left out on purpose: gpt-oss (thinking cannot be switched off; reports of empty/invalid JSON with `format`).
 * Rule of thumb: the download should stay under ~60% of memory, leaving room for the OS, the browser and the context.
 */
export type LocalModel = {
  /** Smallest machine memory (GB) this model is meant for. */
  minRamGb: number;
  /** Exact Ollama tag, as passed to `ollama pull`. */
  tag: string;
  /** Download size in GB. */
  sizeGb: number;
  label: string;
  /** One line on why it is in the list. */
  note: string;
  /** The pick for its tier (one per tier); the others are alternatives. */
  recommended: boolean;
};

export const LOCAL_MODELS: readonly LocalModel[] = [
  { minRamGb: 8, tag: "qwen3.5:4b", sizeGb: 3.3, label: "Qwen 3.5 4B", recommended: true,
    note: "Best small all-rounder: strong instruction following (IFEval ~90) and reliable JSON for its size." },
  { minRamGb: 8, tag: "qwen3:4b-instruct", sizeGb: 2.5, label: "Qwen3 4B Instruct (2507)", recommended: false,
    note: "Smallest option: never thinks, so it answers fast on older or busy laptops." },
  { minRamGb: 16, tag: "qwen3.5:9b", sizeGb: 6.6, label: "Qwen 3.5 9B", recommended: true,
    note: "Top small-model scores on instruction following and structured output; good CV rewriting." },
  { minRamGb: 16, tag: "gemma4:12b", sizeGb: 8.0, label: "Gemma 4 12B", recommended: false,
    note: "Google's model, long context; a different writing style if Qwen's rewrites don't suit you." },
  { minRamGb: 32, tag: "qwen3.8:27b", sizeGb: 17.7, label: "Qwen 3.8 27B", recommended: true,
    note: "Newest Qwen dense model: noticeably better tailoring and judgement, slower per answer." },
  { minRamGb: 32, tag: "gemma4:26b", sizeGb: 18.7, label: "Gemma 4 26B (MoE)", recommended: false,
    note: "Mixture-of-experts (~4B active), so much faster than a dense 27B on a laptop." },
  { minRamGb: 64, tag: "qwen3.6:35b-a3b", sizeGb: 22.6, label: "Qwen 3.6 35B-A3B (MoE)", recommended: true,
    note: "Large but fast (~3B active per token); leaves plenty of room for long CVs and job ads." },
  { minRamGb: 64, tag: "gemma4:31b", sizeGb: 20.4, label: "Gemma 4 31B", recommended: false,
    note: "Strongest Gemma; very good first-try instruction following." },
];

/** A tiny model (<1 GB) for checking that downloads and JSON output work end to end. Not for real use. */
export const SMOKE_TEST_MODEL = { tag: "gemma3:270m", sizeGb: 0.3 } as const;

export const LOCAL_TIERS: readonly number[] = [...new Set(LOCAL_MODELS.map((m) => m.minRamGb))].sort((a, b) => a - b);

/** Bytes from os.totalmem() to whole GB (an "8 GB" machine reports exactly 8 GiB). */
export const bytesToGb = (bytes: number) => Math.round(bytes / 1024 ** 3);

/**
 * The tier that fits a machine: the largest tier whose minRamGb is at or below its memory. Machines below the smallest
 * tier get the smallest tier, flagged `tight`.
 */
export function recommendFor(totalRamGb: number): { tierGb: number; tight: boolean; recommended: LocalModel; models: LocalModel[] } {
  const fitting = LOCAL_TIERS.filter((t) => t <= totalRamGb);
  const tierGb = fitting.length ? fitting[fitting.length - 1] : LOCAL_TIERS[0];
  const models = LOCAL_MODELS.filter((m) => m.minRamGb === tierGb);
  const recommended = models.find((m) => m.recommended) ?? models[0];
  return { tierGb, tight: fitting.length === 0, recommended, models };
}
