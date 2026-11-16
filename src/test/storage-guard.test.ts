import { describe, expect, it } from "vitest";
import { getState } from "@/lib/budget";
import { shadowToRestore } from "@/lib/storage-guard";

const empty = () => ({ ...getState(), txs: [], balance: 0, cash: 0, cushion: 0, goals: [] });

describe("shadow copy restore", () => {
  it("restores a filled copy when the live budget is empty", () => {
    const r = shadowToRestore(empty(), JSON.stringify({ ...empty(), balance: 5000 }));
    expect(r?.balance).toBe(5000);
  });
  it("never replaces a filled live budget", () => {
    expect(
      shadowToRestore({ ...empty(), balance: 1 }, JSON.stringify({ ...empty(), balance: 5000 })),
    ).toBeNull();
  });
  it("ignores an empty or broken copy", () => {
    expect(shadowToRestore(empty(), JSON.stringify(empty()))).toBeNull();
    expect(shadowToRestore(empty(), "{oops")).toBeNull();
  });
});
