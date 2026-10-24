import { useState } from "react";
import { Trash2, Scale, ArrowDownLeft, PiggyBank } from "lucide-react";
import { cat, catColor, rub, updateTx, type Method, type Tx } from "@/lib/budget";
import { CatIcon } from "./Shell";
import { deleteWithUndo } from "./Undo";
import { CategoryChip, MethodToggle } from "./Pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function TxList({ txs }: { txs: Tx[] }) {
  const [edit, setEdit] = useState<Tx | null>(null);
  if (!txs.length) return <p className="py-6 text-center text-sm text-muted-foreground">Пока пусто — и это нормально.</p>;
  return (
    <>
      <ul className="divide-y divide-border rounded-2xl bg-card shadow-soft">
        {txs.map((t) => {
          const c = cat(t.category);
          const Icon = t.kind === "adjust" ? Scale : t.kind === "income" ? ArrowDownLeft : t.kind === "cushion" || t.kind === "savings" ? PiggyBank : null;
          const sign = t.kind === "expense" ? "−" : t.amount >= 0 ? "+" : "−";
          return (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => setEdit(t)} aria-label="Изменить" className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-foreground" style={t.kind === "expense" ? { background: catColor(c) } : undefined}>
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
              </button>
              <button aria-label="Удалить" onClick={() => deleteWithUndo(t.id)} className="p-1 text-muted-foreground hover:text-foreground">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
      {edit && <EditTx t={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function EditTx({ t, onClose }: { t: Tx; onClose: () => void }) {
  const [amount, setAmount] = useState(String(Math.abs(t.amount)));
  const [note, setNote] = useState(t.note ?? "");
  const [category, setCategory] = useState(t.category);
  const [method, setMethod] = useState<Method>(t.method ?? "card");
  const [date, setDate] = useState(t.date.slice(0, 10));
  const signed = t.kind === "adjust" || t.kind === "cushion" || t.kind === "savings";
  const save = () => {
    const a = Math.abs(Number(amount.replace(",", ".").replace(/\s/g, "")));
    if (!a) return;
    const d = new Date(t.date);
    const [y, m, day] = date.split("-").map(Number);
    if (y && m && day) d.setFullYear(y, m - 1, day);
    updateTx(t.id, { amount: signed && t.amount < 0 ? -a : a, note: note.trim(), category, method, date: d.toISOString() });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Изменить операцию</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма" className="text-lg" />
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Название" />
          {t.kind === "expense" && <CategoryChip value={category} onChange={setCategory} />}
          <MethodToggle value={method} onChange={setMethod} />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button className="w-full" onClick={save}>Сохранить</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
