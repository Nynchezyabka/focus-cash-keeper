import { describe, expect, it } from "vitest";
import { getState, resetLoadedState, setState, unreadableBackup } from "@/lib/budget";

describe("испорченное хранилище", () => {
  it("оригинал сохраняется до создания пустого бюджета и не затирается", () => {
    localStorage.clear();
    localStorage.setItem("berezhny-budget-v1", "{broken");
    resetLoadedState();
    expect(getState().txs).toEqual([]);
    expect(unreadableBackup()).toBe("{broken");
    setState((s) => ({ ...s, balance: 5 }));
    expect(unreadableBackup()).toBe("{broken");
  });
});
