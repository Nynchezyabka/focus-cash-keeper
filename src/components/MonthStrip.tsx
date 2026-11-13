import { dayKey, forecast, rub, type CalEvent, type State } from "@/lib/budget";

/** desktop-only 30-day strip: where payments fall between incomes */
export function MonthStrip({ s }: { s: State }) {
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
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground" />платёж</span>
        </span>
      </div>
      <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-0.5">
        {days.map((d) => {
          const ev = byDay.get(dayKey(d)) ?? [];
          const inc = ev.filter((e) => e.kind === "income");
          const pay = ev.filter((e) => e.kind === "payment");
          const title = ev.map((e) => `${e.kind === "income" ? "+" : "−"}${rub(e.amount)} ${e.name}`).join("\n");
          return (
            <div key={+d} title={title || undefined} className={`flex h-14 flex-col items-center justify-between rounded-md py-1 text-[10px] ${inc.length ? "bg-secondary" : ""} ${d.getDay() === 0 || d.getDay() === 6 ? "text-muted-foreground" : ""}`}>
              <span>{d.getDate()}</span>
              <span className="flex flex-col items-center gap-0.5">
                {inc.length > 0 && <span className="h-2 w-2 rounded-full bg-primary" />}
                {pay.length > 0 && <span className={`h-2 w-2 rounded-full ${pay.every((p) => p.paid) ? "border border-muted-foreground" : "bg-muted-foreground"}`} />}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
