import { beforeEach, describe, expect, it } from "vitest";
import { calc, getState, replaceState, setCushion, type State } from "@/lib/budget";
import { buyGoal, goalSaved, mergeGoals, putToGoal, saveGoal, sharedGoals, unassigned } from "@/lib/goals";

const base = (): State => ({ version: 1, balance: 100000, cash: 0, cushion: 0, txs: [], obligations: [], incomes: [], incomeAck: {}, ai: { provider: "none", apiKey: "", model: "" }, createdAt: "2026-10-01T00:00:00Z" });

describe("savings goals", () => {
  beforeEach(() => { localStorage.clear(); replaceState(base()); setCushion(50000); });

  it("creating a goal changes neither free today nor savings", () => {
    const before = calc(getState()).freeToday;
    saveGoal({ name: "Ноутбук", target: 60000 });
    expect(getState().cushion).toBe(50000);
    expect(calc(getState()).freeToday).toBe(before);
    expect(unassigned(getState())).toBe(50000);
  });

  it("10 000 from the card: card −10 000, savings +10 000, goal 10 000", () => {
    const id = saveGoal({ name: "Ноутбук", target: 60000 });
    putToGoal(id, 10000, "card");
    const s = getState();
    expect(s.balance).toBe(90000);
    expect(s.cushion).toBe(60000);
    expect(goalSaved(s, id)).toBe(10000);
  });

  it("bought for 58 000 with 10 000 collected: card −48 000, savings −10 000, archived", () => {
    const id = saveGoal({ name: "Ноутбук", target: 60000 });
    putToGoal(id, 10000, "card");
    buyGoal(id, 58000, "card");
    const s = getState();
    expect(s.balance).toBe(90000 - 48000);
    expect(s.cushion).toBe(50000);
    expect(s.goals?.[0]?.done?.price).toBe(58000);
  });

  it("old data: all savings are «Без цели»", () => {
    expect(unassigned(getState())).toBe(50000);
  });

  it("undo of a purchase restores money", () => {
    const id = saveGoal({ name: "X", target: 1000 });
    putToGoal(id, 1000, "free");
    buyGoal(id, 3000, "card")();
    expect(getState().balance).toBe(100000);
    expect(getState().cushion).toBe(50000);
  });
});

describe("family goals", () => {
  beforeEach(() => { localStorage.clear(); replaceState(base()); setCushion(50000); });

  it("only family goals leave the phone, with my own part", () => {
    saveGoal({ name: "Личное", target: 1000 });
    const id = saveGoal({ name: "Отпуск", target: 100000, family: true });
    putToGoal(id, 20000, "free");
    const out = sharedGoals(getState());
    expect(out).toHaveLength(1);
    expect(out[0]?.saved).toBe(20000);
  });

  it("partner's newer edit is taken, money untouched", () => {
    const id = saveGoal({ name: "Отпуск", target: 100000, family: true });
    const merged = mergeGoals(getState(), [[{ id, name: "Отпуск", target: 120000, updatedAt: "2999-01-01", saved: 15000 }]]);
    expect(merged?.[0]?.target).toBe(120000);
    expect(getState().cushion).toBe(50000);
  });
});
