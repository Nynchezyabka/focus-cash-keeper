import { describe, it, expect } from "vitest";
import { demoState } from "@/lib/demo";
import { calc } from "@/lib/budget";
describe("демо-пример", () => {
  it("показывает положительную сумму на сегодня", () => {
    const c = calc(demoState());
    expect(c.freeToday).toBeGreaterThan(0);
  });
});
