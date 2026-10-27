import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Check } from "lucide-react";
import { Shell, meta } from "@/components/Shell";
import { MethodBadge } from "@/components/Pickers";
import { calc, dayKey, forecast, rub, type State } from "@/lib/budget";

export const Route = createFileRoute("/calendar")({
  head: () => meta("Календарь денег — Бережный бюджет", "Цепочка «выплата → платежи → выплата» на 45 дней вперёд и сколько будет свободно в день на каждом отрезке."),
  component: () => <Shell title="Календарь денег">{(s) => <Calendar s={s} />}</Shell>,
});

const dm = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });

function Calendar({ s }: { s: State }) {
  const c = calc(s);
  const segs = forecast(s);
  const todayK = dayKey(new Date());
  if (!s.incomes.length && !s.obligations.length)
    return (
      <p className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
        Пока пусто. Добавьте выплаты в <Link to="/incomes" className="underline">План доходов</Link> и счета в{" "}
        <Link to="/payments" className="underline">План платежей</Link> — здесь появится цепочка на 45 дней.
      </p>
    );
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        45 дней вперёд: когда приходят деньги, когда уходят платежи и сколько будет свободно в день. Прогноз считает, что свободные деньги
        каждого отрезка тратятся до конца — так безопаснее.
      </p>
      {segs.map((g, i) => {
        const perDay = i === 0 ? c.dailyNorm : g.perDay;
        return (
          <section key={dayKey(g.start)} className="rounded-2xl bg-card p-4 shadow-soft">
            {g.incomes.length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {g.incomes.map((e) => (
                  <li key={e.refId + dayKey(e.date)} className="flex items-center gap-2 text-sm">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-primary"><ArrowDownLeft className="h-4 w-4" /></span>
                    <span className="flex-1"><span className="block">{e.name} <MethodBadge m={e.method} /></span><span className="text-xs text-muted-foreground">{dm(e.date)}</span></span>
                    <span className="tabular-nums text-primary">+{rub(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
              <p className="text-xs text-muted-foreground">
                {i === 0 ? "Сейчас" : "С " + g.start.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} · {g.days} дн.
              </p>
              {g.open && i > 0 ? (
                <p className="text-xs text-muted-foreground">дальше — когда появятся следующие выплаты</p>
              ) : <p className="text-sm">
                <span className="font-display text-lg tabular-nums">{rub(perDay)}</span>
                <span className="text-muted-foreground"> в день</span>
              </p>}
            </div>
            {g.events.length === 0 ? (
              <p className="pt-2 text-xs text-muted-foreground">Платежей на этом отрезке нет</p>
            ) : (
              <ul className="space-y-1.5 pt-2">
                {g.events.map((e) => (
                  <li key={e.refId + dayKey(e.date)} className={`flex items-center gap-2 text-sm ${e.paid ? "opacity-50" : ""}`}>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground">
                      {e.paid ? <Check className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{e.name}</span>
                      <span className="text-xs text-muted-foreground">{dayKey(e.date) === todayK ? "сегодня" : dm(e.date)}{e.paid ? " · оплачено" : ""}</span>
                    </span>
                    <span className="tabular-nums">−{rub(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            {g.gap > 0 && (
              <p className="mt-3 rounded-xl bg-accent p-2.5 text-xs text-accent-foreground">
                На платежи этого отрезка не хватает {rub(g.gap)}. Можно заранее перенести платёж в{" "}
                <Link to="/payments" className="underline">Плане платежей</Link>.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
