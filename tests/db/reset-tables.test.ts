import { describe, expect, it } from "vitest";
import { USER_TABLES } from "@/lib/db/reset";

describe("delete-my-data covers the inbox and outreach tables", () => {
  it("deletes inbox_events, outreach and gmail_connections before applications", () => {
    for (const t of ["inbox_events", "outreach", "gmail_connections"]) expect(USER_TABLES).toContain(t);
    // inbox_events/outreach reference applications (on delete set null), so order is not required for FK safety,
    // but deleting them first means no row ever points at a deleted application mid-reset.
    expect(USER_TABLES.indexOf("inbox_events")).toBeLessThan(USER_TABLES.indexOf("applications"));
    expect(USER_TABLES.indexOf("outreach")).toBeLessThan(USER_TABLES.indexOf("applications"));
  });
});
