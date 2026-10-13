import { describe, it, expect, vi, beforeEach } from "vitest";

const s = vi.hoisted(() => ({
  env: { cronSecret: "s3cret-value-for-tests" } as { cronSecret: string },
  companies: [] as { id: number; slug: string }[],
  cursor: 0 as number,
  cursorWrites: [] as number[],
  ingested: [] as string[],
  ingestImpl: null as null | ((c: { slug: string }) => Promise<unknown>),
  adminCreated: 0,
}));

vi.mock("node:crypto", async (orig) => {
  const real = await orig<typeof import("node:crypto")>();
  return { ...real, default: real, timingSafeEqual: vi.fn(real.timingSafeEqual) };
});
vi.mock("@/lib/env", () => ({ env: s.env }));
vi.mock("@/lib/ingest/providers", () => ({ fetchJobs: vi.fn(async () => { throw new Error("network must not be hit"); }) }));
vi.mock("@/lib/ai/tagJob", () => ({ tagJob: vi.fn() }));
vi.mock("@/lib/ingest/store", () => ({ supabaseStore: () => ({}) }));
vi.mock("@/lib/ingest/run", () => ({
  ingestCompany: vi.fn(async (c: { slug: string }) => {
    s.ingested.push(c.slug);
    if (s.ingestImpl) await s.ingestImpl(c);
    return { kept: 1, tagged: 1, pending: 0, dead: 0 };
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    s.adminCreated++;
    return {
      from: (table: string) => {
        const b: Record<string, unknown> = {};
        let op = "select";
        let payload: { cursor?: number } = {};
        b.select = () => b; b.eq = () => b;
        b.update = (p: { cursor: number }) => { op = "update"; payload = p; return b; };
        b.order = async () => ({ data: s.companies, error: null });
        b.single = async () => ({ data: { cursor: s.cursor }, error: null });
        b.then = (res: (v: unknown) => unknown) => {
          if (table === "ingest_state" && op === "update") { s.cursorWrites.push(payload.cursor!); s.cursor = payload.cursor!; }
          return Promise.resolve({ error: null }).then(res);
        };
        return b;
      },
    };
  },
}));

import { timingSafeEqual } from "node:crypto";
import { GET } from "@/app/api/ingest/route";

const req = (qs = "", auth?: string | null) =>
  new Request(`https://placed.test/api/ingest${qs}`, { headers: auth === null || auth === undefined ? {} : { authorization: auth } });
const OK = () => `Bearer ${s.env.cronSecret}`;

beforeEach(() => {
  s.env.cronSecret = "s3cret-value-for-tests";
  s.companies = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, slug: `c${i}` }));
  s.cursor = 0; s.cursorWrites = []; s.ingested = []; s.ingestImpl = null; s.adminCreated = 0;
  vi.mocked(timingSafeEqual).mockClear();
});

describe("/api/ingest auth", () => {
  it.each([
    ["missing header", null],
    ["empty header", ""],
    ["no Bearer prefix", "s3cret-value-for-tests"],
    ["lowercase bearer", "bearer s3cret-value-for-tests"],
    ["wrong secret, same length", "Bearer s3cret-value-for-tesTS"],
    ["prefix of secret", "Bearer s3cret"],
    ["secret + suffix", "Bearer s3cret-value-for-testsX"],
    ["double space", "Bearer  s3cret-value-for-tests"],
    ["Basic auth", "Basic czNjcmV0"],
  ])("%s → 401 and no DB access", async (_n, auth) => {
    const r = await GET(req("?batch=0", auth));
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "unauthorized" });
    expect(s.adminCreated).toBe(0);
    expect(s.ingested).toEqual([]);
  });
  it("unset CRON_SECRET locks the route even for 'Bearer ' and 'Bearer undefined'", async () => {
    s.env.cronSecret = "";
    for (const a of ["Bearer ", "Bearer", "Bearer undefined", "Bearer null"]) {
      expect((await GET(req("", a))).status).toBe(401);
    }
    expect(timingSafeEqual).not.toHaveBeenCalled();
    expect(s.adminCreated).toBe(0);
  });
  it("uses a constant-time compare for equal-length candidates", async () => {
    await GET(req("?batch=0", "Bearer s3cret-value-for-tesTS"));
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);
    const [a, b] = vi.mocked(timingSafeEqual).mock.calls[0] as [Buffer, Buffer];
    expect(a.length).toBe(b.length);
  });
  it("length mismatch short-circuits (timingSafeEqual would throw on unequal lengths)", async () => {
    expect((await GET(req("?batch=0", "Bearer x"))).status).toBe(401);
    expect(timingSafeEqual).not.toHaveBeenCalled();
  });
  it("multi-byte header bytes are compared by byte length, not string length (no throw)", async () => {
    // "é" is 2 UTF-8 bytes but header values are latin1/ByteString; build a same-char-length value
    const sameChars = "Bearer " + "é".repeat(s.env.cronSecret.length);
    const r = await GET(new Request("https://placed.test/api/ingest?batch=0", { headers: { authorization: sameChars } }));
    expect(r.status).toBe(401);
  });
  it("correct secret → 200", async () => {
    const r = await GET(req("?batch=0", OK()));
    expect(r.status).toBe(200);
  });
});

