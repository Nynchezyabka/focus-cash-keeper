import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Minus, Scale, Wand2, Lock, Loader2, ImageUp, Mic as MicIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { Shell, CatIcon, meta } from "@/components/Shell";
import { TxList } from "@/components/TxList";
import { addedToast, undoable } from "@/components/Undo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addTx, borrow, calc, cat, confirmIncome, coverFromCushion, dayKey, getState, learnKeys, moveIncome, pendingIncome, reconcile, removeTx, rub, setState,
  type Method, type State,
} from "@/lib/budget";
import { detectService, parseImage, parseSmart, type Parsed } from "@/lib/parse";
import { CategoryChip, CategoryPicker, MethodToggle } from "@/components/Pickers";
import { MicButton } from "@/components/Mic";

export const Route = createFileRoute("/")({
  head: () => meta("Бережный бюджет — сколько можно потратить сегодня", "Спокойный бюджет без таблиц и чувства вины: одна цифра на день, сверка баланса в один клик."),
  component: () => <Shell>{(s) => <Today s={s} />}</Shell>,
});

function Today({ s }: { s: State }) {
  const c = calc(s);
  const [dialog, setDialog] = useState<null | "expense" | "income" | "reconcile" | "pocket">(null);
  const [photo, setPhoto] = useState<File | null>(null);
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
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-auto flex-col gap-0.5 rounded-2xl py-2.5" onClick={() => { setPhoto(null); setDialog("pocket"); }}>
          <span className="flex items-center gap-1.5 text-sm"><MicIcon className="h-4 w-4" /> Текст или голос</span>
          <span className="text-xs font-normal text-muted-foreground">вставить или надиктовать</span>
        </Button>
        <label className="inline-flex h-auto cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl border border-input bg-background py-2.5">
          <span className="flex items-center gap-1.5 text-sm font-medium"><ImageUp className="h-4 w-4" /> Чек или скриншот</span>
          <span className="text-xs text-muted-foreground">из банка или магазина</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setPhoto(f); setDialog("pocket"); } }} />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Карта" value={rub(s.balance)} />
        <Stat label="Наличные" value={rub(s.cash ?? 0)} />
        <Stat label="Отложено" value={rub(c.reserve)} icon />
      </div>

      {s.cushion > 0 && <p className="text-center text-xs text-muted-foreground">В подушке: {rub(s.cushion)}</p>}
      {c.total < 0 && <BorrowCard gap={-c.total} />}
      {c.total >= 0 && c.shortfall > 0 && (
        <p className="rounded-2xl bg-accent p-4 text-sm text-accent-foreground">Сейчас денег меньше, чем нужно на платежи до дохода: не хватает {rub(c.shortfall)}. Поэтому «свободно» — 0. Можно перенести платёж в «Плане платежей».</p>
      )}
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
      <PocketDialog open={dialog === "pocket"} onClose={() => { setDialog(null); setPhoto(null); }} s={s} photo={photo} />
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
  const shift = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    moveIncome(p.income.id, dayKey(d));
    toast(`Ждём доход до ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`);
  };
  return (
    <div className="rounded-2xl bg-secondary p-4 text-secondary-foreground">
      <p className="text-sm">Пришёл ли доход «{p.income.name}» ({rub(p.income.amount)})?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => addedToast(confirmIncome(getState(), p.income), "Доход учтён")}>Да, пришёл</Button>
        <Button size="sm" variant="outline" onClick={() => shift(2)}>Сдвинуть на 2 дня</Button>
        <Button size="sm" variant="outline" onClick={() => shift(5)}>На 5 дней</Button>
      </div>
    </div>
  );
}

function ExpenseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("card");
  const save = (category: string) => {
    const a = Number(amount.replace(",", "."));
    if (!a) { toast("Сначала впишите сумму"); return; }
    const t = addTx({ kind: "expense", amount: a, category, method });
    addedToast(t, `${cat(category).name}: ${rub(a)}`);
    setAmount(""); onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-sm overflow-y-auto">
        <DialogHeader><DialogTitle>Новая трата</DialogTitle></DialogHeader>
        <Input autoFocus inputMode="decimal" placeholder="Сумма, ₽" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 text-center text-2xl" />
        <MethodToggle value={method} onChange={setMethod} />
        <CategoryPicker onPick={save} />
        <p className="text-center text-xs text-muted-foreground">Нажмите на категорию — трата сохранится</p>
      </DialogContent>
    </Dialog>
  );
}

function IncomeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<Method>("card");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Пришли деньги</DialogTitle></DialogHeader>
        <Input autoFocus inputMode="decimal" placeholder="Сумма, ₽" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 text-center text-2xl" />
        <MethodToggle value={method} onChange={setMethod} />
        <Input placeholder="Откуда (аванс, наличные, подработка, подарок)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button onClick={() => {
          const a = Number(amount.replace(",", "."));
          if (!a) return;
          addedToast(addTx({ kind: "income", amount: a, category: "income", note: note || "Разовый доход", method }), `+${rub(a)} — дневная норма подросла`);
          setAmount(""); setNote(""); onClose();
        }}>Добавить</Button>
      </DialogContent>
    </Dialog>
  );
}

function ReconcileDialog({ open, onClose, balance }: { open: boolean; onClose: () => void; balance: number }) {
  const [v, setV] = useState("");
  const [method, setMethod] = useState<Method>("card");
  const was = method === "cash" ? getState().cash ?? 0 : balance;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Сверить баланс</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Не нужно вспоминать каждую покупку. Посмотрите, сколько есть сейчас, — и начнём с этой точки.</p>
        <MethodToggle value={method} onChange={setMethod} />
        <Input autoFocus inputMode="decimal" placeholder={`Сейчас, ₽ (было ${rub(was)})`} value={v} onChange={(e) => setV(e.target.value)} className="h-14 text-center text-xl" />
        <Button onClick={() => {
          const a = Number(v.replace(/\s/g, "").replace(",", "."));
          if (Number.isNaN(a) || v === "") return;
          const t = reconcile(a, method);
          if (t) undoable("Готово, расчёт обновлён", () => removeTx(t.id)); else toast("Всё сходится");
          setV(""); onClose();
        }}>Готово</Button>
      </DialogContent>
    </Dialog>
  );
}

function BorrowCard({ gap }: { gap: number }) {
  const [from, setFrom] = useState("");
  const [date, setDate] = useState("");
  return (
    <div className="space-y-2 rounded-2xl bg-accent p-4 text-accent-foreground">
      <p className="text-sm">Потрачено на {rub(gap)} больше, чем было. Откуда взялись деньги и когда вернуть? Запишу возврат в план платежей.</p>
      <Input placeholder="Откуда: кредитка, заняла у мамы" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-card" />
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-card" />
      <Button className="w-full" disabled={!from.trim() || !date} onClick={() => {
        const { t, ob } = borrow(gap, from.trim(), date);
        undoable("Возврат добавлен в план платежей", () => { removeTx(t.id); setState((x) => ({ ...x, obligations: x.obligations.filter((o) => o.id !== ob.id) })); });
      }}>Записать</Button>
      <p className="text-xs">Если просто ошиблась в сумме — нажмите «Сверить баланс».</p>
    </div>
  );
}

