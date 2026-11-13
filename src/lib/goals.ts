import { addTx, dayKey, getState, removeTx, setState, uid, type Goal, type Method, type State, type Tx } from "@/lib/budget";

/** how much of the savings belongs to a goal: everything tagged with it that moved savings */
export function goalSaved(s: State, id: string) {
  let sum = 0;
  for (const t of s.txs) {
    if (t.goal !== id) continue;
    if (t.kind === "expense" && t.category === "savings") sum += t.amount;
    else if (t.kind === "cushion") sum -= t.amount;
    else if (t.kind === "savings" || t.kind === "goal") sum += t.amount;
  }
  return Math.max(0, sum);
}
/** goals that still hold money: active ones, and family purchases this person has not decided on yet */
const holds = (g: Goal) => !g.deleted && (!g.done || (g.family && !g.settled));
export const activeGoals = (s: State) => (s.goals ?? []).filter((g) => !g.deleted && !g.done);
export const archivedGoals = (s: State) => (s.goals ?? []).filter((g) => !g.deleted && g.done);
export function unassigned(s: State) {
  const used = (s.goals ?? []).filter(holds).reduce((a, g) => a + goalSaved(s, g.id), 0);
  return Math.max(0, s.cushion - used);
}
/** per month to reach the target by the date */
export function perMonth(s: State, g: Goal, now = new Date()) {
  if (!g.date) return null;
  const left = Math.max(0, g.target - goalSaved(s, g.id));
  const [y = 0, m = 1] = g.date.split("-").map(Number);
  const months = Math.max(1, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()) + 1);
  return Math.ceil(left / months);
}

const now = () => new Date().toISOString();
function patch(id: string, p: Partial<Goal>) {
  setState((s) => ({ ...s, goals: (s.goals ?? []).map((g) => (g.id === id ? { ...g, ...p, updatedAt: now() } : g)) }));
}
export function saveGoal(g: Omit<Goal, "id"> & { id?: string }) {
  const id = g.id ?? uid();
  setState((s) => {
    const list = s.goals ?? [];
    const next = { ...g, id, updatedAt: now() } as Goal;
    return { ...s, goals: list.some((x) => x.id === id) ? list.map((x) => (x.id === id ? { ...x, ...next } : x)) : [...list, next] };
  });
  return id;
}
/** deleting never changes savings: the money simply becomes «Без цели» */
export function deleteGoal(id: string) {
  const g = getState().goals?.find((x) => x.id === id);
  if (!g) return () => {};
  if (g.family) patch(id, { deleted: true });
  else setState((s) => ({ ...s, goals: (s.goals ?? []).filter((x) => x.id !== id) }));
  return () => setState((s) => ({ ...s, goals: [...(s.goals ?? []).filter((x) => x.id !== id), g] }));
}
/** put money aside for a goal: from card/cash (savings grow) or from «Без цели» (nothing else changes) */
export function putToGoal(id: string, amount: number, from: Method | "free"): Tx {
  const name = getState().goals?.find((g) => g.id === id)?.name ?? "";
  if (from === "free") return addTx({ kind: "goal", amount, category: "savings", note: `На цель «${name}»`, goal: id });
  return addTx({ kind: "expense", amount, category: "savings", note: `На цель «${name}»`, method: from, goal: id });
}
/**
 * bought: what was collected leaves the savings, the missing part is paid from card/cash, any surplus stays «Без цели».
 * spendOwn=false (family): my part stays in savings.
 */
