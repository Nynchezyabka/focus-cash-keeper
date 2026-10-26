import { describe, expect, it } from "vitest";
import { familyTotals, snapshotOf, sharedTxs, type Snapshot } from "@/lib/family";
import type { State } from "@/lib/budget";

const NOW = new Date(2026, 9, 16);
const snap = (p: Partial<Snapshot>): Snapshot => ({ day: "2026-10-16", freeToday: 0, dailyNorm: 0, nextDate: "2026-10-26", total: 0, reserve: 0, cushion: 0, monthSpent: 0, monthIncome: 0, ...p });
const base = (): State => ({ version: 1, balance: 0, cash: 0, cushion: 0, txs: [], obligations: [], incomes: [], incomeAck: {}, ai: { provider: "none", apiKey: "sk-secret", model: "" }, advisorAbout: "беременность", createdAt: "2026-10-01T00:00:00Z" });

describe("family totals", () => {
  const a = snap({ freeToday: 500, dailyNorm: 500, nextDate: "2026-10-26" }); // 10 days
  const b = snap({ freeToday: 1000, dailyNorm: 1000, nextDate: "2026-10-23" }); // 7 days

  it("500×10 and 1000×7 give 1 500 today and 10 500 until the nearest income", () => {
    const t = familyTotals([{ snapshot: a }, { snapshot: b }], NOW);
    expect(t.today).toBe(1500);
    expect(t.untilIncome).toBe(10500);
  });

  it("recomputes by itself as the nearest income gets closer", () => {
    expect(familyTotals([{ snapshot: a }, { snapshot: b }], new Date(2026, 9, 20)).untilIncome).toBe(4500);
  });

  it("a member without data does not break the totals", () => {
    expect(familyTotals([{ snapshot: a }, { snapshot: null }], NOW).today).toBe(500);
  });

  it("savings of both are summed", () => {
    expect(familyTotals([{ snapshot: snap({ cushion: 100000 }) }, { snapshot: snap({ cushion: 5000 }) }], NOW).cushion).toBe(105000);
  });
});

describe("what leaves the phone", () => {
  it("a transfer inside the family is not counted in family spending or shared list", () => {
    const s = { ...base(), txs: [
      { id: "1", kind: "expense" as const, amount: 300, category: "food", date: "2026-10-15T10:00:00Z" },
      { id: "2", kind: "expense" as const, amount: 5000, category: "food", date: "2026-10-15T10:00:00Z", family: true },
    ] };
    expect(snapshotOf(s, NOW).monthSpent).toBe(300);
    expect(sharedTxs(s)).toHaveLength(1);
  });

  it("the AI key and «О себе» are never in the shared data", () => {
    const s = base();
    const out = JSON.stringify([snapshotOf(s, NOW), sharedTxs(s)]);
    expect(out).not.toContain("sk-secret");
    expect(out).not.toContain("беременность");
  });
});
