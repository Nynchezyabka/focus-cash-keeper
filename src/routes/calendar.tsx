import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, List, CalendarDays } from "lucide-react";
import { Shell, meta } from "@/components/Shell";
import { PlanTabs } from "@/components/PlanTabs";
import { MethodBadge } from "@/components/Pickers";
import { calc, dayKey, forecast, rub, type CalEvent, type State } from "@/lib/budget";

export const Route = createFileRoute("/calendar")({
  head: () => meta("План на 45 дней — Бережный бюджет", "Когда приходят деньги, когда уходят платежи и сколько будет свободно в день — на 30, 45 или 60 дней вперёд."),
  component: () => <Shell title="План">{(s) => <><PlanTabs /><Calendar s={s} /></>}</Shell>,
});

const H_KEY = "berezhny-plan-horizon";
const V_KEY = "berezhny-plan-view";
const HORIZONS = [30, 45, 60] as const;
const dm = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });

function Calendar({ s }: { s: State }) {
  const [horizon, setHorizon] = useState(45);
  const [view, setView] = useState<"list" | "grid">("list");
  useEffect(() => {
    const h = Number(localStorage.getItem(H_KEY));
    if (HORIZONS.includes(h as 30)) setHorizon(h);
    if (localStorage.getItem(V_KEY) === "grid") setView("grid");
  }, []);
  const pickH = (h: number) => { setHorizon(h); localStorage.setItem(H_KEY, String(h)); };
  const pickV = (v: "list" | "grid") => { setView(v); localStorage.setItem(V_KEY, v); };

  if (!s.incomes.length && !s.obligations.length) return <EmptyPlan />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg">План на {horizon} дней</h2>
        <div className="flex rounded-full bg-secondary p-1">
          <button aria-label="Списком" onClick={() => pickV("list")} className={`grid h-9 w-9 place-items-center rounded-full ${view === "list" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}><List className="h-4 w-4" /></button>
          <button aria-label="Календарём" onClick={() => pickV("grid")} className={`grid h-9 w-9 place-items-center rounded-full ${view === "grid" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}><CalendarDays className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="flex gap-2">
        {HORIZONS.map((h) => (
          <button key={h} onClick={() => pickH(h)} className={`rounded-full px-3 py-1.5 text-sm ${h === horizon ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{h} дней</button>
        ))}
      </div>
      {view === "grid" ? <Grid s={s} horizon={horizon} /> : <Segments s={s} horizon={horizon} />}
    </div>
  );
}

function EmptyPlan() {
  const steps = [
    { to: "/incomes" as const, n: 1, title: "Когда приходят деньги", text: "Аванс, зарплата, пособие — сумма и число месяца.", btn: "Добавить доход", Icon: ArrowDownLeft, tone: "bg-primary/15 text-primary" },
    { to: "/payments" as const, n: 2, title: "Что нужно оплатить", text: "Кредит, ЖКУ, связь — приложение заранее отложит на них.", btn: "Добавить платёж", Icon: ArrowUpRight, tone: "bg-accent text-accent-foreground" },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="font-display text-lg">Здесь будет ваш план</h2>
        <p className="mt-1 text-sm text-muted-foreground">Два шага — и вы увидите, сколько можно тратить в день до каждой выплаты.</p>
      </div>
      {steps.map(({ to, n, title, text, btn, Icon, tone }) => (
        <Link key={to} to={to} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tone}`}><Icon className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm">{n}. {title}</span>
            <span className="block text-xs text-muted-foreground">{text}</span>
          </span>
          <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground">{btn}</span>
        </Link>
      ))}
      <section className="rounded-2xl border border-dashed border-border p-4" aria-label="Пример плана">
        <p className="mb-3 text-xs text-muted-foreground">Так это будет выглядеть</p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-primary"><ArrowDownLeft className="h-4 w-4" /></span><span className="flex-1">Зарплата · 25-е</span><span className="tabular-nums text-primary">+40 000 ₽</span></li>
          <li className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground"><ArrowUpRight className="h-4 w-4" /></span><span className="flex-1">Кредит · 28-е</span><span className="tabular-nums">−12 000 ₽</span></li>
        </ul>
        <p className="mt-3 rounded-xl bg-secondary p-2.5 text-xs text-secondary-foreground">
          Платёж отложится заранее, а остаток разделится на дни до следующей выплаты: <span className="tabular-nums">≈ 1 900 ₽ в день</span>.
        </p>
      </section>
    </div>
  );
}

