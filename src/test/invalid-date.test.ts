import { describe, it, expect } from "vitest";
import { obligationDue, safeKey } from "@/lib/budget";

describe("broken payment dates", () => {
  it("a payment with a non-ISO date still gets a real due date", () => {
    const d = obligationDue({ id: "x", name: "x", amount: 100, day: 15, category: "home", once: "15 ноября" } as never, new Date(2026, 10, 14));
    expect(+d).not.toBeNaN();
    expect(d.getDate()).toBe(15);
  });
  it("a payment with no day falls back to a valid date", () => {
    const d = obligationDue({ id: "x", name: "x", amount: 100, day: NaN, category: "home" } as never, new Date(2026, 10, 14));
    expect(+d).not.toBeNaN();
  });
  it("safeKey accepts only YYYY-MM-DD", () => {
    expect(safeKey("2026-11-15")).toBe("2026-11-15");
    expect(safeKey("15 ноября")).toBeUndefined();
  });
});
