import { clearDemo, startDemo } from "@/lib/demo";
import { GoalsSection } from "@/components/Goals";
import { activeGoals, cutGoals, goalSaved, overGoals, unassigned } from "@/lib/goals";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ShoppingBag,
  PiggyBank,
  Plus,
  Minus,
  Wand2,
  Lock,
  Loader2,
  ImageUp,
  Mic as MicIcon,
  Check,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Banknote,
} from "lucide-react";
import { TransferButton } from "@/components/Transfer";
import { WeekSummary } from "@/components/WeekSummary";
import { toast } from "sonner";
import { Shell, CatIcon, meta } from "@/components/Shell";
import { TxList } from "@/components/TxList";
import { addedToast, undoable } from "@/components/Undo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addTx,
  borrow,
  calc,
  cat,
  confirmIncome,
  coverFromCushion,
  dayKey,
  getState,
  learnKeys,
  moveIncome,
  pendingIncome,
  nextIncome,
  markIncomeArrived,
  setCushion,
  takeFromCushion,
  reconcile,
  removeTx,
  rub,
  setState,
  type Method,
  type State,
} from "@/lib/budget";
import { applyFx, detectService, parseImage, parseSmart, type Parsed } from "@/lib/parse";
import { CURRENCIES, cachedRate, currency, loadRates, toRub } from "@/lib/fx";
import { CategoryChip, CategoryPicker, MethodToggle } from "@/components/Pickers";
import { MicButton } from "@/components/Mic";
import { useFamily } from "@/lib/family";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/")({
  head: () =>
    meta(
      "Бережный бюджет — сколько можно потратить сегодня",
      "Спокойный бюджет без таблиц и чувства вины: одна цифра на день, сверка баланса в один клик.",
    ),
  component: () => <Shell wide>{(s) => <Today s={s} />}</Shell>,
});

