// Compact spending rhythm per category, computed on the device: few tokens for the advisor.
import { cat, dayKey, rub, type State, type Tx } from "@/lib/budget";

export interface CatPattern {
  id: string;
  total: number;
  count: number;
  activeDays: number;
  weekdayDays: number;
  weekendDays: number;
  perActiveDay: number;
  perWeekday: number;
  perWeekend: number;
  avgTicket: number;
  /** average days between purchase days; 0 when only one day */
  everyDays: number;
  cardShare: number;
  /** purchases above 2× the typical ticket, newest first */
  big: { amount: number; date: string }[];
}

const isEveryday = (t: Tx) => t.kind === "expense" && !t.obligationId && !t.goal && !t.family;

export function catPatterns(txs: Tx[], from: number, to = Date.now()): CatPattern[] {
  const by = new Map<string, Tx[]>();
  for (const t of txs) {
    const ms = +new Date(t.date);
    if (!isEveryday(t) || ms < from || ms > to) continue;
    by.set(t.category, [...(by.get(t.category) ?? []), t]);
  }
  return [...by.entries()]
    .map(([id, list]) => {
      const days = new Map<string, { sum: number; wknd: boolean; ms: number }>();
      let total = 0,
        card = 0;
      for (const t of list) {
        const dt = new Date(t.date),
          k = dayKey(dt);
        const g = days.get(k) ?? { sum: 0, wknd: dt.getDay() === 0 || dt.getDay() === 6, ms: +dt };
        g.sum += t.amount;
        days.set(k, g);
        total += t.amount;
        if (t.method !== "cash") card += t.amount;
      }
      const v = [...days.values()];
      const wd = v.filter((x) => !x.wknd),
        we = v.filter((x) => x.wknd);
      const sum = (a: typeof v) => a.reduce((s, x) => s + x.sum, 0);
      const ms = v.map((x) => x.ms).sort((a, b) => a - b);
      const span = ms.length > 1 ? (ms[ms.length - 1]! - ms[0]!) / 86400000 : 0;
      return {
        id,
        total,
        count: list.length,
        activeDays: v.length,
        weekdayDays: wd.length,
        weekendDays: we.length,
        perActiveDay: Math.round(total / v.length),
        perWeekday: wd.length ? Math.round(sum(wd) / wd.length) : 0,
        perWeekend: we.length ? Math.round(sum(we) / we.length) : 0,
        avgTicket: Math.round(total / list.length),
        everyDays: v.length > 1 ? Math.round(span / (v.length - 1)) : 0,
        cardShare: total ? Math.round((card / total) * 100) : 100,
        big: (() => {
          const sorted = list.map((t) => t.amount).sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
          return list.length >= 3
            ? list
                .filter((t) => t.amount > median * 2)
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 3)
                .map((t) => ({ amount: t.amount, date: t.date }))
            : [];
        })(),
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** One short line per category for the advisor prompt. */
export function patternText(s: State, days = 30, now = new Date(), limit = 30) {
  const rows = catPatterns(s.txs, +now - days * 86400000, +now).slice(0, limit);
  if (!rows.length) return "нет записей";
  return rows
    .map((p) => {
      const parts = [
        `${cat(p.id).name}: дней с тратами ${p.activeDays} из ${days}`,
        `в среднем ${rub(p.perActiveDay)} в такой день`,
      ];
      if (p.weekdayDays && p.weekendDays)
        parts.push(`будни ${p.weekdayDays} дн. по ${rub(p.perWeekday)}, выходные ${p.weekendDays} дн. по ${rub(p.perWeekend)}`);
      else parts.push(p.weekendDays ? "только выходные" : "только будни");
      if (p.count > p.activeDays) parts.push(`покупок ${p.count}, средний чек ${rub(p.avgTicket)}`);
      if (p.everyDays) parts.push(`примерно раз в ${p.everyDays} дн.`);
      if (p.big.length)
        parts.push(
          `крупные покупки: ${p.big.map((b) => `${rub(b.amount)} ${new Date(b.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`).join(", ")}`,
        );
      parts.push(
        p.cardShare === 100
          ? "100% картой, наличными не было"
          : p.cardShare === 0
            ? "100% наличными, картой не было"
            : `картой ${p.cardShare}%, наличными ${100 - p.cardShare}%`,
      );
      return parts.join(", ");
    })
    .join("; ");
}

/** Day-by-day diary of everyday spending: one short line per active day, newest first. */
export function dailyDiary(s: State, days = 30, now = new Date()) {
  const from = +now - days * 86400000;
  const by = new Map<string, { ms: number; cats: Map<string, number> }>();
  for (const t of s.txs) {
    const ms = +new Date(t.date);
    if (!isEveryday(t) || ms < from || ms > +now) continue;
    const k = dayKey(new Date(t.date));
    const g = by.get(k) ?? { ms, cats: new Map() };
    g.cats.set(t.category, (g.cats.get(t.category) ?? 0) + t.amount);
    by.set(k, g);
  }
  if (!by.size) return "нет записей";
  return [...by.values()]
    .sort((a, b) => b.ms - a.ms)
    .map(
      (g) =>
        `${new Date(g.ms).toLocaleDateString("ru-RU", { day: "numeric", month: "short", weekday: "short" })}: ${[...g.cats]
          .map(([c, v]) => `${cat(c).name} ${rub(v)}`)
          .join(", ")}`,
    )
    .join("; ");
}