function PocketDialog({ open, onClose, s, photo }: { open: boolean; onClose: () => void; s: State; photo: File | null }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<Parsed[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [via, setVia] = useState("");
  const [off, setOff] = useState<Set<number>>(new Set());
  const show = (list: Parsed[]) => { setItems(list); setOff(new Set()); };
  const close = () => { setText(""); setItems(null); onClose(); };
  const fromImage = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { show(await parseImage(f, getState().ai)); setVia(detectService(getState().ai.apiKey)?.name ?? ""); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (open && photo) void fromImage(photo); }, [open, photo]);
  const chosen = (items ?? []).filter((it, i) => !off.has(i) && it.amount > 0);
  const toggle = (i: number) => setOff((o) => { const n = new Set(o); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{photo ? "Траты со скриншота" : "Записать несколько трат"}</DialogTitle></DialogHeader>
        {!items && photo ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Читаю скриншот… Переводы между счетами и поступления пропускаю.</> : "Не получилось прочитать. Попробуйте другой скриншот."}</p>
        ) : !items ? (
          <>
            <p className="text-sm text-muted-foreground">Вставьте скопированный текст, напишите или надиктуйте как есть — приложение само разложит по категориям.</p>
            <div className="relative">
              <Textarea autoFocus rows={4} placeholder="Такси 450, кофе с круассаном 380, в аптеке 1200" value={text} onChange={(e) => setText(e.target.value)} className="pr-12" />
              <MicButton onText={(t) => setText((p) => (p ? p + ", " : "") + t)} />
            </div>
            <p className="text-xs text-muted-foreground">{detectService(s.ai.apiKey) ? "Знакомые слова разберу сама, незнакомые — через ИИ." : "Разбор на телефоне, по суммам и словам. Ключ ИИ можно добавить в настройках."}</p>
            <div className="grid grid-cols-2 gap-2">
            <label className={`inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input text-sm ${busy ? "opacity-50" : ""}`}>
              <ImageUp className="h-4 w-4" /> Скриншот
              <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => { void fromImage(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <Button disabled={busy || !text.trim()} onClick={async () => {
              setBusy(true);
              try { const r = await parseSmart(text, getState().ai); show(r.items); setVia(r.via); }
              catch (e) { toast((e as Error).message); }
              finally { setBusy(false); }
            }}>{busy ? <Loader2 className="animate-spin" /> : <Wand2 />} Разобрать</Button>
            </div>
          </>
        ) : (
          <>
            {items.length > 0 && <p className="text-xs text-muted-foreground">{via === "device" ? "Разобрано на телефоне, без ИИ." : `Разобрал ${via}.`} Нажмите на категорию, чтобы поменять.</p>}
            {items.length === 0 && <p className="text-sm text-muted-foreground">Не нашла сумм. Попробуйте «кофе 200, такси 450».</p>}
            {items.length > 1 && <p className="text-xs text-muted-foreground">Снимите галочку с лишних или старых трат.</p>}
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
              {items.map((it, i) => (
                <li key={i} className={`flex items-center gap-2 rounded-xl bg-secondary p-2 text-sm ${off.has(i) ? "opacity-40" : ""}`}>
                  <button aria-label={off.has(i) ? "Включить" : "Не записывать"} onClick={() => toggle(i)} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border border-primary ${off.has(i) ? "" : "bg-primary text-primary-foreground"}`}>{!off.has(i) && <Check className="h-3.5 w-3.5" />}</button>
                  <CategoryChip value={it.category} onChange={(id) => setItems(items.map((x, j) => (j === i ? { ...x, category: id } : x)))} />
                  <span className="flex-1 truncate">{it.note}</span>
                  <input inputMode="decimal" aria-label="Сумма" value={it.amount} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)))} className="w-20 rounded-md bg-card p-1 text-right text-sm tabular-nums" />
                                  </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => (photo ? close() : setItems(null))}>Назад</Button>
              <Button className="flex-1" disabled={!chosen.length} onClick={() => {
                const ok = chosen;
                learnKeys(ok);
                const ids = ok.map((it) => addTx({ kind: "expense", amount: it.amount, category: it.category, note: it.note }).id);
                undoable(`Добавлено трат: ${ids.length}`, () => ids.forEach(removeTx));
                close();
              }}>Сохранить {chosen.length} · {rub(chosen.reduce((a, x) => a + x.amount, 0))}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
