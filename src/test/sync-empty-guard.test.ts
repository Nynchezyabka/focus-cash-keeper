import { describe, expect, it } from "vitest";
import { getState, type State } from "@/lib/budget";
import { isEmptyBudget, syncDecision } from "@/lib/device-sync";

const empty = (): State => ({ ...getState(), txs: [], balance: 0, cash: 0, cushion: 0, goals: [] });
const filled = (): State => ({ ...empty(), balance: 25000 });

describe("sync never lets an empty budget overwrite a filled one", () => {
  it("detects an empty budget", () => {
    expect(isEmptyBudget(empty())).toBe(true);
    expect(isEmptyBudget(filled())).toBe(false);
  });
  it("wiped phone pulls even when forced to push", () => {
    expect(syncDecision(empty(), filled(), false, true)).toBe("pull");
  });
  it("filled device ignores a newer empty copy and pushes its own", () => {
    expect(syncDecision(filled(), empty(), true, false)).toBe("push");
  });
  it("normal newer remote is still pulled", () => {
    expect(syncDecision(filled(), { ...filled(), balance: 1 }, true, false)).toBe("pull");
  });
});
