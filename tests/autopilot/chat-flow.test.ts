import { describe, expect, it } from "vitest";
import type { Answers, PackGroup, PackItem } from "@/lib/autopilot/pack";
import type { FieldType, FormField } from "@/lib/autopilot/forms/types";
import { canSkip, controlKind, displayValue, isSkipped, nextToAsk, progressRows, transcript } from "@/lib/autopilot/chat-flow";

const field = (key: string, type: FieldType = "text", options: FormField["options"] = []): FormField => ({ key, label: key.toUpperCase(), type, required: true, options, target: key });
const item = (key: string, group: PackGroup, type: FieldType = "text", options: FormField["options"] = [], sourceLabel: string | null = null): PackItem => ({ field: field(key, type, options), group, value: null, sourceLabel });
const none = new Set<string>();
const opts = (...labels: string[]) => labels.map((l, i) => ({ label: l, value: `v${i}` }));

describe("chat flow", () => {
  it("nothing to ask when every item is vault or yours", () => {
    const items = [item("a", "vault"), item("b", "vault"), item("gender", "yours")];
    items[2].field.label = "Gender";
    expect(nextToAsk(items, {}, none, none)).toBeNull();
    expect(transcript(items, {}, none)).toEqual([{ kind: "summary", filled: 2 }, { kind: "yours", labels: ["Gender"] }]);
  });

  it("nextToAsk walks form order and skips done items", () => {
    const items = [item("v", "vault"), item("c", "confirm", "boolean"), item("a", "ask"), item("d", "draft", "textarea")];
    expect(nextToAsk(items, { c: { value: "true" } }, none, none)?.field.key).toBe("a");
  });

  it("nextToAsk returns the first unanswered item regardless of the last edit", () => {
    const items = [item("a", "ask"), item("b", "ask")];
    expect(nextToAsk(items, { b: { value: "x" } }, none, none)?.field.key).toBe("a");
  });

  it("a draft counts as done only when approved with text", () => {
    const items = [item("d", "draft", "textarea")];
    expect(nextToAsk(items, { d: { value: "text" } }, none, none)?.field.key).toBe("d");
    expect(nextToAsk(items, { d: { value: "text", approved: true } }, none, none)).toBeNull();
  });

  it("a draft with a saved empty value is skipped and not asked", () => {
    const items = [item("d", "draft", "textarea")];
    const answers: Answers = { d: { value: "  ", approved: true } };
    expect(isSkipped(items[0], answers)).toBe(true);
    expect(nextToAsk(items, answers, none, none)).toBeNull();
  });

  it("cover is done when its key is in coverReady, and not asked when in coverSkipped", () => {
    const items = [item("letter", "cover", "textarea"), item("f", "cover", "file")];
    expect(nextToAsk(items, {}, new Set(["letter"]), none)?.field.key).toBe("f");
    expect(nextToAsk(items, {}, new Set(["letter"]), new Set(["upload"]))).toBeNull();
    expect(nextToAsk(items, {}, new Set(["letter", "upload"]), none)).toBeNull();
  });

  it("an optional ask can be skipped; a required one cannot", () => {
    const items = [item("eeo", "ask"), item("req", "ask")];
    items[0].field.required = false;
    expect(canSkip(items[0])).toBe(true);
    expect(canSkip(items[1])).toBe(false);
    expect(nextToAsk(items, {}, none, none, new Set(["eeo"]))?.field.key).toBe("req");
    expect(nextToAsk(items, {}, none, none, new Set(["eeo", "req"]))?.field.key).toBe("req");
    expect(nextToAsk(items, { req: { value: "x" } }, none, none, new Set(["eeo"]))).toBeNull();
  });

  it("transcript rebuilds answered turns in form order", () => {
    const items = [item("v", "vault"), item("c", "confirm", "boolean"), item("a", "ask"), item("y", "yours")];
    items[3].field.label = "Gender";
    const t = transcript(items, { c: { value: "true" }, a: { value: "Foo" } }, none);
    expect(t).toEqual([
      { kind: "summary", filled: 1 },
      { kind: "ask", key: "c" }, { kind: "answer", key: "c", text: "Yes" },
      { kind: "ask", key: "a" }, { kind: "answer", key: "a", text: "Foo" },
      { kind: "yours", labels: ["Gender"] },
    ]);
    expect(transcript([item("a", "ask")], {}, none)).toEqual([]);
  });

  it("transcript shows skipped drafts", () => {
    const t = transcript([item("d", "draft", "textarea")], { d: { value: "", approved: true } }, none);
    expect(t).toEqual([{ kind: "ask", key: "d" }, { kind: "answer", key: "d", text: "Skipped, I'll write it on the form" }]);
  });

  it("progressRows marks current, done, skipped, yours", () => {
    const items = [item("v", "vault", "text", [], "your CV"), item("c", "confirm"), item("a", "ask"), item("d", "draft", "textarea"), item("y", "yours")];
    const rows = progressRows(items, { c: { value: "x" }, d: { value: "", approved: true } }, none, "a");
    expect(rows.map((r) => r.state)).toEqual(["done", "done", "current", "skipped", "yours"]);
    expect(rows[0]).toEqual({ key: "v", label: "V", state: "done", group: "vault", sourceLabel: "your CV" });
    expect(progressRows(items, {}, none, "v")[0].state).toBe("done");
    expect(progressRows(items, {}, none, null)[2].state).toBe("upcoming");
  });

  it("controlKind", () => {
    expect(controlKind(field("b", "boolean"))).toBe("chips");
    expect(controlKind(field("s", "select", opts("a", "b", "c")))).toBe("chips");
    expect(controlKind(field("s", "select", opts("a", "b", "c", "d", "e")))).toBe("dropdown");
    expect(controlKind(field("m", "multiselect", opts("a", "b")))).toBe("multi");
    expect(controlKind(field("t", "textarea"))).toBe("text");
    expect(controlKind(field("s", "select", opts("x".repeat(41))))).toBe("dropdown");
  });

  it("displayValue maps labels", () => {
    expect(displayValue(field("b", "boolean"), "false")).toBe("No");
    expect(displayValue(field("m", "multiselect", opts("A", "B")), ["v0", "v1"])).toBe("A, B");
    expect(displayValue(field("t"), null)).toBe("");
  });
});
