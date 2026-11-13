import { describe, expect, it } from "vitest";
import { moneyIn, freeUntilIncome } from "@/lib/advisor-calc";
import { isOwnTransfer } from "@/lib/parse";

describe("advisor question detection", () => {
  it("«перенести платёж 15 числа» has no money sum", () => {
    expect(moneyIn("можно ли перенести платёж 15 числа")).toBe(0);
  });
  it("sum with ₽ or к counts", () => {
    expect(moneyIn("можно ли купить пылесос за 35 000 ₽")).toBe(35000);
    expect(moneyIn("потяну 5к?")).toBe(5000);
  });
  it("free until income subtracts today's spending", () => {
    expect(freeUntilIncome({ dailyNorm: 1000, days: 5, spentToday: 300 })).toBe(4700);
  });
  it("own transfers are not spending", () => {
    expect(isOwnTransfer("Перевод между своими счетами")).toBe(true);
    expect(isOwnTransfer("Пятёрочка")).toBe(false);
  });
});

import { precompute as pc2 } from "@/lib/advisor-calc";
import { calc as calc2 } from "@/lib/budget";
describe("spent today", () => {
  const base = { version: 1, balance: 10000, cushion: 0, obligations: [], incomes: [], incomeAck: {}, ai: { provider: "none", apiKey: "", model: "" }, createdAt: "" } as never;
  it("past-tense question is not a purchase", () => {
    expect(pc2({ ...(base as object), txs: [] } as never, "я потратила 425+3566+690, почему так посчиталось?")).toBeNull();
  });
  it("medicine counts in today's spending, planned payment does not", () => {
    const now = new Date().toISOString();
    const s = { ...(base as object), txs: [
      { id: "a", kind: "expense", amount: 425, category: "food", date: now },
      { id: "b", kind: "expense", amount: 3566, category: "health", date: now },
      { id: "c", kind: "expense", amount: 690, category: "cafe", date: now },
      { id: "d", kind: "expense", amount: 5000, category: "home", date: now, obligationId: "x" },
    ] } as never;
    expect(calc2(s).spentToday).toBe(4681);
  });
});
