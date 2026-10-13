import { createFileRoute } from "@tanstack/react-router";
import { Shell, meta } from "@/components/Shell";
import { TxList } from "@/components/TxList";
import { cat, GROUPS, rub, type Group, type State } from "@/lib/budget";

export const Route = createFileRoute("/history")({
  head: () => meta("История — Бережный бюджет", "Все траты и доходы по трём кучкам: обязательное, безопасность, жизнь и радости."),
  component: () => <Shell title="История">{(s) => <History s={s} />}</Shell>,
});

function History({ s }: { s: State }) {
  const month = new Date().toISOString().slice(0, 7);
  const sums: Record<Group, number> = { must: 0, safe: 0, life: 0 };
  s.txs.filter((t) => t.kind === "expense" && t.date.startsWith(month)).forEach((t) => (sums[cat(t.category).group] += t.amount));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(GROUPS) as Group[]).map((g) => (
          <div key={g} className="rounded-2xl bg-card p-3 text-center shadow-soft">
            <p className="text-[11px] text-muted-foreground">{GROUPS[g]}</p>
            <p className="mt-1 text-sm tabular-nums">{rub(sums[g])}</p>
          </div>
        ))}
      </div>
      <TxList txs={s.txs} />
    </div>
  );
}
