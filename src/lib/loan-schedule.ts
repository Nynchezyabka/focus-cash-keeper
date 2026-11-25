import type { Obligation, State } from "./budget";

export interface ScheduleRow {
  id: string;
  date: string;
  amount: number;
}
export const schedulePaymentId = (parent: string, row: string) => `${parent}::${row}`;
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y = 0, m = 0, d = 0] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return y >= 2000 && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
export const validSchedule = (rows: ScheduleRow[]) =>
  rows.length > 0 &&
  rows.every((r) => r.id && validDate(r.date) && Number.isFinite(r.amount) && r.amount > 0) &&
  new Set(rows.map((r) => r.id)).size === rows.length;

/** Virtual one-off obligations reuse wallet, payment, undo and forecast logic. */
export function schedulePayments(o: Obligation): Obligation[] {
  return (o.schedule ?? [])
    .map((r) => ({
      id: schedulePaymentId(o.id, r.id),
      name: o.name,
      amount: r.amount,
      once: r.date,
      day: Number(r.date.slice(8)),
      category: o.category,
      ...(o.method ? { method: o.method } : {}),
    }))
    .sort((a, b) => (a.once ?? "").localeCompare(b.once ?? ""));
}
export function paymentObligations(s: State) {
  return s.obligations.flatMap((o) => (o.schedule ? schedulePayments(o) : [o]));
}
export function scheduleTotals(s: State, o: Obligation) {
  const rows = schedulePayments(o).map((p) => {
    const paid = s.txs
      .filter((t) => t.kind === "expense" && t.obligationId === p.id)
      .reduce((a, t) => a + t.amount, 0);
    const closed = s.txs.some(
      (t) => t.kind === "expense" && t.obligationId === p.id && t.closesObligation,
    );
    return { payment: p, paid, left: closed ? 0 : Math.max(0, p.amount - paid) };
  });
  return {
    rows,
    left: rows.reduce((a, r) => a + r.left, 0),
    remaining: rows.filter((r) => r.left > 0).length,
    total: rows.reduce((a, r) => a + r.payment.amount, 0),
  };
}

const MONTHS = ["янв", "фев", "мар", "апр", "ма", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const DATE_RE =
  /(\d{4}-\d{2}-\d{2})|\b(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?\b|\b(\d{1,2})\s+(янв|фев|мар|апр|мая|май|июн|июл|авг|сен|окт|ноя|дек)[а-яё]*\.?(?:\s+(\d{4}))?/i;
const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Text import rejects incomplete rows; a missing year is inferred as the nearest upcoming one and kept chronological. */
export function parseScheduleText(
  text: string,
  today = new Date(),
): { rows: ScheduleRow[]; errors: number[] } {
  const rows: ScheduleRow[] = [],
    errors: number[] = [];
  const floor = key(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 60));
  let prev = "";
  text.split(/\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const m = line.match(DATE_RE);
    if (!m) {
      errors.push(i + 1);
      return;
    }
    let date: string;
    if (m[1]) date = m[1];
    else {
      const day = Number(m[2] ?? m[5]);
      const month = m[3]
        ? Number(m[3])
        : MONTHS.findIndex((x) => (m[6] ?? "").toLowerCase().startsWith(x)) + 1;
      const yearText = m[4] ?? m[7];
      let year = yearText ? Number(yearText) : today.getFullYear();
      date = `${year}-${pad(month)}-${pad(day)}`;
      if (!yearText) {
        while (date < floor || (prev && date < prev)) {
          year += 1;
          date = `${year}-${pad(month)}-${pad(day)}`;
        }
      }
    }
    const rest = line
      .replace(m[0], "")
      .replace(/₽|руб\.?|р\./gi, "")
      .replace(/[A-Za-zА-Яа-яЁё]+\.?/g, "")
      .trim()
      .replace(/^[;:\s—–-]+/, "")
      .replace(/[;:\s—–-]+$/, "");
    const amount = Number(rest.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
    const numberFormat = /^(?:\d+|\d{1,3}(?:[\s\u00a0\u202f]\d{3})+)(?:[.,]\d{1,2})?$/;
    if (!validDate(date) || !numberFormat.test(rest) || !Number.isFinite(amount) || amount <= 0) {
      errors.push(i + 1);
      return;
    }
    prev = date;
    rows.push({ id: `import-${i}`, date, amount });
  });
  return { rows, errors };
}
