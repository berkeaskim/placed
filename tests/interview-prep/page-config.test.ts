import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("job page route config", () => {
  it("allows 300 s so a retried grounded generation is not killed mid-way (and other actions keep the platform default)", () => {
    expect(readFileSync("app/(app)/jobs/[id]/page.tsx", "utf8")).toMatch(/export const maxDuration = 300;/);
  });
});
