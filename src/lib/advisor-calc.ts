// Deterministic math for the Помощник: the app calculates, the model only explains.
import { calc, cat, dayKey, forecast, getState, moveIncome, moveObligation, nextIncome, rub, setState, transfer, uid, type Method, type State } from "@/lib/budget";
import { saveGoal } from "@/lib/goals";
import { validDate } from "@/lib/loan-schedule";
import { debtFeeAt } from "@/lib/debt-fee";

const d = (x: Date) => x.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

export interface PurchaseEval { price: number; untilIncome: number; after: number; perDayAfter: number; days: number; nextDate: Date; verdict: "calm" | "tight" | "wait" }
/** Can I buy X now? Compares the price with what is free until the next income. */
export function evaluatePurchase(s: State, price: number, now = new Date()): PurchaseEval {
  const c = calc(s, now);
  const untilIncome = Math.max(0, c.dailyNorm * c.days - c.spentToday);
  const after = untilIncome - price;
  const perDayAfter = after / c.days;
  const verdict = after < 0 ? "wait" : perDayAfter < c.minDaily ? "tight" : "calm";
  return { price, untilIncome, after, perDayAfter, days: c.days, nextDate: c.next.date, verdict };
}
export function purchaseText(e: PurchaseEval) {
  const v = e.verdict === "calm" ? "спокойно можно" : e.verdict === "tight" ? `можно, но до ${d(e.nextDate)} станет тесно` : `лучше подождать до ${d(e.nextDate)}`;
  return `Покупка за ${rub(e.price)}: вердикт приложения — ${v}. Свободно до дохода ${rub(e.untilIncome)}, после покупки останется ${rub(Math.max(0, e.after))}${e.after < 0 ? ` (не хватает ${rub(-e.after)})` : ""}, это ≈ ${rub(Math.max(0, e.perDayAfter))} в день на ${e.days} дн.`;
}

export type Change = { kind: "income"; delta: number } | { kind: "delay"; days: number } | { kind: "payment"; amount: number; date: string };
export interface ScenarioRow { period: string; before: number; after: number; low: boolean; gap: number }
/** «А что если…»: re-run the plan with one change. The real plan is not touched. */
export function whatIf(s: State, ch: Change, now = new Date()): ScenarioRow[] {
  const inc = nextIncome(s, now).income;
  let t: State = s;
  if (ch.kind === "income" && inc) t = { ...s, incomes: s.incomes.map((i) => (i.id === inc.id ? { ...i, amount: Math.max(0, i.amount + ch.delta) } : i)) };
  if (ch.kind === "delay" && inc) t = { ...s, incomes: s.incomes.map((i) => (i.id === inc.id ? { ...i, nextOn: dayKey(new Date(+nextIncome(s, now).date + ch.days * 86400000)) } : i)) };
  if (ch.kind === "payment") t = { ...s, obligations: [...s.obligations, { id: "whatif", name: "Новый платёж", amount: ch.amount, day: Number(ch.date.slice(8)), category: "unexpected", once: ch.date }] };
  const a = forecast(s, 60, now), b = forecast(t, 60, now);
  const min = s.minDaily ?? 500;
  return b.map((g, i) => ({ period: `${d(g.start)} – ${d(g.end)}`, before: a[i]?.perDay ?? 0, after: g.perDay, low: g.perDay < min, gap: g.gap }));
}
export function scenarioText(ch: Change, rows: ScenarioRow[]) {
  const what = ch.kind === "income" ? `ближайший доход ${ch.delta < 0 ? "меньше" : "больше"} на ${rub(Math.abs(ch.delta))}` : ch.kind === "delay" ? `ближайший доход позже на ${ch.days} дн.` : `новый платёж ${rub(ch.amount)} ${ch.date}`;
  return `Сценарий (${what}), прикидка, план не меняется:\n| Период | было в день | станет в день |\n|---|---|---|\n` +
    rows.map((r) => `| ${r.period} | ${rub(r.before)} | ${rub(r.after)}${r.low ? " ⚠ ниже минимума" : ""}${r.gap > 0 ? `, не хватает ${rub(r.gap)}` : ""} |`).join("\n");
}

