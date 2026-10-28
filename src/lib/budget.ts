import { useSyncExternalStore } from "react";

export type Group = "must" | "safe" | "life";
export type TxKind = "expense" | "income" | "adjust" | "cushion" | "savings";

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
  orig?: { amount: number; currency: string; rate: number }; // spent in another currency; amount is in rubles
  family?: boolean; // transfer inside the family: moves money, not counted in family totals
}
export type Method = "card" | "cash";
/** day = regular monthly date; once = one-off date (YYYY-MM-DD); nextOn = moved date of the nearest occurrence */
export interface Obligation { id: string; name: string; amount: number; day: number; category: string; once?: string; nextOn?: string | undefined; method?: Method; from?: string }
export interface Income { id: string; name: string; amount: number; day: number; method?: Method; nextOn?: string | undefined; period?: "monthly" | "biweekly"; skip?: string | undefined /* "YYYY-MM": not counted this month */ }
export interface AiSettings { provider: "none" | "openai" | "openrouter" | "anthropic"; apiKey: string; model: string; mode?: "auto" | "always" }

export interface State {
  version: 1;
  balance: number; // card
  cash?: number;
  cushion: number; // savings total
  cushionCash?: number; // part of savings kept in cash
  txs: Tx[];
  obligations: Obligation[];
  incomes: Income[];
  incomeAck: Record<string, string>; // incomeId -> last handled occurrence (YYYY-MM-DD)
  nextIncomeOverride?: string | undefined; // YYYY-MM-DD
  overspendHandled?: string; // date key
  minDaily?: number | undefined; // protected minimum for life per day
  ai: AiSettings;
  categories?: Category[];
  advisorAbout?: string;
  advisorLoans?: string;
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
  must: ["#f2b544", "#e89a3c", "#f6cc7a", "#dd8a33", "#f9dca0", "#d07a2c"],
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
export function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
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
export const periodOf = (d: Date) => dayKey(d).slice(0, 7);
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
  return incomeDates(inc, today).find((x) => x > today && (!ack || dayKey(x) > ack) && periodOf(x) !== inc.skip) ?? null;
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
    const past = incomeDates(inc, today).filter((d) => d <= today && d >= created && periodOf(d) !== inc.skip);
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
export function paidAmount(s: State, o: Obligation, due: Date) {
  return s.txs.filter((t) => t.obligationId === o.id && (o.once ? true : t.period === periodOf(due))).reduce((a, t) => a + t.amount, 0);
}
export function isPaid(s: State, o: Obligation, due: Date) {
  return paidAmount(s, o, due) >= o.amount;
}
/** part of a payment or debt paid now; the rest stays reserved */
export function payPart(o: Obligation, amount: number, method: Method = o.method ?? "card") {
  const due = obligationDue(o);
  return addTx({ kind: "expense", amount, category: o.category, note: `${o.name} (часть)`, obligationId: o.id, period: periodOf(due), method });
}
/** planned income came early / was entered by hand: mark this month's occurrence handled */
export function markIncomeArrived(s: State, inc: Income) {
  const p = pendingIncome(s);
  const key = inc.nextOn ?? (p?.income.id === inc.id ? p.date : dayKey(incomeUpcoming(s, inc) ?? new Date()));
  setState((x) => ({ ...x, incomeAck: { ...x.incomeAck, [inc.id]: key }, incomes: x.incomes.map((y) => (y.id === inc.id ? { ...y, nextOn: undefined } : y)) }));
}
export function toggleIncomeSkip(id: string, period: string) {
  setState((s) => ({ ...s, incomes: s.incomes.map((y) => (y.id === id ? { ...y, skip: y.skip === period ? undefined : period } : y)) }));
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
export const MIN_DAILY = 500;
export function calc(s: State, now = new Date()) {
  const today = startOfDay(now);
  const next = nextIncome(s, now);
  const days = Math.max(1, Math.round((+next.date - +today) / 86400000));
  const reserved = s.obligations
    .map((o) => ({ o, due: obligationDue(o, now) }))
    .filter(({ o, due }) => due < next.date && !isPaid(s, o, due));
  // only payments due before the next income are set aside from today's money;
  // later ones are covered by the incomes that come before them (see forecast smoothing below)
  const saving: { o: Obligation; due: Date; part: number }[] = [];
  const reserve = reserved.reduce((a, x) => a + x.o.amount - paidAmount(s, x.o, x.due), 0);
  const tk = dayKey(today);
  const todayLife = s.txs.filter((t) => t.kind === "expense" && cat(t.category).group === "life" && dayKey(new Date(t.date)) === tk);
  const spentToday = todayLife.reduce((a, t) => a + t.amount, 0);
  const total = s.balance + (s.cash ?? 0);
  // life minimum comes first; "set aside" never exceeds real money
  const minDaily = s.minDaily ?? MIN_DAILY;
  const pool = Math.max(0, total + spentToday);
  const floor = Math.min(pool, minDaily * days);
  const held = Math.min(reserve, Math.max(0, pool - floor));
  const shortfall = Math.max(0, reserve - held); // payments before the next income not covered by money now
  let dailyNorm = Math.max(0, (pool - held) / days);
  // if later payments need part of today's money (incomes ahead are too small), spend a bit less now
  if (!s.nextIncomeOverride) {
    const first = forecast(s, 60, now, pool)[0];
    if (first && first.perDay < dailyNorm) dailyNorm = Math.max(first.perDay, Math.min(minDaily, pool / days));
  }
  const freeToday = dailyNorm - spentToday;
  const overspend = freeToday < 0 ? -freeToday : 0;
  const rest = Math.max(0, total);
  const afterSpread = days > 1 ? Math.max(0, Math.min(dailyNorm * days - spentToday, rest - held) / (days - 1)) : 0;
  return { next, days, reserve, held, reserved, saving, spentToday, dailyNorm, freeToday, overspend, afterSpread, total, shortfall, minDaily, todayKey: tk };
}

// ---------- actions ----------
export function addTx(t: Omit<Tx, "id" | "date"> & { date?: string }) {
  const tx: Tx = { id: uid(), date: new Date().toISOString(), ...t };
  setState((s) => ({
    ...s,
    txs: [tx, ...s.txs],
    ...move(s, tx, 1),
    ...cushionMove(s, tx, 1),
  }));
  return tx;
}
function move(s: State, t: Tx, sign: 1 | -1): Partial<State> {
  if (t.kind === "savings") return {};
  const d = delta(t) * sign;
  return t.method === "cash" ? { cash: (s.cash ?? 0) + d } : { balance: s.balance + d };
}
/** cushion grows with «Накопления» expenses and shrinks when money is taken back from it */
function cushionMove(s: State, t: Tx, sign: 1 | -1): Partial<State> {
  const d = cushionDelta(t) * sign;
  if (!d) return {};
  const where = t.method;
  return { cushion: s.cushion + d, ...(where === "cash" ? { cushionCash: (s.cushionCash ?? 0) + d } : {}) };
}
function cushionDelta(t: Tx) {
  if (t.kind === "expense" && t.category === "savings") return t.amount;
  if (t.kind === "cushion") return -t.amount;
  if (t.kind === "savings") return t.amount; // signed correction, card untouched
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
    ...cushionMove(s, t, -1),
  }));
  return t;
}
export function restoreTx(t: Tx) {
  setState((s) => ({
    ...s,
    txs: [t, ...s.txs].sort((a, b) => b.date.localeCompare(a.date)),
    ...move(s, t, 1),
    ...cushionMove(s, t, 1),
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
export function borrow(amount: number, from: string, returnOn: string, method: Method = "card", monthly?: number) {
  const ob: Obligation = monthly
    ? { id: uid(), name: `Вернуть: ${from}`, amount: monthly, day: parseKey(returnOn).getDate(), category: "loan", method, from: dayKey(new Date()) }
    : { id: uid(), name: `Вернуть: ${from}`, amount, day: parseKey(returnOn).getDate(), category: "loan", once: returnOn, method, from: dayKey(new Date()) };
  const t = addTx({ kind: "adjust", amount, category: "adjust", note: `Взяла: ${from}`, method });
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
/** «сейчас накоплено N»: corrects the savings total without touching card or cash */
export function setCushion(card: number, cash?: number) {
  const st = getState();
  const curCash = st.cushionCash ?? 0, curCard = st.cushion - curCash;
  const out: Tx[] = [];
  if (card !== curCard) out.push(addTx({ kind: "savings", amount: card - curCard, category: "savings", note: "Накопления: пересчёт", method: "card" }));
  if (cash !== undefined && cash !== curCash) out.push(addTx({ kind: "savings", amount: cash - curCash, category: "savings", note: "Накопления: пересчёт наличных", method: "cash" }));
  return out;
}
/** take money out of savings at any time; optionally plan to put it back */
export function takeFromCushion(amount: number, to: Method = "card", returnOn?: string) {
  const t = addTx({ kind: "cushion", amount, category: "cushion", note: "Из накоплений", method: to });
  let ob: Obligation | undefined;
  if (returnOn) {
    ob = { id: uid(), name: "Вернуть в накопления", amount, day: parseKey(returnOn).getDate(), category: "savings", once: returnOn, method: to, from: dayKey(new Date()) };
    setState((s) => ({ ...s, obligations: [...s.obligations, ob!] }));
  }
  return { t, ob };
}
/** a paid payment becomes active again */
export function unpay(o: Obligation) {
  const due = obligationDue(o);
  const list = getState().txs.filter((t) => t.obligationId === o.id && (o.once ? true : t.period === periodOf(due)));
  list.forEach((t) => removeTx(t.id));
  return list;
}
export function coverFromCushion(amount: number) {
  const a = Math.min(amount, getState().cushion);
  if (a <= 0) return null;
  return addTx({ kind: "cushion", amount: a, category: "cushion", note: "Из подушки" });
}

// ---------- calendar forecast ----------
export interface CalEvent { date: Date; kind: "income" | "payment"; name: string; amount: number; paid?: boolean; method?: Method | undefined; refId: string }
export interface CalSegment { start: Date; end: Date; days: number; money: number; payments: number; perDay: number; gap: number; events: CalEvent[]; incomes: CalEvent[]; open: boolean }
/** chain «доход → платежи → доход» for the coming days with how much is free per day on each stretch */
export function forecast(s: State, horizon = 45, now = new Date(), startMoney?: number): CalSegment[] {
  const today = startOfDay(now);
  const limit = new Date(+today + horizon * 86400000);
  const ev: CalEvent[] = [];
  for (const inc of s.incomes) {
    const ack = s.incomeAck[inc.id];
    const dates: Date[] = [];
    for (let i = 0; i < 3; i++) {
      const d = onDay(today.getFullYear(), today.getMonth() + i, inc.day);
      if (d > today && d <= limit && (!ack || dayKey(d) > ack) && periodOf(d) !== inc.skip) dates.push(d);
    }
    if (inc.nextOn) { const m = parseKey(inc.nextOn); if (dates.length) dates[0] = m; else if (m > today) dates.push(m); }
    for (const d of dates) if (d > today && d <= limit) ev.push({ date: d, kind: "income", name: inc.name, amount: inc.amount, method: inc.method, refId: inc.id });
  }
  for (const o of s.obligations) {
    const first = obligationDue(o, now);
    const dates = o.once ? [first] : [first, onDay(first.getFullYear(), first.getMonth() + 1, o.day), onDay(first.getFullYear(), first.getMonth() + 2, o.day)];
    dates.forEach((d, i) => {
      if (d > limit) return;
      const left = o.amount - (i === 0 ? paidAmount(s, o, d) : 0);
      ev.push({ date: d, kind: "payment", name: o.name, amount: Math.max(0, left), paid: left <= 0, method: o.method, refId: o.id });
    });
  }
  ev.sort((a, b) => +a.date - +b.date || (a.kind === "income" ? -1 : 1));
  const incs = ev.filter((e) => e.kind === "income");
  const ends = [...incs.map((e) => e.date), limit];
  // raw stretches between incomes
  const raw: { start: Date; end: Date; days: number; payments: number; events: CalEvent[]; incomes: CalEvent[]; inAtEnd: number; open: boolean }[] = [];
  let start = today;
  for (const end of ends) {
    if (+end <= +start && raw.length) continue;
    const inSeg = ev.filter((e) => e.kind === "payment" && +e.date >= +start && +e.date < +end);
    raw.push({
      start, end, days: Math.max(1, Math.round((+end - +start) / 86400000)),
      payments: inSeg.filter((e) => !e.paid).reduce((a, e) => a + e.amount, 0),
      events: inSeg, incomes: incs.filter((e) => +e.date === +start),
      inAtEnd: incs.filter((e) => +e.date === +end).reduce((a, e) => a + e.amount, 0), open: end === limit,
    });
    if (end === limit) break;
    start = end;
  }
  // smooth: money from a big income is not "eaten" in a 3-day stretch — the daily amount is the
  // lowest steady rate that keeps every following payment covered
  const segs: CalSegment[] = [];
  let money = (startMoney ?? s.balance + (s.cash ?? 0));
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]!;
    let cum = money, days = 0, rate = Infinity;
    for (let k = i; k < raw.length; k++) {
      // the open tail is cut by the horizon, not by an income — it doesn't limit earlier stretches
      if (raw[k]!.open && k > i) break;
      cum -= raw[k]!.payments; days += raw[k]!.days;
      rate = Math.min(rate, cum / days);
      cum += raw[k]!.inAtEnd;
    }
    const left = money - r.payments;
    const perDay = Math.max(0, Math.min(rate, left / r.days));
    segs.push({ start: r.start, end: r.end, days: r.days, money, payments: r.payments, perDay, gap: Math.max(0, -left), events: r.events, incomes: r.incomes, open: r.open });
    money = left - perDay * r.days + r.inAtEnd;
  }
  return segs;
}
