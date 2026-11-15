import { describe, it, expect } from "vitest";
import { calc, type State } from "@/lib/budget";

describe("«Отложено на платежи» never exceeds real money", () => {
  it("caps at card + cash after spending today", () => {
    const now = new Date(2026, 10, 13, 12);
    const s = {
      version: 1, balance: 3000, cash: 0, cushion: 0, incomeAck: {},
      txs: [{ id: "t", kind: "expense", amount: 4000, category: "food", method: "card", date: now.toISOString() }],
      incomes: [{ id: "i", name: "Доход", amount: 50000, day: 25 }],
      obligations: [{ id: "o", name: "Аренда", amount: 5000, day: 20, category: "home" }],
      createdAt: new Date(2026, 10, 1).toISOString(),
    } as unknown as State;
    const c = calc(s, now);
    expect(c.setAside).toBeLessThanOrEqual(3000);
    expect(c.setAside + c.setAsideShort).toBe(5000);
  });
});
