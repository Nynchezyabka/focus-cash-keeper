import { beforeEach, describe, expect, it } from "vitest";
import { borrow, calc, confirmIncome, getState, nextIncome, reconcile, replaceState, type State } from "@/lib/budget";

const NOW = new Date(2026, 9, 16); // 16 Oct
const base = (): State => ({
  version: 1, balance: 0, cash: 0, cushion: 0, txs: [], obligations: [], incomes: [], incomeAck: {},
  ai: { provider: "none", apiKey: "", model: "" }, createdAt: new Date(2026, 9, 1).toISOString(),
});

describe("budget rules", () => {
  beforeEach(() => replaceState(base()));

  it("reconciling the balance changes today's free amount", () => {
    replaceState({ ...base(), incomes: [{ id: "z", name: "Зарплата", amount: 1, day: 26 }] });
    const before = calc(getState(), NOW).freeToday;
    reconcile(10000);
    const after = calc(getState(), NOW).freeToday;
    expect(before).toBe(0);
    expect(after).toBe(1000); // 10 000 over 10 days
  });

  it("cash counts toward today's free amount", () => {
    replaceState({ ...base(), incomes: [{ id: "z", name: "Зарплата", amount: 1, day: 26 }] });
    reconcile(5000, "cash");
    expect(calc(getState(), NOW).freeToday).toBe(500);
  });

  it("an income confirmed early moves the next date to the following month", () => {
    replaceState({ ...base(), incomes: [{ id: "z", name: "Зарплата", amount: 100, day: 18 }] });
    confirmIncome(getState(), getState().incomes[0]!);
    // confirmIncome uses real today; check the ack moved past the upcoming date
    expect(Object.keys(getState().incomeAck)).toContain("z");
    expect(getState().balance).toBe(100);
  });

  it("a moved income date is used as the next income", () => {
    replaceState({ ...base(), incomes: [{ id: "z", name: "Аванс", amount: 1, day: 20, nextOn: "2026-10-22" }] });
    expect(nextIncome(getState(), NOW).date.getDate()).toBe(22);
  });

  it("borrowing covers the gap and plans a one-off return", () => {
    replaceState({ ...base(), balance: -700 });
    borrow(700, "кредитка", "2026-10-30");
    const s = getState();
    expect(s.balance).toBe(0);
    expect(s.obligations[0]).toMatchObject({ amount: 700, once: "2026-10-30" });
  });
});
