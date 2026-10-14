/**
 * CV upload size cap. Vercel caps a function request body at 4.5 MB, and the multipart envelope adds a little,
 * so the file itself is capped at 4 MB and next.config.ts serverActions.bodySizeLimit is "4.5mb".
 */
export const MAX_CV_BYTES = 4 * 1024 * 1024;
export const CV_TOO_LARGE = "That file is over 4 MB — export a smaller PDF.";

/** null when the size is acceptable, else the friendly message. */
export function cvSizeError(size: number): string | null {
  return size > MAX_CV_BYTES ? CV_TOO_LARGE : null;
}
