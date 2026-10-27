import { useSyncExternalStore } from "react";
import { calc, cat, dayKey, getState, subscribe, type State } from "@/lib/budget";

/** What leaves the phone. Built from a whitelist: no AI key, assistant chat or «О себе». */
export interface Snapshot {
  day: string; // day the numbers were computed
  freeToday: number;
  dailyNorm: number;
  nextDate: string; // YYYY-MM-DD of this person's next income
  total: number; // card + cash
  reserve: number;
  cushion: number;
  monthSpent: number; // without transfers inside the family
  monthIncome: number;
}
export interface SharedTx { date: string; kind: string; amount: number; note: string; category: string }
export interface Member { id: string; name: string; snapshot: Snapshot | null; txs: SharedTx[] | null; updatedAt: string; me: boolean }

export function snapshotOf(s: State, now = new Date()): Snapshot {
  const c = calc(s, now);
  const month = dayKey(now).slice(0, 7);
  const inMonth = s.txs.filter((t) => !t.family && t.date.slice(0, 7) === month);
  return {
    day: dayKey(now), freeToday: Math.round(c.freeToday), dailyNorm: Math.round(c.dailyNorm), nextDate: dayKey(c.next.date),
    total: Math.round(c.total), reserve: Math.round(c.reserve), cushion: Math.round(s.cushion),
    monthSpent: inMonth.filter((t) => t.kind === "expense" && t.category !== "savings").reduce((a, t) => a + t.amount, 0),
    monthIncome: inMonth.filter((t) => t.kind === "income").reduce((a, t) => a + t.amount, 0),
  };
}
export function sharedTxs(s: State): SharedTx[] {
  return s.txs.filter((t) => !t.family && (t.kind === "expense" || t.kind === "income")).slice(0, 100)
    .map((t) => ({ date: t.date, kind: t.kind, amount: t.amount, note: t.note ?? "", category: t.kind === "income" ? "Доход" : cat(t.category).name }));
}

const parse = (k: string) => { const [y = 2000, m = 1, d = 1] = k.split("-").map(Number); return new Date(y, m - 1, d); };
/** family numbers are always recomputed from everyone's latest data — never stored */
export function familyTotals(members: (Pick<Member, "snapshot">)[], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const known = members.map((m) => m.snapshot).filter((x): x is Snapshot => !!x);
  const daysTo = (s: Snapshot) => Math.max(1, Math.round((+parse(s.nextDate) - +today) / 86400000));
  const nearest = known.length ? Math.min(...known.map(daysTo)) : 0;
  const tk = dayKey(today);
  const sum = (f: (s: Snapshot) => number) => known.reduce((a, s) => a + f(s), 0);
  const norm = sum((s) => s.dailyNorm);
  return {
    today: sum((s) => (s.day === tk ? s.freeToday : s.dailyNorm)),
    nearestDays: nearest,
    untilIncome: norm * nearest,
    total: sum((s) => s.total),
    reserve: sum((s) => s.reserve),
    cushion: sum((s) => s.cushion),
    monthSpent: sum((s) => s.monthSpent),
    monthIncome: sum((s) => s.monthIncome),
  };
}

// ---------- local family settings + sync ----------
export interface FamilyLocal { memberId: string; token: string; code: string; name: string; shareTxs: boolean; dirty: boolean; lastPush?: string; lastPull?: string; members?: Member[] }
const KEY = "berezhny-family";
let cur: FamilyLocal | null | undefined;
const ls = new Set<() => void>();
export function getFamily(): FamilyLocal | null {
  if (cur !== undefined) return cur;
  try { cur = JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { cur = null; }
  return cur ?? null;
}
export function setFamily(f: FamilyLocal | null) {
  cur = f;
  if (f) localStorage.setItem(KEY, JSON.stringify(f)); else localStorage.removeItem(KEY);
  ls.forEach((l) => l());
}
export const patchFamily = (p: Partial<FamilyLocal>) => { const f = getFamily(); if (f) setFamily({ ...f, ...p }); };
export function useFamily() {
  return useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, () => getFamily(), () => null);
}

let busy = false;
export async function syncFamily() {
  const f = getFamily();
  if (!f || busy) return;
  busy = true;
  try {
    const { api } = await import("@/lib/family-api");
    const s = getState();
    if (f.dirty || !f.lastPush) {
      await api.push(f.memberId, f.token, f.name, f.shareTxs, snapshotOf(s), f.shareTxs ? sharedTxs(s) : null);
      patchFamily({ dirty: false, lastPush: new Date().toISOString() });
    }
    const members = await api.pull(f.memberId, f.token);
    patchFamily({ members: members as Member[], lastPull: new Date().toISOString() });
  } catch (e) {
    if (String(e).includes("not-member")) patchFamily({ members: [] });
  } finally { busy = false; }
}

/** call once in the browser: any change in your budget is marked and sent when there is a connection */
let started = false;
export function startFamilySync() {
  if (started || typeof window === "undefined") return;
  started = true;
  let t: ReturnType<typeof setTimeout> | undefined;
  subscribe(() => {
    if (!getFamily()) return;
    patchFamily({ dirty: true });
    clearTimeout(t); t = setTimeout(() => void syncFamily(), 1500);
  });
  window.addEventListener("online", () => void syncFamily());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void syncFamily(); });
  setInterval(() => { if (document.visibilityState === "visible") void syncFamily(); }, 60000);
  void syncFamily();
}