const num = (x: string) => Number(x.replace(/[\s\u00a0]/g, "").replace(",", "."));
const AMOUNT = /(\d[\d\s\u00a0]*(?:[.,]\d+)?)\s*(к|тыс\.?|тысяч\w*)?\s*(?:₽|р\b|руб)?/i;
function amountIn(q: string) {
  const m = q.match(AMOUNT);
  if (!m) return 0;
  return num(m[1] ?? "") * (m[2] ? 1000 : 1);
}
/** Recognise a question the app can calculate itself; returns a ready block for the model. */
export function precompute(s: State, q: string, now = new Date()): string | null {
  const t = q.toLowerCase();
  if (/(долг|кредит|кубыш|плат[ауы]|вернуть|погаш)/.test(t) && s.obligations.some((o) => o.debtFee)) {
    const match = t.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})\b/);
    const raw = match?.[0];
    const parts = raw?.split('.');
    const date = raw ? raw.includes('-') ? raw : `${parts?.[2]}-${parts?.[1]?.padStart(2, '0')}-${parts?.[0]?.padStart(2, '0')}` : dayKey(now);
    const debts = s.obligations.filter((o) => o.debtFee);
    const named = debts.filter((o) => t.includes(o.name.toLowerCase()));
    return (named.length ? named : debts).map((o) => {
      const result = debtFeeAt(s, o, date);
      return result ? `${o.name}, на ${date}: основной долг ${rub(result.principal)}, плата ${rub(result.fee)} за ${result.chargedDays} платных дней, ставка за день ${rub(result.daily)}, долг с платой ${rub(result.total)}. Условия сохранены в карточке; предполагается, что новых операций не будет. Плата отдельно от планового платежа, автоматически не списывается.` : `${o.name}: точный расчёт недоступен — проверьте даты и покрытие суммы ступенями. Не вычисляй плату сама.`;
    }).join('\n');
  }
  const dateMatch = t.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})\b/);
  if (/(плат[её]ж|оплат|списан)/.test(t) && /(нов|добав|внеплан|если)/.test(t) && dateMatch) {
    const raw = dateMatch[0];
    const parts = raw.split(".");
    const date = raw.includes("-") ? raw : `${parts[2]}-${parts[1]?.padStart(2, "0")}-${parts[0]?.padStart(2, "0")}`;
    const amount = amountIn(t.replace(raw, ""));
    if (amount > 0 && validDate(date)) {
      const ch: Change = { kind: "payment", amount, date };
      return scenarioText(ch, whatIf(s, ch, now));
    }
  }
  const n = amountIn(t);
  if (/(купить|покупк|потянуть|могу ли|можно ли)/.test(t) && n > 0) return purchaseText(evaluatePurchase(s, n, now));
  if (/(зарплат|доход|выплат)/.test(t) && /(меньше|больше|урежут|снизит|вырастет)/.test(t) && n > 0) {
    const ch: Change = { kind: "income", delta: /больше|вырастет/.test(t) ? n : -n };
    return scenarioText(ch, whatIf(s, ch, now));
  }
  const dl = t.match(/(задерж|сдвин|позже|опозда)\D*(\d+)\s*(дн|дня|день)/);
  if (dl) { const ch: Change = { kind: "delay", days: Number(dl[2]) }; return scenarioText(ch, whatIf(s, ch, now)); }
  return null;
}

/** Ruble sums the model wrote that the app never showed it — marked as approximate. */
export function unverifiedSums(answer: string, sources: string[]): number[] {
  const known = new Set<number>();
  for (const src of sources) for (const m of src.matchAll(/\d[\d\s\u00a0]*/g)) known.add(Math.round(num(m[0])));
  const out: number[] = [];
  for (const m of answer.matchAll(/(\d[\d\s\u00a0]*(?:[.,]\d+)?)\s*(?:₽|руб)/g)) {
    const v = Math.round(num(m[1] ?? ""));
    if (v < 100) continue;
    if (![...known].some((k) => Math.abs(k - v) <= Math.max(1, v * 0.005))) out.push(v);
  }
  return [...new Set(out)];
}

// ---------- action cards: the model proposes, the person confirms ----------
export type Action =
  | { type: "transfer"; from: Method; amount: number }
  | { type: "payment"; name: string; amount: number; date: string }
  | { type: "goal"; name: string; target: number };
