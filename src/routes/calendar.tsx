import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Shell, meta } from "@/components/Shell";
import { PlanTabs } from "@/components/PlanTabs";
import { MethodBadge } from "@/components/Pickers";
import { calc, dayKey, forecast, rub, type CalEvent, type State } from "@/lib/budget";

export const Route = createFileRoute("/calendar")({
  head: () => meta("План на 45 дней — Бережный бюджет", "Когда приходят деньги, когда уходят платежи и сколько будет свободно в день — на 30, 45 или 60 дней вперёд."),
  component: () => <Shell title="План" wide>{(s) => <><PlanTabs /><Calendar s={s} /></>}</Shell>,
});

const H_KEY = "berezhny-plan-horizon";
const V_KEY = "berezhny-plan-view";
const HORIZONS = [30, 45, 60] as const;
const dm = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });

function Calendar({ s }: { s: State }) {
  const [horizon, setHorizon] = useState(45);
  const [view, setView] = useState<"list" | "grid">("grid");
  useEffect(() => {
    const h = Number(localStorage.getItem(H_KEY));
    if (HORIZONS.includes(h as 30)) setHorizon(h);
    if (localStorage.getItem(V_KEY) === "list") setView("list");
  }, []);
  const pickH = (h: number) => { setHorizon(h); localStorage.setItem(H_KEY, String(h)); };
  const pickV = (v: "list" | "grid") => { setView(v); localStorage.setItem(V_KEY, v); };

  if (!s.incomes.length && !s.obligations.length) return <EmptyPlan />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1 text-sm" role="tablist" aria-label="Вид плана">
        {([["grid", "Календарь"], ["list", "По выплатам"]] as const).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => pickV(v)} className={`rounded-full py-2 ${view === v ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>{label}</button>
        ))}
      </div>
      {view === "list" && (
        <label className="flex items-center gap-1 font-display text-lg">План на
          <select aria-label="Горизонт плана" value={horizon} onChange={(e) => pickH(Number(e.target.value))} className="rounded-lg bg-secondary px-1.5 py-0.5 font-display text-lg">
            {HORIZONS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select> дней</label>
      )}
      {view === "grid" ? <Grid s={s} /> : <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0"><Segments s={s} horizon={horizon} /></div>}
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
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${inc ? "bg-primary/15 text-primary" : "bg-spend-soft text-spend"}`}>
        {inc ? <ArrowDownLeft className="h-4 w-4" /> : e.paid ? <Check className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5"><span className="truncate">{e.name}</span>{inc && <MethodBadge m={e.method} />}</span>
        <span className="text-xs text-muted-foreground">{dayKey(e.date) === today ? "сегодня" : dm(e.date)}{e.paid ? " · оплачено" : ""}</span>
      </span>
      <span className={`shrink-0 tabular-nums ${inc ? "text-primary" : "text-spend"}`}>{inc ? "+" : "−"}{rub(e.amount)}</span>
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
                На платежи не хватает {rub(g.gap)}. Можно заранее перенести платёж во вкладке <Link to="/payments" className="underline">Платежи</Link>.
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const n = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array((first.getDay() + 6) % 7).fill(null);
  for (let d = 1; d <= n; d++) cells.push(new Date(year, month, d));
  return cells;
}

const MAX_AHEAD = 2;

function Grid({ s }: { s: State }) {
  const c = calc(s);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayK = dayKey(today);
  const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState(todayK);
  const ym = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const lastOfMonth = new Date(ym.getFullYear(), ym.getMonth() + 1, 0);
  const horizon = Math.max(31, Math.round((+lastOfMonth - +today) / 86400000) + 2);
  const segs = forecast(s, horizon);
  const byDay = new Map<string, CalEvent[]>();
  for (const g of segs) for (const e of [...g.incomes, ...g.events]) { const k = dayKey(e.date); byDay.set(k, [...(byDay.get(k) ?? []), e]); }
  const perDayOf = (d: Date) => {
    const i = segs.findIndex((g) => +d >= +g.start && +d < +g.end);
    const g = segs[i];
    if (!g || (g.open && i > 0)) return null;
    return i === 0 ? c.dailyNorm : g.perDay;
  };
  const days = monthCells(ym.getFullYear(), ym.getMonth());
  const selDate = days.find((d) => d && dayKey(d) === sel) ?? today;
  const selEv = byDay.get(sel) ?? [];
  const pd = selDate < today ? null : perDayOf(selDate);
  const go = (n: number) => {
    const o = offset + n;
    setOffset(o);
    setSel(o === 0 ? todayK : dayKey(new Date(today.getFullYear(), today.getMonth() + o, 1)));
  };
  const title = ym.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }).replace(" г.", "");
  return (
    <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-4 lg:space-y-0">
      <div className="rounded-2xl bg-card p-3 shadow-soft">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button aria-label="Предыдущий месяц" disabled={offset <= 0} onClick={() => go(-1)} className="grid h-11 w-11 place-items-center rounded-full text-foreground disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg capitalize">{title}</h2>
            {offset !== 0 && <button onClick={() => go(-offset)} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">Сегодня</button>}
          </div>
          <button aria-label="Следующий месяц" disabled={offset >= MAX_AHEAD} onClick={() => go(1)} className="grid h-11 w-11 place-items-center rounded-full text-foreground disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] text-muted-foreground">{WD.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <span key={"e" + i} />;
            const k = dayKey(d);
            const past = d < today;
            const ev = byDay.get(k) ?? [];
            const hasInc = ev.some((e) => e.kind === "income");
            const hasPay = ev.some((e) => e.kind === "payment" && !e.paid);
            const hasPaid = ev.some((e) => e.kind === "payment" && e.paid);
            const isSel = k === sel;
            return (
              <button key={k} onClick={() => setSel(k)} aria-label={dm(d)} className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm tabular-nums ${isSel ? "bg-primary text-primary-foreground" : hasInc ? "bg-primary/10" : ""} ${k === todayK && !isSel ? "ring-1 ring-primary" : ""} ${past && !isSel ? "text-muted-foreground opacity-60" : ""}`}>
                <span className="leading-none">{d.getDate()}</span>
                <span className="mt-1 flex h-1.5 gap-0.5">
                  {hasInc && <span className={`h-1.5 w-1.5 rounded-full ${isSel ? "bg-primary-foreground" : "bg-primary"}`} />}
                  {hasPay && <span className={`h-1.5 w-1.5 rounded-full ${isSel ? "bg-primary-foreground" : "bg-spend"}`} />}
                  {hasPaid && !hasPay && <span className={`h-1.5 w-1.5 rounded-full ${isSel ? "bg-primary-foreground/60" : "bg-muted-foreground/50"}`} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> доход</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-spend" /> платёж</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" /> оплачено</span>
        </div>
      </div>
      <section className="rounded-2xl bg-card p-4 shadow-soft lg:sticky lg:top-4">
        <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
          <p className="text-sm">{sel === todayK ? "Сегодня" : dm(selDate)}</p>
          {pd !== null && <p className="text-sm"><span className="font-display text-lg tabular-nums">{rub(pd)}</span><span className="text-muted-foreground"> в день</span></p>}
        </div>
        {selDate < today
          ? <p className="pt-2 text-xs text-muted-foreground">Этот день уже прошёл. Траты за него — в истории операций на главной.</p>
          : selEv.length ? <ul className="space-y-2 pt-2">{selEv.map((e) => <Row key={e.refId + e.kind} e={e} today={todayK} />)}</ul> : <p className="pt-2 text-xs text-muted-foreground">Платежей и поступлений в этот день нет</p>}
      </section>
    </div>
  );
}
