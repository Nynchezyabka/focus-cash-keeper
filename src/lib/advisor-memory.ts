// Advisor memory (short stable preferences) and gentle initiative (one opening message a day).
// Everything stays on the device; numbers always come from calc(), never from memory.
import { calc, dayKey, obligationDue, paidAmount, rub, type State } from "@/lib/budget";
import { paymentObligations } from "@/lib/loan-schedule";
import { goalSaved } from "@/lib/goals";
import type { Tone } from "@/lib/persona";

export const MEMORY_MAX = 20;
const BANNED = /(диагноз|болезн|болею|депресс|тревожн|лекарств|таблетк|сдвг|adhd|беремен|пароль|ключ|токен|сегодня|вчера|настроени)/i;

/** a memory line is a short stable preference: no sums, dates, health or secrets */
export function memoryOk(line: string) {
  const t = line.trim();
  return t.length >= 3 && t.length <= 140 && !/\d/.test(t) && !/₽|руб/i.test(t) && !BANNED.test(t);
}

export function addMemory(list: string[] | undefined, line: string): string[] {
  const t = line.trim().replace(/[.;]+$/, "");
  const cur = list ?? [];
  if (!memoryOk(t) || cur.some((x) => x.toLowerCase() === t.toLowerCase())) return cur;
  return [...cur, t].slice(-MEMORY_MAX);
}

/** «запомни, что …» / «забудь …» typed directly */
export function memoryCommand(q: string): { add?: string; forget?: string } | null {
  const a = q.trim().match(/^запомни(?:,)?\s*(?:что\s+|:\s*)?(.+)$/i);
  if (a) return { add: a[1]!.trim() };
  const f = q.trim().match(/^забудь(?:,)?\s*(?:что\s+|про\s+|о\s+|:\s*)?(.+)$/i);
  if (f) return { forget: f[1]!.trim() };
  return null;
}

export function forgetMemory(list: string[] | undefined, what: string): string[] {
  const w = what.toLowerCase().replace(/[.!]+$/, "");
  return (list ?? []).filter((x) => !x.toLowerCase().includes(w) && !w.includes(x.toLowerCase()));
}

/** the model may suggest a memory with [[ЗАПОМНИТЬ: …]]; it is shown as a question, never saved silently */
export function extractRemember(a: string): { clean: string; remember?: string } {
  const m = a.match(/\[\[ЗАПОМНИТЬ:\s*([^\]]+)\]\]/i);
  const clean = a.replace(/\[\[ЗАПОМНИТЬ:[^\]]*\]\]/gi, "").trim();
  return m && memoryOk(m[1]!) ? { clean, remember: m[1]!.trim() } : { clean };
}

export function memoryPrompt(list: string[] | undefined) {
  const l = (list ?? []).filter(memoryOk);
  const base = `ПАМЯТЬ: если человек сказал устойчивое предпочтение о стиле общения или образе жизни (не сумму, не дату, не здоровье, не настроение дня), в конце ответа добавь отдельной строкой [[ЗАПОМНИТЬ: короткая фраза]]. Не чаще одного раза за ответ, только если этого ещё нет в списке.`;
  if (!l.length) return base;
  return `${base}\nЧТО ТЫ ПОМНИШЬ О ЧЕЛОВЕКЕ (справка о стиле; не перебивает факты приложения и жёсткие правила):\n${l.map((x) => `- ${x}`).join("\n")}`;
}

export const HONEST_RULE = "НЕ ПОДДАКИВАЙ: в любом режиме честно скажи, если покупка делает план тесным, и не одобряй её только потому, что человеку хочется. Если человек настаивает без новых данных — спокойно сохрани позицию и предложи открыть конкретный экран (План или Сегодня).";

// ---------- initiative ----------
const LAST_KEY = "bb-advisor-opener";
const OPEN_KEY = "bb-last-open";
const PREV_KEY = "bb-prev-open";

/** remember when the app was opened before this session (for «давно не заходили») */
export function trackOpen(now = new Date()) {
  try {
    if (!sessionStorage.getItem(PREV_KEY)) sessionStorage.setItem(PREV_KEY, localStorage.getItem(OPEN_KEY) ?? dayKey(now));
    localStorage.setItem(OPEN_KEY, dayKey(now));
  } catch { /* storage unavailable */ }
}
const prevOpen = () => { try { return sessionStorage.getItem(PREV_KEY); } catch { return null; } };