export type MoveAction = { type: "movePayment"; id: string; date: string } | { type: "moveIncome"; id: string; date: string };
export type AdvisorAction = Action | MoveAction;
const TAG = /\[\[(transfer|payment|goal|movePayment|moveIncome):([^\]]{1,200})\]\]/g;
export function parseActions(text: string): { clean: string; actions: AdvisorAction[] } {
  const actions: AdvisorAction[] = [];
  for (const m of text.matchAll(TAG)) {
    const p = (m[2] ?? "").split("|").map((x) => x.trim());
    const amount = num(p[1] ?? "");
    if (m[1] === "transfer" && (p[0] === "card" || p[0] === "cash") && Number.isFinite(amount) && amount > 0) actions.push({ type: "transfer", from: p[0], amount });
    if (m[1] === "payment" && p[0] && Number.isFinite(amount) && amount > 0 && validDate(p[2] ?? "")) actions.push({ type: "payment", name: p[0].slice(0, 60), amount, date: p[2] ?? "" });
    if (m[1] === "goal" && p[0] && Number.isFinite(amount) && amount > 0) actions.push({ type: "goal", name: p[0].slice(0, 60), target: amount });
    if ((m[1] === "movePayment" || m[1] === "moveIncome") && p[0] && validDate(p[1] ?? "")) actions.push({ type: m[1], id: p[0], date: p[1] ?? "" });
  }
  return { clean: text.replace(TAG, "").trim(), actions };
}
export function describeAction(a: AdvisorAction, s: State): { title: string; before: string; after: string } {
  if (a.type === "movePayment" || a.type === "moveIncome") {
    const item = a.type === "moveIncome" ? s.incomes.find((i) => i.id === a.id) : s.obligations.find((o) => o.id === a.id || o.schedule?.some((r) => `${o.id}::${r.id}` === a.id));
    return { title: a.type === "moveIncome" ? "Перенести ближайший доход" : "Перенести платёж", before: item ? `«${item.name}»: ${item.nextOn ?? ("once" in item ? item.once : undefined) ?? `${item.day}-го`}` : "Запись больше не найдена", after: a.date };
  }
  if (a.type === "transfer") {
    const dc = a.from === "card" ? -a.amount : a.amount;
    return { title: a.from === "card" ? "Перевести с карты в наличные" : "Перевести наличные на карту", before: `карта ${rub(s.balance)}, наличные ${rub(s.cash ?? 0)}`, after: `карта ${rub(s.balance + dc)}, наличные ${rub((s.cash ?? 0) - dc)}` };
  }
  if (a.type === "payment") return { title: "Добавить разовый платёж в план", before: `платежей в плане: ${s.obligations.length}`, after: `+ «${a.name}» ${rub(a.amount)} на ${a.date}` };
  return { title: "Создать цель накоплений", before: `целей: ${(s.goals ?? []).filter((g) => !g.deleted && !g.done).length}`, after: `+ «${a.name}» на ${rub(a.target)}` };
}
export function applyAction(a: AdvisorAction): boolean {
  if (a.type === "moveIncome" || a.type === "movePayment") {
    if (!validDate(a.date) || a.date < dayKey(new Date())) return false;
    const s = getState();
    if (a.type === "moveIncome") {
      if (!s.incomes.some((i) => i.id === a.id)) return false;
      moveIncome(a.id, a.date); return true;
    }
    const parent = s.obligations.find((o) => o.schedule?.some((r) => `${o.id}::${r.id}` === a.id));
    if (parent) {
      if (s.txs.some((t) => t.obligationId === a.id)) return false;
      setState((s) => ({ ...s, obligations: s.obligations.map((o) => o.id === parent.id ? { ...o, schedule: o.schedule?.map((r) => `${o.id}::${r.id}` === a.id ? { ...r, date: a.date } : r) ?? [] } : o) }));
      return true;
    }
    if (!s.obligations.some((o) => o.id === a.id && !o.schedule)) return false;
    moveObligation(a.id, a.date); return true;
  }
  if (a.type === "transfer") return !!transfer(a.amount, a.from);
  if (a.type === "payment") {
    setState((s) => ({ ...s, obligations: [...s.obligations, { id: uid(), name: a.name, amount: a.amount, day: Number(a.date.slice(8)), category: "unexpected", once: a.date, method: "card" }] }));
    return true;
  }
  saveGoal({ name: a.name, target: a.target });
  return true;
}
// ---------- weekly summary (offline, no AI) ----------
export function weekSummary(s: State, now = new Date()) {
  const since = +now - 7 * 86400000;
  const week = s.txs.filter((t) => +new Date(t.date) >= since);
  const groups: Record<string, number> = {};
  let income = 0;
  for (const t of week) {
    if (t.kind === "income") income += t.amount;
    if (t.kind === "expense" && !t.goal) { const g = cat(t.category).group; groups[g] = (groups[g] ?? 0) + t.amount; }
  }
  const upcoming = forecast(s, 30, now).flatMap((g) => g.events).filter((e) => !e.paid).slice(0, 3);
  return { groups, income, upcoming, count: week.length };
}