function Today({ s }: { s: State }) {
  const c = calc(s);
  const [dialog, setDialog] = useState<
    null | "expense" | "income" | "reconcile" | "pocket" | "reserve" | "savings" | "buy"
  >(null);
  // home-screen shortcuts open straight into a window: /?add=expense | income | buy
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("add");
    if (p === "expense" || p === "income" || p === "buy") {
      setDialog(p);
      window.history.replaceState(null, "", "/");
    }
  }, []);
  useEffect(() => {
    const open = () => setDialog("expense");
    if (sessionStorage.getItem("quick-expense")) { sessionStorage.removeItem("quick-expense"); open(); }
    window.addEventListener("quick-expense", open);
    return () => window.removeEventListener("quick-expense", open);
  }, []);
  const [recMethod, setRecMethod] = useState<Method>("card");
  const [photo, setPhoto] = useState<File | null>(null);
  const pending = pendingIncome(s);
  const showOver = c.overspend > 0 && s.overspendHandled !== c.todayKey;
  const empty = s.txs.length === 0 && s.balance === 0;

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0">
    <div className="space-y-5">
      <section className="text-center">
        <p className="text-sm text-muted-foreground">Сегодня свободно</p>
        <p className="font-display text-[clamp(3.5rem,18vw,5.5rem)] leading-none tracking-tight text-foreground tabular-nums">
          {rub(Math.max(0, c.freeToday))}
        </p>
        {c.spentToday > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            потрачено {rub(c.spentToday)} из {rub(c.dailyNorm)}
          </p>
        )}
        <Link
          to="/calendar"
          className="mt-4 flex items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-soft active:scale-[0.99]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <CalendarDays className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-foreground">
              {c.days} {plural(c.days, "день", "дня", "дней")} до дохода ·{" "}
              {c.next.date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
            </span>
            <span className="block text-xs text-muted-foreground">
              {c.days > 1 ? <>с завтрашнего дня — по {rub(c.afterSpread)} в день</> : <>завтра придёт доход</>}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>
      </section>
      {pending && <IncomeArrived p={pending} />}

      {s.demo && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary p-3 text-sm text-secondary-foreground">
          <span>Вы смотрите пример</span>
          <Button size="sm" variant="outline" onClick={clearDemo}>Стереть пример</Button>
        </div>
      )}

      {empty && (
        <div className="space-y-3 rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
          <p className="font-medium">С чего начать</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Нажмите на «Карта» ниже и впишите, сколько там сейчас.</li>
            <li>Добавьте доходы с датами в <Link to="/incomes" className="underline">«План» → «Доходы»</Link>.</li>
            <li>Добавьте обязательные платежи: аренда, связь, кредиты.</li>
          </ol>
          <Button variant="outline" className="w-full" onClick={startDemo}>Посмотреть на примере</Button>
        </div>
      )}

      {showOver && (
        <div className="rounded-2xl bg-accent p-4 text-accent-foreground">
          <p className="text-sm">Сегодня вышло на {rub(c.overspend)} больше ориентира. Бывает. Как поступим?</p>
          <div className="mt-3 grid gap-2">
            <Button
              variant="secondary"
              className="h-auto whitespace-normal py-2"
              onClick={() => setState((x) => ({ ...x, overspendHandled: c.todayKey }))}
            >
              Распределить на оставшиеся дни {c.days > 1 && `(≈ ${rub(c.afterSpread)} в день)`}
            </Button>
            <Button
              variant="secondary"
              className="h-auto whitespace-normal py-2"
              disabled={s.cushion <= 0}
              onClick={() => {
                const t = coverFromCushion(c.overspend);
                setState((x) => ({ ...x, overspendHandled: c.todayKey }));
                addedToast(t, "Взяли из накоплений");
              }}
            >
              Взять из накоплений {s.cushion > 0 ? `(есть ${rub(s.cushion)})` : "(пока пуста)"}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" className="h-16 rounded-2xl text-base" onClick={() => setDialog("expense")}>
          <Minus /> Трата
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="h-16 rounded-2xl text-base"
          onClick={() => setDialog("income")}
        >
          <Plus /> Доход
        </Button>
      </div>

      <section className="rounded-2xl bg-card p-1 shadow-soft">
        <div className="grid grid-cols-2">
          <Stat
            label="Карта"
            Icon={CreditCard}
            value={rub(s.balance)}
            onClick={() => {
              setRecMethod("card");
              setDialog("reconcile");
            }}
          />
          <Stat
            label="Наличные"
            Icon={Banknote}
            value={rub(s.cash ?? 0)}
            onClick={() => {
              setRecMethod("cash");
              setDialog("reconcile");
            }}
          />
        </div>
        <TransferButton card={s.balance} cash={s.cash ?? 0} />
        <div className="mx-3 border-t border-border" />
        <div className="grid grid-cols-2">
          <Stat
            label="Отложено на платежи"
            Icon={Lock}
            value={c.shortfall > 0 ? `${rub(c.held)} из ${rub(c.reserve)}` : rub(c.reserve + c.aheadHeld)}
            progress={c.shortfall > 0 && c.reserve > 0 ? c.held / c.reserve : undefined}
            onClick={() => setDialog("reserve")}
          />
          <Stat label="Накопления" Icon={PiggyBank} value={rub(s.cushion)} onClick={() => setDialog("savings")} />
        </div>
      </section>
      {c.total < 0 && <BorrowCard gap={-c.total} />}
      {c.total >= 0 && c.shortfall > 0 && <ShortfallCard gap={c.shortfall} payGap={c.payGap} minDaily={c.minDaily} cushion={s.cushion} />}

    </div>
    <div className="space-y-5">
      <WeekSummary s={s} />
      {s.txs.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm text-muted-foreground">Только что записано</h2>
            <Link to="/analytics" className="text-sm text-muted-foreground">
              Все операции
            </Link>
          </div>
          <TxList txs={s.txs.slice(0, 4)} />
        </section>
      )}
    </div>

      <BuyDialog open={dialog === "buy"} onClose={() => setDialog(null)} />
      <ExpenseDialog
        open={dialog === "expense"}
        onClose={() => setDialog(null)}
        onSmart={(f) => {
          setPhoto(f);
          setDialog("pocket");
        }}
      />
      <IncomeDialog open={dialog === "income"} onClose={() => setDialog(null)} s={s} />
      <SavingsDialog open={dialog === "savings"} onClose={() => setDialog(null)} s={s} />
      <ReconcileDialog
        key={recMethod}
        initialMethod={recMethod}
        open={dialog === "reconcile"}
        onClose={() => setDialog(null)}
        balance={s.balance}
      />
      <ReserveDialog open={dialog === "reserve"} onClose={() => setDialog(null)} c={c} cushion={s.cushion} />
      <PocketDialog
        open={dialog === "pocket"}
        onClose={() => {
          setDialog(null);
          setPhoto(null);
        }}
        s={s}
        photo={photo}
      />
    </div>
  );
}

