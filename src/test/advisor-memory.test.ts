import { describe, it, expect } from "vitest";
import { addMemory, extractRemember, forgetMemory, memoryCommand, memoryOk, memoryPrompt, openerDue } from "@/lib/advisor-memory";
import { getState } from "@/lib/budget";

describe("advisor memory", () => {
  it("rejects sums, dates and health", () => {
    expect(memoryOk("лучше один шаг, а не список")).toBe(true);
    expect(memoryOk("долг 40000")).toBe(false);
    expect(memoryOk("у меня диагноз СДВГ")).toBe(false);
  });
  it("keeps at most 20 lines without duplicates", () => {
    let l: string[] = [];
    for (let i = 0; i < 25; i++) l = addMemory(l, `предпочтение ${"абвгдежзийклмнопрстуфхцч"[i]}`);
    expect(l.length).toBe(20);
    expect(addMemory(["копим на коляску"], "Копим на коляску")).toHaveLength(1);
  });
  it("commands and forgetting", () => {
    expect(memoryCommand("Запомни, что не люблю слово экономить")).toEqual({ add: "не люблю слово экономить" });
    expect(forgetMemory(["копим на коляску", "лучше один шаг"], "коляску")).toEqual(["лучше один шаг"]);
  });
  it("model suggestion is extracted, not saved", () => {
    const r = extractRemember("Ок.\n[[ЗАПОМНИТЬ: по утрам не обсуждать цифры]]");
    expect(r).toEqual({ clean: "Ок.", remember: "по утрам не обсуждать цифры" });
    expect(memoryPrompt([])).not.toContain("ЧТО ТЫ ПОМНИШЬ");
  });
  it("opener at most once a day and can be turned off", () => {
    const s = { ...getState(), txs: [{ id: "i", kind: "income" as const, amount: 50000, category: "income", date: new Date().toISOString() }] };
    expect(openerDue(s, new Date(), null, null)?.reason).toBe("income");
    expect(openerDue(s, new Date(), new Date().toLocaleDateString("sv-SE"), null)).toBeNull();
    expect(openerDue({ ...s, advisorInitiative: false }, new Date(), null, null)).toBeNull();
  });
});
