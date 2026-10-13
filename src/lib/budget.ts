import { useSyncExternalStore } from "react";

export type Group = "must" | "safe" | "life";
export type TxKind = "expense" | "income" | "adjust" | "cushion";

export interface Tx {
  id: string;
  kind: TxKind;
  amount: number; // always positive; sign derived from kind (adjust may be +/-)
  category: string;
  note?: string;
  date: string; // ISO
  obligationId?: string;
  period?: string; // "YYYY-MM" for obligation payments
}
export interface Obligation { id: string; name: string; amount: number; day: number; category: string }
export interface Income { id: string; name: string; amount: number; day: number; period: "monthly" | "biweekly" }
export interface AiSettings { provider: "none" | "openai" | "openrouter" | "anthropic"; apiKey: string; model: string }

export interface State {
  version: 1;
  balance: number;
  cushion: number;
  txs: Tx[];
  obligations: Obligation[];
  incomes: Income[];
  incomeAck: Record<string, string>; // incomeId -> last handled occurrence (YYYY-MM-DD)
  nextIncomeOverride?: string | undefined; // YYYY-MM-DD
  overspendHandled?: string; // date key
  ai: AiSettings;
  createdAt: string;
}

export const CATEGORIES: { id: string; name: string; group: Group; icon: string; keys: string[] }[] = [
  { id: "food", name: "Еда", group: "life", icon: "ShoppingBasket", keys: ["продукт", "магазин", "еда", "пятёроч", "пятероч", "перекрест", "лента", "вкусвилл", "хлеб", "молоко"] },
  { id: "cafe", name: "Кафе и кофе", group: "life", icon: "Coffee", keys: ["кофе", "кафе", "круассан", "обед", "ресторан", "бар", "пицц", "шаурм", "доставк"] },
  { id: "taxi", name: "Транспорт", group: "life", icon: "Car", keys: ["такси", "метро", "автобус", "бензин", "проезд", "каршер"] },
  { id: "shop", name: "Покупки", group: "life", icon: "ShoppingBag", keys: ["одежд", "озон", "ozon", "wb", "вайлдб", "покуп", "обув"] },
  { id: "fun", name: "Хобби и радости", group: "life", icon: "Sparkles", keys: ["кино", "книг", "игр", "хобби", "подарок", "цвет", "концерт"] },
  { id: "health", name: "Лекарства", group: "must", icon: "Pill", keys: ["аптек", "лекарств", "врач", "анализ"] },
  { id: "home", name: "ЖКУ и аренда", group: "must", icon: "House", keys: ["жку", "аренд", "квартплат", "свет", "газ"] },
  { id: "phone", name: "Связь и подписки", group: "must", icon: "Smartphone", keys: ["связь", "телефон", "интернет", "подписк"] },
  { id: "loan", name: "Кредиты и рассрочки", group: "must", icon: "Landmark", keys: ["кредит", "рассроч", "долг"] },
  { id: "kids", name: "Сад и школа", group: "must", icon: "School", keys: ["сад", "школ", "кружок"] },
  { id: "savings", name: "Накопления", group: "safe", icon: "PiggyBank", keys: ["накоп", "копилк", "вклад"] },
  { id: "unexpected", name: "Непредвиденное", group: "safe", icon: "Umbrella", keys: ["ремонт", "штраф", "сломал"] },
];
export const GROUPS: Record<Group, string> = { must: "Обязательное", safe: "Безопасность", life: "Жизнь и радости" };
export const cat = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]!;

const KEY = "berezhny-budget-v1";
const initial = (): State => ({
  version: 1, balance: 0, cushion: 0, txs: [], obligations: [], incomes: [], incomeAck: {},
  ai: { provider: "none", apiKey: "", model: "" }, createdAt: new Date().toISOString(),
});

let state: State | null = null;
const listeners = new Set<() => void>();
function load(): State {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? { ...initial(), ...JSON.parse(raw) } : initial();
  } catch { state = initial(); }
  return state!;
}
export function getState() { return load(); }
export function setState(fn: (s: State) => State) {
  state = fn(load());
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}
export function replaceState(s: State) { setState(() => ({ ...initial(), ...s })); }
export function useBudget(): State | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => load(),
    () => null,
  );
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;

