import { describe, it, expect } from "vitest";
import { isDeleteConfirmed } from "@/lib/settings/confirm";

describe("isDeleteConfirmed", () => {
  it("accepts DELETE and trimmed DELETE", () => {
    expect(isDeleteConfirmed("DELETE")).toBe(true);
    expect(isDeleteConfirmed(" DELETE ")).toBe(true);
  });
  it.each(["delete", "Delete", "DELETE!", "DELETE ME", "", "  ", null, undefined, 1, {}])("rejects %j", (v) => {
    expect(isDeleteConfirmed(v)).toBe(false);
  });
});
