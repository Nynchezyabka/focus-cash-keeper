import { describe, it, expect } from "vitest";
import { calc, type State } from "@/lib/budget";

describe("money kept for payments after the next income", () => {
  it("shows up in reserve and adds up to total", () => {
    const now = new Date(2026, 10, 13, 12);
    const s = {
      version: 1, balance: 9090, cash: 0, cushion: 0, txs: [], incomeAck: {},
      incomes: [{ id: "i", name: "Доход", amount: 5000, day: 15 }],
      obligations: [{ id: "o", name: "Аренда", amount: 12000, day: 16, category: "home" }],
      createdAt: new Date(2026, 10, 1).toISOString(),
    } as unknown as State;
    const c = calc(s, now);
    expect(c.aheadHeld).toBeGreaterThan(0);
    expect(Math.round(c.dailyNorm * c.days + c.held + c.aheadHeld)).toBe(9090);
  });
});