// ---------- dates ----------
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parseKey = (k: string) => { const [y = 2000, m = 1, d = 1] = k.split("-").map(Number); return new Date(y, m - 1, d); };
function onDay(y: number, m: number, day: number) {
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, last));
}
/** occurrences of an income around today */
function incomeDates(inc: Income, from: Date, count = 4): Date[] {
  const out: Date[] = [];
  for (let i = -2; i < count; i++) {
    const base = onDay(from.getFullYear(), from.getMonth() + i, inc.day);
    out.push(base);
    if (inc.period === "biweekly") out.push(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 14));
  }
  return out.sort((a, b) => +a - +b);
}
export function nextIncome(s: State, now = new Date()): { date: Date; income?: Income } {
  const today = startOfDay(now);
  if (s.nextIncomeOverride && parseKey(s.nextIncomeOverride) > today) return { date: parseKey(s.nextIncomeOverride) };
  let best: { date: Date; income?: Income } | null = null;
  for (const inc of s.incomes) {
    const d = incomeDates(inc, today).find((x) => x > today);
    if (d && (!best || d < best.date)) best = { date: d, income: inc };
  }
  return best ?? { date: onDay(today.getFullYear(), today.getMonth() + 1, today.getDate()) };
}
/** regular income whose date arrived (today or earlier) but not confirmed */
export function pendingIncome(s: State, now = new Date()): { income: Income; date: string } | null {
  const today = startOfDay(now);
  const created = startOfDay(new Date(s.createdAt));
  for (const inc of s.incomes) {
    const past = incomeDates(inc, today).filter((d) => d <= today && d >= created);
    const last = past[past.length - 1];
    if (!last) continue;
    const k = dayKey(last);
    const ackd = s.incomeAck[inc.id];
    if (!ackd || ackd < k) return { income: inc, date: k };
  }
  return null;
}
export function obligationDue(o: Obligation, now = new Date()) {
  const today = startOfDay(now);
  const d = onDay(today.getFullYear(), today.getMonth(), o.day);
  return d >= today ? d : onDay(today.getFullYear(), today.getMonth() + 1, o.day);
}
const periodOf = (d: Date) => dayKey(d).slice(0, 7);
export function isPaid(s: State, o: Obligation, due: Date) {
  return s.txs.some((t) => t.obligationId === o.id && t.period === periodOf(due));
}

// ---------- core calc ----------
export function calc(s: State, now = new Date()) {
  const today = startOfDay(now);
  const next = nextIncome(s, now);
  const days = Math.max(1, Math.round((+next.date - +today) / 86400000));
  const reserved = s.obligations
    .map((o) => ({ o, due: obligationDue(o, now) }))
    .filter(({ o, due }) => due < next.date && !isPaid(s, o, due));
  const reserve = reserved.reduce((a, x) => a + x.o.amount, 0);
  const tk = dayKey(today);
  const todayLife = s.txs.filter((t) => t.kind === "expense" && cat(t.category).group === "life" && dayKey(new Date(t.date)) === tk);
  const spentToday = todayLife.reduce((a, t) => a + t.amount, 0);
  const dailyNorm = Math.max(0, (s.balance + spentToday - reserve) / days);
  const freeToday = dailyNorm - spentToday;
  const overspend = freeToday < 0 ? -freeToday : 0;
  const afterSpread = days > 1 ? Math.max(0, (s.balance - reserve) / (days - 1)) : 0;
  return { next, days, reserve, reserved, spentToday, dailyNorm, freeToday, overspend, afterSpread, todayKey: tk };
}

// ---------- actions ----------
export function addTx(t: Omit<Tx, "id" | "date"> & { date?: string }) {
  const tx: Tx = { id: uid(), date: new Date().toISOString(), ...t };
  setState((s) => ({
    ...s,
    txs: [tx, ...s.txs],
    balance: s.balance + delta(tx),
    cushion: s.cushion + (tx.category === "savings" && tx.kind === "expense" ? tx.amount : 0),
  }));
  return tx;
}
function delta(t: Tx) {
  if (t.kind === "income") return t.amount;
  if (t.kind === "expense") return -t.amount;
  return t.amount; // adjust / cushion carry sign
}
export function removeTx(id: string) {
  const t = getState().txs.find((x) => x.id === id);
  if (!t) return;
  setState((s) => ({
    ...s,
    txs: s.txs.filter((x) => x.id !== id),
    balance: s.balance - delta(t),
    cushion: s.cushion - (t.category === "savings" && t.kind === "expense" ? t.amount : 0) - (t.kind === "cushion" ? t.amount : 0),
  }));
  return t;
}
export function restoreTx(t: Tx) {
  setState((s) => ({
    ...s,
    txs: [t, ...s.txs].sort((a, b) => b.date.localeCompare(a.date)),
    balance: s.balance + delta(t),
    cushion: s.cushion + (t.category === "savings" && t.kind === "expense" ? t.amount : 0) + (t.kind === "cushion" ? t.amount : 0),
  }));
}
export function reconcile(actual: number) {
  const diff = actual - getState().balance;
  if (diff === 0) return null;
  return addTx({ kind: "adjust", amount: diff, category: "adjust", note: "Сверка баланса" });
}
export function coverFromCushion(amount: number) {
  const a = Math.min(amount, getState().cushion);
  if (a <= 0) return null;
  return addTx({ kind: "cushion", amount: a, category: "cushion", note: "Из подушки" });
}
