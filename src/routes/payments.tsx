import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, CalendarClock, HandCoins, RotateCcw, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Shell, CatIcon, meta } from "@/components/Shell";
import { addedToast, undoable } from "@/components/Undo";
import { CategoryPicker, DateDialog, MethodBadge, MethodToggle } from "@/components/Pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calc, cat, catColor, dayKey, isPaid, paidAmount, payPart, unpay, restoreTx, borrow, removeTx, moveObligation, obligationDue, payObligation, rub, setState, uid, type Method, type Obligation, type State } from "@/lib/budget";

export const Route = createFileRoute("/payments")({
  head: () => meta("План платежей — Бережный бюджет", "Регулярные и разовые платежи, долги к возврату. Эти деньги откладываются заранее."),
  component: () => <Shell title="План платежей">{(s) => <Payments s={s} />}</Shell>,
});

function Payments({ s }: { s: State }) {
  const c = calc(s);
  const [edit, setEdit] = useState<Obligation | null>(null);
  const [moving, setMoving] = useState<Obligation | null>(null);
  const [part, setPart] = useState<Obligation | null>(null);
  const [loan, setLoan] = useState(false);
  const list = [...s.obligations].map((o) => ({ o, due: obligationDue(o) })).sort((a, b) => +a.due - +b.due);
  const fmt = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Что и когда нужно оплатить: каждый месяц или один раз. Эти деньги заранее откладываются и не входят в «Сегодня свободно».</p>
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> До дохода отложено {rub(c.reserve)}</p>
      <ul className="space-y-2">
        {list.map(({ o, due }) => {
          const paid = isPaid(s, o, due);
          const done = paidAmount(s, o, due);
          const reserved = c.reserved.some((r) => r.o.id === o.id);
          const k = cat(o.category);
          return (
            <li key={o.id} className={`rounded-2xl bg-card p-4 shadow-soft ${paid ? "opacity-60" : ""}`}>
              <button className="flex w-full items-center gap-3 text-left" onClick={() => setEdit(o)}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: catColor(k) }}><CatIcon name={k.icon} className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="truncate text-sm">{o.name}</span><MethodBadge m={o.method} /></span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {o.once ? `Один раз, ${fmt(due)}` : `Каждый месяц, ${o.day}-го`}{o.nextOn ? ` · перенесён на ${fmt(due)}` : ""}{paid ? " · оплачено" : reserved ? " · отложено" : ""}
                  </span>
                </span>
                <span className="text-sm tabular-nums">{rub(o.amount)}</span>
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </button>
              {!paid && done > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Внесено {rub(done)} из {rub(o.amount)}, осталось {rub(o.amount - done)}</p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (done / o.amount) * 100)}%` }} /></div>
                </div>
              )}
              {!paid && (
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-3">
                  <Button size="sm" variant="ghost" className="px-2" onClick={() => setMoving(o)}><CalendarClock /> Перенести</Button>
                  <Button size="sm" variant="ghost" className="px-2" onClick={() => setPart(o)}>Часть</Button>
                  <Button size="sm" variant="secondary" onClick={() => { const rest = o.amount - done; addedToast(done > 0 ? payPart(o, rest) : payObligation(o), `${o.name} оплачено`); }}><Check /> Оплачено</Button>
                </div>
              )}
              {paid && (
                <div className="mt-3 flex justify-end border-t border-border pt-3">
                  <Button size="sm" variant="ghost" onClick={() => { const list = unpay(o); undoable(`«${o.name}» снова ждёт оплаты`, () => list.forEach(restoreTx)); }}><RotateCcw /> Отменить оплату</Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">Например: аренда 5-го, интернет 12-го, рассрочка 20-го. Или разовый: «Подарок маме, 3 ноября».</p>}
      <Button variant="secondary" className="h-12 w-full rounded-2xl" onClick={() => setLoan(true)}><HandCoins /> Взяла в долг или кредит</Button>
      {loan && <LoanDialog onClose={() => setLoan(false)} />}
      <Button className="h-12 w-full rounded-2xl" onClick={() => setEdit({ id: "", name: "", amount: 0, day: 0, category: "home" })}><Plus /> Добавить платёж</Button>

      <DateDialog open={!!moving} title={`Новая дата: «${moving?.name ?? ""}»`} initial={moving ? dayKey(obligationDue(moving)) : ""} onClose={() => setMoving(null)} onSave={(d) => {
        if (!moving) return;
        const wasPaid = isPaid(s, moving, obligationDue(moving));
        moveObligation(moving.id, d);
        if (wasPaid && confirm("Это новый платёж на новую дату? Отметить его неоплаченным?")) unpay(moving);
      }} />
      {part && <PartDialog o={part} left={part.amount - paidAmount(s, part, obligationDue(part))} onClose={() => setPart(null)} />}
      {edit && <Editor o={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function Editor({ o, onClose }: { o: Obligation; onClose: () => void }) {
  const isNew = !o.id;
  const [name, setName] = useState(o.name);
  const [amount, setAmount] = useState(o.amount ? String(o.amount) : "");
  const [once, setOnce] = useState(!!o.once);
  const [day, setDay] = useState(o.day ? String(o.day) : "");
  const [date, setDate] = useState(o.once ?? "");
  const [category, setCategory] = useState(o.category);
  const [method, setMethod] = useState<Method>(o.method ?? "card");
  const a = Number(amount.replace(/\s/g, "").replace(",", ".")), d = Number(day);
  const valid = name.trim() && a > 0 && (once ? !!date : d >= 1 && d <= 31);
  return (
    <Dialog open onOpenChange={(x) => !x && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto">
        <DialogHeader><DialogTitle>{isNew ? "Новый платёж" : "Изменить платёж"}</DialogTitle></DialogHeader>
        <Input autoFocus placeholder="Название (аренда, рассрочка)" value={name} onChange={(e) => setName(e.target.value)} />
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
              day: once ? Number(date.slice(8, 10)) : d, ...(once ? { once: date } : {}), ...(!once && o.nextOn ? { nextOn: o.nextOn } : {}),
            };
            setState((x) => ({ ...x, obligations: isNew ? [...x.obligations, item] : x.obligations.map((y) => (y.id === o.id ? item : y)) }));
            onClose();
          }}>Сохранить</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PartDialog({ o, left, onClose }: { o: Obligation; left: number; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>(o.method ?? "card");
  const a = Number(amount.replace(/\s/g, "").replace(",", "."));
  return (
    <Dialog open onOpenChange={(x) => !x && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Внести часть: «{o.name}»</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Осталось {rub(left)}. Остаток так и будет отложен до даты платежа.</p>
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
