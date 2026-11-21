import { describe, expect, it } from "vitest";
import { catPatterns } from "@/lib/spend-pattern";
import type { Tx } from "@/lib/budget";

const tx = (date: string, amount: number, extra: Partial<Tx> = {}): Tx => ({
  id: date + amount, kind: "expense", amount, category: "cafe", date: `${date}T12:00:00`, ...extra,
});

describe("spending rhythm", () => {
  it("averages only days with spending, weekdays apart from weekends", () => {
    // 2026-11-16 Mon, 17 Tue, 21 Sat
    const [p] = catPatterns([tx("2026-11-16", 1000), tx("2026-11-16", 400), tx("2026-11-17", 600), tx("2026-11-21", 2000)], 0, Infinity);
    expect(p!.activeDays).toBe(3);
    expect(p!.perWeekday).toBe(1000);
    expect(p!.perWeekend).toBe(2000);
    expect(p!.count).toBe(4);
    expect(p!.avgTicket).toBe(1000);
  });
  it("planned payments and cash share", () => {
    const [p] = catPatterns([tx("2026-11-16", 300, { method: "cash" }), tx("2026-11-17", 700), tx("2026-11-18", 5000, { obligationId: "x" })], 0, Infinity);
    expect(p!.total).toBe(1000);
    expect(p!.cardShare).toBe(70);
    expect(p!.everyDays).toBe(1);
  });
  it("finds big purchases above twice the typical ticket", () => {
    const [p] = catPatterns([tx("2026-11-16", 500), tx("2026-11-17", 600), tx("2026-11-18", 3000)], 0, Infinity);
    expect(p!.big.map((b) => b.amount)).toEqual([3000]);
  });
});
