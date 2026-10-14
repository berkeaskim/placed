import { describe, it, expect } from "vitest";
import { CV_TOO_LARGE, MAX_CV_BYTES, cvSizeError } from "@/lib/cv/upload-limits";
import nextConfig from "@/next.config";

const toBytes = (limit: string) => {
  const m = /^(\d+(?:\.\d+)?)\s*(kb|mb)$/i.exec(limit);
  return m ? Number(m[1]) * (m[2].toLowerCase() === "mb" ? 1024 * 1024 : 1024) : Number(limit);
};

describe("CV upload size cap (Vercel 4.5 MB request body)", () => {
  it("is 4 MB, and the message says 4 MB", () => {
    expect(MAX_CV_BYTES).toBe(4 * 1024 * 1024);
    expect(CV_TOO_LARGE).toContain("4 MB");
  });
  it("accepts exactly 4 MB and rejects one byte more", () => {
    expect(cvSizeError(MAX_CV_BYTES)).toBeNull();
    expect(cvSizeError(1)).toBeNull();
    expect(cvSizeError(MAX_CV_BYTES + 1)).toBe(CV_TOO_LARGE);
    expect(cvSizeError(5 * 1024 * 1024)).toBe(CV_TOO_LARGE);
  });
  it("server action body limit is 4.5mb: above the cap, never above Vercel's 4.5 MB", () => {
    const limit = String(nextConfig.experimental?.serverActions?.bodySizeLimit ?? "1mb");
    expect(limit).toBe("4.5mb");
    expect(toBytes(limit)).toBeGreaterThan(MAX_CV_BYTES);
    expect(toBytes(limit)).toBeLessThanOrEqual(4.5 * 1024 * 1024);
  });
});
