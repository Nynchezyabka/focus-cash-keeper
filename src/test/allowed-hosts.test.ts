import { describe, expect, it } from "vitest";
import { CONNECT_SRC, aiHostAllowed } from "@/lib/allowed-hosts";

describe("разрешённые адреса ИИ", () => {
  it("известный сервис разрешён и есть в CSP", () => {
    expect(aiHostAllowed("https://openrouter.ai/api/v1")).toBe(true);
    expect(CONNECT_SRC).toContain("https://openrouter.ai");
  });
  it("чужой домен, порт или http — нельзя", () => {
    expect(aiHostAllowed("https://claude-n-codex.com:8443")).toBe(true);
    expect(aiHostAllowed("https://claude-n-codex.com")).toBe(false);
    expect(aiHostAllowed("https://claude-n-codex.com:9999")).toBe(false);
    expect(aiHostAllowed("https://api.openai.com:8443")).toBe(false);
    expect(aiHostAllowed("http://api.openai.com")).toBe(false);
  });
});

import { detectService as _ds } from "@/lib/parse";
describe("claude-n-codex key detection", () => {
  it("sk-myapi_ keys go to claude-n-codex via Anthropic format", () => {
    const s = _ds("sk-myapi_abc123");
    expect(s?.url).toBe("https://claude-n-codex.com:8443/v1/messages");
    expect(s?.kind).toBe("anthropic");
  });
});
