import { beforeEach, describe, expect, it } from "vitest";
import { addTx, calc, getState, nextIncome, payObligation, payPart, removeTx, replaceState, setCushion, takeFromCushion, transfer, type State } from "@/lib/budget";

// Хрестоматийные сценарии: каждый — понятная жизненная история с ожидаемыми цифрами.
const base = (): State => ({
  version: 1, balance: 0, cash: 0, cushion: 0, txs: [], obligations: [], incomes: [], incomeAck: {},
  ai: { provider: "none", apiKey: "", model: "" }, createdAt: new Date(2026, 9, 1).toISOString(),
});
const at = (d: number, m = 10, y = 2026) => new Date(y, m, d, 12);
const set = (p: Partial<State>) => replaceState({ ...base(), ...p });

describe("хрестоматийные сценарии", () => {
  beforeEach(() => replaceState(base()));

  it("1. спокойный месяц: коммуналка отложена, ориентир ровный, вся сумма видна", () => {
    set({ balance: 44000,
      incomes: [{ id: "a", name: "Аванс", amount: 30000, day: 10 }, { id: "z", name: "Зарплата", amount: 60000, day: 25 }],
      obligations: [{ id: "k", name: "Коммуналка", amount: 5000, day: 18, category: "home" }] });
    const c = calc(getState(), at(12));
    expect(c.days).toBe(13);
    expect(c.held).toBe(5000);
    // не больше 3 000 (44 000 − 5 000 на 13 дней): декабрь беднее, ориентир выравнивается
    expect(c.dailyNorm).toBeLessThanOrEqual(3000);
    expect(c.freeToday).toBe(c.dailyNorm);
    expect(Math.round(c.dailyNorm * c.days + c.held + c.aheadHeld)).toBe(44000);
  });

  it("2. платежи после дохода: часть денег видна в «Отложено», сумма сходится", () => {
    set({ balance: 10000,
      incomes: [{ id: "i", name: "Доход", amount: 5000, day: 15 }],
      obligations: [{ id: "r", name: "Аренда", amount: 20000, day: 16, category: "home" }] });
    const c = calc(getState(), at(13));
    expect(c.dailyNorm).toBeLessThan(5000);
    expect(c.aheadHeld).toBeGreaterThan(0);
    expect(Math.round(c.dailyNorm * c.days + c.held + c.aheadHeld)).toBe(10000);
  });

  it("3. на мели: 2 000 на 4 дня остаются на жизнь, платёж 10 000 честно не покрыт", () => {
    set({ balance: 2000,
      incomes: [{ id: "z", name: "Зарплата", amount: 30000, day: 17 }],
      obligations: [{ id: "l", name: "Кредит", amount: 10000, day: 14, category: "loan", once: "2026-11-14" }] });
    const c = calc(getState(), at(13));
    expect(c.days).toBe(4);
    expect(c.dailyNorm).toBe(500);
    expect(c.held).toBe(0);
    expect(c.shortfall).toBe(10000);
  });

  it("4. оплата планового платежа не уменьшает «Сегодня свободно»", () => {
    const ob = { id: "l", name: "Кредит", amount: 15000, day: 13, category: "loan", once: "2026-11-13" };
    set({ balance: 40000, incomes: [{ id: "z", name: "Зарплата", amount: 100000, day: 23 }], obligations: [ob] });
    const before = calc(getState(), at(13));
    expect(before.dailyNorm).toBe(2500);
    const t = payObligation(ob);
    replaceState({ ...getState(), txs: getState().txs.map((x) => (x.id === t.id ? { ...x, date: at(13).toISOString() } : x)) });
    const after = calc(getState(), at(13));
    expect(getState().balance).toBe(25000);
    expect(after.reserve).toBe(0);
    expect(after.freeToday).toBe(2500);
  });

  it("5. частичная оплата 3 000 наличными: резерв 7 000, отмена всё возвращает", () => {
    const ob = { id: "d", name: "Долг", amount: 10000, day: 20, category: "loan", once: "2026-11-20" };
    set({ balance: 20000, cash: 5000, incomes: [{ id: "z", name: "З", amount: 50000, day: 25 }], obligations: [ob] });
    const free = calc(getState(), at(13)).freeToday;
    const t = payPart(ob, 3000, "cash");
    expect(getState().cash).toBe(2000);
    expect(calc(getState(), at(13)).reserve).toBe(7000);
    expect(calc(getState(), at(13)).freeToday).toBe(free);
    removeTx(t.id);
    expect(getState().cash).toBe(5000);
    expect(calc(getState(), at(13)).reserve).toBe(10000);
  });

  it("6. лекарства на 8 000: всё считается тратой дня, отложенное видно, остаток делится на 9 дней", () => {
    set({ balance: 20000, incomes: [{ id: "z", name: "Зарплата", amount: 50000, day: 23 }] });
    addTx({ kind: "expense", amount: 8000, category: "health", method: "card", date: at(13).toISOString() });
    const c = calc(getState(), at(13));
    expect(c.spentToday).toBe(8000);
    // 20 000 + 50 000 на 40 дней = 1 750 в день; 2 500 оставлено на декабрь и показано
    expect(c.dailyNorm).toBe(1750);
    expect(c.aheadEven).toBe(2500);
    expect(c.overspend).toBe(6250);
    expect(Math.round(c.afterSpread)).toBe(1056); // (17 500 − 8 000) на 9 дней
    expect(Math.round(c.dailyNorm * c.days + c.held + c.aheadHeld)).toBe(20000);
  });

  it("7. снятие 5 000 в банкомате не меняет ни общую сумму, ни свободное", () => {
    set({ balance: 20000, cash: 2000, incomes: [{ id: "z", name: "З", amount: 50000, day: 23 }] });
    const free = calc(getState(), at(13)).freeToday;
    transfer(5000, "card");
    expect(getState().balance).toBe(15000);
    expect(getState().cash).toBe(7000);
    expect(calc(getState(), at(13)).total).toBe(22000);
    expect(calc(getState(), at(13)).freeToday).toBe(free);
  });

  it("8. зарплата 20-го пришла 18-го: следующая дата — 20 декабря", () => {
    set({ incomes: [{ id: "z", name: "Зарплата", amount: 1, day: 20 }], incomeAck: { z: "2026-11-20" } });
    const n = nextIncome(getState(), at(18));
    expect([n.date.getMonth(), n.date.getDate()]).toEqual([11, 20]);
  });

  it("9. доход 31-го: в ноябре 30-е, в феврале 28-е, через Новый год без сбоев", () => {
    set({ incomes: [{ id: "z", name: "З", amount: 1, day: 31 }] });
    expect(nextIncome(getState(), at(20)).date.getDate()).toBe(30);
    expect(nextIncome(getState(), at(10, 1, 2027)).date.getDate()).toBe(28);
    set({ incomes: [{ id: "z", name: "З", amount: 1, day: 5 }] });
    const n = nextIncome(getState(), at(31, 11));
    expect([n.date.getFullYear(), n.date.getMonth(), n.date.getDate()]).toEqual([2027, 0, 5]);
    expect(calc(getState(), new Date(2027, 0, 4, 23)).days).toBe(1);
  });

  it("10. взять 5 000 из копилки: копилка 25 000, карта +5 000, возврат в плане", () => {
    setCushion(30000);
    takeFromCushion(5000, "card", "2026-11-25");
    expect(getState().cushion).toBe(25000);
    expect(getState().balance).toBe(5000);
    expect(getState().obligations[0]).toMatchObject({ amount: 5000, once: "2026-11-25", category: "savings" });
  });
});

describe("ошибка Помощника в отзывы", () => {
  it("содержит комментарий, вопрос и ответ и не длиннее 2000 знаков", async () => {
    const { reportText } = await import("@/routes/advisor");
    const t = reportText("почему 57 ₽?", "Считаю вслух…", "неверно посчитал");
    expect(t).toContain("неверно посчитал");
    expect(t).toContain("почему 57 ₽?");
    expect(reportText("q", "x".repeat(5000), "").length).toBe(2000);
  });
});
