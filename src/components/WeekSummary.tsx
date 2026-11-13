import { GROUPS, rub, type Group, type State } from "@/lib/budget";
import { weekSummary } from "@/lib/advisor-calc";

/** Facts of the last 7 days, calculated on the phone — works offline and without AI. */
export function WeekSummary({ s }: { s: State }) {
  const w = weekSummary(s);
  if (!w.count && !w.upcoming.length) return null;
  const groups = (Object.keys(GROUPS) as Group[]).filter((g) => w.groups[g]);
  return (
    <section className="space-y-2 rounded-2xl bg-card p-4 text-sm shadow-soft">
      <h2 className="text-sm text-muted-foreground">За 7 дней</h2>
      {groups.length ? (
        <ul className="space-y-1">
          {groups.map((g) => <li key={g} className="flex justify-between"><span>{GROUPS[g]}</span><span className="tabular-nums">{rub(w.groups[g]!)}</span></li>)}
        </ul>
      ) : <p className="text-muted-foreground">Трат не записано</p>}
      {w.income > 0 && <p className="flex justify-between"><span>Доходы</span><span className="tabular-nums text-primary">+{rub(w.income)}</span></p>}
      {w.upcoming.length > 0 && (
        <div className="border-t border-border pt-2">
          <p className="mb-1 text-xs text-muted-foreground">Ближайшие платежи</p>
          {w.upcoming.map((e) => (
            <p key={e.refId + +e.date} className="flex justify-between text-xs"><span className="truncate">{e.date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} · {e.name}</span><span className="tabular-nums">{rub(e.amount)}</span></p>
          ))}
        </div>
      )}
    </section>
  );
}
