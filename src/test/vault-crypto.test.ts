import { describe, expect, it } from "vitest";
import {
  importKey,
  newPairCode,
  newVaultKey,
  normCode,
  open,
  pairKey,
  seal,
  showCode,
} from "@/lib/vault-crypto";

describe("device sync encryption", () => {
  it("the budget opens only with the same key", async () => {
    const k = await importKey(newVaultKey());
    const blob = await seal(k, { balance: 7000 });
    expect(blob).not.toContain("7000");
    expect(await open(k, blob)).toEqual({ balance: 7000 });
    await expect(open(await importKey(newVaultKey()), blob)).rejects.toBeTruthy();
  });
  it("pairing code is 16 characters and survives typing with dashes", async () => {
    const c = newPairCode();
    expect(c).toHaveLength(16);
    expect(normCode(showCode(c).toLowerCase())).toBe(c);
    const blob = await seal(await pairKey(c), { id: "x" });
    expect(await open(await pairKey(c), blob)).toEqual({ id: "x" });
  });
});
