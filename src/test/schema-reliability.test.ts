import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FUTURE_SCHEMA_ERROR,
  dayKey,
  getState,
  migrateState,
  newerBackup,
  replaceState,
  resetLoadedState,
  setState,
  unreadableBackup,
  type State,
} from "@/lib/budget";
import { hasPendingInput } from "@/lib/pwa";

const KEY = "berezhny-budget-v1";
const base = (): State => ({
  version: 1,
  balance: 1200,
  cushion: 0,
  txs: [],
  obligations: [],
  incomes: [],
  incomeAck: {},
  ai: { provider: "none", apiKey: "", model: "" },
  createdAt: "2026-11-01T00:00:00.000Z",
});

beforeEach(() => {
  localStorage.clear();
  resetLoadedState();
  document.body.innerHTML = "";
});
afterEach(() => {
  localStorage.clear();
  resetLoadedState();
  document.body.innerHTML = "";
});

describe("schema migration", () => {
  it("accepts old data without a version and fills current defaults", () => {
    const old = {
      balance: 500,
      cushion: 0,
      txs: [],
      obligations: [],
      incomes: [],
      incomeAck: {},
      ai: { provider: "none", apiKey: "", model: "" },
      createdAt: "2026-01-01",
    };
    expect(migrateState(old)).toMatchObject({
      version: 1,
      balance: 500,
      createdAt: "2026-01-01",
      txs: [],
    });
  });

  it("keeps version 1 data", () => {
    expect(migrateState(base())).toMatchObject({ version: 1, balance: 1200 });
  });

  it("rejects a future schema", () => {
    expect(() => migrateState({ ...base(), version: 2 })).toThrow(FUTURE_SCHEMA_ERROR);
  });

  it("does not overwrite locally stored future data", () => {
    const raw = JSON.stringify({ ...base(), version: 2, futureField: "keep me" });
    localStorage.setItem(KEY, raw);
    resetLoadedState();
    expect(getState().balance).toBe(0);
    expect(newerBackup()).toBe(true);
    expect(unreadableBackup()).toBe(raw);
    setState((s) => ({ ...s, balance: 999 }));
    expect(localStorage.getItem(KEY)).toBe(raw);
  });

  it("does not replace the current budget with a future import", () => {
    replaceState(base());
    expect(() => replaceState({ ...base(), version: 2 } as unknown as State)).toThrow(
      FUTURE_SCHEMA_ERROR,
    );
    expect(getState().balance).toBe(1200);
  });
});

describe("safe updates and local dates", () => {
  it("defers reload while the person is writing", () => {
    const input = document.createElement("textarea");
    input.value = "кофе 350";
    document.body.append(input);
    input.focus();
    expect(hasPendingInput()).toBe(true);
    input.value = "";
    expect(hasPendingInput()).toBe(false);
  });

  it("uses today's local date just after midnight", () => {
    expect(dayKey(new Date(2026, 10, 15, 0, 30))).toBe("2026-11-15");
  });
});
