import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Trash2, Lock } from "lucide-react";
import { Shell, CatIcon, meta } from "@/components/Shell";
import { addedToast, undoable } from "@/components/Undo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTx, calc, cat, CATEGORIES, isPaid, obligationDue, rub, setState, uid, type State } from "@/lib/budget";

export const Route = createFileRoute("/payments")({
  head: () => meta("Обязательные платежи — Бережный бюджет", "Аренда, ЖКУ, подписки и рассрочки бронируются заранее, чтобы их случайно не потратить."),
  component: () => <Shell title="Обязательные платежи">{(s) => <Payments s={s} />}</Shell>,
});

function Payments({ s }: { s: State }) {
  const c = calc(s);
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [day, setDay] = useState(""); const [category, setCategory] = useState("home");
  const list = [...s.obligations].map((o) => ({ o, due: obligationDue(o) })).sort((a, b) => +a.due - +b.due);
  return (
    <div className="space-y-5">
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> До дохода забронировано {rub(c.reserve)}</p>
      <ul className="space-y-2">
        {list.map(({ o, due }) => {
          const paid = isPaid(s, o, due);
          const reserved = c.reserved.some((r) => r.o.id === o.id);
          return (
            <li key={o.id} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
              <CatIcon name={cat(o.category).icon} className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-foreground">{o.name}</p>
                <p className="text-xs text-muted-foreground">{due.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}{paid ? " · оплачено" : reserved ? " · забронировано" : ""}</p>
              </div>
              <span className="text-sm tabular-nums">{rub(o.amount)}</span>
              {!paid && (
                <Button size="icon" variant="secondary" aria-label="Оплачено" onClick={() => addedToast(addTx({ kind: "expense", amount: o.amount, category: o.category, note: o.name, obligationId: o.id, period: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}` }), `${o.name} оплачено`)}>
                  <Check className="h-4 w-4" />
                </Button>
              )}
              <button aria-label="Удалить" className="text-muted-foreground" onClick={() => {
                setState((x) => ({ ...x, obligations: x.obligations.filter((y) => y.id !== o.id) }));
                undoable("Платёж удалён", () => setState((x) => ({ ...x, obligations: [...x.obligations, o] })));
              }}><Trash2 className="h-4 w-4" /></button>
            </li>
          );
        })}
      </ul>
      <form className="space-y-2 rounded-2xl bg-secondary p-4" onSubmit={(e) => {
        e.preventDefault();
        const a = Number(amount), d = Number(day);
        if (!name || !a || d < 1 || d > 31) return;
        setState((x) => ({ ...x, obligations: [...x.obligations, { id: uid(), name, amount: a, day: d, category }] }));
        setName(""); setAmount(""); setDay("");
      }}>
        <p className="text-sm text-secondary-foreground">Добавить платёж</p>
        <Input placeholder="Название (аренда, рассрочка за телефон)" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <Input inputMode="decimal" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input inputMode="numeric" placeholder="Число месяца" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm">
          {CATEGORIES.filter((x) => x.group !== "life").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <Button type="submit" className="w-full">Добавить</Button>
      </form>
    </div>
  );
}
