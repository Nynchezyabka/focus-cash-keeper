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
  method?: Method; // where the money moved; default card
}
export type Method = "card" | "cash";
/** day = regular monthly date; once = one-off date (YYYY-MM-DD); nextOn = moved date of the nearest occurrence */
export interface Obligation { id: string; name: string; amount: number; day: number; category: string; once?: string; nextOn?: string | undefined; method?: Method; from?: string }
export interface Income { id: string; name: string; amount: number; day: number; method?: Method; nextOn?: string | undefined; period?: "monthly" | "biweekly" }
export interface AiSettings { provider: "none" | "openai" | "openrouter" | "anthropic"; apiKey: string; model: string; mode?: "auto" | "always" }

export interface State {
  version: 1;
  balance: number; // card
  cash?: number;
  cushion: number;
  txs: Tx[];
  obligations: Obligation[];
  incomes: Income[];
  incomeAck: Record<string, string>; // incomeId -> last handled occurrence (YYYY-MM-DD)
  nextIncomeOverride?: string | undefined; // YYYY-MM-DD
  overspendHandled?: string; // date key
  ai: AiSettings;
  categories?: Category[];
  advisorAbout?: string;
  createdAt: string;
}

export interface Category { id: string; name: string; group: Group; icon: string; keys: string[]; color?: string | undefined }
export const COLORS = ["#7fb89a", "#e0a96d", "#6fa8dc", "#b49ad9", "#e48aa6", "#e07a5f", "#d4c46a", "#5fb7c4", "#8d8fd9", "#9cc56f", "#c79a7a", "#9aa5b1"];
export const DEFAULT_CATEGORIES: Category[] = [
  { id: "food", name: "Еда", group: "life", icon: "ShoppingBasket", keys: ["продукт", "магазин", "еда", "пятёроч", "пятероч", "перекрест", "лента", "вкусвилл", "хлеб", "молоко"] },
  { id: "cafe", name: "Кафе и кофе", group: "life", icon: "Coffee", keys: ["кофе", "кафе", "круассан", "обед", "ресторан", "бар", "пицц", "шаурм", "доставк", "бистро", "bistro", "фастфуд"] },
  { id: "taxi", name: "Транспорт", group: "life", icon: "Car", keys: ["такси", "taxi", "метро", "автобус", "бензин", "проезд", "каршер"] },
  { id: "shop", name: "Покупки", group: "life", icon: "ShoppingBag", keys: ["одежд", "озон", "ozon", "wb", "вайлдб", "покуп", "обув"] },
  { id: "fun", name: "Хобби и радости", group: "life", icon: "Sparkles", keys: ["кино", "книг", "игр", "хобби", "подарок", "цвет", "концерт", "ферм", "зоопарк", "парк", "музей", "выставк"] },
  { id: "health", name: "Лекарства", group: "must", icon: "Pill", keys: ["аптек", "лекарств", "врач", "анализ"] },
  { id: "home", name: "ЖКУ и аренда", group: "must", icon: "House", keys: ["жку", "аренд", "квартплат", "свет", "газ"] },
  { id: "phone", name: "Связь и подписки", group: "must", icon: "Smartphone", keys: ["связь", "телефон", "интернет", "подписк"] },
  { id: "loan", name: "Кредиты и рассрочки", group: "must", icon: "Landmark", keys: ["кредит", "рассроч", "долг", "долями", "сплит"] },
  { id: "kids", name: "Сад и школа", group: "must", icon: "School", keys: ["сад", "школ", "кружок", "госуслуг", "gosuslugi"] },
  { id: "savings", name: "Накопления", group: "safe", icon: "PiggyBank", keys: ["накоп", "копилк", "вклад"] },
  { id: "unexpected", name: "Непредвиденное", group: "safe", icon: "Umbrella", keys: ["ремонт", "штраф", "сломал"] },
];
export const GROUPS: Record<Group, string> = { must: "Обязательное", safe: "Безопасность", life: "Жизнь и радости" };
export const cats = (s: State = getState()): Category[] => s.categories ?? DEFAULT_CATEGORIES;
const FALLBACK: Category = { id: "other", name: "Другое", group: "life", icon: "Circle", keys: [] };
export const cat = (id: string) => cats().find((c) => c.id === id) ?? FALLBACK;
/** Each group has its own family of shades; categories get a shade by their position inside the group. */
export const GROUP_SHADES: Record<Group, string[]> = {
  must: ["#d9825f", "#c8664a", "#e8a283", "#b5523a", "#f0bea5", "#a8472f"],
  safe: ["#6fa0cc", "#4f86b8", "#93bde0", "#3d6f9c", "#b3d1ea"],
  life: ["#7fb89a", "#5e9e78", "#a2cfb5", "#4a8562", "#c1e2cf", "#3d7254"],
};
export const groupColor = (g: Group) => GROUP_SHADES[g][0]!;
export const catColor = (c: Category) => {
  const shades = GROUP_SHADES[c.group];
  const i = Math.max(0, cats().filter((x) => x.group === c.group).findIndex((x) => x.id === c.id));
  return shades[i % shades.length]!;
};
export function saveCategories(list: Category[]) { setState((s) => ({ ...s, categories: list })); }

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
  }
  return out.sort((a, b) => +a - +b);
}
/** nearest future date of one income, respecting a moved date and early confirmation */
export function incomeUpcoming(s: State, inc: Income, now = new Date()): Date | null {
  const today = startOfDay(now);
  if (inc.nextOn) { const d = parseKey(inc.nextOn); return d > today ? d : null; }
  const ack = s.incomeAck[inc.id];
  return incomeDates(inc, today).find((x) => x > today && (!ack || dayKey(x) > ack)) ?? null;
}
export function nextIncome(s: State, now = new Date()): { date: Date; income?: Income } {
  const today = startOfDay(now);
  if (s.nextIncomeOverride && parseKey(s.nextIncomeOverride) > today) return { date: parseKey(s.nextIncomeOverride) };
  let best: { date: Date; income?: Income } | null = null;
  for (const inc of s.incomes) {
    const d = incomeUpcoming(s, inc, now);
    if (d && (!best || d < best.date)) best = { date: d, income: inc };
  }
  return best ?? { date: onDay(today.getFullYear(), today.getMonth() + 1, today.getDate()) };
}
/** regular income whose date arrived (today or earlier) but not confirmed */
export function pendingIncome(s: State, now = new Date()): { income: Income; date: string } | null {
  const today = startOfDay(now);
  const created = startOfDay(new Date(s.createdAt));
  for (const inc of s.incomes) {
    if (inc.nextOn) {
      if (parseKey(inc.nextOn) <= today) return { income: inc, date: inc.nextOn };
      continue;
    }
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
  if (o.once) return parseKey(o.once);
  if (o.nextOn) return parseKey(o.nextOn);
  const d = onDay(today.getFullYear(), today.getMonth(), o.day);
  return d >= today ? d : onDay(today.getFullYear(), today.getMonth() + 1, o.day);
}
const periodOf = (d: Date) => dayKey(d).slice(0, 7);
export function isPaid(s: State, o: Obligation, due: Date) {
  return s.txs.some((t) => t.obligationId === o.id && (o.once ? true : t.period === periodOf(due)));
}
export function payObligation(o: Obligation, method: Method = o.method ?? "card") {
  const due = obligationDue(o);
  const t = addTx({ kind: "expense", amount: o.amount, category: o.category, note: o.name, obligationId: o.id, period: periodOf(due), method });
  if (o.nextOn) setState((s) => ({ ...s, obligations: s.obligations.map((x) => (x.id === o.id ? { ...x, nextOn: undefined } : x)) }));
  return t;
}
/** income really arrived: record money, mark this occurrence handled, drop any moved date */
export function confirmIncome(s: State, inc: Income, amount = inc.amount) {
  const p = pendingIncome(s);
  const key = inc.nextOn ?? (p?.income.id === inc.id ? p.date : dayKey(incomeUpcoming(s, inc) ?? new Date()));
  const t = addTx({ kind: "income", amount, category: "income", note: inc.name, method: inc.method ?? "card" });
  setState((x) => ({
    ...x, nextIncomeOverride: undefined,
    incomeAck: { ...x.incomeAck, [inc.id]: key },
    incomes: x.incomes.map((y) => (y.id === inc.id ? { ...y, nextOn: undefined } : y)),
  }));
  return t;
}
export function moveIncome(id: string, date: string) {
  setState((s) => ({ ...s, incomes: s.incomes.map((y) => (y.id === id ? { ...y, nextOn: date } : y)) }));
}
export function moveObligation(id: string, date: string) {
  setState((s) => ({ ...s, obligations: s.obligations.map((y) => (y.id === id ? (y.once ? { ...y, once: date } : { ...y, nextOn: date }) : y)) }));
}

// ---------- core calc ----------
export function calc(s: State, now = new Date()) {
  const today = startOfDay(now);
  const next = nextIncome(s, now);
  const days = Math.max(1, Math.round((+next.date - +today) / 86400000));
  const reserved = s.obligations
    .map((o) => ({ o, due: obligationDue(o, now) }))
    .filter(({ o, due }) => due < next.date && !isPaid(s, o, due));
  // far one-off payments (e.g. taxes in December) are set aside little by little: by the next income
  // the reserve holds the share proportional to the time passed since the payment was planned
  const saving = s.obligations
    .filter((o) => o.once && !isPaid(s, o, obligationDue(o, now)) && obligationDue(o, now) >= next.date)
    .map((o) => {
      const due = obligationDue(o, now);
      const start = parseKey(o.from ?? s.createdAt.slice(0, 10));
      const share = Math.min(1, Math.max(0, (+next.date - +start) / Math.max(1, +due - +start)));
      return { o, due, part: Math.round(o.amount * share) };
    });
  const reserve = reserved.reduce((a, x) => a + x.o.amount, 0) + saving.reduce((a, x) => a + x.part, 0);
  const tk = dayKey(today);
  const todayLife = s.txs.filter((t) => t.kind === "expense" && cat(t.category).group === "life" && dayKey(new Date(t.date)) === tk);
  const spentToday = todayLife.reduce((a, t) => a + t.amount, 0);
  const total = s.balance + (s.cash ?? 0);
  const dailyNorm = Math.max(0, (total + spentToday - reserve) / days);
  const freeToday = dailyNorm - spentToday;
  const overspend = freeToday < 0 ? -freeToday : 0;
  const afterSpread = days > 1 ? Math.max(0, (total - reserve) / (days - 1)) : 0;
  const shortfall = Math.max(0, reserve - total); // not enough even for planned payments
  return { next, days, reserve, reserved, saving, spentToday, dailyNorm, freeToday, overspend, afterSpread, total, shortfall, todayKey: tk };
}

// ---------- actions ----------
export function addTx(t: Omit<Tx, "id" | "date"> & { date?: string }) {
  const tx: Tx = { id: uid(), date: new Date().toISOString(), ...t };
  setState((s) => ({
    ...s,
    txs: [tx, ...s.txs],
    ...move(s, tx, 1),
    cushion: s.cushion + cushionDelta(tx),
  }));
  return tx;
}
function move(s: State, t: Tx, sign: 1 | -1): Partial<State> {
  const d = delta(t) * sign;
  return t.method === "cash" ? { cash: (s.cash ?? 0) + d } : { balance: s.balance + d };
}
/** cushion grows with «Накопления» expenses and shrinks when money is taken back from it */
function cushionDelta(t: Tx) {
  if (t.kind === "expense" && t.category === "savings") return t.amount;
  if (t.kind === "cushion") return -t.amount;
  return 0;
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
    ...move(s, t, -1),
    cushion: s.cushion - cushionDelta(t),
  }));
  return t;
}
export function restoreTx(t: Tx) {
  setState((s) => ({
    ...s,
    txs: [t, ...s.txs].sort((a, b) => b.date.localeCompare(a.date)),
    ...move(s, t, 1),
    cushion: s.cushion + cushionDelta(t),
  }));
}
/** Edit a recorded operation: undo its money effect, then apply the new version. */
export function updateTx(id: string, patch: Partial<Omit<Tx, "id">>) {
  const old = getState().txs.find((x) => x.id === id);
  if (!old) return;
  removeTx(id);
  restoreTx({ ...old, ...patch, id });
}
export function reconcile(actual: number, method: Method = "card") {
  const st = getState();
  const diff = actual - (method === "cash" ? st.cash ?? 0 : st.balance);
  if (diff === 0) return null;
  return addTx({ kind: "adjust", amount: diff, category: "adjust", note: method === "cash" ? "Пересчёт наличных" : "Сверка баланса", method });
}
/** money borrowed to cover a gap: adds it to the card and plans the return as a one-off payment */
export function borrow(amount: number, from: string, returnOn: string) {
  const ob: Obligation = { id: uid(), name: `Вернуть: ${from}`, amount, day: parseKey(returnOn).getDate(), category: "loan", once: returnOn };
  const t = addTx({ kind: "adjust", amount, category: "adjust", note: `Взяла: ${from}` });
  setState((s) => ({ ...s, obligations: [...s.obligations, ob] }));
  return { t, ob };
}
/** remember words of saved expenses so the next list is sorted on the device, without AI */
export function learnKeys(items: { note: string; category: string }[]) {
  const list = cats();
  let changed = false;
  const next = list.map((c) => ({ ...c, keys: [...c.keys] }));
  for (const it of items) {
    const words = it.note.toLowerCase().replace(/[^a-zа-яё\s-]/gi, " ").split(/\s+/).filter((w) => w.length >= 3);
    // short names like «Городская ферма» are learned whole, so a generic first word doesn't steal other places
    const word = words.length >= 2 && words.length <= 3 ? words.join(" ") : words[0];
    if (!word) continue;
    const stem = word.includes(" ") ? word : word.length > 6 ? word.slice(0, word.length - 2) : word;
    const owner = next.find((c) => c.keys.some((k) => word.includes(k)));
    if (owner?.id === it.category) continue;
    const target = next.find((c) => c.id === it.category);
    if (!target) continue;
    target.keys.push(stem); changed = true;
  }
  if (changed) saveCategories(next);
  return changed;
}
export function coverFromCushion(amount: number) {
  const a = Math.min(amount, getState().cushion);
  if (a <= 0) return null;
  return addTx({ kind: "cushion", amount: a, category: "cushion", note: "Из подушки" });
}
