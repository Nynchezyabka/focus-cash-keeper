import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlanEventEditor } from "@/routes/incomes";
import { dayKey, forecast, rub, type CalEvent, type State } from "@/lib/budget";

/** desktop-only 30-day strip: where payments fall between incomes */
export function MonthStrip({ s }: { s: State }) {
  const [open, setOpen] = useState<CalEvent | null>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const seen = new Set<string>();
  const byDay = new Map<string, CalEvent[]>();
  for (const seg of forecast(s, 30)) for (const e of [...seg.incomes, ...seg.events]) {
    const k = `${e.kind}:${e.refId}:${dayKey(e.date)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const d = dayKey(e.date);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  const days = Array.from({ length: 30 }, (_, i) => new Date(+today + i * 86400000));
  return (
    <section aria-label="Ближайшие 30 дней" className="mb-5 hidden rounded-2xl bg-card p-4 shadow-soft lg:block">
      <div className="mb-3 flex items-center justify-between text-sm">
        <h2 className="font-medium">Ближайшие 30 дней</h2>
        <span className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />доход</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-spend" />платёж</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-muted-foreground" />оплачено</span>
        </span>
      </div>
      <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-0.5">
        {days.map((d) => {
          const ev = byDay.get(dayKey(d)) ?? [];
          const inc = ev.filter((e) => e.kind === "income");
          const pay = ev.filter((e) => e.kind === "payment");
          const title = ev.map((e) => `${e.kind === "income" ? "+" : "−"}${rub(e.amount)} ${e.name}`).join("\n");
          const cls = `flex h-14 w-full flex-col items-center justify-between rounded-md py-1 text-[10px] ${inc.length ? "bg-primary/10" : ""} ${d.getDay() === 0 || d.getDay() === 6 ? "text-muted-foreground" : ""}`;
          const dots = (
            <>
              <span>{d.getDate()}</span>
              <span className="flex flex-col items-center gap-0.5">
                {inc.length > 0 && <span className="h-2 w-2 rounded-full bg-primary" />}
                {pay.length > 0 && <span className={`h-2 w-2 rounded-full ${pay.every((p) => p.paid) ? "border border-muted-foreground" : "bg-spend"}`} />}
              </span>
            </>
          );
          if (!ev.length) return <div key={+d} className={cls}>{dots}</div>;
          return (
            <Popover key={+d}>
              <PopoverTrigger asChild><button type="button" title={title} aria-label={d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} className={`${cls} hover:bg-secondary`}>{dots}</button></PopoverTrigger>
              <PopoverContent className="w-72 p-2">
                <p className="px-2 pb-1 text-xs text-muted-foreground">{d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" })}</p>
                <ul>
                  {ev.map((e) => (
                    <li key={e.kind + e.refId}><button type="button" onClick={() => setOpen(e)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary ${e.paid ? "opacity-60" : ""}`}>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${e.kind === "income" ? "bg-primary" : e.paid ? "border border-muted-foreground" : "bg-spend"}`} />
                      <span className="min-w-0 flex-1 truncate">{e.name}{e.paid ? " · оплачено" : ""}</span>
                      <span className={`tabular-nums ${e.kind === "income" ? "text-primary" : "text-spend"}`}>{e.kind === "income" ? "+" : "−"}{rub(e.amount)}</span>
                    </button></li>
                  ))}
                </ul>
                <p className="px-2 pt-1 text-[11px] text-muted-foreground">Нажмите, чтобы изменить</p>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
      <PlanEventEditor s={s} e={open} onClose={() => setOpen(null)} />
    </section>
  );
}
