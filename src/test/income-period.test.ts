import { describe, it, expect } from "vitest";
import { forecast, incomeUpcoming, nextIncome, type State } from "@/lib/budget";

const now = new Date(2026, 10, 14, 12);
const base = (inc: object): State => ({ version: 1, balance: 10000, cushion: 0, txs: [], obligations: [], incomeAck: {}, createdAt: new Date(2026, 9, 1).toISOString(),
  incomes: [{ id: "care", name: "Пособие", amount: 31932, day: 8, ...inc }] } as unknown as State);

describe("regular income with a period", () => {
  it("is not expected before its start", () => {
    const s = base({ start: "2027-05-01" });
    expect(incomeUpcoming(s, s.incomes[0]!, now)?.toDateString()).toBe(new Date(2027, 4, 8).toDateString());
    expect(forecast(s, 60, now).flatMap((g) => g.incomes).length).toBe(0);
  });
  it("comes monthly from its start", () => {
    const s = base({ start: "2026-12-01" });
    const evs = forecast(s, 90, now).flatMap((g) => g.incomes).map((e) => e.date.getMonth());
    expect(evs).toEqual([11, 0, 1]);
  });
  it("stops after its end", () => {
    const s = base({ end: "2026-12-31" });
    expect(forecast(s, 120, now).flatMap((g) => g.incomes).length).toBe(1);
    expect(nextIncome(s, new Date(2027, 0, 2)).income).toBeUndefined();
  });
});
