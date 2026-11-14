import { activeGoals } from "@/lib/goals";
import { DebtFeeFields, DebtFeeSummary } from "@/components/DebtFee";
import { validDebtFee } from "@/lib/debt-fee";
import { LoanScheduleCard, LoanScheduleEditor } from "@/components/LoanSchedule";
import { paymentObligations } from "@/lib/loan-schedule";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, CalendarClock, HandCoins, Lock, Plus, Trash2 } from "lucide-react";
import { Shell, CatIcon, meta } from "@/components/Shell";
import { MonthStrip } from "@/components/MonthStrip";
import { PlanTabs } from "@/components/PlanTabs";
import { addedToast, undoable } from "@/components/Undo";
import { CategoryPicker, DateDialog, MethodBadge, MethodToggle } from "@/components/Pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getState, calc, cat, catColor, dayKey, isPaid, paidAmount, payPart, unpay, restoreTx, borrow, removeTx, moveObligation, obligationDue, payObligation, rub, setState, syncLoanMoney, updateTx, uid, type Method, type Obligation, type State } from "@/lib/budget";

export const Route = createFileRoute("/payments")({
  head: () => meta("План платежей — Бережный бюджет", "Регулярные и разовые платежи, долги к возврату. Эти деньги откладываются заранее."),
  component: () => <Shell title="План" wide>{(s) => <><PlanTabs /><MonthStrip s={s} /><Payments s={s} /></>}</Shell>,
});

function Payments({ s }: { s: State }) {
  const c = calc(s);
  const [edit, setEdit] = useState<Obligation | null>(null);
  const [moving, setMoving] = useState<Obligation | null>(null);
  const [part, setPart] = useState<Obligation | null>(null);
  const [loan, setLoan] = useState(false);
  const [schedule, setSchedule] = useState<Obligation | "new" | null>(null);
  const list = [...s.obligations].map((o) => ({ o, due: obligationDue(o) })).sort((a, b) => +a.due - +b.due);
  const fmt = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Что и когда нужно оплатить: каждый месяц или один раз. Эти деньги заранее откладываются и не входят в «Сегодня свободно».</p>
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> До дохода отложено {rub(c.reserve)}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button className="h-12 rounded-2xl" onClick={() => setEdit({ id: "", name: "", amount: 0, day: 0, category: "home" })}><Plus /> Платёж</Button>
        <Button variant="secondary" className="h-12 rounded-2xl" onClick={() => setLoan(true)}><HandCoins /> Взяла в долг</Button>
      </div>
      {loan && <LoanDialog onClose={() => setLoan(false)} />}
      <Button variant="outline" className="w-full" onClick={() => setSchedule("new")}><CalendarClock /> График кредита</Button>
      {schedule && <LoanScheduleEditor o={schedule === "new" ? undefined : schedule} onClose={() => setSchedule(null)} />}
      <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
        {list.map(({ o, due }) => {
          if (o.schedule) return <LoanScheduleCard key={o.id} s={s} o={o} onEdit={() => setSchedule(o)} />;
          const paid = isPaid(s, o, due);
          const done = paidAmount(s, o, due);
          const reserved = c.reserved.some((r) => r.o.id === o.id);
          const k = cat(o.category);
          return (
            <li key={o.id} className={`rounded-2xl bg-card p-4 shadow-soft ${paid ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3">
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEdit(o)}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: catColor(k) }}><CatIcon name={k.icon} className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="truncate text-sm">{o.name}</span><MethodBadge m={o.method} /></span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {o.once ? `Один раз, ${fmt(due)}` : `Каждый месяц, ${o.day}-го`}{o.nextOn ? ` · перенесён на ${fmt(due)}` : ""}{paid ? " · оплачено" : reserved ? " · отложено" : ""}
                  </span>
                </span>
                <span className="text-sm tabular-nums">{rub(o.amount)}</span>
              </button>
              <span className="flex shrink-0 flex-col items-center gap-0.5">
              <button
                type="button"
                aria-label={paid ? "Отменить оплату" : "Отметить оплаченным"}
                onClick={() => {
                  if (paid) { const l = unpay(o); undoable(`«${o.name}» снова ждёт оплаты`, () => l.forEach(restoreTx)); }
                  else { const rest = o.amount - done; addedToast(done > 0 ? payPart(o, rest) : payObligation(o), `${o.name} оплачено — минус одна забота`); }
                }}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 active:scale-95 ${paid ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
              >
                {paid && <Check className="h-4 w-4" />}
              </button>
              <span className="text-[10px] leading-none text-muted-foreground">Оплачено</span>
              </span>
              </div>
              {!paid && done > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Внесено {rub(done)} из {rub(o.amount)}, осталось {rub(o.amount - done)}</p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (done / o.amount) * 100)}%` }} /></div>
                </div>
              )}
              {o.debtFee && <DebtFeeSummary s={s} o={o} />}
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">Например: аренда 5-го, интернет 12-го, рассрочка 20-го. И разовые: подарок к празднику, страховка, налог.</p>}

      <DateDialog open={!!moving} title={`Новая дата: «${moving?.name ?? ""}»`} initial={moving ? dayKey(obligationDue(moving)) : ""} onClose={() => setMoving(null)} onSave={(d) => {
        if (!moving) return;
        const wasPaid = isPaid(s, moving, obligationDue(moving));
        moveObligation(moving.id, d);
        if (wasPaid && confirm("Это новый платёж на новую дату? Отметить его неоплаченным?")) unpay(moving);
      }} />
      {part && <PartDialog o={part} left={part.amount - paidAmount(s, part, obligationDue(part))} onClose={() => setPart(null)} />}
      {edit && <Editor o={edit} onClose={() => setEdit(null)} onMove={() => { setMoving(edit); setEdit(null); }} onPart={isPaid(s, edit, obligationDue(edit)) ? undefined : () => { setPart(edit); setEdit(null); }} />}
    </div>
  );
}

