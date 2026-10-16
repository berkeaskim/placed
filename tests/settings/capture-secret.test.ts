import { describe, it, expect } from "vitest";
import { mintCaptureToken, verifyCaptureToken } from "@/lib/linkedin/capture-token";
import { getSecret, setSecret } from "@/lib/settings/store";
import { LOCAL_USER_ID } from "@/lib/auth/local-user";
import { withTempDb } from "../cv/temp-db";

withTempDb();

describe("LinkedIn capture ticket secret", () => {
  it("without LINKEDIN_CAPTURE_SECRET, signs with a random local secret created on first use", () => {
    const prev = process.env.LINKEDIN_CAPTURE_SECRET;
    delete process.env.LINKEDIN_CAPTURE_SECRET;
    try {
      expect(getSecret("capture.hmac")).toBeNull();
      const t = mintCaptureToken({ userId: LOCAL_USER_ID, sector: "consulting", year: "2nd" });
      const s = getSecret("capture.hmac");
      expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(verifyCaptureToken(t)).toMatchObject({ userId: LOCAL_USER_ID, sector: "consulting" });
      setSecret("capture.hmac", "rotated");
      expect(verifyCaptureToken(t)).toBeNull();
    } finally {
      if (prev !== undefined) process.env.LINKEDIN_CAPTURE_SECRET = prev;
    }
  });
});
