import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { DateDialog, MethodBadge as Badge, MethodToggle } from "@/components/Pickers";
import { addedToast } from "@/components/Undo";
import { Shell, meta } from "@/components/Shell";
import { PlanTabs } from "@/components/PlanTabs";
import { undoable } from "@/components/Undo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { confirmIncome, dayKey, periodOf, toggleIncomeSkip, incomeUpcoming, moveIncome, nextIncome, pendingIncome, rub, setState, uid, type Income, type State } from "@/lib/budget";

export const Route = createFileRoute("/incomes")({
  head: () => meta("План доходов — Бережный бюджет", "Какого числа приходят аванс, зарплата, наличные или пособия. По этим датам считается дневной бюджет."),
  component: () => <Shell title="План">{(s) => <><PlanTabs /><Incomes s={s} /></>}</Shell>,
});

type Draft = { id?: string; name: string; amount: string; day: string; method: "card" | "cash" };
const empty: Draft = { name: "", amount: "", day: "", method: "card" };

function Incomes({ s }: { s: State }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [moving, setMoving] = useState<Income | null>(null);
  const pending = pendingIncome(s);
  const next = nextIncome(s);
  const list = [...s.incomes].sort((a, b) => a.day - b.day);
  const total = list.reduce((a, i) => a + i.amount, 0);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Это план: какого числа обычно приходят деньги. По нему приложение понимает, на сколько дней делить остаток. Когда деньги пришли — нажмите «Пришли» у выплаты. Разовые деньги — кнопка «Доход» на главном.
      </p>

      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <p className="text-xs text-muted-foreground">Следующие деньги</p>
        <p className="mt-1 font-display text-xl">{next.date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}{next.income ? ` · ${next.income.name}` : ""}</p>
      </div>

      {list.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-lg">Каждый месяц</h2>
            <span className="text-sm tabular-nums text-muted-foreground">{rub(total)}</span>
          </div>
          <ul className="space-y-2">
            {list.map((i) => {
              const isNext = next.income?.id === i.id;
              return (
                <li key={i.id} className={`rounded-2xl bg-card p-4 shadow-soft ${isNext ? "ring-2 ring-primary" : ""}`}>
                  <button onClick={() => setDraft({ id: i.id, name: i.name, amount: String(i.amount), day: String(i.day), method: i.method ?? "card" })} className="flex w-full items-center gap-3 text-left">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary leading-none text-secondary-foreground">
                      <span className="text-center"><span className="block font-display text-lg tabular-nums">{i.day}</span><span className="text-[10px]">число</span></span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{i.name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2"><Badge m={i.method} />{isNext && <span className="text-[11px] text-primary">следующий</span>}</span>
                    </span>
                    <span className="text-sm tabular-nums">{rub(i.amount)}</span>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <label className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>{i.skip === periodOf(new Date()) ? "В этом месяце не учитывается — уже внесли вручную" : "Учитывать в этом месяце"}</span>
                    <Switch checked={i.skip !== periodOf(new Date())} onCheckedChange={() => toggleIncomeSkip(i.id, periodOf(new Date()))} />
                  </label>
                  <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                    <span className="flex-1 text-xs text-muted-foreground">
                      {pending?.income.id === i.id ? "Дата наступила — пришли?" : (() => { const d = incomeUpcoming(s, i); return d ? `Ближайший раз: ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}${i.nextOn ? " (перенесён)" : ""}` : ""; })()}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setMoving(i)}><CalendarClock /> Перенести</Button>
                    <Button size="sm" variant="secondary" onClick={() => addedToast(confirmIncome(s, i), `${i.name}: +${rub(i.amount)}`)}><Check /> Пришли</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {list.length === 0 && <p className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">Добавьте каждую выплату отдельно: например, «Аванс» 10-го на карту, «Аванс наличными» 10-го, «Зарплата» 25-го.</p>}

      <Button className="h-12 w-full rounded-2xl" onClick={() => setDraft(empty)}><Plus /> Добавить выплату в план</Button>

      <DateDialog open={!!moving} title={`Когда придёт «${moving?.name ?? ""}»?`} initial={moving ? dayKey(incomeUpcoming(s, moving) ?? new Date()) : ""} onClose={() => setMoving(null)} onSave={(d) => moving && moveIncome(moving.id, d)} />
      <IncomeEditor draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function IncomeEditor({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  const [v, setV] = useState<Draft>(empty);
  const [openId, setOpenId] = useState<string | null>(null);
  const key = draft ? draft.id ?? "new" : null;
  if (key !== openId) { setOpenId(key); if (draft) setV(draft); }
  const isNew = !draft?.id;
  const a = Number(v.amount.replace(/\s/g, "").replace(",", ".")), d = Number(v.day);
  const valid = v.name.trim() && a > 0 && d >= 1 && d <= 31;

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{isNew ? "Новая выплата" : "Изменить выплату"}</DialogTitle></DialogHeader>
        <Input autoFocus placeholder="Название: Аванс, Зарплата, Пособие" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <div className="flex gap-2">
          <Input inputMode="decimal" placeholder="Сумма, ₽" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} />
          <Input inputMode="numeric" placeholder="Число (1–31)" value={v.day} onChange={(e) => setV({ ...v, day: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
        </div>
        <MethodToggle value={v.method} onChange={(m) => setV({ ...v, method: m })} />
        <p className="text-xs text-muted-foreground">Каждый месяц в этот день. Если в месяце нет такого числа — в последний день.</p>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="outline" size="icon" aria-label="Удалить" onClick={() => {
              let removed: Income | undefined;
              setState((x) => { removed = x.incomes.find((y) => y.id === draft!.id); return { ...x, incomes: x.incomes.filter((y) => y.id !== draft!.id) }; });
              if (removed) { const r = removed; undoable("Выплата убрана из плана", () => setState((x) => ({ ...x, incomes: [...x.incomes, r] }))); }
              onClose();
            }}><Trash2 /></Button>
          )}
          <Button className="flex-1" disabled={!valid} onClick={() => {
            const item: Income = { id: draft?.id ?? uid(), name: v.name.trim(), amount: a, day: d, method: v.method };
            setState((x) => isNew
              ? { ...x, incomes: [...x.incomes, item], incomeAck: { ...x.incomeAck, [item.id]: dayKey(new Date()) } }
              : { ...x, incomes: x.incomes.map((y) => (y.id === item.id ? item : y)) });
            onClose();
          }}>Сохранить</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
