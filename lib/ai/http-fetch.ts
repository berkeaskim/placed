import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";

/**
 * A minimal fetch over node:http with no built-in timeouts. Node's global fetch (undici) gives up after 300 s without
 * response headers or between body chunks, and a busy local model can sit longer than that before it answers (Ollama
 * queues requests from every client). Callers bound the wait with their own AbortSignal instead.
 */
export function httpFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const url = new URL(input);
    const signal = init.signal ?? undefined;
    if (signal?.aborted) return reject(signal.reason);
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const req = (url.protocol === "https:" ? https : http).request(url, { method: init.method ?? "GET", headers, signal }, (res) => {
      const resHeaders = new Headers();
      for (const [k, v] of Object.entries(res.headers)) {
        if (v !== undefined) resHeaders.set(k, Array.isArray(v) ? v.join(", ") : v);
      }
      const status = res.statusCode ?? 500;
      const body = status === 204 || status === 304 ? null : (Readable.toWeb(res) as ReadableStream<Uint8Array>);
      resolve(new Response(body, { status, statusText: res.statusMessage, headers: resHeaders }));
    });
    req.on("error", reject);
    if (init.body != null) req.write(typeof init.body === "string" ? init.body : String(init.body));
    req.end();
  });
}
