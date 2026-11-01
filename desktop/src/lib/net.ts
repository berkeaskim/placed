import { createServer } from "node:net";

/** True when nothing is listening on 127.0.0.1:<port> (checked by binding it briefly). */
export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll `url` until any HTTP response (status ignored). False on timeout or abort. */
export async function waitForServer(url: string, timeoutMs = 60_000, intervalMs = 250, signal?: AbortSignal): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !signal?.aborted) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(Math.max(intervalMs, 2000)), redirect: "manual" });
      await res.body?.cancel();
      return true;
    } catch {
      await sleep(intervalMs);
    }
  }
  return false;
}
