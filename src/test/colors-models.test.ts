import { afterEach, describe, expect, it, vi } from "vitest";
import { catColor, DEFAULT_CATEGORIES, getState, replaceState, saveCategories, type AiSettings } from "@/lib/budget";
import { PALETTE } from "@/lib/colors";
import { saveGoal, sharedGoals, mergeGoals } from "@/lib/goals";
import { sharedTxs } from "@/lib/family";
import { aiChat, parseAi, selectedModel, checkAiModel } from "@/lib/parse";

afterEach(() => vi.unstubAllGlobals());
describe("palette persistence", () => {
  it("offers 12 colors", () => expect(PALETTE).toHaveLength(12));
  it("category colors stay stable when a neighbour is removed", () => {
    const c = DEFAULT_CATEGORIES[1];
    if (!c) throw new Error("Missing category");
    saveCategories(DEFAULT_CATEGORIES);
    const before = catColor(c);
    saveCategories(DEFAULT_CATEGORIES.filter((x) => x.id !== "food"));
    expect(catColor(c)).toBe(before);
    expect(catColor({ ...c, color: "rose" })).toBe("var(--palette-rose)");
  });
  it("family goals share and merge the exact chosen color without changing money", () => {
    replaceState({ ...getState(), goals: [], cushion: 1000 });
    const id = saveGoal({ name: "Отпуск", target: 50000, family: true, color: "sky" });
    expect(sharedGoals(getState())[0]?.color).toBe("sky");
    const out = mergeGoals(getState(), [[{ id, name: "Отпуск", target: 50000, color: "rose", saved: 0, updatedAt: "2999-01-01" }]]);
    expect(out?.[0]?.color).toBe("rose");
    expect(getState().cushion).toBe(1000);
  });
  it("only shared operations carry category colors, never the AI key", () => {
    const s = { ...getState(), categories: [{ ...DEFAULT_CATEGORIES[0], id: "food", name: "Еда", group: "life" as const, icon: "Circle", keys: [], color: "mint" }], txs: [{ id: "x", kind: "expense" as const, amount: 100, category: "food", date: "2026-11-13" }] };
    expect(sharedTxs(s)[0]?.color).toBe("mint");
    expect(sharedTxs(s)[0]).not.toHaveProperty("ai");
  });
});
describe("BYOK model selection", () => {
  const ai: AiSettings = { provider: "openai", apiKey: "sk-test-only", model: "gpt-4.1-mini", advisorModel: "gpt-4.1" };
  it("uses the service default for old settings", () => expect(selectedModel({ ...ai, model: "", advisorModel: "" })).toBe("gpt-4o-mini"));
  it("advisor falls back to parsing model", () => expect(selectedModel({ ...ai, advisorModel: "" }, "advisor")).toBe("gpt-4.1-mini"));
  it("sends parsing and advisor choices to the provider", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"items":[]}' } }] }) });
    vi.stubGlobal("fetch", fetcher);
    await parseAi("test", ai);
    expect(JSON.parse(fetcher.mock.calls[0]?.[1].body).model).toBe("gpt-4.1-mini");
    await aiChat("test", [{ role: "user", content: "test" }], ai);
    expect(JSON.parse(fetcher.mock.calls[1]?.[1].body).model).toBe("gpt-4.1");
    await checkAiModel(ai, "parse");
    expect(JSON.parse(fetcher.mock.calls[2]?.[1].body).model).toBe("gpt-4.1-mini");
  });
  it("reports a rejected key instead of successful verification", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(checkAiModel(ai, "advisor")).rejects.toThrow("401");
  });
});