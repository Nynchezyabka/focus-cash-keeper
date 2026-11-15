import { describe, it, expect } from "vitest";
import { apiUrl, endpoint } from "@/lib/parse";
import type { AiSettings } from "@/lib/budget";

const conn = { id: "c1", name: "Claude n Codex", baseUrl: "https://claude-n-codex.com:8443/", format: "anthropic" as const, apiKey: "k1", model: "claude-sonnet-4-5" };
const base: AiSettings = { provider: "none", apiKey: "sk-proj-abc", model: "", connections: [conn] };

describe("custom AI connections", () => {
  it("normalises any pasted base URL", () => {
    expect(apiUrl("https://claude-n-codex.com:8443", "anthropic")).toBe("https://claude-n-codex.com:8443/v1/messages");
    expect(apiUrl("https://x.io/v1/", "openai")).toBe("https://x.io/v1/chat/completions");
    expect(apiUrl("https://x.io/v1/chat/completions", "openai")).toBe("https://x.io/v1/chat/completions");
  });
  it("uses separate connections for parsing and advisor", () => {
    const ai = { ...base, advisorConnId: "c1" };
    expect(endpoint(ai, "parse")?.name).toBe("OpenAI");
    const a = endpoint(ai, "advisor")!;
    expect([a.kind, a.key, a.model]).toEqual(["anthropic", "k1", "claude-sonnet-4-5"]);
  });
  it("advisor follows the parsing connection when none chosen", () => {
    expect(endpoint({ ...base, connId: "c1" }, "advisor")?.name).toBe("Claude n Codex");
  });
  it("deleted connection falls back to the main key", () => {
    expect(endpoint({ ...base, connections: [], connId: "c1" }, "parse")?.name).toBe("OpenAI");
  });
});
