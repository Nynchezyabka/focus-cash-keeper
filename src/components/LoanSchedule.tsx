import { useRef, useState } from "react";
import { CalendarDays, Check, ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { MethodBadge, MethodToggle } from "./Pickers";
import { addedToast, undoable } from "./Undo";
import { aiChat } from "@/lib/parse";
import { getState, payPart, unpay, restoreTx, rub, setState, uid, type Obligation, type Method, type State } from "@/lib/budget";
import { parseScheduleText, scheduleTotals, validSchedule, type ScheduleRow } from "@/lib/loan-schedule";

export function LoanScheduleCard({ s, o, onEdit }: { s: State; o: Obligation; onEdit: () => void }) {
  const totals = scheduleTotals(s, o);
  return <li className="space-y-3 rounded-2xl bg-card p-4 shadow-soft">
    <Button variant="ghost" className="h-auto w-full justify-between gap-2 p-0 text-left" onClick={onEdit}>
      <span className="min-w-0 whitespace-normal break-words">{o.name}</span><MethodBadge m={o.method} />
    </Button>
    <p className="text-sm">Осталось {rub(totals.left)} · платежей {totals.remaining} из {totals.rows.length}</p>
    <details>
      <summary className="cursor-pointer text-xs text-muted-foreground">График платежей</summary>
      <ul className="mt-2 divide-y divide-border">
        {totals.rows.map(({ payment: p, paid, left }) => <li key={p.id} className="flex items-center justify-between gap-2 py-2">
          <span className="min-w-0 text-xs">{new Date(`${p.once}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
            <span className="block tabular-nums">{rub(p.amount)}{paid > 0 && left > 0 ? ` · осталось ${rub(left)}` : ""}</span>
          </span>
          <Button variant={left === 0 ? "secondary" : "outline"} size="icon" className="shrink-0" aria-label={left === 0 ? `Отменить оплату ${p.once}` : `Оплатить ${p.once}`} title={left === 0 ? "Отменить оплату" : "Оплачено"} onClick={() => {
            if (left === 0) { const txs = unpay(p); undoable("Оплата отменена", () => txs.forEach(restoreTx)); }
            else addedToast(payPart(p, left), `${o.name}: оплачено ${rub(left)}`);
          }}><Check className={left === 0 ? "opacity-100" : "opacity-40"} /></Button>
        </li>)}
      </ul>
    </details>
  </li>;
}

export function LoanScheduleEditor({ o, onClose }: { o?: Obligation | undefined; onClose: () => void }) {
  const [name, setName] = useState(o?.name ?? "");
  const [method, setMethod] = useState<Method>(o?.method ?? "card");
  const [rows, setRows] = useState<ScheduleRow[]>(o?.schedule ?? [{ id: uid(), date: "", amount: 0 }]);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ScheduleRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const inspect = (source: string) => {
    const parsed = parseScheduleText(source);
    setError(parsed.errors.length ? `Не удалось прочитать строки: ${parsed.errors.join(", ")}. Нужны дата и сумма.` : parsed.rows.length ? "" : "Не найдено платежей.");
    setPreview(parsed.errors.length ? null : parsed.rows.length ? parsed.rows : null);
  };
  const locked = (id: string) => !!o && scheduleTotals(getState(), o).rows.some((r) => r.payment.id === `${o.id}::${id}` && r.paid > 0);
  return <Dialog open onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
      <DialogHeader><DialogTitle>{o ? "Изменить график кредита" : "График кредита"}</DialogTitle></DialogHeader>
      <Input placeholder="Название кредита" value={name} onChange={(e) => setName(e.target.value)} />
      <MethodToggle value={method} onChange={setMethod} />
      <div className="space-y-2">
        {rows.map((r, i) => <div key={r.id} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_2.25rem] items-center gap-1.5">
          <Input className="min-w-0 px-2 text-xs" aria-label={`Дата платежа ${i + 1}`} type="date" value={r.date} disabled={locked(r.id)} onChange={(e) => setRows(rows.map((x) => x.id === r.id ? { ...x, date: e.target.value } : x))} />
          <Input className="min-w-0 px-2" aria-label={`Сумма платежа ${i + 1}`} inputMode="decimal" placeholder="Сумма, ₽" value={r.amount || ""} disabled={locked(r.id)} onChange={(e) => setRows(rows.map((x) => x.id === r.id ? { ...x, amount: Number(e.target.value.replace(/\s/g, "").replace(",", ".")) } : x))} />
          <Button variant="ghost" size="icon" disabled={locked(r.id)} aria-label={`Удалить платёж ${i + 1}`} onClick={() => setRows(rows.filter((x) => x.id !== r.id))}><Trash2 /></Button>
        </div>)}
        <Button variant="outline" size="sm" onClick={() => setRows([...rows, { id: uid(), date: "", amount: 0 }])}><Plus /> Добавить дату</Button>
      </div>
      <details className="space-y-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground">Вставить текст или загрузить скриншот</summary>
        <Textarea className="mt-2" aria-label="Текст графика" placeholder={'20.11.2026 12 500\n20.12.2026 11 800'} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={!text.trim() || busy} onClick={() => inspect(text)}><CalendarDays /> Предпросмотр</Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => file.current?.click()}><ImagePlus />{busy ? "Распознаю…" : "Скриншот"}</Button>
        </div>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
          setBusy(true); setError(""); setPreview(null);
          try {
            const dataUrl = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(f); });
            const answer = await aiChat("Выпиши график платежей по кредиту с изображения. Только строки YYYY-MM-DD сумма, без валюты и оформления. Не включай итоги, проценты или остаток долга. Не выдумывай даты, год или суммы; если год не указан, ответь НЕЯСНО.", [{ role: "user", content: "Прочитай даты и полные суммы каждого платежа." }], getState().ai, { dataUrl, type: f.type });
            setText(answer); inspect(answer);
          } catch (e) { setError(e instanceof Error ? e.message : "Не удалось прочитать изображение."); }
          finally { setBusy(false); }
        }} />
      </details>
      {error && <p role="alert" className="text-xs text-muted-foreground">{error}</p>}
      {preview && <div className="space-y-2 border-y border-border py-3">
        <p className="text-sm">Проверьте даты и суммы: {preview.length} платежей</p>
        <ul className="max-h-40 overflow-y-auto text-xs">{preview.map((r) => <li key={r.id} className="flex justify-between gap-2 py-1"><span>{r.date}</span><span>{rub(r.amount)}</span></li>)}</ul>
        <Button variant="secondary" size="sm" onClick={() => {
          const paidRows = rows.filter((r) => locked(r.id));
          const next = preview.filter((r) => !paidRows.some((p) => p.date === r.date && p.amount === r.amount)).map((r) => {
            const existing = rows.find((x) => x.date === r.date && x.amount === r.amount);
            return { ...r, id: existing?.id ?? uid() };
          });
          setRows([...paidRows, ...next]); setPreview(null);
        }}>Внести в график</Button>
      </div>}
      <p className="text-xs text-muted-foreground">Всего по графику: {rub(rows.reduce((a, r) => a + (Number.isFinite(r.amount) ? r.amount : 0), 0))}{o ? ". Оплаченные строки сохраняются; для их изменения сначала отмените оплату." : ". Деньги на карту не добавляются."}</p>
      <div className="flex gap-2">
        {o && <Button variant="outline" size="icon" aria-label="Удалить кредит" onClick={() => {
          setState((s) => ({ ...s, obligations: s.obligations.filter((x) => x.id !== o.id) }));
          undoable("График удалён, записанные оплаты сохранены", () => setState((s) => ({ ...s, obligations: [...s.obligations, o] }))); onClose();
        }}><Trash2 /></Button>}
        <Button className="flex-1" disabled={!name.trim() || !validSchedule(rows) || busy || !!preview} onClick={() => {
          const item: Obligation = { ...(o ?? {}), id: o?.id ?? uid(), name: name.trim(), category: "loan", method, day: 0, amount: rows.reduce((a, r) => a + r.amount, 0), schedule: [...rows].sort((a, b) => a.date.localeCompare(b.date)) };
          setState((s) => ({ ...s, obligations: o ? s.obligations.map((x) => x.id === o.id ? item : x) : [...s.obligations, item] }));
          toast("График сохранён"); onClose();
        }}>Сохранить график</Button>
      </div>
    </DialogContent>
  </Dialog>;
}