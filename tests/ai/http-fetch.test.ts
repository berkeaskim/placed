import { describe, it, expect, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { httpFetch } from "@/lib/ai/http-fetch";

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.url === "/slow") return setTimeout(() => res.end("late"), 200);
    res.writeHead(201, { "content-type": "application/json", "x-echo": req.headers["x-test"] ?? "" });
    res.write(JSON.stringify({ method: req.method, body }));
    res.end();
  });
});
const base = new Promise<string>((r) => server.listen(0, "127.0.0.1", () => r(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)));
afterAll(() => server.close());

describe("httpFetch", () => {
  it("sends method, headers and body and returns a Response", async () => {
    const res = await httpFetch(`${await base}/x`, { method: "POST", headers: { "x-test": "hi" }, body: "payload" });
    expect(res.status).toBe(201);
    expect(res.headers.get("x-echo")).toBe("hi");
    expect(await res.json()).toEqual({ method: "POST", body: "payload" });
  });

  it("honours an abort signal", async () => {
    await expect(httpFetch(`${await base}/slow`, { signal: AbortSignal.timeout(20) })).rejects.toThrow();
  });

  it("rejects when nothing listens", async () => {
    await expect(httpFetch("http://127.0.0.1:1/")).rejects.toThrow();
  });
});
