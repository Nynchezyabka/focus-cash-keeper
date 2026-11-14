import { useSyncExternalStore } from "react";
import { getState, replaceState, subscribe, type State } from "@/lib/budget";
import { activeServer } from "@/lib/server";
import { importKey, newToken, newVaultKey, open, pairHash, pairKey, seal } from "@/lib/vault-crypto";

// Sync between one person's own devices. The budget is encrypted on the device; the database stores only the sealed blob.
export interface Link { id: string; token: string; key: string; rev: number; dirty: boolean; dirtyAt?: number; lastSync?: string }
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
  const r = await fetch(`${sv.url}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: sv.key, "Content-Type": "application/json" }, body: JSON.stringify(args) });
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
  await syncDevices(true);
  await rpc("device_pair_answer", { p_hash: await pairHash(code), p_blob: blob });
}
/** computer: waits for the phone; resolves once the budget arrived */
export async function pollPairing(code: string): Promise<boolean> {
  const blob = await rpc<string | null>("device_pair_poll", { p_hash: await pairHash(code) });
  if (!blob) return false;
  const creds = await open<{ id: string; token: string; key: string }>(await pairKey(code), blob);
  setLink({ ...creds, rev: 0, dirty: false });
  await syncDevices();
  return true;
}
export async function unlink(wipeCloud: boolean) {
  const l = getLink(); if (!l) return;
  if (wipeCloud) await rpc("device_vault_delete", { p_id: l.id, p_token: l.token });
  setLink(null);
}

// ---------- sync ----------
let busy = false;
export async function syncDevices(forcePush = false) {
  const l = getLink();
  if (!l || busy || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  busy = true;
  try {
    const key = await importKey(l.key);
    const remote = await rpc<{ blob: string; rev: number } | null>("device_vault_pull", { p_id: l.id, p_token: l.token });
    const remoteNewer = !!remote && remote.rev > l.rev;
    // both changed: the later change wins (last write wins)
    if (remoteNewer && !(l.dirty && (l.dirtyAt ?? 0) > remote!.rev && !forcePush)) {
      applyRemote(await open<State>(key, remote!.blob));
      patch({ rev: remote!.rev, dirty: false, lastSync: new Date().toISOString() });
      return;
    }
    if (l.dirty || !remote || forcePush) {
      const rev = Math.max(Date.now(), (remote?.rev ?? 0) + 1);
      await rpc("device_vault_push", { p_id: l.id, p_token: l.token, p_blob: await seal(key, outgoing(getState())), p_rev: rev });
      patch({ rev, dirty: false, lastSync: new Date().toISOString() });
    } else patch({ lastSync: new Date().toISOString() });
  } catch (e) {
    if (String(e).includes("no-access")) setLink(null);
  } finally { busy = false; }
}

let started = false;
export function startDeviceSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  let t: ReturnType<typeof setTimeout> | undefined;
  subscribe(() => {
    if (applying || !getLink()) return;
    patch({ dirty: true, dirtyAt: Date.now() });
    clearTimeout(t); t = setTimeout(() => void syncDevices(), 1500);
  });
  window.addEventListener("online", () => void syncDevices());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void syncDevices(); });
  setInterval(() => { if (document.visibilityState === "visible") void syncDevices(); }, 30000);
  void syncDevices();
}