describe("/api/ingest ?batch parsing", () => {
  it.each(["-1", "NaN", "1.5", "1e3", "", " 1", "0x1", "１", "+1", "abc", "1,2"])("batch=%j → 400 without touching the DB", async (b) => {
    const r = await GET(req(`?batch=${encodeURIComponent(b)}`, OK()));
    expect(r.status).toBe(400);
    expect(s.adminCreated).toBe(0);
  });
  it("batch=0 → first 10 companies", async () => {
    const body = await (await GET(req("?batch=0", OK()))).json();
    expect(body).toMatchObject({ batch: 0, total: 25, partial: false });
    expect(s.ingested).toEqual(s.companies.slice(0, 10).map((c) => c.slug));
  });
  it("batch=2 → the 5-company tail; batch=3 → empty", async () => {
    await GET(req("?batch=2", OK()));
    expect(s.ingested).toEqual(["c20", "c21", "c22", "c23", "c24"]);
    s.ingested = [];
    const body = await (await GET(req("?batch=3", OK()))).json();
    expect(body.log).toEqual([]);
    expect(s.ingested).toEqual([]);
  });
  it("leading zeros are accepted as decimal", async () => {
    expect((await (await GET(req("?batch=001", OK()))).json()).batch).toBe(1);
  });
  it("huge batch numbers (beyond 2^53, even Infinity-sized) are a harmless empty 200", async () => {
    for (const b of ["9007199254740993", "9".repeat(400)]) {
      const r = await GET(req(`?batch=${b}`, OK()));
      expect(r.status).toBe(200);
      expect((await r.json()).log).toEqual([]);
    }
    expect(s.ingested).toEqual([]);
  });
  it("batch mode never touches the cron cursor", async () => {
    await GET(req("?batch=1", OK()));
    expect(s.cursorWrites).toEqual([]);
  });
  it("one company failing is logged and the batch continues", async () => {
    s.ingestImpl = async (c) => { if (c.slug === "c3") throw new Error("ATS 500"); };
    const body = await (await GET(req("?batch=0", OK()))).json();
    expect(body.log).toContain("c3: ERROR ATS 500");
    expect(s.ingested).toHaveLength(10);
  });
});

describe("/api/ingest cron (cursor) mode", () => {
  it("resumes from the stored cursor and wraps around once", async () => {
    s.cursor = 23;
    const body = await (await GET(req("", OK()))).json();
    expect(s.ingested).toEqual(["c23", "c24"]); // stops when cursor wraps to 0
    expect(body).toMatchObject({ cursor: 0, partial: false });
  });
  it("a stored cursor beyond the list length is taken modulo the length", async () => {
    s.cursor = 52; // 52 % 25 = 2
    await GET(req("", OK()));
    expect(s.ingested[0]).toBe("c2");
  });
  it("empty company list → no work, cursor saved, 200", async () => {
    s.companies = [];
    const r = await GET(req("", OK()));
    expect(r.status).toBe(200);
    expect(s.ingested).toEqual([]);
  });
  // BUG: a negative stored cursor (corrupt row / manual edit) is not normalised: (-1 % n) === -1 → list[-1] is
  // undefined → the catch block itself throws on `c.slug` → unhandled 500 and cron makes no progress.
  // Fixed: the stored cursor is normalised with ((c % n) + n) % n.
  it("a negative stored cursor is normalised instead of crashing", async () => {
    s.cursor = -1;
    const r = await GET(req("", OK()));
    expect(r.status).toBe(200);
  });
});
