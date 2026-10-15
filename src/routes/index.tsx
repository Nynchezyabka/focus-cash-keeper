import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Minus, Scale, Wand2, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Shell, CatIcon, meta } from "@/components/Shell";
import { TxList } from "@/components/TxList";
import { addedToast, undoable } from "@/components/Undo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addTx, calc, cat, catColor, cats, coverFromCushion, dayKey, GROUPS, getState, pendingIncome, reconcile, removeTx, rub, setState,
  type Group, type State,
} from "@/lib/budget";
import { detectService, parseAi, type Parsed } from "@/lib/parse";
import { MicButton } from "@/components/Mic";

export const Route = createFileRoute("/")({
  head: () => meta("Бережный бюджет — сколько можно потратить сегодня", "Спокойный бюджет без таблиц и чувства вины: одна цифра на день, сверка баланса в один клик."),
  component: () => <Shell>{(s) => <Today s={s} />}</Shell>,
});

function Today({ s }: { s: State }) {
  const c = calc(s);
  const [dialog, setDialog] = useState<null | "expense" | "income" | "reconcile" | "pocket">(null);
  const pending = pendingIncome(s);
  const showOver = c.overspend > 0 && s.overspendHandled !== c.todayKey;
  const empty = s.txs.length === 0 && s.balance === 0;

  return (
    <div className="space-y-5">
      {pending && <IncomeArrived p={pending} />}

      <section className="pt-10 text-center">
        <p className="text-sm text-muted-foreground">Сегодня свободно</p>
        <p className="font-display text-[clamp(3.5rem,18vw,5.5rem)] leading-none tracking-tight text-foreground tabular-nums">
          {rub(Math.max(0, c.freeToday))}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {c.days} {plural(c.days, "день", "дня", "дней")} до дохода · {c.next.date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
        </p>
        {c.spentToday > 0 && <p className="mt-1 text-xs text-muted-foreground">Уже потрачено сегодня: {rub(c.spentToday)} из {rub(c.dailyNorm)}</p>}
      </section>

      {empty && (
        <div className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
          С чего начать: нажмите «Сверить баланс» и впишите, сколько сейчас на карте. Потом впишите, каких числа приходят деньги, в <Link to="/incomes" className="underline">План доходов</Link>.
        </div>
      )}

      {showOver && (
        <div className="rounded-2xl bg-accent p-4 text-accent-foreground">
          <p className="text-sm">Сегодня вышло на {rub(c.overspend)} больше ориентира. Бывает. Как поступим?</p>
          <div className="mt-3 grid gap-2">
            <Button variant="secondary" className="h-auto whitespace-normal py-2" onClick={() => setState((x) => ({ ...x, overspendHandled: c.todayKey }))}>
              Распределить на оставшиеся дни {c.days > 1 && `(≈ ${rub(c.afterSpread)} в день)`}
            </Button>
            <Button variant="secondary" className="h-auto whitespace-normal py-2" disabled={s.cushion <= 0} onClick={() => {
              const t = coverFromCushion(c.overspend);
              setState((x) => ({ ...x, overspendHandled: c.todayKey }));
              addedToast(t, "Взяли из подушки");
            }}>
              Взять из подушки {s.cushion > 0 ? `(есть ${rub(s.cushion)})` : "(пока пуста)"}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" className="h-16 rounded-2xl text-base" onClick={() => setDialog("expense")}><Minus /> Трата</Button>
        <Button size="lg" variant="secondary" className="h-16 rounded-2xl text-base" onClick={() => setDialog("income")}><Plus /> Доход</Button>
      </div>
      <Button variant="outline" className="h-12 w-full rounded-2xl" onClick={() => setDialog("pocket")}><Wand2 /> Записать несколько трат текстом или голосом</Button>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="На карте" value={rub(s.balance)} />
        <Stat label="Забронировано" value={rub(c.reserve)} icon />
        <Stat label="Подушка" value={rub(s.cushion)} />
      </div>

      <button onClick={() => setDialog("reconcile")} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-3 text-left text-sm text-muted-foreground">
        <Scale className="h-5 w-5 shrink-0" />
        <span className="flex-1">Сверить баланс — если цифра на карте не совпадает</span>
      </button>

      {s.txs.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm text-muted-foreground">Только что записано</h2>
            <Link to="/analytics" className="text-sm text-muted-foreground">Все операции</Link>
          </div>
          <TxList txs={s.txs.slice(0, 2)} />
        </section>
      )}

      <ExpenseDialog open={dialog === "expense"} onClose={() => setDialog(null)} />
      <IncomeDialog open={dialog === "income"} onClose={() => setDialog(null)} />
      <ReconcileDialog open={dialog === "reconcile"} onClose={() => setDialog(null)} balance={s.balance} />
      <PocketDialog open={dialog === "pocket"} onClose={() => setDialog(null)} s={s} />
    </div>
  );
}

const plural = (n: number, a: string, b: string, c: string) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);

function Stat({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-soft">
      <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">{icon && <Lock className="h-3 w-3" />}{label}</p>
      <p className="mt-1 text-sm text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function IncomeArrived({ p }: { p: NonNullable<ReturnType<typeof pendingIncome>> }) {
  const ack = (extra?: Partial<State>) => setState((s) => ({ ...s, ...extra, incomeAck: { ...s.incomeAck, [p.income.id]: p.date } }));
  const shift = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    ack({ nextIncomeOverride: dayKey(d) });
    toast(`Ждём доход до ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`);
  };
  return (
    <div className="rounded-2xl bg-secondary p-4 text-secondary-foreground">
      <p className="text-sm">Пришёл ли доход «{p.income.name}» ({rub(p.income.amount)})?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => { const t = addTx({ kind: "income", amount: p.income.amount, category: "income", note: p.income.name }); ack({ nextIncomeOverride: undefined }); addedToast(t, "Доход учтён"); }}>Да, пришёл</Button>
        <Button size="sm" variant="outline" onClick={() => shift(2)}>Сдвинуть на 2 дня</Button>
        <Button size="sm" variant="outline" onClick={() => shift(5)}>На 5 дней</Button>
      </div>
    </div>
  );
}

function ExpenseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [group, setGroup] = useState<Group>("life");
  const save = (category: string) => {
    const a = Number(amount.replace(",", "."));
    if (!a) { toast("Сначала впишите сумму"); return; }
    const t = addTx({ kind: "expense", amount: a, category });
    addedToast(t, `${cat(category).name}: ${rub(a)}`);
    setAmount(""); onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Новая трата</DialogTitle></DialogHeader>
        <Input autoFocus inputMode="decimal" placeholder="Сумма, ₽" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 text-center text-2xl" />
        <div className="flex gap-1 rounded-xl bg-muted p-1 text-xs">
          {(Object.keys(GROUPS) as Group[]).map((g) => (
            <button key={g} onClick={() => setGroup(g)} className={`flex-1 rounded-lg py-2 ${group === g ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>{GROUPS[g]}</button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {cats().filter((c) => c.group === group).map((c) => (
            <button key={c.id} onClick={() => save(c.id)} className="flex flex-col items-center gap-1 rounded-xl bg-secondary p-3 text-xs text-secondary-foreground active:scale-95">
              <span className="grid h-9 w-9 place-items-center rounded-full text-foreground" style={{ background: catColor(c) }}><CatIcon name={c.icon} className="h-5 w-5" /></span>{c.name}
            </button>
          ))}
          <Link to="/categories" onClick={onClose} className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border p-3 text-xs text-muted-foreground">+ Своя</Link>
        </div>
        <p className="text-center text-xs text-muted-foreground">Нажмите на категорию — трата сохранится</p>
      </DialogContent>
    </Dialog>
  );
}

function IncomeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Пришли деньги</DialogTitle></DialogHeader>
        <Input autoFocus inputMode="decimal" placeholder="Сумма, ₽" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 text-center text-2xl" />
        <Input placeholder="Откуда (аванс, наличные, подработка, подарок)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button onClick={() => {
          const a = Number(amount.replace(",", "."));
          if (!a) return;
          addedToast(addTx({ kind: "income", amount: a, category: "income", note: note || "Разовый доход" }), `+${rub(a)} — дневная норма подросла`);
          setAmount(""); setNote(""); onClose();
        }}>Добавить</Button>
      </DialogContent>
    </Dialog>
  );
}

function ReconcileDialog({ open, onClose, balance }: { open: boolean; onClose: () => void; balance: number }) {
  const [v, setV] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Сверить баланс</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Не нужно вспоминать каждую покупку. Просто посмотрите, сколько сейчас на карте — и начнём с этой точки.</p>
        <Input autoFocus inputMode="decimal" placeholder={`Сейчас фактически, ₽ (было ${rub(balance)})`} value={v} onChange={(e) => setV(e.target.value)} className="h-14 text-center text-xl" />
        <Button onClick={() => {
          const a = Number(v.replace(/\s/g, "").replace(",", "."));
          if (Number.isNaN(a) || v === "") return;
          const t = reconcile(a);
          if (t) undoable("Готово, расчёт обновлён", () => removeTx(t.id)); else toast("Всё сходится");
          setV(""); onClose();
        }}>Готово</Button>
      </DialogContent>
    </Dialog>
  );
}

function PocketDialog({ open, onClose, s }: { open: boolean; onClose: () => void; s: State }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<Parsed[] | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => { setText(""); setItems(null); onClose(); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Записать несколько трат</DialogTitle></DialogHeader>
        {!items ? (
          <>
            <p className="text-sm text-muted-foreground">Напишите или надиктуйте как есть — приложение само разложит по категориям.</p>
            <div className="relative">
              <Textarea autoFocus rows={4} placeholder="Такси 450, кофе с круассаном 380, в аптеке 1200" value={text} onChange={(e) => setText(e.target.value)} className="pr-12" />
              <MicButton onText={(t) => setText((p) => (p ? p + ", " : "") + t)} />
            </div>
            <p className="text-xs text-muted-foreground">{detectService(s.ai.apiKey) ? `Разберёт ИИ (${detectService(s.ai.apiKey)!.name}).` : "Разбор на устройстве, по суммам и словам. Ключ ИИ можно добавить в настройках."}</p>
            <Button disabled={busy || !text.trim()} onClick={async () => {
              setBusy(true);
              try { setItems(await parseAi(text, getState().ai)); }
              catch (e) { toast((e as Error).message); }
              finally { setBusy(false); }
            }}>{busy ? <Loader2 className="animate-spin" /> : <Wand2 />} Разобрать</Button>
          </>
        ) : (
          <>
            {items.length === 0 && <p className="text-sm text-muted-foreground">Не нашла сумм. Попробуйте «кофе 200, такси 450».</p>}
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl bg-secondary p-2 text-sm">
                  <select value={it.category} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))} className="w-28 rounded-md bg-card p-1 text-xs">
                    {cats().map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <span className="flex-1 truncate">{it.note}</span>
                  <input inputMode="decimal" aria-label="Сумма" value={it.amount} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)))} className="w-20 rounded-md bg-card p-1 text-right text-sm tabular-nums" />
                  <button aria-label="Убрать" className="px-1 text-muted-foreground" onClick={() => setItems(items.filter((_, j) => j !== i))}>×</button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setItems(null)}>Назад</Button>
              <Button className="flex-1" disabled={!items.length} onClick={() => {
                const ids = items.filter((it) => it.amount > 0).map((it) => addTx({ kind: "expense", amount: it.amount, category: it.category, note: it.note }).id);
                undoable(`Добавлено трат: ${ids.length}`, () => ids.forEach(removeTx));
                close();
              }}>Сохранить всё</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
