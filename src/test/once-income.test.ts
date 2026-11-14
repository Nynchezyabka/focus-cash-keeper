import { describe, it, expect } from "vitest";
import { forecast, incomeUpcoming, nextIncome, pendingIncome, type State } from "@/lib/budget";

const now = new Date(2026, 10, 14, 12);
const base = (): State => ({ version: 1, balance: 10000, cushion: 0, txs: [], obligations: [], incomeAck: {}, createdAt: new Date(2026, 9, 1).toISOString(),
  incomes: [{ id: "sfr", name: "Декретные", amount: 288860, day: 25, once: "2027-01-25" }] } as unknown as State);

describe("one-off income", () => {
  it("comes once on its exact date", () => {
    const s = base();
    expect(incomeUpcoming(s, s.incomes[0]!, now)?.toDateString()).toBe(new Date(2027, 0, 25).toDateString());
    expect(nextIncome(s, now).income?.id).toBe("sfr");
  });
  it("appears once in the forecast, not every month", () => {
    const evs = forecast(base(), 120, now).flatMap((g) => g.incomes);
    expect(evs.filter((e) => e.refId === "sfr").length).toBe(1);
  });
  it("is gone after it arrived", () => {
    const s = { ...base(), incomeAck: { sfr: "2027-01-25" } };
    expect(incomeUpcoming(s, s.incomes[0]!, now)).toBeNull();
    expect(pendingIncome(s, new Date(2027, 0, 26))).toBeNull();
  });
});
