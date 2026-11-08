import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { rub, type Goal, type Method, type State } from "@/lib/budget";
import { activeGoals, archivedGoals, buyGoal, contributions, deleteGoal, familyCollected, goalSaved, perMonth, putToGoal, saveGoal, settleGoal, unassigned } from "@/lib/goals";
import { getFamily } from "@/lib/family";
import { removeTx } from "@/lib/budget";
import { undoable } from "./Undo";
import { MethodToggle } from "./Pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

const num = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));
const monthName = (d: string) => new Date(d + "-01").toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

export function GoalsSection({ s }: { s: State }) {
  const [edit, setEdit] = useState<Partial<Goal> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const goals = activeGoals(s);
  const waiting = archivedGoals(s).filter((g) => g.family && !g.settled && goalSaved(s, g.id) > 0);
  const archive = archivedGoals(s);
  const fam = getFamily();
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="font-medium">Цели</p>
        <span className="text-xs text-muted-foreground">Без цели: {rub(unassigned(s))}</span>
      </div>
      {waiting.map((g) => (
        <div key={g.id} className="space-y-2 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
          <p>«{g.name}» купили{g.done?.by ? ` (${g.done.by})` : ""}. Ваша часть — {rub(goalSaved(s, g.id))}.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={() => undoable("Ваша часть списана", settleGoal(g.id, true))}>Списать</Button>
            <Button size="sm" variant="outline" onClick={() => undoable("Оставлено в накоплениях", settleGoal(g.id, false))}>Оставить</Button>
          </div>
        </div>
      ))}
      {goals.map((g) => {
        const mine = goalSaved(s, g.id);
        const got = g.family ? familyCollected(g.id, mine) : mine;
        const pm = perMonth(s, g);
        return (
          <div key={g.id} className="rounded-xl bg-muted p-3 text-sm">
            <button className="w-full text-left" onClick={() => setOpen(open === g.id ? null : g.id)}>
              <p className="flex justify-between gap-2"><span className="truncate">{g.name}{g.family ? " · семейная" : ""}</span><span className="tabular-nums">{rub(got)} из {rub(g.target)}</span></p>
              <Progress value={Math.min(100, (got / Math.max(1, g.target)) * 100)} className="mt-2 h-1.5" />
              {g.date && <p className="mt-1 text-xs text-muted-foreground">К {monthName(g.date)}{pm ? ` — по ${rub(pm)} в месяц` : " — успеваете"}</p>}
              {g.family && <p className="mt-1 text-xs text-muted-foreground">{contributions(g.id, mine, fam?.name ?? "").map((p) => `${p.me ? "вы" : p.name}: ${rub(p.saved)}`).join(" · ")}</p>}
            </button>
            {open === g.id && <GoalActions s={s} g={g} onEdit={() => setEdit(g)} onDone={() => setOpen(null)} />}
          </div>
        );
      })}
      {edit ? <GoalEditor g={edit} onClose={() => setEdit(null)} /> : (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setEdit({})}><Plus /> Новая цель</Button>
      )}
      {archive.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary>Куплено ({archive.length})</summary>
          <ul className="mt-1 space-y-1">{archive.map((g) => <li key={g.id}>{g.name} — {rub(g.done?.price ?? 0)}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

function GoalActions({ s, g, onEdit, onDone }: { s: State; g: Goal; onEdit: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"put" | "buy" | null>(null);
  const [sum, setSum] = useState("");
  const [from, setFrom] = useState<Method | "free">("card");
  const [spendOwn, setSpendOwn] = useState(true);
  const free = unassigned(s);
  const a = num(sum);
  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      {!mode && (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => setMode("put")}>Отложить</Button>
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => setMode("buy")}><Check /> Куплена</Button>
          <Button size="icon" variant="ghost" aria-label="Изменить" onClick={onEdit}><Pencil /></Button>
          <Button size="icon" variant="ghost" aria-label="Удалить" onClick={() => { undoable("Цель удалена, деньги остались в накоплениях", deleteGoal(g.id)); onDone(); }}><Trash2 /></Button>
        </div>
      )}
      {mode === "put" && (
        <>
          <Input autoFocus inputMode="decimal" placeholder="Сколько, ₽" value={sum} onChange={(e) => setSum(e.target.value)} />
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-background p-1 text-xs">
            {(["card", "cash", "free"] as const).map((k) => (
              <button key={k} onClick={() => setFrom(k)} className={`rounded-lg py-1.5 ${from === k ? "bg-card shadow-soft" : "text-muted-foreground"}`}>{k === "card" ? "С карты" : k === "cash" ? "Наличные" : "Без цели"}</button>
            ))}
          </div>
          {from === "free" && <p className="text-xs text-muted-foreground">Из накоплений без цели можно взять до {rub(free)}.</p>}
          <Button size="sm" className="w-full" disabled={!(a > 0) || (from === "free" && a > free)} onClick={() => {
            const t = putToGoal(g.id, a, from);
            undoable(`«${g.name}»: +${rub(a)}`, () => removeTx(t.id));
            onDone();
          }}>Отложить</Button>
        </>
      )}
      {mode === "buy" && (
        <>
          <Input autoFocus inputMode="decimal" placeholder="Сколько стоила, ₽" value={sum} onChange={(e) => setSum(e.target.value)} />
          {g.family && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={spendOwn} onChange={(e) => setSpendOwn(e.target.checked)} /> Списать мою часть ({rub(goalSaved(s, g.id))})</label>}
          {(() => {
            const got = g.family ? familyCollected(g.id, goalSaved(s, g.id)) : goalSaved(s, g.id);
            const extra = Math.max(0, a - got);
            return a > 0 && <p className="text-xs text-muted-foreground">{extra > 0 ? `Не хватает ${rub(extra)} — где взять:` : a < got ? `Останется ${rub(got - a)} — они будут в накоплениях без цели.` : "Собрано ровно столько."}</p>;
          })()}
          <MethodToggle value={from === "free" ? "card" : from} onChange={setFrom} />
          <Button size="sm" className="w-full" disabled={!(a > 0)} onClick={() => {
            undoable(`«${g.name}» куплена`, buyGoal(g.id, a, from === "free" ? "card" : from, g.family ? spendOwn : true, getFamily()?.name));
            onDone();
          }}>Готово</Button>
        </>
      )}
    </div>
  );
}

function GoalEditor({ g, onClose }: { g: Partial<Goal>; onClose: () => void }) {
  const [name, setName] = useState(g.name ?? "");
  const [target, setTarget] = useState(g.target ? String(g.target) : "");
  const [date, setDate] = useState(g.date ?? "");
  const [family, setFam] = useState(!!g.family);
  const canFamily = !!getFamily() && !g.id;
  return (
    <div className="space-y-2 rounded-xl bg-muted p-3 text-sm">
      <Input autoFocus placeholder="На что копим" value={name} onChange={(e) => setName(e.target.value)} />
      <Input inputMode="decimal" placeholder="Нужная сумма, ₽" value={target} onChange={(e) => setTarget(e.target.value)} />
      <label className="block text-xs text-muted-foreground">К какому месяцу (необязательно)
        <Input type="month" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
      </label>
      {canFamily && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={family} onChange={(e) => setFam(e.target.checked)} /> Семейная — увидит и сможет пополнять партнёр</label>}
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>Отмена</Button>
        <Button size="sm" className="flex-1" disabled={!name.trim() || !(num(target) > 0)} onClick={() => {
          saveGoal({ ...g, name: name.trim(), target: num(target), date: date || undefined, family: g.id ? g.family : family } as Goal);
          onClose();
        }}>Сохранить</Button>
      </div>
    </div>
  );
}
