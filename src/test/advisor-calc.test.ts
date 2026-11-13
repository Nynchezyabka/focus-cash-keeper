import { beforeEach, describe, expect, it } from "vitest";
import { applyAction, evaluatePurchase, parseActions, precompute, unverifiedSums, whatIf } from "@/lib/advisor-calc";
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
  it("calculates a new payment without mistaking the date for the amount or changing the plan", () => {
    const out = precompute(getState(), "Что если новый платёж 2026-10-20 на 5 000 ₽?", NOW);
    expect(out).toContain("новый платёж 5 000 ₽ 2026-10-20");
    expect(getState().obligations).toEqual([]);
    expect(whatIf(getState(), { kind: "payment", amount: 5000, date: "2026-10-20" }, NOW)[0]?.after).toBeLessThan(whatIf(getState(), { kind: "payment", amount: 0, date: "2026-10-20" }, NOW)[0]?.after ?? 0);
  });
  it("date cards do not change anything until applied", () => {
    const r = parseActions("[[moveIncome:z|2999-12-01]]");
    expect(getState().incomes[0]?.nextOn).toBeUndefined();
    const action = r.actions[0]; if (!action) throw new Error("Missing action");
    expect(applyAction(action)).toBe(true);
    expect(getState().incomes[0]?.nextOn).toBe("2999-12-01");
    expect(getState().balance).toBe(20000);
  });
  it("rejects missing IDs and impossible dates", () => {
    expect(parseActions("[[movePayment:z|2026-02-31]]").actions).toEqual([]);
    expect(applyAction({ type: "movePayment", id: "missing", date: "2999-12-01" })).toBe(false);
  });
  it("cannot move an already paid credit schedule row", () => {
    replaceState({ ...base(), obligations: [{ id: "loan", name: "Кредит", amount: 1000, day: 0, category: "loan", schedule: [{ id: "row", date: "2999-01-01", amount: 1000 }] }], txs: [{ id: "tx", kind: "expense", amount: 1000, category: "loan", date: "2026-10-16", obligationId: "loan::row" }] });
    expect(applyAction({ type: "movePayment", id: "loan::row", date: "2999-12-01" })).toBe(false);
    expect(getState().obligations[0]?.schedule?.[0]?.date).toBe("2999-01-01");
  });
});
