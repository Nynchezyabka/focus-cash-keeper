import { describe, it, expect } from "vitest";
import { calc, type State } from "@/lib/budget";

const base = (over: Partial<State>) =>
  ({
    version: 1, balance: 10000, cash: 0, cushion: 0, txs: [], incomeAck: {},
    incomes: [{ id: "i", name: "Доход", amount: 50000, day: 21 }],
    obligations: [], dailyCarry: true, createdAt: new Date(2026, 10, 1).toISOString(),
    ...over,
  }) as unknown as State;

describe("daily carry", () => {
  it("unspent yesterday is added whole to today", () => {
    const now = new Date(2026, 10, 11, 12); // 10 days to income
    // yesterday norm 1000, spent 200 → 800 carried; money now 10000
    const s = base({
      carryLog: { day: "2026-11-10", norm: 1000, carry: 0 },
      txs: [{ id: "t", kind: "expense", amount: 200, category: "food", date: new Date(2026, 10, 10, 10).toISOString(), method: "card" }] as State["txs"],
    });
    const c = calc(s, now);
    expect(Math.round(c.carry)).toBe(800);
    expect(Math.round(c.freeToday)).toBe(Math.round(c.baseNorm + 800));
    expect(Math.round(c.baseNorm * c.days + c.carry)).toBe(10000);
  });
  it("accumulates over several untouched days", () => {
    const c = calc(base({ carryLog: { day: "2026-11-08", norm: 500, carry: 300 } }), new Date(2026, 10, 11, 12));
    expect(Math.round(c.carry)).toBe(1800);
  });
  it("overspent day resets carry to zero", () => {
    const s = base({
      carryLog: { day: "2026-11-10", norm: 1000, carry: 300 },
      txs: [{ id: "t", kind: "expense", amount: 2000, category: "food", date: new Date(2026, 10, 10, 10).toISOString(), method: "card" }] as State["txs"],
    });
    expect(calc(s, new Date(2026, 10, 11, 12)).carry).toBe(0);
  });
});
