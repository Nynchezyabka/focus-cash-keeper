import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import {
  calc,
  confirmIncome,
  forecast,
  getState,
  isPaid,
  payObligation,
  payPart,
  remainingPayment,
  replaceState,
  removeTx,
  restoreTx,
  type State,
  type Obligation,
} from "@/lib/budget";
import { scheduleTotals } from "@/lib/loan-schedule";

const now = new Date(2026, 10, 24, 12);
const payment: Obligation = {
  id: "repair",
  name: "Ремонт",
  amount: 1200,
  category: "home",
  once: "2026-11-24",
  day: 24,
  method: "cash",
};
const base = (): State => ({
  version: 1,
  balance: 4200,
  cash: 1500,
  cushion: 0,
  txs: [],
  obligations: [payment],
  incomes: [{ id: "salary", name: "Зарплата", amount: 25000, day: 27 }],
  incomeAck: {},
  ai: { provider: "none", apiKey: "", model: "" },
  createdAt: "2026-11-01T00:00:00.000Z",
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  replaceState(base());
});
afterEach(() => vi.useRealTimers());
describe("actual payment amounts", () => {
  it("1100 cash settles the 1200 repair without changing the plan or keeping 100 reserved", () => {
    const t = payObligation(payment, "cash", 1100);
    const s = getState();
    expect(s.cash).toBe(400);
    expect(s.obligations[0]?.amount).toBe(1200);
    expect(isPaid(s, payment, now)).toBe(true);
    expect(remainingPayment(s, payment, now)).toBe(0);
    expect(calc(s, now).reserve).toBe(0);
    expect(
      forecast(s, 60, now)
        .flatMap((g) => g.events)
        .find((e) => e.refId === "repair")?.paid,
    ).toBe(true);
    removeTx(t.id);
    expect(getState().cash).toBe(1500);
    expect(remainingPayment(getState(), payment, now)).toBe(1200);
    restoreTx(t);
    expect(isPaid(getState(), payment, now)).toBe(true);
  });
  it("a partial 1100 payment keeps the remaining 100", () => {
    payPart(payment, 1100, "cash");
    expect(remainingPayment(getState(), payment, now)).toBe(100);
    expect(isPaid(getState(), payment, now)).toBe(false);
  });
  it("a completed regular occurrence does not close the next month", () => {
    const regular = { ...payment, once: undefined };
    const { once: _, ...o } = regular;
    payObligation(o, "cash", 1100);
    expect(isPaid(getState(), o, now)).toBe(true);
    expect(isPaid(getState(), o, new Date(2026, 11, 24))).toBe(false);
  });
  it("paying a December calendar occurrence does not settle November", () => {
    const { once: _, ...o } = payment;
    const december = new Date(2026, 11, 24);
    payObligation(o, "cash", 1100, december);
    expect(isPaid(getState(), o, december)).toBe(true);
    expect(isPaid(getState(), o, now)).toBe(false);
  });
  it("a schedule row settled for less has no outstanding tail", () => {
    const parent = {
      ...payment,
      id: "credit",
      schedule: [{ id: "row", date: "2026-11-24", amount: 1200 }],
    };
    payObligation({ ...payment, id: "credit::row" }, "cash", 1100);
    expect(scheduleTotals(getState(), parent).left).toBe(0);
  });
  it("a 38000 actual receipt completes a 40000 planned income and credits only 38000", () => {
    const inc = { id: "salary", name: "Зарплата", amount: 40000, day: 27 };
    confirmIncome(getState(), inc, 38000);
    expect(getState().balance).toBe(42200);
    expect(getState().incomeAck["salary"]).toBe("2026-11-27");
    expect(getState().txs[0]?.incomeId).toBe("salary");
  });
});
