import { useSyncExternalStore } from "react";
import { getState, replaceState, subscribe, type State } from "@/lib/budget";
import { activeServer } from "@/lib/server";
import { importKey, newToken, newVaultKey, open, pairHash, pairKey, seal } from "@/lib/vault-crypto";

// Sync between one person's own devices. The budget is encrypted on the device; the database stores only the sealed blob.
export interface Link { id: string; token: string; key: string; rev: number; dirty: boolean; dirtyAt?: number; lastSync?: string; lastError?: string | undefined; lastErrorAt?: string | undefined; noAccess?: boolean }

/** Human-readable reason for a failed sync/pairing step. */
export function syncErrorText(e: unknown): string {
  const m = String(e instanceof Error ? e.message : e);
  if (m.includes("not-configured")) return "Сервер не подключён";
  if (m.includes("no-access")) return "Нет доступа к хранилищу — подключите устройство заново";
  if (m.includes("vault-missing")) return "Бюджет с телефона ещё не пришёл";
  if (/PGRST202|42883|could not find the function|404/i.test(m)) return "На сервере не настроена синхронизация (нужно выполнить device-sync.sql)";
  if (/rpc (401|403)/.test(m)) return "Сервер отказал в доступе";
  if (/rpc 5\d\d/.test(m)) return "Сервер временно недоступен";
  if (/failed to fetch|networkerror|load failed|offline/i.test(m)) return "Нет связи с сервером";
  return "Не удалось сверить: " + m.slice(0, 120);
}
const KEY = "berezhny-device-sync";
let cur: Link | null | undefined;
const ls = new Set<() => void>();
export function getLink(): Link | null {
  if (cur !== undefined) return cur;
  try { cur = JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { cur = null; }
  return cur ?? null;
}
function setLink(l: Link | null) {
  cur = l;
  if (l) localStorage.setItem(KEY, JSON.stringify(l)); else localStorage.removeItem(KEY);
  ls.forEach((f) => f());
}
const patch = (p: Partial<Link>) => { const l = getLink(); if (l) setLink({ ...l, ...p }); };
export const useLink = () => useSyncExternalStore((f) => { ls.add(f); return () => ls.delete(f); }, () => getLink(), () => null);

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const sv = activeServer(); if (!sv) throw new Error("not-configured");
  let r: Response;
  try { r = await fetch(`${sv.url}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: sv.key, "Content-Type": "application/json" }, body: JSON.stringify(args) }); }
  catch { throw new Error("offline"); }
  if (!r.ok) throw new Error(`rpc ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}

/** AI keys stay on each device, like in the backup file */
const outgoing = (s: State) => ({ ...s, ai: { ...s.ai, apiKey: "", advisorApiKey: "" } });
let applying = false;
function applyRemote(remote: State) {
  const s = getState();
  applying = true;
  try { replaceState({ ...remote, ai: { ...remote.ai, apiKey: s.ai.apiKey, advisorApiKey: (s.ai as { advisorApiKey?: string }).advisorApiKey ?? "" } as State["ai"] }); }
  finally { applying = false; }
}

// ---------- pairing ----------
/** phone: answers the code shown on the other device and starts syncing */
export async function answerPairing(code: string) {
  const link: Link = getLink() ?? { id: crypto.randomUUID(), token: newToken(), key: newVaultKey(), rev: 0, dirty: true };
  const blob = await seal(await pairKey(code), { id: link.id, token: link.token, key: link.key });
  setLink({ ...link, dirty: true, dirtyAt: Date.now() });
  // the budget must be in the vault before the computer learns the credentials
  await waitIdle();
  const r = await syncDevices(true);
  if (!r.ok) throw new Error(r.error);
  await rpc("device_pair_answer", { p_hash: await pairHash(code), p_blob: blob });
}
export type PairStage = "waiting" | "receiving" | "done";
/** computer: waits for the phone, then downloads its budget. Never pushes its own data while pairing. */
export async function pollPairing(code: string, onStage?: (s: PairStage) => void, tries = 10, delay = 1500): Promise<boolean> {
  const blob = await rpc<string | null>("device_pair_poll", { p_hash: await pairHash(code) });
  if (!blob) return false;
  onStage?.("receiving");
  const creds = await open<{ id: string; token: string; key: string }>(await pairKey(code), blob);
  const key = await importKey(creds.key);
  for (let i = 0; i < tries; i++) {
    const remote = await rpc<{ blob: string; rev: number } | null>("device_vault_pull", { p_id: creds.id, p_token: creds.token });
    if (remote) {
      applyRemote(await open<State>(key, remote.blob));
      setLink({ ...creds, rev: remote.rev, dirty: false, lastSync: new Date().toISOString() });
      onStage?.("done");
      return true;
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error("vault-missing");
}
export async function unlink(wipeCloud: boolean) {
  const l = getLink(); if (!l) return;
  if (wipeCloud) await rpc("device_vault_delete", { p_id: l.id, p_token: l.token });
  setLink(null);
}

// ---------- sync ----------
let busy = false;
async function waitIdle() { for (let i = 0; i < 50 && busy; i++) await new Promise((r) => setTimeout(r, 200)); }
export type SyncResult = { ok: true } | { ok: false; error: string };
export async function syncDevices(forcePush = false): Promise<SyncResult> {
  const l = getLink();
  if (!l) return { ok: false, error: "Устройство не подключено" };
  if (typeof navigator !== "undefined" && !navigator.onLine) { patch({ lastError: "Нет связи с сервером", lastErrorAt: new Date().toISOString() }); return { ok: false, error: "Нет связи с сервером" }; }
  if (busy) { await waitIdle(); if (busy) return { ok: false, error: "Сверка уже идёт" }; }
  busy = true;
  try {
    const key = await importKey(l.key);
    const remote = await rpc<{ blob: string; rev: number } | null>("device_vault_pull", { p_id: l.id, p_token: l.token });
    const remoteNewer = !!remote && remote.rev > l.rev;
    // both changed: the later change wins (last write wins)
    if (remoteNewer && !(l.dirty && (l.dirtyAt ?? 0) > remote!.rev && !forcePush)) {
      applyRemote(await open<State>(key, remote!.blob));
      patch({ rev: remote!.rev, dirty: false, lastSync: new Date().toISOString(), lastError: undefined, noAccess: false });
      return { ok: true };
    }
    if (l.dirty || !remote || forcePush) {
      const rev = Math.max(Date.now(), (remote?.rev ?? 0) + 1);
      await rpc("device_vault_push", { p_id: l.id, p_token: l.token, p_blob: await seal(key, outgoing(getState())), p_rev: rev });
      patch({ rev, dirty: false, lastSync: new Date().toISOString(), lastError: undefined, noAccess: false });
    } else patch({ lastSync: new Date().toISOString(), lastError: undefined, noAccess: false });
    return { ok: true };
  } catch (e) {
    const error = syncErrorText(e);
    // never unlink silently: keep the link and show the reason
    patch({ lastError: error, lastErrorAt: new Date().toISOString(), noAccess: String(e).includes("no-access") });
    return { ok: false, error };
  } finally { busy = false; }
}

let started = false;
let pairing = false;
export const setPairing = (v: boolean) => { pairing = v; };
export function startDeviceSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  let t: ReturnType<typeof setTimeout> | undefined;
  subscribe(() => {
    if (applying || !getLink() || pairing) return;
    patch({ dirty: true, dirtyAt: Date.now() });
    clearTimeout(t); t = setTimeout(() => void syncDevices(), 1500);
  });
  window.addEventListener("online", () => void syncDevices());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void syncDevices(); });
  setInterval(() => { if (document.visibilityState === "visible") void syncDevices(); }, 30000);
  void syncDevices();
}