const plural = (n: number, a: string, b: string, c: string) =>
  n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c;

function Stat({
  label,
  value,
  Icon,
  onClick,
  progress,
}: {
  label: string;
  value: string;
  progress?: number | undefined;
  Icon: typeof Lock;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="rounded-xl p-3 text-left active:scale-[0.98] active:bg-secondary">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 break-words text-base leading-snug text-foreground tabular-nums">{value}</p>
      {progress !== undefined && (
        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-secondary">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }} />
        </span>
      )}
    </button>
  );
}

const dm = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
function ReserveDialog({
  open,
  onClose,
  c,
  cushion,
}: {
  open: boolean;
  onClose: () => void;
  c: ReturnType<typeof calc>;
  cushion: number;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Что отложено</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Эти деньги лежат на карте или наличными, но уже «заняты» платежами из Плана платежей. В «Сегодня свободно» они
          не входят.
        </p>
        {c.reserved.length + c.saving.length === 0 && (
          <p className="text-sm">Сейчас ничего не отложено — до {dm(c.next.date)} платежей нет, а следующие доходы покрывают платежи позже.</p>
        )}
        {c.reserved.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Платежи до {dm(c.next.date)} — целиком</p>
            <ul className="divide-y divide-border rounded-xl bg-secondary text-sm">
              {c.reserved.map(({ o, due }) => (
                <li key={o.id} className="flex justify-between gap-2 px-3 py-2">
                  <span className="truncate">
                    {o.name} · {dm(due)}
                  </span>
                  <span className="tabular-nums">{rub(o.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {c.saving.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Откладываю заранее на платежи после {dm(c.next.date)} — следующий доход их целиком не покроет</p>
            <ul className="divide-y divide-border rounded-xl bg-secondary text-sm">
              {c.saving.map(({ o, due, part }) => (
                <li key={o.id} className="flex justify-between gap-2 px-3 py-2">
                  <span className="truncate">
                    {o.name} · {dm(due)}
                  </span>
                  <span className="tabular-nums">
                    {rub(part)} из {rub(o.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="flex justify-between border-t border-border pt-2 text-sm">
          <span>Всего отложено</span>
          <span className="tabular-nums">
            {c.shortfall > 0 ? `${rub(c.held)} из ${rub(c.reserve)}` : rub(c.reserve + c.aheadHeld)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">Накопления лежат отдельно: {rub(cushion)}</p>
        <Button asChild variant="secondary">
          <Link to="/payments">Открыть платежи</Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function IncomeArrived({ p }: { p: NonNullable<ReturnType<typeof pendingIncome>> }) {
  const shift = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    moveIncome(p.income.id, dayKey(d));
    toast(`Ждём доход до ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`);
  };
  return (
    <div className="rounded-2xl bg-secondary p-4 text-secondary-foreground">
      <p className="text-sm">
        «{p.income.name}» ({rub(p.income.amount)}) уже пришёл?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => addedToast(confirmIncome(getState(), p.income), "Доход учтён")}>
          Да, пришёл
        </Button>
        <Button size="sm" variant="outline" onClick={() => shift(2)}>
          Сдвинуть на 2 дня
        </Button>
        <Button size="sm" variant="outline" onClick={() => shift(5)}>
          На 5 дней
        </Button>
      </div>
    </div>
  );
}

function ExpenseDialog({
  open,
  onClose,
  onSmart,
}: {
  open: boolean;
  onClose: () => void;
  onSmart: (photo: File | null) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("card");
  const [family, setFam] = useState(false);
  const fam = useFamily();
  const [cur, setCur] = useState("RUB");
  const [rate, setRate] = useState("");
  useEffect(() => {
    if (cur === "RUB") return;
    const c = cachedRate(cur);
    setRate(c ? String(Math.round(c * 10000) / 10000) : "");
    void loadRates().then((x) => {
      const r = x?.rates[cur];
      if (r) setRate(String(Math.round(r * 10000) / 10000));
    });
  }, [cur]);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const save = () => {
    if (!category) {
      toast("Выберите категорию");
      return;
    }
    const raw = Number(amount.replace(/\s/g, "").replace(",", "."));
    if (!raw) {
      toast("Сначала впишите сумму");
      return;
    }
    const r = cur === "RUB" ? 1 : Number(rate.replace(",", "."));
    if (!r) {
      toast("Впишите курс");
      return;
    }
    const a = Math.round(toRub(raw, r));
    const label = note.trim() || cat(category).name;
    const t = addTx({
      kind: "expense",
      amount: a,
      category,
      method,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(family ? { family: true } : {}),
      ...(cur !== "RUB"
        ? { orig: { amount: raw, currency: cur, rate: r }, note: `${label} · ${raw} ${currency(cur).sign}` }
        : {}),
    });
    setFam(false);
    addedToast(t, `${label}: ${rub(a)}`);
    setAmount("");
    setNote("");
    setCategory("");
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новая трата</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Input
            autoFocus
            inputMode="decimal"
            placeholder="Сумма"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-14 px-24 text-center text-2xl"
          />
          <div className="absolute inset-y-0 left-1 flex items-center">
            <div className="relative flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-lg text-muted-foreground">
              {currency(cur).sign}
              <select
                aria-label="Валюта"
                value={cur}
                onChange={(e) => setCur(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.sign} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Текст или голос"
              onClick={() => onSmart(null)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground active:scale-95"
            >
              <MicIcon className="h-5 w-5" />
            </button>
            <label
              aria-label="Чек или скриншот"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground active:scale-95"
            >
              <ImageUp className="h-5 w-5" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) onSmart(f);
                }}
              />
            </label>
          </div>
        </div>
        {cur !== "RUB" && (
          <Input
            inputMode="decimal"
            aria-label="Курс"
            placeholder="Курс, ₽ за 1"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        )}
        {cur !== "RUB" && Number(rate.replace(",", ".")) > 0 && Number(amount.replace(",", ".")) > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            ≈ {rub(toRub(Number(amount.replace(",", ".")), Number(rate.replace(",", "."))))} по курсу ЦБ. Можно
            поправить на курс банка.
          </p>
        )}
        <MethodToggle value={method} onChange={setMethod} />
        {fam && <FamilyToggle value={family} onChange={setFam} />}
        <Input
          placeholder="Описание, если хочется (например, такси)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <CategoryPicker value={category} onPick={setCategory} />
        <Button className="h-12 rounded-2xl" disabled={!category || !amount.trim()} onClick={save}>
          Внести трату
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function IncomeDialog({ open, onClose, s }: { open: boolean; onClose: () => void; s: State }) {
  const planned = (() => {
    const p = pendingIncome(s);
    if (p) return p.income;
    const n = nextIncome(s);
    return n.income && +n.date - Date.now() < 10 * 86400000 ? n.income : undefined;
  })();
  const [mark, setMark] = useState(true);
  const [family, setFam] = useState(false);
  const fam = useFamily();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<Method>("card");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Пришли деньги</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          inputMode="decimal"
          placeholder="Сумма, ₽"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-14 text-center text-2xl"
        />
        <MethodToggle value={method} onChange={setMethod} />
        <Input
          placeholder="Откуда (аванс, наличные, подработка, подарок)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {fam && <FamilyToggle value={family} onChange={setFam} />}
        {planned && !family && (
          <label className="flex items-start gap-2 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
            <input type="checkbox" className="mt-1" checked={mark} onChange={(e) => setMark(e.target.checked)} />
            <span>Это «{planned.name}» из плана — отметить пришедшей, чтобы не считать её дважды</span>
          </label>
        )}
        <Button
          onClick={() => {
            const a = Number(amount.replace(",", "."));
            if (!a) return;
            addedToast(
              addTx({
                kind: "income",
                amount: a,
                category: "income",
                note: note || (planned && mark && !family ? planned.name : "Разовый доход"),
                method,
                ...(family ? { family: true } : {}),
              }),
              `+${rub(a)} — дневная норма подросла`,
            );
            if (planned && mark && !family) markIncomeArrived(s, planned);
            setFam(false);
            setAmount("");
            setNote("");
            onClose();
          }}
        >
          Добавить
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function ReconcileDialog({
  open,
  onClose,
  balance,
  initialMethod,
}: {
  open: boolean;
  onClose: () => void;
  balance: number;
  initialMethod: Method;
}) {
  const [v, setV] = useState("");
  const [method, setMethod] = useState<Method>(initialMethod);
  const was = method === "cash" ? (getState().cash ?? 0) : balance;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{method === "cash" ? "Сколько наличных сейчас?" : "Сколько на карте сейчас?"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Старые траты вспоминать не нужно. Впишите, сколько есть сейчас, — дальше посчитаю от этой суммы.
        </p>
        <MethodToggle value={method} onChange={setMethod} />
        <Input
          autoFocus
          inputMode="decimal"
          placeholder={`Сейчас, ₽ (было ${rub(was)})`}
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="h-14 text-center text-xl"
        />
        <Button
          onClick={() => {
            const a = Number(v.replace(/\s/g, "").replace(",", "."));
            if (Number.isNaN(a) || v === "") return;
            const t = reconcile(a, method);
            if (t) undoable("Готово, расчёт обновлён", () => removeTx(t.id));
            else toast("Всё сходится");
            setV("");
            onClose();
          }}
        >
          Готово
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function ShortfallCard({ gap, payGap, minDaily, cushion }: { gap: number; payGap: number; minDaily: number; cushion: number }) {
  const [mode, setMode] = useState<null | "borrow">(null);
  const [more, setMore] = useState(false);
  if (mode === "borrow") return <BorrowCard gap={gap} />;
  const take = Math.min(gap, cushion);
  const btn = "h-auto whitespace-normal py-2";
  const move = <Button asChild variant="secondary" className={btn}><Link to="/payments">Перенести или оплатить частично</Link></Button>;
  return (
    <div className="space-y-2 rounded-2xl bg-accent p-4 text-accent-foreground">
      <p className="text-sm">
        {payGap > 0
          ? <>До дохода на платежи не хватает {rub(payGap)}{gap > payGap && <> (вместе с минимумом на жизнь {rub(minDaily)} в день — {rub(gap)})</>}.</>
          : <>На платежи денег хватает, но вместе с минимумом на жизнь {rub(minDaily)} в день не хватает {rub(gap)}.</>}{" "}
        Можно спокойно выбрать, как быть.
      </p>
      <div className="grid gap-2">
        {cushion > 0
          ? <Button className={btn} onClick={() => addedToast(coverFromCushion(take), "Взяли из накоплений")}>Взять из накоплений ({rub(take)})</Button>
          : move}
        {!more ? (
          <Button variant="ghost" className={btn} onClick={() => setMore(true)}>Другие варианты</Button>
        ) : (
          <>
            {cushion > 0 && move}
            <Button variant="secondary" className={btn} onClick={() => setMode("borrow")}>Уже оплачено в долг — записать, когда вернуть</Button>
          </>
        )}
      </div>
    </div>
  );
}

function BorrowCard({ gap }: { gap: number }) {
  const [from, setFrom] = useState("");
  const [date, setDate] = useState("");
  return (
    <div className="space-y-2 rounded-2xl bg-accent p-4 text-accent-foreground">
      <p className="text-sm">
        Потрачено на {rub(gap)} больше, чем было. Если это кредитка или заём — запишите, когда вернуть, и я добавлю это
        в платежи.
      </p>
      <Input
        placeholder="Откуда: кредитка, заняла у мамы"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="bg-card"
      />
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-card" />
      <Button
        className="w-full"
        disabled={!from.trim() || !date}
        onClick={() => {
          const { t, ob } = borrow(gap, from.trim(), date);
          undoable("Возврат добавлен в план платежей", () => {
            removeTx(t.id);
            setState((x) => ({ ...x, obligations: x.obligations.filter((o) => o.id !== ob.id) }));
          });
        }}
      >
        Записать
      </Button>
      <p className="text-xs">Если просто ошиблись в сумме — нажмите на «Карта» и впишите, сколько есть.</p>
    </div>
  );
}

function PocketDialog({
  open,
  onClose,
  s,
  photo,
}: {
  open: boolean;
  onClose: () => void;
  s: State;
  photo: File | null;
}) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<Parsed[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [via, setVia] = useState("");
  const [off, setOff] = useState<Set<number>>(new Set());
  const show = (list: Parsed[]) => {
    setItems(list);
    setOff(new Set());
  };
  const close = () => {
    setText("");
    setItems(null);
    onClose();
  };
  const fromImage = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      await loadRates();
      show(applyFx(await parseImage(f, getState().ai)));
      setVia(detectService(getState().ai.apiKey)?.name ?? "");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (open && photo) void fromImage(photo);
  }, [open, photo]);
  const chosen = (items ?? []).filter((it, i) => !off.has(i) && it.amount > 0);
  const toggle = (i: number) =>
    setOff((o) => {
      const n = new Set(o);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{photo ? "Траты со скриншота" : "Записать несколько трат"}</DialogTitle>
        </DialogHeader>
        {!items && photo ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Читаю скриншот… Переводы между своими счетами пропускаю.
              </>
            ) : (
              "Не получилось прочитать. Попробуйте другой скриншот."
            )}
          </p>
        ) : !items ? (
          <>
            <p className="text-sm text-muted-foreground">
              Вставьте скопированный текст, напишите или надиктуйте — приложение само разложит по категориям.
            </p>
            <div className="relative">
              <Textarea
                autoFocus
                rows={4}
                placeholder="Такси 450, кофе с круассаном 380, в аптеке 1200"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="pr-12"
              />
              <MicButton onText={(t) => setText((p) => (p ? p + ", " : "") + t)} />
            </div>
            <p className="text-xs text-muted-foreground">
              {detectService(s.ai.apiKey)
                ? "Знакомые слова разберу сама, незнакомые — через ИИ."
                : "Разбор на телефоне, по суммам и словам. Ключ ИИ можно добавить в настройках."}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input text-sm ${busy ? "opacity-50" : ""}`}
              >
                <ImageUp className="h-4 w-4" /> Скриншот
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    void fromImage(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <Button
                disabled={busy || !text.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await loadRates();
                    const r0 = await parseSmart(text, getState().ai);
                    const r = { ...r0, items: applyFx(r0.items) };
                    show(r.items);
                    setVia(r.via);
                  } catch (e) {
                    toast((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Wand2 />} Разобрать
              </Button>
            </div>
          </>
        ) : (
          <>
            {items.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {via === "device" ? "Разобрано на телефоне, без ИИ." : `Разобрал ${via}.`} Нажмите на категорию, чтобы
                поменять.
              </p>
            )}
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">Не нашла сумм. Попробуйте «кофе 200, такси 450».</p>
            )}
            {items.length > 1 && (
              <p className="text-xs text-muted-foreground">Снимите галочку с лишних или старых трат.</p>
            )}
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
              {items.map((it, i) => (
                <li
                  key={i}
                  className={`flex items-center gap-2 rounded-xl bg-secondary p-2 text-sm ${off.has(i) ? "opacity-40" : ""}`}
                >
                  <button
                    aria-label={off.has(i) ? "Включить" : "Не записывать"}
                    onClick={() => toggle(i)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border border-primary ${off.has(i) ? "" : "bg-primary text-primary-foreground"}`}
                  >
                    {!off.has(i) && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <CategoryChip
                    value={it.category}
                    onChange={(id) => setItems(items.map((x, j) => (j === i ? { ...x, category: id } : x)))}
                  />
                  <span className="flex-1 truncate">{it.note}</span>
                  <input
                    inputMode="decimal"
                    aria-label="Сумма"
                    value={it.amount}
                    onChange={(e) =>
                      setItems(
                        items.map((x, j) =>
                          j === i ? { ...x, amount: Number(e.target.value.replace(/\D/g, "")) || 0 } : x,
                        ),
                      )
                    }
                    className="w-20 rounded-md bg-card p-1 text-right text-sm tabular-nums"
                  />
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => (photo ? close() : setItems(null))}>
                Назад
              </Button>
              <Button
                className="flex-1"
                disabled={!chosen.length}
                onClick={() => {
                  const ok = chosen;
                  learnKeys(ok);
                  const ids = ok.map(
                    (it) =>
                      addTx({
                        kind: "expense",
                        amount: it.amount,
                        category: it.category,
                        note: it.note,
                        ...(it.orig ? { orig: it.orig } : {}),
                      }).id,
                  );
                  undoable(`Добавлено трат: ${ids.length}`, () => ids.forEach(removeTx));
                  close();
                }}
              >
                Сохранить {chosen.length} · {rub(chosen.reduce((a, x) => a + x.amount, 0))}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SavingsDialog({ open, onClose, s }: { open: boolean; onClose: () => void; s: State }) {
  const cashNow = Math.max(0, s.cushionCash ?? 0),
    cardNow = s.cushion - cashNow;
  const [card, setCard] = useState("");
  const [cash, setCash] = useState("");
  const [take, setTake] = useState("");
  const [to, setTo] = useState<Method>("card");
  const [back, setBack] = useState(false);
  const [date, setDate] = useState("");
  const [takeGoal, setTakeGoal] = useState("");
  const [cut, setCut] = useState<Record<string, string> | null>(null);
  const num = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));
  const close = () => {
    setCard("");
    setCash("");
    setTake("");
    setBack(false);
    setDate("");
    setCut(null);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Накопления</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Сейчас {rub(s.cushion)}: на карте {rub(cardNow)}, наличными {rub(cashNow)}. В «Сегодня свободно» не входят.
        </p>
        <GoalsSection s={s} />
        <div className="space-y-2 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
          <p className="font-medium">Просто указать сумму</p>
          <p className="text-xs">Сколько накоплено на самом деле. Остаток на карте и наличные не меняются.</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              inputMode="decimal"
              placeholder={`На карте (${Math.round(cardNow)})`}
              value={card}
              onChange={(e) => setCard(e.target.value)}
            />
            <Input
              inputMode="decimal"
              placeholder={`Наличными (${Math.round(cashNow)})`}
              value={cash}
              onChange={(e) => setCash(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={!card.trim() && !cash.trim()}
            onClick={() => {
              const nc = card.trim() ? num(card) : cardNow, nh = cash.trim() ? num(cash) : cashNow;
              const over = overGoals(s, nc + nh);
              if (over > 0 && !cut) {
                const gs = activeGoals(s).filter((g) => goalSaved(s, g.id) > 0);
                const held = gs.reduce((a, g) => a + goalSaved(s, g.id), 0);
                setCut(Object.fromEntries(gs.map((g) => [g.id, String(Math.round((goalSaved(s, g.id) / held) * over))])));
                return;
              }
              const cuts = cut ? Object.fromEntries(Object.entries(cut).map(([k, v]) => [k, num(v) || 0])) : {};
              const gt = cutGoals(cuts);
              const list = [...gt, ...setCushion(nc, nh)];
              if (list.length) undoable("Накопления обновлены", () => list.forEach((t) => removeTx(t.id)));
              close();
            }}
          >
            {cut ? "Убрать и сохранить" : "Сохранить"}
          </Button>
          {cut && (() => {
            const over = overGoals(s, (card.trim() ? num(card) : cardNow) + (cash.trim() ? num(cash) : cashNow));
            const sum = Object.values(cut).reduce((a, v) => a + (num(v) || 0), 0);
            return (
              <div className="space-y-2 rounded-lg bg-background p-2">
                <p className="text-xs">На целях лежит больше, чем накоплено. Из каких целей убрать {rub(over)}?</p>
                {Object.keys(cut).map((id) => {
                  const g = s.goals?.find((x) => x.id === id);
                  return (
                    <label key={id} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 truncate">{g?.name} ({rub(goalSaved(s, id))})</span>
                      <Input className="h-8 w-24" inputMode="decimal" value={cut[id]} onChange={(e) => setCut({ ...cut, [id]: e.target.value })} />
                    </label>
                  );
                })}
                {sum < over && <p className="text-xs text-muted-foreground">Осталось распределить {rub(over - sum)}.</p>}
              </div>
            );
          })()}
        </div>
        <div className="space-y-2 rounded-xl bg-muted p-3 text-sm">
          <p className="font-medium">Взять из накоплений</p>
          <p className="text-xs text-muted-foreground">
            Например, из «Кубышки». Деньги прибавятся к карте или наличным и к «Сегодня свободно».
          </p>
          <Input inputMode="decimal" placeholder="Сколько, ₽" value={take} onChange={(e) => setTake(e.target.value)} />
          <MethodToggle value={to} onChange={setTo} />
          {activeGoals(s).length > 0 && (
            <select value={takeGoal} onChange={(e) => setTakeGoal(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="">Без цели ({rub(unassigned(s))})</option>
              {activeGoals(s).map((g) => <option key={g.id} value={g.id}>Из цели «{g.name}» ({rub(goalSaved(s, g.id))})</option>)}
            </select>
          )}
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={back} onChange={(e) => setBack(e.target.checked)} /> Хочу вернуть до даты
            (появится в Плане платежей)
          </label>
          {back && <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          <Button
            variant="secondary"
            className="w-full"
            disabled={!(num(take) > 0) || (back && !date) || (!!takeGoal && num(take) > goalSaved(s, takeGoal))}
            onClick={() => {
              const a = Math.min(num(take), s.cushion > 0 ? s.cushion : num(take), takeGoal ? goalSaved(s, takeGoal) : Infinity);
              const { t, ob } = takeFromCushion(a, to, back ? date : undefined, takeGoal || undefined);
              undoable(`Из накоплений: ${rub(a)}`, () => {
                removeTx(t.id);
                if (ob) setState((x) => ({ ...x, obligations: x.obligations.filter((o) => o.id !== ob.id) }));
              });
              close();
            }}
          >
            Взять
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          <b>Отложили с карты</b> — запишите трату в категории «Накопления» или нажмите «Отложить» у цели.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function FamilyToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
      <span>
        Перевод внутри семьи
        <span className="block text-xs text-muted-foreground">Остаток меняется, но в семейных итогах не считается</span>
      </span>
      <Switch checked={value} onCheckedChange={onChange} />
    </label>
  );
}

/** Quick purchase check: price (+ optional name/photo) → ready question for the Помощник. */
function BuyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [price, setPrice] = useState("");
  const [what, setWhat] = useState("");
  const [img, setImg] = useState<{ dataUrl: string; type: string; name: string } | null>(null);
  const ok = Number(price.replace(",", ".")) > 0 || !!img;
  function go() {
    const n = Number(price.replace(",", "."));
    const q = `Хочу купить${what.trim() ? ` ${what.trim()}` : ""}${n > 0 ? ` за ${rub(n)}` : " (цена на скриншоте)"}. Можно ли спокойно, и сколько останется в день до дохода?`;
    sessionStorage.setItem("berezhny-advisor-ask", JSON.stringify({ q, img }));
    setPrice("");
    setWhat("");
    setImg(null);
    onClose();
    void nav({ to: "/advisor" });
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Оценить покупку</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Помощник посчитает по вашим цифрам, впишется ли покупка и сколько останется в день.
        </p>
        <Input
          inputMode="decimal"
          autoFocus
          placeholder="Цена, ₽"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <Input placeholder="Что это (необязательно)" value={what} onChange={(e) => setWhat(e.target.value)} />
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-input p-2 text-sm text-muted-foreground">
          {img ? (
            <img src={img.dataUrl} alt="" className="h-10 w-10 rounded object-cover" />
          ) : (
            <ImageUp className="h-4 w-4" />
          )}
          <span className="flex-1 truncate">{img ? img.name : "Добавить фото или скриншот товара"}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const r = new FileReader();
              r.onload = () => setImg({ dataUrl: String(r.result), type: f.type, name: f.name });
              r.readAsDataURL(f);
            }}
          />
        </label>
        {!detectService(getState().ai.apiKey) && (
          <p className="text-xs text-muted-foreground">Для оценки нужен ключ ИИ — его можно добавить в Настройках.</p>
        )}
        <Button disabled={!ok} onClick={go}>
          Оценить
        </Button>
      </DialogContent>
    </Dialog>
  );
}