function Row({ e, today }: { e: CalEvent; today: string }) {
  const inc = e.kind === "income";
  return (
    <li className={`flex items-center gap-3 text-sm ${e.paid ? "opacity-50" : ""}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${inc ? "bg-primary/15 text-primary" : "bg-accent text-accent-foreground"}`}>
        {inc ? <ArrowDownLeft className="h-4 w-4" /> : e.paid ? <Check className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5"><span className="truncate">{e.name}</span>{inc && <MethodBadge m={e.method} />}</span>
        <span className="text-xs text-muted-foreground">{dayKey(e.date) === today ? "сегодня" : dm(e.date)}{e.paid ? " · оплачено" : ""}</span>
      </span>
      <span className={`shrink-0 tabular-nums ${inc ? "text-primary" : ""}`}>{inc ? "+" : "−"}{rub(e.amount)}</span>
    </li>
  );
}

function Segments({ s, horizon }: { s: State; horizon: number }) {
  const c = calc(s);
  const segs = forecast(s, horizon);
  const todayK = dayKey(new Date());
  return (
    <>
      {segs.map((g, i) => {
        const perDay = i === 0 ? c.dailyNorm : g.perDay;
        return (
          <section key={dayKey(g.start)} className="rounded-2xl bg-card p-4 shadow-soft">
            {g.incomes.length > 0 && <ul className="mb-3 space-y-2">{g.incomes.map((e) => <Row key={e.refId + dayKey(e.date)} e={e} today={todayK} />)}</ul>}
            <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
              <p className="text-xs text-muted-foreground">
                {i === 0 ? "Сейчас" : "С " + g.start.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} · {g.days} дн.
              </p>
              {g.open && i > 0 ? (
                <p className="text-right text-xs text-muted-foreground">дальше выплат пока нет</p>
              ) : (
                <p className="text-sm"><span className="font-display text-lg tabular-nums">{rub(perDay)}</span><span className="text-muted-foreground"> в день</span></p>
              )}
            </div>
            {g.events.length === 0 ? (
              <p className="pt-2 text-xs text-muted-foreground">Платежей нет</p>
            ) : (
              <ul className="space-y-2 pt-2">{g.events.map((e) => <Row key={e.refId + dayKey(e.date)} e={e} today={todayK} />)}</ul>
            )}
            {g.gap > 0 && (
              <p className="mt-3 rounded-xl bg-accent p-2.5 text-xs text-accent-foreground">
                Не хватает {rub(g.gap)}. Можно заранее перенести платёж во вкладке <Link to="/payments" className="underline">Платежи</Link>.
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function Grid({ s, horizon }: { s: State; horizon: number }) {
  const c = calc(s);
  const segs = forecast(s, horizon);
  const todayK = dayKey(new Date());
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [sel, setSel] = useState(todayK);
  const byDay = new Map<string, CalEvent[]>();
  for (const g of segs) for (const e of [...g.incomes, ...g.events]) { const k = dayKey(e.date); byDay.set(k, [...(byDay.get(k) ?? []), e]); }
  const perDayOf = (d: Date) => {
    const i = segs.findIndex((g) => +d >= +g.start && +d < +g.end);
    const g = segs[i];
    if (!g || (g.open && i > 0)) return null;
    return i === 0 ? c.dailyNorm : g.perDay;
  };
  const days: (Date | null)[] = Array((today.getDay() + 6) % 7).fill(null);
  for (let i = 0; i < horizon; i++) days.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
  const selDate = days.find((d) => d && dayKey(d) === sel) ?? today;
  const selEv = byDay.get(sel) ?? [];
  const pd = perDayOf(selDate);
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card p-3 shadow-soft">
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] text-muted-foreground">{WD.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <span key={"e" + i} />;
            const k = dayKey(d);
            const ev = byDay.get(k) ?? [];
            const hasInc = ev.some((e) => e.kind === "income");
            const hasPay = ev.some((e) => e.kind === "payment" && !e.paid);
            const first = d.getDate() === 1 || i === days.findIndex(Boolean);
            return (
              <button key={k} onClick={() => setSel(k)} className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm tabular-nums ${k === sel ? "bg-primary text-primary-foreground" : hasInc ? "bg-primary/10" : ""} ${k === todayK && k !== sel ? "ring-1 ring-primary" : ""}`}>
                <span className="leading-none">{d.getDate()}</span>
                {first && <span className="text-[9px] leading-none opacity-70">{d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "")}</span>}
                <span className="mt-1 flex h-1.5 gap-0.5">
                  {hasInc && <span className={`h-1.5 w-1.5 rounded-full ${k === sel ? "bg-primary-foreground" : "bg-primary"}`} />}
                  {hasPay && <span className={`h-1.5 w-1.5 rounded-full ${k === sel ? "bg-primary-foreground" : "bg-accent-foreground"}`} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> доход</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-accent-foreground" /> платёж</span>
        </div>
      </div>
      <section className="rounded-2xl bg-card p-4 shadow-soft">
        <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
          <p className="text-sm">{sel === todayK ? "Сегодня" : dm(selDate)}</p>
          {pd !== null && <p className="text-sm"><span className="font-display text-lg tabular-nums">{rub(pd)}</span><span className="text-muted-foreground"> в день</span></p>}
        </div>
        {selEv.length ? <ul className="space-y-2 pt-2">{selEv.map((e) => <Row key={e.refId} e={e} today={todayK} />)}</ul> : <p className="pt-2 text-xs text-muted-foreground">В этот день ничего не приходит и не списывается</p>}
      </section>
    </div>
  );
}
