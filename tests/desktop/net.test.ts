import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { isPortFree, waitForServer } from "../../desktop/src/lib/net";

let server: Server | undefined;
afterEach(async () => {
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  server = undefined;
});

const listen = () =>
  new Promise<number>((resolve) => {
    server = createServer((_req, res) => {
      res.statusCode = 500; // any HTTP response counts as "up"
      res.end();
    });
    server.listen(0, "127.0.0.1", () => resolve((server!.address() as AddressInfo).port));
  });

describe("isPortFree", () => {
  it("is false while something listens on the port and true after it closes", async () => {
    const port = await listen();
    expect(await isPortFree(port)).toBe(false);
    await new Promise<void>((r) => server!.close(() => r()));
    server = undefined;
    expect(await isPortFree(port)).toBe(true);
  });
});

describe("waitForServer", () => {
  it("resolves true on any HTTP response", async () => {
    const port = await listen();
    expect(await waitForServer(`http://127.0.0.1:${port}/`, 2000, 20)).toBe(true);
  });

  it("resolves false when nothing answers before the timeout", async () => {
    const port = await listen();
    await new Promise<void>((r) => server!.close(() => r()));
    server = undefined;
    expect(await waitForServer(`http://127.0.0.1:${port}/`, 200, 20)).toBe(false);
  });

  it("stops early when aborted", async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 50);
    const started = Date.now();
    expect(await waitForServer("http://127.0.0.1:9/", 5000, 20, ac.signal)).toBe(false);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