export function buyGoal(id: string, price: number, method: Method, spendOwn = true, by?: string) {
  const s = getState();
  const g = s.goals?.find((x) => x.id === id);
  if (!g) return () => {};
  const mine = goalSaved(s, id);
  const collected = g.family ? familyCollected(id, mine) : mine;
  const fromSavings = spendOwn ? Math.min(mine, price) : 0;
  const extra = Math.max(0, price - (g.family ? collected : mine));
  const txs: Tx[] = [];
  if (fromSavings > 0) txs.push(addTx({ kind: "savings", amount: -fromSavings, category: "savings", note: `Куплено: ${g.name}`, method: "card", goal: id }));
  // the missing part is a normal purchase: it shows in month spending and analytics (but not in «today», it was planned)
  if (extra > 0) txs.push(addTx({ kind: "expense", amount: extra, category: "shop", note: `${g.name} (доплата)`, method, goal: id }));
  patch(id, { done: { at: dayKey(new Date()), price, ...(by ? { by } : {}) }, ...(g.family ? { settled: spendOwn ? "spent" : "kept" } : {}) });
  return () => { txs.forEach((t) => removeTx(t.id)); setState((x) => ({ ...x, goals: (x.goals ?? []).map((y) => (y.id === id ? g : y)) })); };
}
/** partner bought a family goal: I decide what happens to my part */
export function settleGoal(id: string, spend: boolean) {
  const s = getState();
  const g = s.goals?.find((x) => x.id === id);
  if (!g) return () => {};
  const mine = goalSaved(s, id);
  const t = spend && mine > 0 ? addTx({ kind: "savings", amount: -mine, category: "savings", note: `Куплено: ${g.name}`, method: "card", goal: id }) : null;
  setState((x) => ({ ...x, goals: (x.goals ?? []).map((y) => (y.id === id ? { ...y, settled: spend ? "spent" : "kept" } : y)) }));
  return () => { if (t) removeTx(t.id); setState((x) => ({ ...x, goals: (x.goals ?? []).map((y) => (y.id === id ? g : y)) })); };
}

/** savings were set lower than the goals hold: take the difference out of the chosen goals */
export function cutGoals(cuts: Record<string, number>): Tx[] {
  const s = getState();
  return Object.entries(cuts).filter(([, a]) => a > 0).map(([id, a]) =>
    addTx({ kind: "goal", amount: -Math.min(a, goalSaved(s, id)), category: "savings", note: `Убрано с цели «${s.goals?.find((g) => g.id === id)?.name ?? ""}»`, goal: id }));
}
/** how much the goals hold above a new savings total */
export const overGoals = (s: State, total: number) => Math.max(0, s.cushion - unassigned(s) - total);

// ---------- family goals ----------
/** what leaves the phone about family goals: the goal itself and only my own contribution */
export interface SharedGoal { id: string; name: string; target: number; color?: string | undefined; date?: string | undefined; updatedAt: string; deleted?: boolean; done?: Goal["done"]; saved: number }
export function sharedGoals(s: State): SharedGoal[] {
  return (s.goals ?? []).filter((g) => g.family).map((g) => ({
    id: g.id, name: g.name, target: g.target, color: g.color, date: g.date, updatedAt: g.updatedAt ?? s.createdAt,
    ...(g.deleted ? { deleted: true } : {}), ...(g.done ? { done: g.done } : {}), saved: g.deleted ? 0 : goalSaved(s, g.id),
  }));
}
let remote: { name: string; me: boolean; goals: SharedGoal[] }[] = [];
export function setRemoteGoals(list: typeof remote) { remote = list; }
export const remoteGoals = () => remote;
export function familyCollected(id: string, mine: number) {
  return mine + remote.filter((m) => !m.me).reduce((a, m) => a + (m.goals.find((g) => g.id === id)?.saved ?? 0), 0);
}
export function contributions(id: string, mine: number, myName: string) {
  return [{ name: myName || "Я", saved: mine, me: true }, ...remote.filter((m) => !m.me).map((m) => ({ name: m.name || "Партнёр", saved: m.goals.find((g) => g.id === id)?.saved ?? 0, me: false }))];
}
/** take newer goal settings from other members; never touches money */
export function mergeGoals(s: State, others: SharedGoal[][]): Goal[] | null {
  const list = [...(s.goals ?? [])];
  let changed = false;
  for (const gs of others) for (const r of gs) {
    const i = list.findIndex((g) => g.id === r.id);
    const mine = list[i];
    if (!mine) {
      if (r.deleted) continue;
      list.push({ id: r.id, name: r.name, target: r.target, color: r.color, date: r.date, done: r.done, family: true, updatedAt: r.updatedAt });
      changed = true;
    } else if (mine.family && (mine.updatedAt ?? "") < r.updatedAt) {
      list[i] = { ...mine, name: r.name, target: r.target, color: r.color, date: r.date, done: r.done, deleted: r.deleted, updatedAt: r.updatedAt };
      changed = true;
    }
  }
  return changed ? list : null;
}
/** leaving the family: family goals disappear, my parts go back to «Без цели» */
export function dropFamilyGoals() {
  setState((s) => ({ ...s, goals: (s.goals ?? []).filter((g) => !g.family) }));
}
