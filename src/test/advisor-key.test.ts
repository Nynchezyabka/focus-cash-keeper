import { describe, expect, it } from "vitest";
import { advisorAi, selectedModel } from "@/lib/parse";
const ds = "sk-" + "a".repeat(32);
describe("separate advisor key", () => {
  const ai = { provider: "none" as const, apiKey: ds, model: "", advisorApiKey: "sk-ant-x" };
  it("advisor uses Claude key, parsing keeps DeepSeek", () => {
    expect(advisorAi(ai).apiKey).toBe("sk-ant-x");
    expect(selectedModel(ai, "advisor")).toBe("claude-haiku-4-5");
    expect(selectedModel(ai)).toBe("deepseek-chat");
  });
  it("no advisor key falls back to main key", () => {
    expect(advisorAi({ ...ai, advisorApiKey: "" }).apiKey).toBe(ds);
  });
});
