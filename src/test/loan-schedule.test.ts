import { beforeEach, describe, expect, it } from "vitest";
import { calc, forecast, getState, payPart, removeTx, replaceState, type Obligation, type State } from "@/lib/budget";
import { parseScheduleText, schedulePayments, scheduleTotals, validSchedule } from "@/lib/loan-schedule";

const credit: Obligation = { id: "credit", name: "Кредит", category: "loan", amount: 27000, day: 0, method: "card", schedule: [
  { id: "a", date: "2026-11-20", amount: 12000 },
  { id: "b", date: "2026-12-05", amount: 9000 },
  { id: "c", date: "2026-12-20", amount: 6000 },
] };
const base = (): State => ({ version: 1, balance: 100000, cash: 1000, cushion: 0, txs: [], obligations: [credit], incomes: [], incomeAck: {}, nextIncomeOverride: "2026-11-25", ai: { provider: "none", apiKey: "", model: "" }, createdAt: "2026-11-01T00:00:00Z" });
const now = new Date(2026, 10, 13);
describe("credit schedule", () => {
  beforeEach(() => replaceState(base()));
  it("reserves only 12 000 before the November 25 income", () => {
    expect(calc(getState(), now).reserve).toBe(12000);
  });
  it("puts different amounts on their own dates, without repeating monthly", () => {
    const events = forecast(getState(), 60, now).flatMap((g) => g.events);
    expect(events.map((e) => [e.date.getMonth() + 1, e.date.getDate(), e.amount])).toEqual([[11, 20, 12000], [12, 5, 9000], [12, 20, 6000]]);
  });
  it("payment reduces wallet and derived remainder; undo restores both", () => {
    const payment = schedulePayments(credit)[0];
    if (!payment) throw new Error("Missing payment");
    const t = payPart(payment, 12000);
    expect(getState().balance).toBe(88000);
    expect(scheduleTotals(getState(), credit).left).toBe(15000);
    expect(scheduleTotals(getState(), credit).remaining).toBe(2);
    expect(calc(getState(), now).reserve).toBe(0);
    removeTx(t.id);
    expect(getState().balance).toBe(100000);
    expect(scheduleTotals(getState(), credit).left).toBe(27000);
    expect(scheduleTotals(getState(), credit).remaining).toBe(3);
  });
  it("two payments in the same month have separate identities", () => {
    const payments = schedulePayments(credit);
    const second = payments[1]; if (!second) throw new Error("Missing payment");
    payPart(second, 4000, "cash");
    expect(scheduleTotals(getState(), credit).rows.map((r) => r.left)).toEqual([12000, 5000, 6000]);
    expect(getState().cash).toBe(-3000);
  });
  it("unpaid overdue rows are included in today's forecast", () => {
    const events = forecast(getState(), 30, new Date(2026, 10, 23)).flatMap((g) => g.events);
    expect(events[0]?.date.getDate()).toBe(23);
    expect(events[0]?.amount).toBe(12000);
  });
  it("JSON round trip preserves stable row IDs and paid remainder", () => {
    const p = schedulePayments(credit)[0]; if (!p) throw new Error("Missing payment");
    payPart(p, 12000);
    replaceState(JSON.parse(JSON.stringify(getState())));
    const restored = getState().obligations[0]; if (!restored) throw new Error("Missing credit");
    expect(schedulePayments(restored)[0]?.id).toBe("credit::a");
    expect(scheduleTotals(getState(), restored).left).toBe(15000);
  });
});
describe("schedule import", () => {
  it("reads dates with spaces and decimal commas", () => {
    const parsed = parseScheduleText("20.11.2026 12 500\n2026-12-20; 11 800,50 ₽");
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows.map((r) => [r.date, r.amount])).toEqual([["2026-11-20", 12500], ["2026-12-20", 11800.5]]);
  });
  it("rejects impossible dates and ambiguous rows instead of silently importing", () => {
    const parsed = parseScheduleText("31.02.2026 1000\n20.11.2026 1200 400\n20.11 500");
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors).toEqual([1, 2, 3]);
    expect(validSchedule([{ id: "x", date: "2026-11-20", amount: -1 }])).toBe(false);
  });
});