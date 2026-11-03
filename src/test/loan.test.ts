import { beforeEach, expect, it } from "vitest";
import { borrow, getState, replaceState, syncLoanMoney } from "@/lib/budget";

beforeEach(() => replaceState({ ...getState(), balance: 1000, cash: 0, txs: [], obligations: [] }));

it("moving a debt from card to cash moves the money", () => {
  const { ob } = borrow(5000, "мама", "2026-12-01", "card");
  expect(getState().balance).toBe(6000);
  syncLoanMoney(ob, { ...ob, method: "cash" });
  expect(getState().balance).toBe(1000);
  expect(getState().cash).toBe(5000);
});

it("changing a one-off debt sum fixes the wallet by the difference", () => {
  const { ob } = borrow(5000, "мама", "2026-12-01", "card");
  syncLoanMoney(ob, { ...ob, amount: 7000 });
  expect(getState().balance).toBe(8000);
});
