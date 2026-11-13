import { describe, it, expect } from "vitest";
import { toneOf, nameOf, isNextStep, greeting } from "@/lib/persona";
describe("persona", () => {
  it("defaults to calm", () => { expect(toneOf(undefined)).toBe("calm"); expect(toneOf("x")).toBe("calm"); expect(toneOf("shake")).toBe("shake"); });
  it("default name and greeting uses name", () => { expect(nameOf("  ")).toBe("Помощник"); expect(greeting("calm", "Груша")).toContain("Груша"); });
  it("detects next-step questions", () => { expect(isNextStep("Что мне сейчас делать?")).toBe(true); expect(isNextStep("С чего начать сегодня?")).toBe(true); expect(isNextStep("Можно купить пылесос?")).toBe(false); });
});