const PRESETS = [
  { name: "Аренда", category: "home", once: false },
  { name: "ЖКУ", category: "home", once: false },
  { name: "Кредит", category: "loan", once: false },
  { name: "Связь", category: "phone", once: false },
  { name: "Подарок к празднику", category: "fun", once: true },
  { name: "Налог", category: "home", once: true },
  { name: "Страховка", category: "unexpected", once: true },
];

export function Editor({ o, onClose, onMove, onPart }: { o: Obligation; onClose: () => void; onMove?: (() => void) | undefined; onPart?: (() => void) | undefined }) {
  const isNew = !o.id;
  const [name, setName] = useState(o.name);
  const [amount, setAmount] = useState(o.amount ? String(o.amount) : "");
  const [once, setOnce] = useState(!!o.once);
  const [day, setDay] = useState(o.day ? String(o.day) : "");
  const [date, setDate] = useState(o.once ?? "");
  const [category, setCategory] = useState(o.category);
  const [method, setMethod] = useState<Method>(o.method ?? "card");
  const [goal, setGoal] = useState(o.goal ?? "");
  const [debtFee, setDebtFee] = useState(o.debtFee);
  const goals = activeGoals(getState());
  const a = Number(amount.replace(/\s/g, "").replace(",", ".")), d = Number(day);
  const valid = name.trim() && a > 0 && (once ? !!date : d >= 1 && d <= 31) && (!debtFee || (once && validDebtFee(debtFee)));
  return (
    <Dialog open onOpenChange={(x) => !x && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto">
        <DialogHeader><DialogTitle>{isNew ? "Новый платёж" : "Изменить платёж"}</DialogTitle></DialogHeader>
        <Input autoFocus placeholder="Название (аренда, рассрочка)" value={name} onChange={(e) => setName(e.target.value)} />
        {isNew && !name && (
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.name} type="button" className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
                onClick={() => { setName(p.name); setCategory(p.category); setOnce(p.once); }}>{p.name}</button>
            ))}
          </div>
        )}
        <Input inputMode="decimal" placeholder="Сумма, ₽" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm">
          {[false, true].map((v) => (
            <button key={String(v)} type="button" onClick={() => setOnce(v)} className={`rounded-lg py-2 ${once === v ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>{v ? "Один раз" : "Каждый месяц"}</button>
          ))}
        </div>
        {once
          ? <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          : <Input inputMode="numeric" placeholder="Какого числа (1–31)" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))} />}
        <MethodToggle value={method} onChange={setMethod} />
        <CategoryPicker value={category} onPick={setCategory} groups={["must", "safe", "life"]} />
        {once && category === "loan" && <DebtFeeFields value={debtFee} onChange={setDebtFee} />}
        {category === "savings" && goals.length > 0 && (
          <select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Без цели</option>
            {goals.map((g) => <option key={g.id} value={g.id}>На цель «{g.name}»</option>)}
          </select>
        )}
        {!isNew && (onMove || onPart) && (
          <div className="grid grid-cols-2 gap-2">
            {onMove && <Button variant="outline" onClick={onMove}><CalendarClock /> Перенести</Button>}
            {onPart && <Button variant="outline" onClick={onPart}>Оплатить часть</Button>}
          </div>
        )}
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="outline" size="icon" aria-label="Удалить" onClick={() => {
              setState((x) => ({ ...x, obligations: x.obligations.filter((y) => y.id !== o.id) }));
              undoable("Платёж удалён", () => setState((x) => ({ ...x, obligations: [...x.obligations, o] })));
              onClose();
            }}><Trash2 /></Button>
          )}
          <Button className="flex-1" disabled={!valid} onClick={() => {
            const item: Obligation = {
              id: o.id || uid(), name: name.trim(), amount: a, category, method, from: o.from ?? new Date().toISOString().slice(0, 10),
              day: once ? Number(date.slice(8, 10)) : d, ...(once ? { once: date } : {}), ...(!once && o.nextOn ? { nextOn: o.nextOn } : {}), ...(o.loanTx ? { loanTx: o.loanTx } : {}),
              ...(category === "savings" && goal ? { goal } : {}),
              ...(once && category === "loan" && debtFee ? { debtFee } : {}),
            };
            setState((x) => ({ ...x, obligations: isNew ? [...x.obligations, item] : x.obligations.map((y) => (y.id === o.id ? item : y)) }));
            if (!isNew) {
              const before = syncLoanMoney(o, item);
              if (before) undoable("Остаток на карте и наличными пересчитан", () => { updateTx(before.id, before); setState((x) => ({ ...x, obligations: x.obligations.map((y) => (y.id === o.id ? o : y)) })); });
            }
            onClose();
          }}>Сохранить</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PartDialog({ o, left, onClose }: { o: Obligation; left: number; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>(o.method ?? "card");
  const a = Number(amount.replace(/\s/g, "").replace(",", "."));
  return (
    <Dialog open onOpenChange={(x) => !x && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Внести часть: «{o.name}»</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Осталось {rub(left)}. Он остаётся отложенным до дня оплаты.</p>
        <Input autoFocus inputMode="decimal" placeholder="Сколько внесли, ₽" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 text-center text-2xl" />
        <MethodToggle value={method} onChange={setMethod} />
        <Button disabled={!(a > 0)} onClick={() => { addedToast(payPart(o, Math.min(a, left), method), `${o.name}: внесено ${rub(Math.min(a, left))}`); onClose(); }}>Внести</Button>
      </DialogContent>
    </Dialog>
  );
}

function LoanDialog({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState("");
  const [monthly, setMonthly] = useState(false);
  const [per, setPer] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState<Method>("card");
  const n = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));
  const ok = n(amount) > 0 && from.trim() && date && (!monthly || n(per) > 0);
  return (
    <Dialog open onOpenChange={(x) => !x && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto">
        <DialogHeader><DialogTitle>Взяла в долг или кредит</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Деньги сразу появятся на карте или в наличных, а возврат — в плане платежей.</p>
        <Input autoFocus inputMode="decimal" placeholder="Сколько получили, ₽" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <MethodToggle value={method} onChange={setMethod} />
        <Input placeholder="У кого: банк, мама, кредитка" value={from} onChange={(e) => setFrom(e.target.value)} />
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm">
          {[false, true].map((v) => (
            <button key={String(v)} type="button" onClick={() => setMonthly(v)} className={`rounded-lg py-2 ${monthly === v ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>{v ? "Каждый месяц" : "Вернуть разом"}</button>
          ))}
        </div>
        {monthly && <Input inputMode="decimal" placeholder="Платёж в месяц, ₽" value={per} onChange={(e) => setPer(e.target.value)} />}
        <label className="text-xs text-muted-foreground">{monthly ? "Дата первого платежа" : "Когда вернуть"}</label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button disabled={!ok} onClick={() => {
          const { t, ob } = borrow(n(amount), from.trim(), date, method, monthly ? n(per) : undefined);
          undoable(`+${rub(n(amount))}, возврат в плане`, () => { removeTx(t.id); setState((x) => ({ ...x, obligations: x.obligations.filter((o) => o.id !== ob.id) })); });
          onClose();
        }}>Записать</Button>
      </DialogContent>
    </Dialog>
  );
}

