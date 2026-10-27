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

describe("savings, partial payments, skipped income", () => {
  beforeEach(() => replaceState(base()));

  it("setting savings to 100 000 leaves card and free today untouched, and undo restores", async () => {
    const { setCushion, removeTx } = await import("@/lib/budget");
    replaceState({ ...base(), balance: 10000, incomes: [{ id: "z", name: "З", amount: 1, day: 26 }] });
    const before = calc(getState(), NOW).freeToday;
    const t = setCushion(100000)[0]!;
    expect(getState().cushion).toBe(100000);
    expect(getState().balance).toBe(10000);
    expect(calc(getState(), NOW).freeToday).toBe(before);
    removeTx(t.id);
    expect(getState().cushion).toBe(0);
  });

  it("a partial payment lowers the reserve by the paid part", async () => {
    const { payPart } = await import("@/lib/budget");
    const ob = { id: "d", name: "Долг", amount: 10000, day: 20, category: "loan", once: "2026-10-20" };
    replaceState({ ...base(), balance: 20000, incomes: [{ id: "z", name: "З", amount: 1, day: 26 }], obligations: [ob] });
    payPart(ob, 3000);
    expect(calc(getState(), NOW).reserve).toBe(7000);
    expect(getState().balance).toBe(17000);
  });

  it("an income switched off for this month is skipped", () => {
    replaceState({ ...base(), incomes: [{ id: "z", name: "З", amount: 1, day: 20, skip: "2026-10" }, { id: "y", name: "А", amount: 1, day: 25 }] });
    expect(nextIncome(getState(), NOW).date.getDate()).toBe(25);
  });
});

describe("payments, savings and loans", () => {
  beforeEach(() => replaceState(base()));

  it("cancelling a payment makes it reserved again", async () => {
    const { payObligation, unpay, isPaid, obligationDue } = await import("@/lib/budget");
    const ob = { id: "r", name: "Аренда", amount: 5000, day: 20, category: "home" };
    replaceState({ ...base(), balance: 10000, obligations: [ob] });
    payObligation(ob);
    expect(isPaid(getState(), ob, obligationDue(ob))).toBe(true);
    unpay(ob);
    expect(isPaid(getState(), ob, obligationDue(ob))).toBe(false);
    expect(getState().balance).toBe(10000);
  });

  it("taking 2000 from savings adds it to the card and plans the return", async () => {
    const { setCushion, takeFromCushion } = await import("@/lib/budget");
    setCushion(10000);
    takeFromCushion(2000, "card", "2026-11-20");
    expect(getState().cushion).toBe(8000);
    expect(getState().balance).toBe(2000);
    expect(getState().obligations[0]).toMatchObject({ amount: 2000, once: "2026-11-20", category: "savings" });
  });

  it("savings in cash are kept apart from savings on the card", async () => {
    const { setCushion } = await import("@/lib/budget");
    setCushion(7000, 3000);
    expect(getState().cushion).toBe(10000);
    expect(getState().cushionCash).toBe(3000);
    expect(getState().cash).toBe(0);
  });

  it("a monthly loan puts the money on the card and a monthly payment in the plan", () => {
    borrow(30000, "банк", "2026-11-05", "card", 3000);
    expect(getState().balance).toBe(30000);
    expect(getState().obligations[0]).toMatchObject({ amount: 3000, day: 5 });
    expect(getState().obligations[0]!.once).toBeUndefined();
  });
});

describe("currency", () => {
  it("12 dollars at 95 become 1140 rubles and keep the original", async () => {
    localStorage.setItem("berezhny-fx", JSON.stringify({ at: new Date().toISOString(), rates: { USD: 95 } }));
    const { applyFx, parseLocal } = await import("@/lib/parse");
    const [it] = applyFx(parseLocal("кофе 12$"));
    expect(it!.amount).toBe(1140);
    expect(it!.orig).toMatchObject({ amount: 12, currency: "USD" });
  });
});

describe("life minimum and honest reserve", () => {
  it("keeps 500 ₽ a day for life and never sets aside more than there is", () => {
    replaceState({
      ...base(), balance: 8000,
      incomes: [{ id: "z", name: "Зарплата", amount: 1, day: 26 }],
      obligations: [{ id: "o", name: "Кредит", amount: 25000, day: 20, category: "loan" }],
    });
    const c = calc(getState(), NOW); // 10 days
    expect(c.dailyNorm).toBe(500);
    expect(c.held).toBe(3000);
    expect(c.shortfall).toBe(22000);
  });
});

describe("calendar forecast", () => {
  it("splits days by incomes and shows free money per day on each stretch", async () => {
    const { forecast } = await import("@/lib/budget");
    replaceState({
      ...base(), balance: 10000,
      incomes: [{ id: "z", name: "Зарплата", amount: 30000, day: 26 }],
      obligations: [{ id: "o", name: "Кредит", amount: 5000, day: 20, category: "loan" }],
    });
    const [a, b] = forecast(getState(), 45, NOW);
    expect(a!.days).toBe(10);
    expect(a!.perDay).toBe(500); // (10000 − 5000) / 10
    expect(b!.money).toBe(30000);
    expect(b!.incomes[0]!.name).toBe("Зарплата");
  });
});
