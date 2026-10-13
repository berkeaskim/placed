export const BATCH_SIZE = 10;

/** Items with index in [n*size, n*size+size). */
export function batchSlice<T>(items: T[], n: number, size = BATCH_SIZE): T[] {
  return items.slice(n * size, n * size + size);
}

/** null = no batch param; "invalid" = not a non-negative integer. */
export function parseBatch(raw: string | null): number | null | "invalid" {
  if (raw === null) return null;
  return /^\d+$/.test(raw) ? Number(raw) : "invalid";
}
