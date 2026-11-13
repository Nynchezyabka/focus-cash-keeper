import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { debtFeeAt, validDebtFee, type DebtFee } from '@/lib/debt-fee';
import { dayKey, rub, type Obligation, type State } from '@/lib/budget';

export function DebtFeeFields({ value, onChange }: { value: DebtFee | undefined; onChange: (f: DebtFee | undefined) => void }) {
  return <div className="space-y-3 border-t border-border pt-3">
    <label className="flex items-center justify-between text-sm">Плата за пользование долгом<Switch checked={!!value} onCheckedChange={(v) => onChange(v ? { start: dayKey(new Date()), freeDays: 0, capPercent: 0, tiers: [{ upTo: null, daily: 0 }], includeReturnDay: false } : undefined)} /></label>
    {value && <>
      <label className="block text-xs text-muted-foreground">Дата получения денег<Input aria-label="Дата получения долга" type="date" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} /></label>
      <label className="block text-xs text-muted-foreground">Дней без платы<Input aria-label="Дней без платы" type="number" min={0} value={value.freeDays} onChange={(e) => onChange({ ...value, freeDays: Number(e.target.value) })} /></label>
      <label className="block text-xs text-muted-foreground">Предел, % от остатка в день<Input aria-label="Дневной предел в процентах" type="number" min={0} step="0.01" value={value.capPercent} onChange={(e) => onChange({ ...value, capPercent: Number(e.target.value) })} /></label>
      {value.tiers.map((t, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] items-end gap-2">
        <label className="text-xs text-muted-foreground">До суммы, ₽<Input aria-label={`Порог ступени ${i + 1}`} inputMode="decimal" placeholder="Без предела" value={t.upTo ?? ''} onChange={(e) => onChange({ ...value, tiers: value.tiers.map((r, j) => j === i ? { ...r, upTo: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) } : r) })} /></label>
        <label className="text-xs text-muted-foreground">Плата, ₽/день<Input aria-label={`Плата ступени ${i + 1}`} inputMode="decimal" value={t.daily} onChange={(e) => onChange({ ...value, tiers: value.tiers.map((r, j) => j === i ? { ...r, daily: Number(e.target.value.replace(',', '.')) } : r) })} /></label>
        <Button size="icon" variant="ghost" aria-label={`Удалить ступень ${i + 1}`} onClick={() => onChange({ ...value, tiers: value.tiers.filter((_, j) => j !== i) })}><Trash2 /></Button>
      </div>)}
      <Button size="sm" variant="outline" onClick={() => onChange({ ...value, tiers: [...value.tiers, { upTo: null, daily: 0 }] })}><Plus /> Ступень</Button>
      <label className="flex items-center justify-between gap-2 text-xs">Начислять за день возврата<Switch checked={value.includeReturnDay} onCheckedChange={(v) => onChange({ ...value, includeReturnDay: v })} /></label>
      {!validDebtFee(value) && <p role="status" className="text-xs text-muted-foreground">Пороги должны идти по возрастанию; «Без предела» — только последняя ступень.</p>}
    </>}
  </div>;
}

export function DebtFeeSummary({ s, o }: { s: State; o: Obligation }) {
  const [date, setDate] = useState(o.once ?? dayKey(new Date()));
  const today = debtFeeAt(s, o, dayKey(new Date())), selected = debtFeeAt(s, o, date);
  return <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
    <p>{today ? `Плата на сегодня ${rub(today.fee)} · ${rub(today.daily)}/день` : 'Для расчёта платы проверьте условия и пороги.'}</p>
    <label className="block text-muted-foreground">Дата возврата для расчёта<Input aria-label={`Расчёт платы ${o.name}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
    {selected && <p>Плата к этой дате {rub(selected.fee)} · долг с платой {rub(selected.total)}</p>}
    <p className="text-muted-foreground">При сохранении текущего остатка. Записанные оплаты уменьшают основной долг; плата показана отдельно и не списывается автоматически.</p>
  </div>;
}