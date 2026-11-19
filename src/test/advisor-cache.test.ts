import { describe, expect, it } from "vitest";
import { chatBody, wantsCache, type Endpoint } from "@/lib/parse";
import { factNeeds, systemParts } from "@/lib/advisor-prompt";

const ep = (kind: "openai" | "anthropic", url: string) =>
  ({ kind, url, key: "k", model: "m", name: "X" }) as unknown as Endpoint;
const sys = systemParts("ПРАВИЛА", ["факты 100 ₽ 07:42"]);

describe("advisor prompt cache", () => {
  it("stable part identical whatever the facts", () => {
    const a = systemParts("ПРАВИЛА", ["100 ₽ 07:42"]);
    const b = systemParts("ПРАВИЛА", ["900 ₽ 07:45"]);
    expect(a.stable).toBe(b.stable);
    const flat = (x: typeof a) =>
      (chatBody(ep("openai", "https://api.openai.com/v1/chat/completions"), x, [])["messages"] as {
        content: string;
      }[])[0]!.content;
    expect(flat(a).slice(0, 8)).toBe(flat(b).slice(0, 8));
  });
  it("cache_control only for Anthropic", () => {
    const o = chatBody(ep("openai", "https://api.openai.com/v1/chat/completions"), sys, [], {}, false);
    expect(JSON.stringify(o)).not.toContain("cache_control");
    const anth = ep("anthropic", "https://api.anthropic.com/v1/messages");
    const a = chatBody(anth, sys, [], {}, wantsCache(anth, {}));
    expect((a["system"] as { cache_control?: unknown }[])[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect((a["system"] as { cache_control?: unknown }[])[1]!.cache_control).toBeUndefined();
  });
  it("own Anthropic server needs the switch; refused server is remembered", () => {
    const own = ep("anthropic", "https://claude-n-codex.com:8443/v1/messages");
    expect(wantsCache(own, {})).toBe(false);
    expect(wantsCache(own, { cacheOk: true })).toBe(true);
    expect(wantsCache(own, { cacheOk: true }, [own.url])).toBe(false);
    expect(wantsCache(ep("openai", "https://api.openai.com/v1/x"), { cacheOk: true })).toBe(false);
  });
  it("purchase question skips spending and forecast", () => {
    const n = factNeeds("можно ли купить за 5 000");
    expect(n.spending).toBe(false);
    expect(n.forecast).toBe(false);
  });
  it("food question includes spending", () => {
    expect(factNeeds("сколько я потратила на еду").spending).toBe(true);
  });
  it("unclear question includes everything", () => {
    expect(Object.values(factNeeds("расскажи что-нибудь")).every(Boolean)).toBe(true);
  });
});
