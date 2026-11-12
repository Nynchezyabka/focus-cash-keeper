import { beforeEach, describe, expect, it } from "vitest";
import { calc, getState, removeTx, replaceState, transfer, type State } from "@/lib/budget";

const NOW = new Date(2026, 9, 16);
const base = (): State => ({
  version: 1, balance: 10000, cash: 2000, cushion: 0, txs: [], obligations: [], incomes: [{ id: "z", name: "З", amount: 1, day: 26 }], incomeAck: {},
  ai: { provider: "none", apiKey: "", model: "" }, createdAt: new Date(2026, 9, 1).toISOString(),
});

describe("card ↔ cash transfer", () => {
  beforeEach(() => replaceState(base()));
  it("moves money from card to cash without changing today's free amount", () => {
    const before = calc(getState(), NOW).freeToday;
    transfer(3000, "card");
    expect(getState().balance).toBe(7000);
    expect(getState().cash).toBe(5000);
    expect(calc(getState(), NOW).freeToday).toBe(before);
  });
  it("refuses to move more than the source wallet has", () => {
    expect(transfer(2500, "cash")).toBeNull();
    expect(getState().cash).toBe(2000);
  });
  it("undo restores both wallets", () => {
    const t = transfer(1500, "cash")!;
    removeTx(t.id);
    expect(getState().balance).toBe(10000);
    expect(getState().cash).toBe(2000);
  });
});
