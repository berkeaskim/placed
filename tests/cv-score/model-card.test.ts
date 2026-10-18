import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { RULES } from "@/lib/cv-rules";
import { MODEL_CARD_URL } from "@/lib/cv-score/present";
import { ANTHROPIC_MODELS, GEMINI_MODELS } from "@/lib/ai/models";

// Audit 04#24: the model card must not drift from the code it describes.
const card = readFileSync("docs/validation/MODEL_CARD.md", "utf8");

describe("MODEL_CARD.md", () => {
  it("is the file the panel links to", () => {
    expect(MODEL_CARD_URL.endsWith("/docs/validation/MODEL_CARD.md")).toBe(true);
    expect(existsSync("docs/validation/MODEL_CARD.md")).toBe(true);
  });
  it("states the current rule counts", () => {
    const code = RULES.filter((r) => r.check === "code").length;
    expect(card).toContain(`rules: ${RULES.length}`);
    expect(card).toContain(`There are ${RULES.length} rules in total: ${code} are checked by code, and ${RULES.length - code} are judged by an AI model`);
  });
  it("names the pinned default judge models", () => {
    expect(card).toContain(ANTHROPIC_MODELS.smart);
    expect(card).toContain(GEMINI_MODELS.smart);
  });
  it("says it is not validated and that results differ across models", () => {
    expect(card).toContain("beta, not validated");
    expect(card).toContain("Results differ across models");
  });
});
