import { describe, expect, it } from 'vitest';
import { dailyDebtFee, debtFeeAt, validDebtFee, type DebtFee } from '@/lib/debt-fee';
import type { State, Obligation } from '@/lib/budget';
const f: DebtFee = { start: '2026-11-01', freeDays: 0, capPercent: 0.8, tiers: [{ upTo: 25000, daily: 200 }, { upTo: null, daily: 240 }], includeReturnDay: false };
const o: Obligation = { id: 'debt', name: 'Долг', amount: 20500, day: 13, once: '2026-11-13', category: 'loan', debtFee: f };
const s: State = { version: 1, balance: 0, cushion: 0, txs: [], obligations: [o], incomes: [], incomeAck: {}, ai: { provider: 'none', apiKey: '', model: '' }, createdAt: '2026-11-01' };
describe('debt fees', () => {
  it('20500 at 0.8% is 164 per day, not the 200 tier price', () => expect(dailyDebtFee(20500, f)).toBe(164));
  it('free days are not charged', () => expect(debtFeeAt(s, { ...o, debtFee: { ...f, freeDays: 2 } }, '2026-11-04')?.fee).toBe(164));
  it('excludes return day by default', () => expect(debtFeeAt(s, o, '2026-11-02')?.fee).toBe(164));
  it('can explicitly include return day', () => expect(debtFeeAt(s, { ...o, debtFee: { ...f, includeReturnDay: true } }, '2026-11-02')?.fee).toBe(328));
  it('uses inclusive tier boundaries', () => expect(dailyDebtFee(25000, f)).toBe(200));
  it('refuses uncovered amounts', () => expect(dailyDebtFee(30000, { ...f, tiers: [{ upTo: 25000, daily: 200 }] })).toBeNull());
  it('rejects unordered or invalid terms', () => expect(validDebtFee({ ...f, tiers: [{ upTo: null, daily: 8 }, { upTo: 3000, daily: 24 }] })).toBe(false));
  it('payments reduce principal and undo restores the derived fee', () => {
    const paid = { ...s, txs: [{ id: 'p', kind: 'expense' as const, amount: 10500, category: 'loan', date: '2026-11-02T12:00:00', obligationId: 'debt' }] };
    expect(debtFeeAt(paid, o, '2026-11-03')?.fee).toBe(244);
    expect(debtFeeAt(s, o, '2026-11-03')?.fee).toBe(328);
    expect(s.obligations[0]?.amount).toBe(20500);
  });
});