import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { DateDialog, MethodBadge as Badge, MethodToggle } from "@/components/Pickers";
import { addedToast } from "@/components/Undo";
import { Shell, meta } from "@/components/Shell";
import { MonthStrip } from "@/components/MonthStrip";
import { PlanTabs } from "@/components/PlanTabs";
import { undoable } from "@/components/Undo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { confirmIncome, dayKey, periodOf, toggleIncomeSkip, incomeUpcoming, moveIncome, nextIncome, pendingIncome, rub, setState, uid, type Income, type State } from "@/lib/budget";

export const Route = createFileRoute("/incomes")({
  head: () => meta("План доходов — Бережный бюджет", "Какого числа приходят аванс, зарплата, наличные или пособия. По этим датам считается дневной бюджет."),
  component: () => <Shell title="План" wide>{(s) => <><PlanTabs /><MonthStrip s={s} /><Incomes s={s} /></>}</Shell>,
});

type Draft = { id?: string; name: string; amount: string; day: string; method: "card" | "cash"; once: string | null; start: string; end: string };
const empty: Draft = { name: "", amount: "", day: "", method: "card", once: null, start: "", end: "" };
const fmtD = (k: string) => new Date(k + "T00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
const periodText = (i: Income) => i.start && i.end ? `с ${fmtD(i.start)} по ${fmtD(i.end)}` : i.start ? `с ${fmtD(i.start)}` : i.end ? `по ${fmtD(i.end)}` : "";

function Incomes({ s }: { s: State }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [moving, setMoving] = useState<Income | null>(null);
  const pending = pendingIncome(s);
  const next = nextIncome(s);
  const list = s.incomes.filter((i) => !i.once).sort((a, b) => a.day - b.day);
  const onceList = s.incomes.filter((i) => i.once).sort((a, b) => a.once!.localeCompare(b.once!));
  const total = list.reduce((a, i) => a + i.amount, 0);

  return (
    <div className="space-y-5">
      <Button className="h-12 w-full rounded-2xl" onClick={() => setDraft(empty)}><Plus /> Добавить выплату в план</Button>
      <p className="text-sm text-muted-foreground">
        Это план: какого числа обычно приходят деньги. По нему приложение понимает, на сколько дней делить остаток. Когда деньги пришли — нажмите «Пришли» у выплаты. Подработку, подарок и другие нерегулярные деньги вносите кнопкой «Доход» на главном.
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
          <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
            {list.map((i) => {
              const isNext = next.income?.id === i.id;
              const ended = !!i.end && i.end < dayKey(new Date());
              return (
                <li key={i.id} className={`rounded-2xl bg-card p-4 shadow-soft ${isNext ? "ring-2 ring-primary" : ""} ${ended ? "opacity-60" : ""}`}>
                  <button onClick={() => setDraft({ id: i.id, name: i.name, amount: String(i.amount), day: String(i.day), method: i.method ?? "card", once: null, start: i.start ?? "", end: i.end ?? "" })} className="flex w-full items-center gap-3 text-left">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary leading-none text-secondary-foreground">
                      <span className="text-center"><span className="block font-display text-lg tabular-nums">{i.day}</span><span className="text-[10px]">число</span></span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{i.name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2"><Badge m={i.method} />{isNext && <span className="text-[11px] text-primary">следующий</span>}{periodText(i) && <span className="text-[11px] text-muted-foreground">{ended ? "закончилась · " : ""}{periodText(i)}</span>}</span>
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
      {onceList.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg">Разовые выплаты</h2>
          <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
            {onceList.map((i) => {
              const done = !!s.incomeAck[i.id] && s.incomeAck[i.id]! >= (i.nextOn ?? i.once!);
              const due = i.nextOn ?? i.once!;
              const isDue = pending?.income.id === i.id;
              return (
                <li key={i.id} className={`rounded-2xl bg-card p-4 shadow-soft ${done ? "opacity-60" : ""} ${next.income?.id === i.id ? "ring-2 ring-primary" : ""}`}>
                  <button onClick={() => setDraft({ id: i.id, name: i.name, amount: String(i.amount), day: String(i.day), method: i.method ?? "card", once: i.once!, start: "", end: "" })} className="flex w-full items-center gap-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{i.name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><Badge m={i.method} />{new Date(due + "T00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}{done ? " · пришла" : ""}</span>
                    </span>
                    <span className="text-sm tabular-nums">{rub(i.amount)}</span>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  {!done && (
                    <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                      <span className="flex-1 text-xs text-muted-foreground">{isDue ? "Дата наступила — пришла?" : "Один раз"}</span>
                      <Button size="sm" variant="ghost" onClick={() => setMoving(i)}><CalendarClock /> Перенести</Button>
                      <Button size="sm" variant="secondary" onClick={() => addedToast(confirmIncome(s, i), `${i.name}: +${rub(i.amount)}`)}><Check /> Пришла</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {list.length === 0 && onceList.length === 0 && <p className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">Добавьте каждую выплату отдельно: например, «Аванс» 10-го на карту, «Аванс наличными» 10-го, «Зарплата» 25-го.</p>}


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
  const periodOk = !v.start || !v.end || v.start <= v.end;
  const valid = v.name.trim() && a > 0 && (v.once !== null ? /^\d{4}-\d{2}-\d{2}$/.test(v.once) : d >= 1 && d <= 31 && periodOk);

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{isNew ? "Новая выплата" : "Изменить выплату"}</DialogTitle></DialogHeader>
        <Input autoFocus placeholder="Название: Аванс, Зарплата, Пособие" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1 text-sm">
          {[false, true].map((o) => (
            <button key={String(o)} type="button" onClick={() => setV({ ...v, once: o ? (v.once ?? "") : null })} className={`rounded-lg py-2 ${(v.once !== null) === o ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>{o ? "Один раз" : "Каждый месяц"}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input inputMode="decimal" placeholder="Сумма, ₽" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} />
          {v.once === null
            ? <Input inputMode="numeric" placeholder="Число (1–31)" value={v.day} onChange={(e) => setV({ ...v, day: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
            : <Input type="date" aria-label="Дата выплаты" value={v.once} onChange={(e) => setV({ ...v, once: e.target.value })} />}
        </div>
        {v.once === null && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Период (необязательно) — например, пособие с мая на полтора года</p>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-muted-foreground">Действует с<Input type="date" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} /></label>
              <label className="flex-1 text-xs text-muted-foreground">по<Input type="date" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} /></label>
            </div>
            {!periodOk && <p className="text-xs text-destructive">Дата окончания раньше начала</p>}
          </div>
        )}
        <MethodToggle value={v.method} onChange={(m) => setV({ ...v, method: m })} />
        <p className="text-xs text-muted-foreground">{v.once === null ? "Каждый месяц в этот день. Если в месяце нет такого числа — в последний день." : "Один раз в этот день: декретные, отпускные, премия, возврат налога."}</p>
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
            const item: Income = { id: draft?.id ?? uid(), name: v.name.trim(), amount: a, day: v.once !== null ? Number(v.once.slice(8, 10)) : d, method: v.method, ...(v.once !== null ? { once: v.once } : {}), ...(v.once === null && v.start ? { start: v.start } : {}), ...(v.once === null && v.end ? { end: v.end } : {}) };
            setState((x) => isNew
              ? { ...x, incomes: [...x.incomes, item], incomeAck: item.once ? x.incomeAck : { ...x.incomeAck, [item.id]: dayKey(new Date()) } }
              : { ...x, incomes: x.incomes.map((y) => (y.id === item.id ? item : y)) });
            onClose();
          }}>Сохранить</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
