import { describe, expect, it } from "vitest";
import { reviewRange } from "@/lib/review";

const now = new Date(2026, 10, 18);
describe("advisor review range", () => {
  it("ignores ordinary questions", () => expect(reviewRange("сколько можно потратить?", now)).toBeNull());
  it("month by name", () => {
    const r = reviewRange("Сделай обзор за октябрь", now)!;
    expect(r.from).toEqual(new Date(2026, 9, 1));
    expect(r.to).toEqual(new Date(2026, 10, 1));
  });
  it("future month name means last year", () => expect(reviewRange("итоги декабря", now)!.from).toEqual(new Date(2025, 11, 1)));
  it("all time", () => expect(reviewRange("обозри бюджет за всё время", now)!.label).toBe("за всё время"));
  it("default is this month", () => expect(reviewRange("обзор", now)!.from).toEqual(new Date(2026, 10, 1)));
});
