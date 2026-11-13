import { beforeEach, describe, expect, it } from "vitest";
import { evaluatePurchase, parseActions, precompute, unverifiedSums, whatIf } from "@/lib/advisor-calc";
import { replaceState, getState, type State } from "@/lib/budget";

const NOW = new Date(2026, 9, 16);
const base = (): State => ({
  version: 1, balance: 20000, cash: 0, cushion: 0, txs: [], obligations: [], incomes: [{ id: "z", name: "Зарплата", amount: 40000, day: 26 }], incomeAck: {},
  ai: { provider: "none", apiKey: "", model: "" }, createdAt: new Date(2026, 9, 1).toISOString(),
});

describe("advisor math", () => {
  beforeEach(() => replaceState(base()));
  it("purchase within free money is calm, above it — wait", () => {
    expect(evaluatePurchase(getState(), 5000, NOW).verdict).toBe("calm");   // ≈960/day left
    expect(evaluatePurchase(getState(), 12000, NOW).verdict).toBe("tight"); // ≈14 600 free until income (smoothed), 260/day left < 500
    expect(evaluatePurchase(getState(), 25000, NOW).verdict).toBe("wait");
  });
  it("smaller salary lowers the daily amount in the following stretch", () => {
    const rows = whatIf(getState(), { kind: "income", delta: -10000 }, NOW);
    expect(rows.some((r) => r.after < r.before)).toBe(true);
    expect(rows.every((r) => r.after <= r.before)).toBe(true);
  });
  it("recognises a purchase question", () => {
    expect(precompute(getState(), "Можно ли купить пылесос за 35 000 ₽?", NOW)).toContain("лучше подождать");
  });
  it("flags ruble sums the app never showed", () => {
    expect(unverifiedSums("Останется 1 500 ₽, а потом 7 777 ₽", ["в день 1500"])).toEqual([7777]);
  });
  it("reads action tags and strips them from text", () => {
    const r = parseActions("Можно так. [[transfer:card|3000]]");
    expect(r.clean).toBe("Можно так.");
    expect(r.actions).toEqual([{ type: "transfer", from: "card", amount: 3000 }]);
  });
});
