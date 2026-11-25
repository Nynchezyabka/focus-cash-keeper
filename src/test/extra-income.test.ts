import { describe, expect, it } from "vitest";
import { calc, intervalExtra, type State } from "@/lib/budget";
const now = new Date(2026, 10, 24, 12);
const base = (): State => ({
  version: 1,
  balance: 4200,
  cash: 0,
  cushion: 0,
  txs: [],
  obligations: [
    { id: "tax", name: "Налоги", amount: 8541, day: 30, once: "2026-11-30", category: "home" },
  ],
  incomes: [
    { id: "salary", name: "Зарплата", amount: 50000, day: 27, end: "2026-11-30" },
    { id: "holiday", name: "Отпускные", amount: 55000, day: 28, once: "2026-11-28" },
  ],
  incomeAck: {},
  ai: { provider: "none", apiKey: "", model: "" },
  createdAt: "2026-11-01T00:00:00.000Z",
});
describe("one-off income before salary", () => {
  it("10000 increases the 3-day norm by 10000 / 3, not 10000 / 60", () => {
    const s = base();
    const before = calc(s, now);
    const after = calc(
      {
        ...s,
        balance: s.balance + 10000,
        txs: [
          {
            id: "gift",
            kind: "income",
            amount: 10000,
            category: "income",
            note: "Перевод",
            date: now.toISOString(),
          },
        ],
      },
      now,
    );
    expect(after.days).toBe(3);
    expect(after.dailyNorm - before.dailyNorm).toBeCloseTo(10000 / 3);
  });
  it("reserved amounts never exceed the actual 6009 balance after today's 8803 spending", () => {
    const s = {
      ...base(),
      balance: 6009,
      txs: [
        {
          id: "gift",
          kind: "income" as const,
          amount: 10000,
          category: "income",
          date: now.toISOString(),
        },
        {
          id: "expense",
          kind: "expense" as const,
          amount: 8803,
          category: "fun",
          date: now.toISOString(),
        },
      ],
    };
    const c = calc(s, now);
    expect(c.aheadHeld + c.held).toBeLessThanOrEqual(6009);
    expect(c.setAside).toBeLessThanOrEqual(6009);
    expect(c.afterSpread).toBeGreaterThan(0);
  });
  it("planned receipts are not extra income, including legacy source-name receipts", () => {
    const s = base();
    s.txs = [
      {
        id: "p",
        kind: "income",
        amount: 25000,
        category: "income",
        incomeId: "salary",
        date: now.toISOString(),
      },
      {
        id: "old",
        kind: "income",
        amount: 25000,
        category: "income",
        note: "Зарплата",
        date: now.toISOString(),
      },
    ];
    expect(intervalExtra(s, now)).toBe(0);
  });
  it("a gift from the previous planned income interval does not bypass smoothing", () => {
    const s = base();
    s.txs = [
      {
        id: "gift",
        kind: "income",
        amount: 10000,
        category: "income",
        date: "2026-10-24T12:00:00.000Z",
      },
    ];
    expect(intervalExtra(s, now)).toBe(0);
  });
});