/** opens the same payment editor (with move / part flows) from the calendar or the 30-day strip */
export function PaymentEditFlow({ s, id, onClose }: { s: State; id: string; onClose: () => void }) {
  const o0 = s.obligations.find((o) => o.id === id) ?? s.obligations.find((o) => o.schedule && paymentObligations({ ...s, obligations: [o] }).some((p) => p.id === id));
  const [mode, setMode] = useState<"edit" | "move" | "part" | "schedule">(o0?.schedule ? "schedule" : "edit");
  if (!o0) return null;
  const o = o0;
  if (mode === "schedule") return <LoanScheduleEditor o={o} onClose={onClose} />;
  if (mode === "part") return <PartDialog o={o} left={o.amount - paidAmount(s, o, obligationDue(o))} onClose={onClose} />;
  if (mode === "move") return <DateDialog open title={`Новая дата: «${o.name}»`} initial={dayKey(obligationDue(o))} onClose={onClose} onSave={(d) => {
    const wasPaid = isPaid(s, o, obligationDue(o));
    moveObligation(o.id, d);
    if (wasPaid && confirm("Это новый платёж на новую дату? Отметить его неоплаченным?")) unpay(o);
  }} />;
  return <Editor o={o} onClose={onClose} onMove={() => setMode("move")} onPart={isPaid(s, o, obligationDue(o)) ? undefined : () => setMode("part")} />;
}
