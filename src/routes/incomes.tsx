import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2 } from "lucide-react";
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
      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <p className="text-xs text-muted-foreground">Ближайшее поступление</p>
        <p className="mt-1 font-display text-xl">{next.date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}{next.income ? ` · ${next.income.name}` : ""}</p>
        <p className="mt-1 text-xs text-muted-foreground">До этого дня приложение делит деньги на дни. Пришла выплата — считаем до следующей.</p>
      </div>
      {s.incomes.length > 0 && <h2 className="font-display text-lg">Мои выплаты по числам</h2>}
      <ul className="space-y-2">
        {[...s.incomes].sort((a, b) => a.day - b.day).map((i) => {
          const isNext = next.income?.id === i.id;
          return (
          <li key={i.id} className={`flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft ${isNext ? "ring-2 ring-primary" : ""}`}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary font-display text-lg tabular-nums text-secondary-foreground">{i.day}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{i.name}</p>
              <p className="text-xs text-muted-foreground">{i.period === "biweekly" ? `${i.day}-го и через 2 недели` : `каждый месяц, ${i.day}-го`}{isNext ? " · следующая" : ""}</p>
            </div>
            <span className="text-sm tabular-nums">{rub(i.amount)}</span>
            <button aria-label="Удалить" className="text-muted-foreground" onClick={() => {
              setState((x) => ({ ...x, incomes: x.incomes.filter((y) => y.id !== i.id) }));
              undoable("Выплата удалена", () => setState((x) => ({ ...x, incomes: [...x.incomes, i] })));
            }}><Trash2 className="h-4 w-4" /></button>
          </li>
        );})}
      </ul>
      {s.incomes.length === 0 && <p className="text-sm text-muted-foreground">Добавьте все регулярные поступления: зарплату, аванс, наличные, пособия — каждое отдельной строкой со своим числом.</p>}
      <form className="space-y-2 rounded-2xl bg-secondary p-4" onSubmit={(e) => {
        e.preventDefault();
        const a = Number(amount), d = Number(day);
        if (!name || !a || d < 1 || d > 31) return;
        const id = uid();
        // don't ask about occurrences before today
        setState((x) => ({ ...x, incomes: [...x.incomes, { id, name, amount: a, day: d, period }], incomeAck: { ...x.incomeAck, [id]: dayKey(new Date()) } }));
        setName(""); setAmount(""); setDay("");
      }}>
        <p className="text-sm font-medium text-secondary-foreground">Добавить выплату</p>
        <Input placeholder="Например: Аванс на карту, Наличные, Пособие" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <Input inputMode="decimal" placeholder="Сумма, ₽" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input inputMode="numeric" placeholder="Какого числа (1–31)" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value as Income["period"])} className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm">
          <option value="monthly">Раз в месяц</option>
          <option value="biweekly">Каждые 2 недели</option>
        </select>
        <Button type="submit" className="w-full">Добавить выплату</Button>
      </form>
      <p className="text-xs text-muted-foreground">Наличные, которые хотите отложить, можно сразу перевести в подушку. Разовые деньги (подработка, подарок) — кнопка «Доход» на главном экране.</p>
    </div>
  );
}
