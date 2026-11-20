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
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** One short line per category for the advisor prompt. */
export function patternText(s: State, days = 30, now = new Date(), limit = 8) {
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
      parts.push(p.cardShare === 100 ? "картой" : p.cardShare === 0 ? "наличными" : `картой ${p.cardShare}%`);
      return parts.join(", ");
    })
    .join("; ");
}
