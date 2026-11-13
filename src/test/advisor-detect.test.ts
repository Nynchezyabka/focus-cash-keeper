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
