import { Trash2, Scale, ArrowDownLeft, PiggyBank } from "lucide-react";
import { cat, rub, type Tx } from "@/lib/budget";
import { CatIcon } from "./Shell";
import { deleteWithUndo } from "./Undo";

export function TxList({ txs }: { txs: Tx[] }) {
  if (!txs.length) return <p className="py-6 text-center text-sm text-muted-foreground">Пока пусто — и это нормально.</p>;
  return (
    <ul className="divide-y divide-border rounded-2xl bg-card shadow-soft">
      {txs.map((t) => {
        const c = cat(t.category);
        const Icon = t.kind === "adjust" ? Scale : t.kind === "income" ? ArrowDownLeft : t.kind === "cushion" ? PiggyBank : null;
        const sign = t.kind === "expense" ? "−" : t.amount >= 0 ? "+" : "−";
        return (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
              {Icon ? <Icon className="h-4 w-4" /> : <CatIcon name={c.icon} className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{t.note || (t.kind === "income" ? "Доход" : c.name)}</p>
              <p className="text-xs text-muted-foreground">
                {t.kind === "expense" ? c.name + " · " : ""}
                {new Date(t.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
              </p>
            </div>
            <span className={`text-sm tabular-nums ${t.kind === "expense" ? "text-foreground" : "text-primary"}`}>
              {sign}{rub(Math.abs(t.amount))}
            </span>
            <button aria-label="Удалить" onClick={() => deleteWithUndo(t.id)} className="p-1 text-muted-foreground hover:text-foreground">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
