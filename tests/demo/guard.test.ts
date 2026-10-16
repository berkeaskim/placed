import { describe, expect, it } from "vitest";
import { LIVE_DEMO_OPT_IN, assertLiveDemoWriteAllowed, assertSeparateE2eUser, liveDemoWriteAllowed } from "@/lib/demo/guard";

describe("assertLiveDemoWriteAllowed (the demo account is the live public demo on the prod DB)", () => {
  it("refuses without the opt-in, whatever NODE_ENV is", () => {
    for (const env of [{}, { NODE_ENV: "development" }, { NODE_ENV: "test" }, { NODE_ENV: "production" }]) {
      expect(() => assertLiveDemoWriteAllowed(env, "demo:reset")).toThrow(/Refusing to run demo:reset.*LIVE public demo.*production database/);
    }
  });
  it("only accepts exactly PLACED_ALLOW_LIVE_DEMO_WRITE=1", () => {
    for (const v of ["", "0", "true", "yes", " 1"]) expect(liveDemoWriteAllowed({ [LIVE_DEMO_OPT_IN]: v })).toBe(false);
    expect(liveDemoWriteAllowed({ [LIVE_DEMO_OPT_IN]: "1" })).toBe(true);
    expect(() => assertLiveDemoWriteAllowed({ [LIVE_DEMO_OPT_IN]: "1" }, "demo:user")).not.toThrow();
  });
  it("tells the operator how to opt in and what to test with instead", () => {
    expect(() => assertLiveDemoWriteAllowed({}, "demo:user")).toThrow(/PLACED_ALLOW_LIVE_DEMO_WRITE=1.*E2E_USER_EMAIL/);
  });
});

describe("assertSeparateE2eUser", () => {
  it("refuses an e2e user that is the demo account (case and space insensitive)", () => {
    expect(() => assertSeparateE2eUser({ E2E_USER_EMAIL: " Demo@Placed.test ", DEMO_EMAIL: "demo@placed.test" })).toThrow(/LIVE public demo/);
  });
  it("allows a separate e2e user, or a missing one (the specs skip)", () => {
    expect(() => assertSeparateE2eUser({ E2E_USER_EMAIL: "e2e@placed.example.test", DEMO_EMAIL: "demo@placed.test" })).not.toThrow();
    expect(() => assertSeparateE2eUser({ DEMO_EMAIL: "demo@placed.test" })).not.toThrow();
  });
});
