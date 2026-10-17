import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { LOCAL_USER_ID } from "@/lib/auth/local-user";
import { withTempDb } from "../cv/temp-db";
import { upsertSource } from "@/lib/bank/store";
import { AI_NOT_SET_UP } from "@/lib/ai/provider";
import { acceptAllAction, importCvAction, importLinkedInCaptureAction, importPostsAction } from "@/app/(app)/profile/bank/actions";

withTempDb();

describe("bank import actions", () => {
  const prevMode = process.env.AI_MODE;
  afterEach(() => { if (prevMode === undefined) delete process.env.AI_MODE; else process.env.AI_MODE = prevMode; });

  it("importPostsAction rejects more than 10 posts and posts over 5000 characters", async () => {
    expect(await importPostsAction(Array.from({ length: 11 }, (_, i) => `post ${i}`))).toMatchObject({ error: expect.any(String) });
    expect(await importPostsAction(["x".repeat(5001)])).toMatchObject({ error: expect.any(String) });
    expect(await importPostsAction(["   "])).toMatchObject({ error: expect.any(String) });
  });

  it("importPostsAction returns AI_NOT_SET_UP when AI is off", async () => {
    process.env.AI_MODE = "off";
    expect(await importPostsAction(["I built a thing and shipped it to 200 users."])).toEqual({ error: AI_NOT_SET_UP, aiOff: true });
  });

  it("acceptAllAction on a post source returns an error instead of throwing", async () => {
    const { id } = upsertSource(LOCAL_USER_ID, "linkedin_post", "ref-post", "a post");
    expect(await acceptAllAction(id)).toMatchObject({ error: expect.stringContaining("one by one") });
  });

  it("importLinkedInCaptureAction without a capture returns the exact copy", async () => {
    expect(await importLinkedInCaptureAction()).toEqual({ error: "Capture your profile with the extension first" });
  });

  it("importCvAction rejects a missing file, a non-PDF and an oversized file", async () => {
    expect(await importCvAction(new FormData())).toMatchObject({ error: expect.any(String) });
    const fd = new FormData();
    fd.set("cv", new File(["hello"], "a.txt", { type: "text/plain" }));
    expect(await importCvAction(fd)).toMatchObject({ error: "Please upload a PDF." });
  });
});
