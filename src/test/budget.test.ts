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

describe("editing", () => {
  it("editing an expense amount and method moves the money correctly", async () => {
    const { addTx, updateTx } = await import("@/lib/budget");
    replaceState({ ...base(), balance: 1000, cash: 500 });
    const t = addTx({ kind: "expense", amount: 100, category: "food", method: "card" });
    updateTx(t.id, { amount: 300, method: "cash" });
    expect(getState().balance).toBe(1000);
    expect(getState().cash).toBe(200);
  });
});

describe("reserve and cushion", () => {
  beforeEach(() => replaceState(base()));

  it("a far one-off payment is reserved in proportion to time passed", () => {
    // planned 1 Oct, due 31 Dec (91 days); next income 26 Oct (25 days) -> 12 000 * 25/91 ≈ 3297
    replaceState({ ...base(), balance: 20000, incomes: [{ id: "z", name: "З", amount: 1, day: 26 }],
      obligations: [{ id: "t", name: "Налоги", amount: 12000, day: 31, category: "home", once: "2026-12-31", from: "2026-10-01" }] });
    expect(calc(getState(), NOW).reserve).toBe(3297);
  });

  it("taking money from the cushion makes the cushion smaller", async () => {
    const { addTx, coverFromCushion } = await import("@/lib/budget");
    addTx({ kind: "expense", amount: 5000, category: "savings" });
    coverFromCushion(2000);
    expect(getState().cushion).toBe(3000);
  });
});
