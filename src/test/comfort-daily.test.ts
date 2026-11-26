import { describe, it, expect } from "vitest";
import { calc, type State } from "@/lib/budget";

const s = (over: Partial<State>) =>
  ({
    version: 1, balance: 6000, cash: 0, cushion: 0, txs: [], incomeAck: {},
    incomes: [{ id: "i", name: "Доход", amount: 50000, day: 27 }],
    obligations: [], createdAt: new Date(2026, 10, 1).toISOString(),
    ...over,
  }) as unknown as State;

describe("comfortable daily norm", () => {
  const now = new Date(2026, 10, 25, 12); // 2 days to income
  it("caps today at 1400 and keeps the rest set aside", () => {
    const c = calc(s({ comfortDaily: 1400 }), now);
    expect(Math.round(c.dailyNorm)).toBe(1400);
    expect(Math.round(c.setAside)).toBe(6000 - 2800);
  });
  it("without the setting the whole money is spread", () => {
    expect(Math.round(calc(s({}), now).dailyNorm)).toBeGreaterThan(1400);
  });
});
