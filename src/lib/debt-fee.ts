import type { Obligation, State } from './budget';
import { validDate } from './loan-schedule';

export interface FeeTier { upTo: number | null; daily: number }
export interface DebtFee { start: string; freeDays: number; capPercent: number; tiers: FeeTier[]; includeReturnDay: boolean }
const cents = (n: number) => Math.round(n * 100) / 100;
const ordinal = (date: string) => {
  const [y = 0, m = 0, d = 0] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};
export function validDebtFee(f: DebtFee): boolean {
  return !!f && validDate(f.start) && Number.isInteger(f.freeDays) && f.freeDays >= 0 && Number.isFinite(f.capPercent) && f.capPercent >= 0 && typeof f.includeReturnDay === 'boolean' && Array.isArray(f.tiers) && f.tiers.length > 0 && f.tiers.length <= 50 && f.tiers.every((t, i) => t && Number.isFinite(t.daily) && t.daily >= 0 && (t.upTo === null ? i === f.tiers.length - 1 : Number.isFinite(t.upTo) && t.upTo > (f.tiers[i - 1]?.upTo ?? 0)));
}
export function dailyDebtFee(principal: number, f: DebtFee): number | null {
  if (!validDebtFee(f) || !Number.isFinite(principal) || principal < 0) return null;
  if (principal === 0) return 0;
  const tier = f.tiers.find((t) => t.upTo === null || principal <= t.upTo);
  return tier ? cents(Math.min(tier.daily, principal * f.capPercent / 100)) : null;
}
/** Full calendar days: borrowing day included; repayment day follows the explicit contract setting.
 * Linked expense payments reduce principal; fees never compound and never mutate the budget. */
export function debtFeeAt(s: State, o: Obligation, date: string) {
  const f = o.debtFee;
  if (!f || !validDebtFee(f) || !validDate(date) || !Number.isFinite(o.amount) || o.amount <= 0) return null;
  const start = ordinal(f.start), end = ordinal(date) + (f.includeReturnDay ? 1 : 0);
  if (end < start || end - start > 36525) return null;
  const payments = s.txs.filter((t) => t.kind === 'expense' && t.obligationId === o.id && validDate(t.date.slice(0, 10))).map((t) => ({ day: ordinal(t.date.slice(0, 10)), amount: t.amount }));
  let fee = 0, chargedDays = 0;
  for (let day = start; day < end; day++) {
    if (day - start < f.freeDays) continue;
    const principal = Math.max(0, o.amount - payments.filter((p) => p.day <= day).reduce((n, p) => n + p.amount, 0));
    const rate = dailyDebtFee(principal, f);
    if (rate === null) return null;
    fee = cents(fee + rate); if (rate > 0) chargedDays++;
  }
  const left = Math.max(0, o.amount - payments.filter((p) => p.day <= ordinal(date)).reduce((n, p) => n + p.amount, 0));
  const daily = dailyDebtFee(left, f);
  return daily === null ? null : { fee, chargedDays, daily, principal: left, total: cents(left + fee) };
}