import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/server", () => ({ activeServer: () => ({ url: "http://x", key: "k" }) }));
import { getState, replaceState, type State } from "@/lib/budget";
import { answerPairing, getLink, pollPairing, syncDevices, syncErrorText, unlink } from "@/lib/device-sync";

const st = (balance: number): State => ({ version: 1, balance, cash: 0, cushion: 0, txs: [], obligations: [], incomes: [], incomeAck: {}, ai: { provider: "none", apiKey: "", model: "" }, createdAt: "2026-10-01T00:00:00.000Z" });

// fake server: pair slot + vault
let pair: Record<string, string> = {}, vault: Record<string, { blob: string; rev: number }> = {};
let mode: "ok" | "offline" | "nosql" | "noaccess" = "ok";
let pushes = 0;
function server() {
  vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
    if (mode === "offline") throw new TypeError("Failed to fetch");
    if (mode === "nosql") return new Response('{"code":"PGRST202"}', { status: 404 });
    const fn = url.split("/").pop()!, a = JSON.parse(init.body);
    const j = (v: unknown) => new Response(v == null ? "" : JSON.stringify(v), { status: 200 });
    if (mode === "noaccess" && fn.startsWith("device_vault")) return new Response("no-access", { status: 400 });
    if (fn === "device_pair_answer") { pair[a.p_hash] = a.p_blob; return j(null); }
    if (fn === "device_pair_poll") return j(pair[a.p_hash] ?? null);
    if (fn === "device_vault_pull") return j(vault[a.p_id] ?? null);
    if (fn === "device_vault_push") { pushes++; vault[a.p_id] = { blob: a.p_blob, rev: a.p_rev }; return j(null); }
    return j(null);
  });
}
const CODE = "ABCDEFGHJKMNPQRS";

describe("device pairing", () => {
  beforeEach(async () => { pair = {}; vault = {}; mode = "ok"; pushes = 0; server(); localStorage.clear(); await unlink(false).catch(() => {}); });

  it("success: computer receives the phone budget", async () => {
    replaceState(st(7000)); await answerPairing(CODE);
    const phoneLink = getLink()!;
    await unlink(false); replaceState(st(0)); pushes = 0;
    expect(await pollPairing(CODE)).toBe(true);
    expect(getState().balance).toBe(7000);
    expect(getLink()!.id).toBe(phoneLink.id);
    expect(pushes).toBe(0);
  });

  it("no connection: phone shows the reason and gives the computer nothing", async () => {
    mode = "offline"; replaceState(st(5));
    await expect(answerPairing(CODE)).rejects.toThrow("Нет связи с сервером");
    expect(Object.keys(pair)).toHaveLength(0);
  });

  it("SQL not applied is named clearly", async () => {
    mode = "nosql";
    await expect(pollPairing(CODE)).rejects.toThrow();
    expect(syncErrorText(new Error('rpc 404: {"code":"PGRST202"}'))).toContain("device-sync.sql");
  });

  it("phone not uploaded yet: computer waits and never pushes its own data", async () => {
    replaceState(st(7000)); await answerPairing(CODE);
    const id = getLink()!.id, saved = vault[id];
    delete vault[id]; await unlink(false); replaceState(st(1)); pushes = 0;
    setTimeout(() => { vault[id] = saved!; }, 30);
    expect(await pollPairing(CODE, undefined, 10, 20)).toBe(true);
    expect(getState().balance).toBe(7000);
    expect(pushes).toBe(0);
  });

  it("no access keeps the link and shows a message", async () => {
    replaceState(st(1)); await answerPairing(CODE);
    mode = "noaccess";
    const r = await syncDevices();
    expect(r.ok).toBe(false);
    expect(getLink()?.noAccess).toBe(true);
    expect(getLink()?.lastError).toContain("подключите");
  });
});
