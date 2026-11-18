import { cat, rub, type State } from "./budget";

const MONTHS = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];

export type ReviewRange = { from: Date; to: Date; label: string };

/** A one-off review request: «обзор за октябрь», «итоги месяца», «обзор за всё время». */
export function reviewRange(q: string, now = new Date()): ReviewRange | null {
  const t = q.toLowerCase();
  if (!/(обзор|обозри|итог|разбор|разбери)/.test(t)) return null;
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (/вс[её]\s*врем|за\s*вс[её]|целиком|весь\s*бюджет/.test(t))
    return { from: new Date(2000, 0, 1), to: end, label: "за всё время" };
  if (/прошл\w*\s*месяц/.test(t)) {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { from, to: new Date(now.getFullYear(), now.getMonth(), 1), label: "за прошлый месяц" };
  }
  const i = MONTHS.findIndex((m) => new RegExp(m === "ма" ? "(^|[^а-яё])ма[йяе]([^а-яё]|$)" : `(^|[^а-яё])${m}`).test(t));
  if (i >= 0) {
    const y = i > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
    const from = new Date(y, i, 1);
    const to = new Date(y, i + 1, 1);
    return { from, to: to > end ? end : to, label: `за ${from.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}` };
  }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: end, label: "за этот месяц" };
}

/** Full local summary for one review — sent once with that question only. */
export function reviewText(s: State, r: ReviewRange): string {
  const txs = s.txs.filter((t) => {
    const d = new Date(t.date);
    return d >= r.from && d < r.to && !t.family;
  });
  const life = txs.filter((t) => t.kind === "expense" && !t.goal);
  const sum = (l: typeof txs) => l.reduce((a, t) => a + Math.abs(t.amount), 0);
  const income = txs.filter((t) => t.kind === "income");
  const planned = life.filter((t) => t.obligationId);
  const daily = life.filter((t) => !t.obligationId);
  const byCat = new Map<string, number>();
  for (const t of daily) byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  const cats = [...byCat].sort((a, b) => b[1] - a[1]).map(([c, v]) => `${cat(c).name} ${rub(v)}`).join("; ") || "нет";
  const top = [...daily].sort((a, b) => b.amount - a.amount).slice(0, 10)
    .map((t) => `${new Date(t.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} ${t.note || cat(t.category).name} ${rub(t.amount)}`).join("; ") || "нет";
  const days = new Set(daily.map((t) => new Date(t.date).toDateString())).size;
  const first = txs.length ? new Date(Math.min(...txs.map((t) => +new Date(t.date)))) : r.from;
  const span = Math.max(1, Math.round((+r.to - +(first > r.from ? first : r.from)) / 86400000));
  const goalIn = sum(txs.filter((t) => t.goal));
  return `ОБЗОР ${r.label.toUpperCase()} (собран приложением; это разовый подробный разбор — оцени бережно: что получилось, где были форс-мажоры, как бюджет в целом; без стыда за траты; советы об экономии только если человек о них просил):
Доходы: ${rub(sum(income))} (${income.length} поступлений).
Траты на жизнь: ${rub(sum(daily))} за ${span} дн., в среднем ${rub(sum(daily) / span)} в день; дней с тратами ${days}.
Оплачено плановых платежей: ${rub(sum(planned))} (${planned.length}).
В накопления/цели: ${rub(goalIn)}.
По категориям: ${cats}.
Самые крупные траты: ${top}.`;
}
