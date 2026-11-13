import type { Obligation, State } from "./budget";

export interface ScheduleRow { id: string; date: string; amount: number }
export const schedulePaymentId = (parent: string, row: string) => `${parent}::${row}`;
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y = 0, m = 0, d = 0] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return y >= 2000 && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
export const validSchedule = (rows: ScheduleRow[]) => rows.length > 0 && rows.every((r) => r.id && validDate(r.date) && Number.isFinite(r.amount) && r.amount > 0) && new Set(rows.map((r) => r.id)).size === rows.length;

/** Virtual one-off obligations reuse wallet, payment, undo and forecast logic. */
export function schedulePayments(o: Obligation): Obligation[] {
  return (o.schedule ?? []).map((r) => ({
    id: schedulePaymentId(o.id, r.id), name: o.name, amount: r.amount, once: r.date,
    day: Number(r.date.slice(8)), category: o.category, ...(o.method ? { method: o.method } : {}),
  })).sort((a, b) => (a.once ?? "").localeCompare(b.once ?? ""));
}
export function paymentObligations(s: State) {
  return s.obligations.flatMap((o) => o.schedule ? schedulePayments(o) : [o]);
}
export function scheduleTotals(s: State, o: Obligation) {
  const rows = schedulePayments(o).map((p) => {
    const paid = s.txs.filter((t) => t.kind === "expense" && t.obligationId === p.id).reduce((a, t) => a + t.amount, 0);
    return { payment: p, paid, left: Math.max(0, p.amount - paid) };
  });
  return { rows, left: rows.reduce((a, r) => a + r.left, 0), remaining: rows.filter((r) => r.left > 0).length, total: rows.reduce((a, r) => a + r.payment.amount, 0) };
}

/** Text import deliberately rejects incomplete rows instead of guessing a date or amount. */
export function parseScheduleText(text: string): { rows: ScheduleRow[]; errors: number[] } {
  const rows: ScheduleRow[] = [], errors: number[] = [];
  text.split(/\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const match = line.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})\b/);
    if (!match) { errors.push(i + 1); return; }
    const raw = match[0];
    const parts = raw.split(/[./]/);
    const date = raw.includes("-") ? raw : `${parts[2]}-${parts[1]?.padStart(2, "0")}-${parts[0]?.padStart(2, "0")}`;
    const rest = line.replace(raw, "").replace(/₽|руб\.?/gi, "").trim().replace(/^[;:\s—–-]+/, "");
    const amount = Number(rest.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
    const numberFormat = /^(?:\d+|\d{1,3}(?:[\s\u00a0\u202f]\d{3})+)(?:[.,]\d{1,2})?$/;
    if (!validDate(date) || !numberFormat.test(rest) || !Number.isFinite(amount) || amount <= 0) { errors.push(i + 1); return; }
    rows.push({ id: `import-${i}`, date, amount });
  });
  return { rows, errors };
}