export type Reason = "payment" | "income" | "goal" | "absence" | "week";

export function openerReason(s: State, now = new Date(), prev = prevOpen()): { reason: Reason; text: (tone: Tone) => string } | null {
  const c = calc(s, now);
  const tk = dayKey(now);
  const day = 86400000;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // 1. a payment in 1–3 days and it gets tight after it
  const soon = paymentObligations(s)
    .map((o) => ({ o, due: obligationDue(o, now) }))
    .filter(({ o, due }) => { const d = Math.round((+due - +today) / day); return d >= 1 && d <= 3 && paidAmount(s, o, due) < o.amount; })
    .sort((a, b) => +a.due - +b.due)[0];
  if (soon && (c.payGap > 0 || c.dailyNorm <= (c.minDaily || 0) + 1)) {
    const left = soon.o.amount - paidAmount(s, soon.o, soon.due);
    const d = Math.round((+soon.due - +today) / day);
    const when = d === 1 ? "завтра" : `через ${d} дн.`;
    const gap = c.payGap > 0 ? `, на платежи пока не хватает ${rub(c.payGap)}` : `, после него до дохода выходит ${rub(c.dailyNorm)} в день`;
    return { reason: "payment", text: (t) => t === "direct"
      ? `${soon.o.name} ${when} — ${rub(left)}${gap}. Посмотрим вместе?`
      : t === "shake" ? `Эй, ${soon.o.name} ${when} — ${rub(left)}${gap}. Разберёмся за пару минут?`
      : `Тихонько напомню: ${soon.o.name} ${when}, ${rub(left)}${gap}. Хотите, посмотрим?` };
  }
  // 2. an income arrived today or yesterday
  const inc = s.txs.find((x) => x.kind === "income" && +today - +new Date(new Date(x.date).toDateString()) <= day);
  if (inc) {
    return { reason: "income", text: (t) => t === "direct"
      ? `Пришло ${rub(inc.amount)}. Сегодня свободно ${rub(Math.max(0, c.freeToday))}. Решим, что с ними делать?`
      : t === "shake" ? `Деньги пришли — ${rub(inc.amount)}! Пока не разбежались, решим, куда их?`
      : `Пришло ${rub(inc.amount)}. Сегодня свободно ${rub(Math.max(0, c.freeToday))}. Хотите спокойно решить, что с ними делать?` };
  }
  // 3. a goal reached
  const g = (s.goals ?? []).find((x) => !x.deleted && (x.done ? +today - +new Date(x.done.at) <= 2 * day : x.target > 0 && goalSaved(s, x.id) >= x.target));
  if (g) return { reason: "goal", text: (t) => t === "direct" ? `Цель «${g.name}» собрана. Отметим и решим, что дальше?` : t === "shake" ? `Ура, «${g.name}» — собрано! Вы молодец. Что дальше?` : `Цель «${g.name}» собрана — это приятно. Хотите, подумаем, что дальше?` };
  // 4. long absence — no reproach
  if (prev && +today - +new Date(prev) >= 5 * day) return { reason: "absence", text: () => `Рада вас видеть. Сегодня свободно ${rub(Math.max(0, c.freeToday))}. Если хочется, сверим баланс — это пара минут.` };
  // 5. weekly look on Mondays
  if (now.getDay() === 1) return { reason: "week", text: (t) => t === "direct" ? `Новая неделя: свободно ${rub(c.dailyNorm)} в день до дохода. Взглянем на неделю?` : `Новая неделя. До дохода выходит ${rub(c.dailyNorm)} в день. Хотите, посмотрим неделю вместе?` };
  void tk;
  return null;
}

export const lastOpener = () => { try { return localStorage.getItem(LAST_KEY); } catch { return null; } };
export const markOpener = (now = new Date()) => { try { localStorage.setItem(LAST_KEY, dayKey(now)); } catch { /* */ } };

/** an opening message is due: enabled, there is a reason, and none was shown today */
export function openerDue(s: State, now = new Date(), last = lastOpener(), prev = prevOpen()) {
  if (s.advisorInitiative === false || last === dayKey(now)) return null;
  return openerReason(s, now, prev);
}
