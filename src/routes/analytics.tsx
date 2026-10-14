import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CatIcon, Shell, meta } from "@/components/Shell";
import { TxList } from "@/components/TxList";
import { Link } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { cat, catColor, GROUPS, rub, type Group, type State } from "@/lib/budget";

export const Route = createFileRoute("/analytics")({
  head: () => meta("Аналитика — Бережный бюджет", "Куда уходят деньги: круговая диаграмма трат по категориям за месяц."),
  component: () => <Shell title="Аналитика">{(s) => <Analytics s={s} />}</Shell>,
});

const color = (id: string) => catColor(cat(id));

const PERIODS = [
  { id: "month", label: "Этот месяц" },
  { id: "prev", label: "Прошлый" },
  { id: "all", label: "Всё время" },
] as const;

function Analytics({ s }: { s: State }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("month");
  const [picked, setPicked] = useState<string | null>(null);
  const now = new Date();
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const key = period === "month" ? ym(now) : period === "prev" ? ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)) : "";
  const inPeriod = s.txs.filter((t) => !key || ym(new Date(t.date)) === key);
  const exp = inPeriod.filter((t) => t.kind === "expense");
  const byCat = new Map<string, number>();
  exp.forEach((t) => byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount));
  const rows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((a, [, v]) => a + v, 0);
  const groups: Record<Group, number> = { must: 0, safe: 0, life: 0 };
  rows.forEach(([id, v]) => (groups[cat(id).group] += v));

  // donut
  const R = 70, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-full bg-secondary p-1">
        {PERIODS.map((p) => (
          <button key={p.id} onClick={() => { setPeriod(p.id); setPicked(null); }}
            className={`flex-1 rounded-full py-2 text-sm ${period === p.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>{p.label}</button>
        ))}
      </div>

      <div className="relative mx-auto h-56 w-56">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
          <circle cx="90" cy="90" r={R} fill="none" stroke="var(--secondary)" strokeWidth="22" />
          {rows.map(([id, v]) => {
            const len = (v / total) * C;
            const el = (
              <circle key={id} cx="90" cy="90" r={R} fill="none" stroke={color(id)} strokeWidth={picked === id ? 28 : 22}
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} className="cursor-pointer transition-all"
                opacity={picked && picked !== id ? 0.35 : 1} onClick={() => setPicked(picked === id ? null : id)} />
            );
            off += len;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xs text-muted-foreground">{picked ? cat(picked).name : "Потрачено"}</p>
            <p className="font-display text-2xl tabular-nums">{rub(picked ? byCat.get(picked) ?? 0 : total)}</p>
          </div>
        </div>
      </div>

      {total === 0 ? (
        <p className="text-center text-sm text-muted-foreground">За этот период трат нет.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(GROUPS) as Group[]).map((g) => (
              <div key={g} className="rounded-2xl bg-card p-3 text-center shadow-soft">
                <p className="text-[11px] leading-tight text-muted-foreground">{GROUPS[g]}</p>
                <p className="mt-1 text-sm tabular-nums">{Math.round((groups[g] / total) * 100)}%</p>
              </div>
            ))}
          </div>
          <ul className="divide-y divide-border rounded-2xl bg-card shadow-soft">
            {rows.map(([id, v]) => {
              const c = cat(id);
              return (
                <li key={id}>
                  <button onClick={() => setPicked(picked === id ? null : id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${picked === id ? "bg-secondary" : ""}`}>
                    <span className="grid h-9 w-9 place-items-center rounded-full text-foreground" style={{ background: color(id) }}><CatIcon name={c.icon} className="h-4 w-4" /></span>
                    <span className="flex-1 text-sm">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{Math.round((v / total) * 100)}%</span>
                    <span className="w-24 text-right text-sm tabular-nums">{rub(v)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Link to="/categories" className="flex items-center justify-center gap-2 text-sm text-primary"><Settings2 className="h-4 w-4" /> Настроить категории, иконки и цвета</Link>
      <h2 className="pt-2 font-display text-lg">{picked ? `Операции: ${cat(picked).name}` : "Все операции"}</h2>
      <TxList txs={picked ? exp.filter((t) => t.category === picked) : inPeriod} />
    </div>
  );
}
