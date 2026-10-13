import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2, Wallet } from "lucide-react";
import { Shell, meta } from "@/components/Shell";
import { undoable } from "@/components/Undo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dayKey, nextIncome, rub, setState, uid, type Income, type State } from "@/lib/budget";

export const Route = createFileRoute("/incomes")({
  head: () => meta("Доходы — Бережный бюджет", "Зарплата и аванс задают цикл; разовые доходы сразу увеличивают дневную норму."),
  component: () => <Shell title="Доходы">{(s) => <Incomes s={s} />}</Shell>,
});

function Incomes({ s }: { s: State }) {
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [day, setDay] = useState(""); const [period, setPeriod] = useState<Income["period"]>("monthly");
  const next = nextIncome(s);
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Следующий доход: {next.date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}{next.income ? ` — ${next.income.name}` : s.nextIncomeOverride ? " (сдвинуто вручную)" : ""}</p>
      <ul className="space-y-2">
        {s.incomes.map((i) => (
          <li key={i.id} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm">{i.name}</p>
              <p className="text-xs text-muted-foreground">{i.day}-го числа{i.period === "biweekly" ? " и через 2 недели" : " каждый месяц"}</p>
            </div>
            <span className="text-sm tabular-nums">{rub(i.amount)}</span>
            <button aria-label="Удалить" className="text-muted-foreground" onClick={() => {
              setState((x) => ({ ...x, incomes: x.incomes.filter((y) => y.id !== i.id) }));
              undoable("Доход удалён", () => setState((x) => ({ ...x, incomes: [...x.incomes, i] })));
            }}><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
      <form className="space-y-2 rounded-2xl bg-secondary p-4" onSubmit={(e) => {
        e.preventDefault();
        const a = Number(amount), d = Number(day);
        if (!name || !a || d < 1 || d > 31) return;
        const id = uid();
        // don't ask about occurrences before today
        setState((x) => ({ ...x, incomes: [...x.incomes, { id, name, amount: a, day: d, period }], incomeAck: { ...x.incomeAck, [id]: dayKey(new Date()) } }));
        setName(""); setAmount(""); setDay("");
      }}>
        <p className="text-sm text-secondary-foreground">Регулярный доход</p>
        <Input placeholder="Зарплата, аванс…" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <Input inputMode="decimal" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input inputMode="numeric" placeholder="Число месяца" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value as Income["period"])} className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm">
          <option value="monthly">Раз в месяц</option>
          <option value="biweekly">Каждые 2 недели</option>
        </select>
        <Button type="submit" className="w-full">Добавить</Button>
      </form>
      <p className="text-xs text-muted-foreground">Разовый доход (Авито, подработка, подарок) — кнопка «Доход» на главном экране.</p>
    </div>
  );
}
