import { activeGoals, familyCollected, goalSaved, unassigned } from "@/lib/goals";
import { GUIDE_TEXT } from "@/lib/guide";
import { paymentObligations } from "@/lib/loan-schedule";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Send, Trash2, X, Settings2, Eye, Calculator } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyAction, describeAction, parseActions, precompute, unverifiedSums, type Action } from "@/lib/advisor-calc";
import { toast } from "sonner";
import { Shell, meta } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  calc,
  cat,
  forecast,
  GROUPS,
  obligationDue,
  paidAmount,
  incomeUpcoming,
  periodOf,
  rub,
  setState,
  type State,
} from "@/lib/budget";
import { aiChat, detectService, type ChatMsg } from "@/lib/parse";
import { familyTotals, getFamily } from "@/lib/family";

/** «Оценить покупку» on the home screen leaves a ready question here (sessionStorage). */
const ASK_KEY = "berezhny-advisor-ask";

export const Route = createFileRoute("/advisor")({
  head: () =>
    meta(
      "Помощник — Бережный бюджет",
      "Помощник по вашему бюджету: можно ли купить, как дела до дохода, обсуждение трат без упрёков.",
    ),
  component: Advisor,
});

const HKEY = "berezhny-advisor-chat";
const d = (x: Date) => x.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

const KIND: Record<string, string> = { expense: "трата", income: "доход", adjust: "сверка", cushion: "из накоплений", savings: "накопления", goal: "цель", transfer: "перевод карта↔наличные, не трата" };
/** Facts of the budget the advisor must rely on — it never invents numbers. */
function context(s: State) {
  const c = calc(s);
  const since = Date.now() - 30 * 86400000;
  const by: Record<string, number> = {};
  for (const t of s.txs)
    if (t.kind === "expense" && +new Date(t.date) >= since) by[t.category] = (by[t.category] ?? 0) + t.amount;
  const spent =
    Object.entries(by)
      .sort((a, b) => b[1] - a[1])
      .map(([id, v]) => `${cat(id).name} (${GROUPS[cat(id).group]}): ${rub(v)}`)
      .join("; ") || "нет записей";
  const obl =
    paymentObligations(s)
      .map((o) => {
        const due = obligationDue(o),
          paid = paidAmount(s, o, due);
        const st =
          paid >= o.amount
            ? "ОПЛАЧЕНО"
            : paid > 0
              ? `внесено ${rub(paid)} из ${rub(o.amount)}, осталось ${rub(o.amount - paid)}`
              : "ещё не оплачено";
        return `${o.name} ${rub(o.amount)} — ${d(due)}${o.once ? " (разово)" : " (ежемесячно)"} — ${st}`;
      })
      .join("; ") || "нет";
  const resv =
    [
      ...c.reserved.map((r) => `${r.o.name} ${rub(r.o.amount - paidAmount(s, r.o, r.due))}`),
      ...c.saving.map((x) => `${x.o.name} (копится) ${rub(x.part)}`),
    ].join("; ") || "ничего";
  const month = periodOf(new Date());
  const inc =
    s.incomes
      .map((i) => {
        const u = incomeUpcoming(s, i);
        return `${i.name} ${rub(i.amount)}${i.method === "cash" ? " наличными" : ""}${i.skip === month ? " — В ЭТОМ МЕСЯЦЕ ОТКЛЮЧЕНА, не рассчитывай на неё" : ""}${u ? ` — ${d(u)}` : ""}`;
      })
      .join("; ") || "нет";
  const recent =
    s.txs
      .filter((t) => +new Date(t.date) >= since)
      .slice(0, 15)
      .map(
        (t) =>
          `${d(new Date(t.date))} ${KIND[t.kind] ?? t.kind}: ${t.note || cat(t.category).name} ${rub(Math.abs(t.amount))}${t.method === "cash" ? " (наличные)" : ""}${t.orig ? ` (= ${t.orig.amount} ${t.orig.currency} по курсу ${t.orig.rate})` : ""}${t.family ? " — перевод внутри семьи, не трата" : ""}`,
      )
      .join("; ") || "нет";
  const f = getFamily();
  let fam = "семейный доступ не подключён";
  if (f?.members?.length && s.advisorNoFamily) fam = "пользователь попросил не передавать цифры семьи";
  else if (f?.members?.length) {
    const ft = familyTotals(f.members);
    fam = `участников ${f.members.length}; свободно сегодня вместе ${rub(ft.today)}; на картах и наличными вместе ${rub(ft.total)}; отложено на платежи вместе ${rub(ft.reserve)}; накопления вместе ${rub(ft.cushion)}; до ближайшего дохода через ${ft.nearestDays} дн. вместе можно ${rub(ft.untilIncome)}. Бюджеты раздельные: деньги партнёра — не твои, предлагай их только как тему для разговора, не как источник.`;
  }
  const goalsText = activeGoals(s).map((g) => {
    const mine = goalSaved(s, g.id);
    return `«${g.name}» нужно ${rub(g.target)}${g.date ? ` к ${g.date}` : ""}, ${g.family && !s.advisorNoFamily ? `мой вклад ${rub(mine)}, всего собрано вместе ${rub(familyCollected(g.id, mine))} (семейная)` : `собрано ${rub(mine)}`}`;
  }).join("; ") + `; без цели ${rub(unassigned(s))}`;
  return `ТЕКУЩИЕ ФАКТЫ (собраны на устройстве ${new Date().toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}; единственный источник цифр, цифры из прошлых сообщений устарели):
Сегодня ${d(new Date())}. На карте ${rub(s.balance)}, наличными ${rub(s.cash ?? 0)}, всего ${rub(c.total)}.
Накопления (в «всего» НЕ входят): ${rub(s.cushion)}, из них наличными ${rub(s.cushionCash ?? 0)}.
Ближайший доход ${d(c.next.date)}, через ${c.days} дн.
Нужно на обязательные платежи до дохода и накопление на дальние: ${rub(c.reserve)}; реально отложено ${rub(c.held)}${c.shortfall > 0 ? `, не хватает ${rub(c.shortfall)} (сначала защищён минимум на жизнь ${rub(c.minDaily)}/день)` : ""}.
Свободно сегодня: ${rub(Math.max(0, c.freeToday))}, дневной ориентир ${rub(c.dailyNorm)}, с завтрашнего дня по ${rub(c.afterSpread)} в день.
Свободно до дохода всего: ${rub(c.dailyNorm * c.days)}.
Что именно отложено сейчас: ${resv}.
Платежи и их состояние (оплаченные уже списаны и не резервируются): ${obl}.
Плановые доходы: ${inc}.
Траты за 30 дней: ${spent}.
Последние операции за 30 дней (до 15): ${recent}.
Семья: ${fam}
Цели накоплений (часть накоплений, не отдельные деньги): ${goalsText}.
О пользователе и мои правила: ${s.advisorAbout?.trim() || "не указано"}.
Кредиты и долги (условия со слов пользователя): ${s.advisorLoans?.trim() || "не указаны"}.
Минимум на жизнь: ${rub(c.minDaily)} в день.
ПРОГНОЗ НА 60 ДНЕЙ (раздел «План», отрезки от дохода до дохода; траты на жизнь не учтены, «в день» = (деньги на начало − платежи) / дней):
${forecastText(s)}`;
}

function forecastText(s: State) {
  const segs = forecast(s, 60);
  if (!segs.length) return "нет данных";
  return segs
    .map((g, i) => {
      const inc = g.incomes.map((e) => `+${rub(e.amount)} ${e.name}`).join(", ");
      const pays =
        g.events.map((e) => `${d(e.date)} ${e.name} ${e.paid ? "оплачено" : rub(e.amount)}`).join(", ") || "нет";
      return `${i + 1}) ${d(g.start)} – ${d(g.end)} (${g.days} дн.)${inc ? `, в начале приходит ${inc}` : ""}; деньги на начало ${rub(g.money)}; платежи: ${pays}; итого платежей ${rub(g.payments)}; свободно ≈ ${rub(g.perDay)} в день${g.gap > 0 ? `; НЕ ХВАТАЕТ ${rub(g.gap)}` : ""}.`;
    })
    .join("\n");
}

const RULES = `Ты — спокойная помощница по личному бюджету в приложении «Бережный бюджет». Обращайся к человеку на «вы». О себе говори в женском роде («поняла», «посмотрела»). Особенности человека смотри в поле «О себе», если оно есть. Отвечай простым живым русским языком без калек с английского, коротко (до 8 предложений или короткий список), тепло и без морали.
ГЛАВНЫЙ ПРИНЦИП: считает приложение, ты объясняешь. Если есть блок «РАСЧЁТ ПРИЛОЖЕНИЯ» — бери вердикт и цифры только оттуда, не пересчитывай их по-своему.
Разделяй источники: то, что взято из бюджета, начинай с «Из ваших данных:»; справку о налогах, пособиях, законах помечай «Общая информация (справочно):».
Не выдумывай кнопки, разделы и настройки. Если такой функции в приложении нет — честно скажи, что её нет.
ДЕЙСТВИЯ: если человек просит что-то сделать в приложении, добавь в конец ответа тег (он станет карточкой с кнопкой «Применить», сама ты ничего не меняешь):
[[transfer:card|СУММА]] — снять с карты в наличные; [[transfer:cash|СУММА]] — наличные на карту;
[[payment:НАЗВАНИЕ|СУММА|ГГГГ-ММ-ДД]] — разовый платёж в план; [[goal:НАЗВАНИЕ|СУММА]] — цель накоплений.
Не добавляй теги без просьбы человека.
НЕ заканчивай ответ дежурными вопросами и предложениями («Хотите, я…?», «Нужно что-то ещё?»). Уточняющий вопрос задавай, только если без него нельзя посчитать.
Если спрашивают, как пользоваться приложением, отвечай по этой инструкции, не выдумывай кнопок и функций, которых в ней нет:
${GUIDE_TEXT}
ЖЁСТКИЕ ПРАВИЛА:
0. Блок ФАКТЫ собран из приложения прямо сейчас и ВСЕГДА главнее прошлых сообщений. Если раньше в разговоре говорилось, что долг закрыт, платёж оплачен или доход пришёл, а в ФАКТАХ иначе — верь ФАКТАМ и коротко скажи, что видишь в приложении.
ПРАВИЛА ЧЕЛОВЕКА (выполняй, если не противоречат жёстким правилам): см. «Мои правила» в ФАКТАХ.
СПРАВКА ПО РОССИИ (используй для прикидок, называй это оценкой, точные суммы — у работодателя или СФР):
- Отпускные платят не позже чем за 3 дня до отпуска. Это деньги за дни отпуска, поэтому следующая зарплата будет меньше обычной. Предупреждай и предлагай часть отпускных оставить на жизнь после отпуска.
- Зарплата обычно в две части: аванс и расчёт, не реже раза в полмесяца; НДФЛ удерживается при расчёте.
- Больничный: первые 3 дня платит работодатель, остальное — СФР; размер от среднего заработка за 2 года: стаж до 5 лет — 60%, 5–8 лет — 80%, от 8 лет — 100%, с лимитом. Работодатель передаёт данные, СФР обычно платит в течение 10 рабочих дней после закрытия.
- Пособие по беременности и родам — 100% среднего заработка за 2 года (с лимитом), обычно 140 дней одной суммой. Пособие по уходу за ребёнком до 1,5 лет — 100% среднего заработка (с лимитом), приходит до 28-го числа за прошлый месяц. Цифры лимитов меняются каждый год — если не уверен, так и скажи.
1. Используй ТОЛЬКО цифры из блока ФАКТЫ. Не выдумывай доходы, накопления, ставки, вклады. Если данных не хватает — так и скажи и спроси.
2. Никогда не ругай и не стыди. Кофе, такси, вкусное, отдых — законный способ восстановиться. Не предлагай урезать их, если пользователь сам не попросит искать, на чём сэкономить.
3. Не советуй тратить накопления или резерв на обязательные платежи на желания и крупные цели (ипотека, вложения). Накопления — на непредвиденное.
4. Не предлагай брать новые кредиты, рассрочки и инвестиции. По уже имеющимся долгам из блока «Кредиты и долги» можно помочь посчитать: когда выгоднее вернуть (учитывай ставку, льготный период, штрафы, дату платежа) — но только из свободных денег, не трогая резерв обязательных платежей и накопления. Если условий не хватает — спроси. Налоговые и медицинские вопросы — к специалисту.
8. Если приложен скриншот — сначала коротко перечисли, что на нём видно (цена, товар, условия), затем отвечай по правилам выше.
5. Оценка покупки: сравни цену со «Свободно до дохода всего» и с дневным ориентиром. Дай вердикт одной фразой («спокойно можно», «можно, но станет тесно до ДАТЫ: ≈ N ₽ в день», «лучше подождать до ДАТЫ»), покажи, сколько останется в день до дохода после покупки (свободно до дохода − цена) / дней. Если сейчас тесно — 1–2 варианта: купить после ДАТЫ дохода или откладывать по N ₽ с каждого дохода (посчитай). Не предлагай таймеры, вишлисты и «подождать 48 часов».
6. Считай аккуратно, показывай простую арифметику.
7. Если человек просто хочет обсудить траты — слушай и отражай, без лишних вопросов.
9. Сценарии «а что если» (доход уменьшится, выплата сдвинется, начнётся декрет, пособие, новый платёж): возьми отрезки из ПРОГНОЗА, замени только то, что изменил пользователь, и пересчитай каждый затронутый отрезок по формуле (деньги на начало − платежи) / дней; остаток или нехватка переходит в следующий отрезок. Покажи короткую таблицу «Период | было в день | станет в день», отметь отрезки ниже минимума на жизнь (он указан в ФАКТАХ) и предложи 1–2 спокойных варианта. Если не хватает данных (сумма, дата) — спроси. Подчеркни, что это прикидка, план в приложении не меняется.`;

const QUICK = [
  "Можно ли купить пылесос за 35 000 ₽?",
  "Как у меня дела до следующего дохода?",
  "Что будет, если зарплата будет на 10 000 ₽ меньше?",
];
type Msg = ChatMsg & { calc?: string; unverified?: number[]; done?: number[] };

function Advisor() {
  return <Shell title="Помощник">{(s) => <Chat s={s} />}</Shell>;
}

function Chat({ s }: { s: State }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [panel, setPanel] = useState<"" | "rules" | "facts">("");
  const [about, setAbout] = useState(s.advisorAbout ?? "");
  const [loans, setLoans] = useState(s.advisorLoans ?? "");
  const [img, setImg] = useState<{ dataUrl: string; type: string; name: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const grew = useRef(false);
  const hasKey = !!detectService(s.ai.apiKey);

  useEffect(() => {
    let h: Msg[] = [];
    try {
      h = JSON.parse(localStorage.getItem(HKEY) ?? "[]");
    } catch {
      /* empty */
    }
    setMsgs(h);
    setReady(true);
    const raw = sessionStorage.getItem(ASK_KEY);
    if (raw && hasKey) {
      sessionStorage.removeItem(ASK_KEY);
      try {
        const a = JSON.parse(raw);
        void send(a.q, h, a.img ?? null);
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!ready) return; // never overwrite the saved chat before it is read
    localStorage.setItem(HKEY, JSON.stringify(msgs.slice(-30)));
    // the screen does not jump down when it opens — only when the conversation grows
    if (grew.current) end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    grew.current = false;
  }, [msgs, ready]);

  async function send(q: string, base: Msg[] = msgs, shot = img) {
    if ((!q.trim() && !shot) || busy) return;
    const content = (q.trim() || "Посмотри скриншот") + (shot ? "\n📷 скриншот" : "");
    const next: Msg[] = [...base, { role: "user", content }];
    grew.current = true;
    setMsgs(next);
    setText("");
    setImg(null);
    setErr("");
    setBusy(true);
    try {
      const facts = context(s);
      const pre = q.trim() ? precompute(s, q) : null;
      const sys = `${RULES}\n\n${facts}${pre ? `\n\nРАСЧЁТ ПРИЛОЖЕНИЯ ДЛЯ ЭТОГО ВОПРОСА (точный, объясни его, не меняй цифры):\n${pre}` : ""}`;
      const a = (await aiChat(sys, next.slice(-12).map(({ role, content }) => ({ role, content })), s.ai, shot ?? undefined)).trim();
      const unverified = unverifiedSums(parseActions(a).clean, [facts, pre ?? "", ...next.filter((m) => m.role === "user").map((m) => m.content)]);
      grew.current = true;
      setMsgs([...next, { role: "assistant", content: a || "Не получилось ответить, попробуйте ещё раз.", ...(pre ? { calc: pre } : {}), ...(unverified.length ? { unverified } : {}) }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось связаться с ИИ");
    }
    setBusy(false);
  }

  function recalc(i: number) {
    const q = [...msgs.slice(0, i)].reverse().find((m) => m.role === "user")?.content ?? "";
    const c = calc(s);
    const out = precompute(s, q) ?? `Из ваших данных: свободно сегодня ${rub(Math.max(0, c.freeToday))}, до дохода ${d(c.next.date)} — ${rub(c.dailyNorm * c.days)}, это ${rub(c.dailyNorm)} в день. Отложено на платежи ${rub(c.held)} из ${rub(c.reserve)}.`;
    grew.current = true;
    setMsgs([...msgs, { role: "assistant", content: `**Расчёт приложения:**\n\n${out}`, calc: out }]);
  }

  if (!hasKey)
    return (
      <div className="space-y-3 rounded-2xl bg-card p-5 text-sm">
        <p>
          Помощнику нужен ваш ключ ИИ (например, DeepSeek). Он видит только цифры из приложения и не ругает за кофе.
        </p>
        <Button asChild>
          <Link to="/settings">Добавить ключ в Настройках</Link>
        </Button>
      </div>
    );

  return (
    <div className="pb-36">
      <div className="mb-3 flex gap-2">
        <Button variant="secondary" size="sm" className="rounded-full" onClick={() => setPanel("rules")}><Settings2 /> Мои правила</Button>
        <Button variant="secondary" size="sm" className="rounded-full" onClick={() => setPanel("facts")}><Eye /> Что помощник видит</Button>
      </div>
      <Dialog open={panel === "rules"} onOpenChange={(o) => !o && setPanel("")}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Мои правила</DialogTitle></DialogHeader>
          <Textarea rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Например: скоро декрет. Муж платит за квартиру. Кофе и такси — мой отдых, не предлагать их урезать." />
          <p className="text-xs text-muted-foreground">Помощник учитывает это в каждом ответе. Свой разговор он не запоминает — постоянное пишите сюда.</p>
          <p className="text-sm text-muted-foreground">Кредиты и долги — чтобы спрашивать, когда лучше вернуть</p>
          <Textarea rows={3} value={loans} onChange={(e) => setLoans(e.target.value)} placeholder="Например: кредитка, долг 40 000 ₽, беспроцентный период до 15 декабря, потом 30% годовых, минимальный платёж 2 000 ₽ 5-го числа." />
          <Button onClick={() => { setState((x) => ({ ...x, advisorAbout: about, advisorLoans: loans })); toast("Сохранено"); setPanel(""); }}>Сохранить</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={panel === "facts"} onOpenChange={(o) => !o && setPanel("")}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Что Помощник видит сейчас</DialogTitle></DialogHeader>
          <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{context(s)}</pre>
        </DialogContent>
      </Dialog>

      {msgs.length === 0 && (
        <div className="grid gap-2">
          {QUICK.map((q) => (
            <button key={q} onClick={() => send(q)} className="rounded-2xl border border-border bg-card p-3 text-left text-sm">{q}</button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {msgs.map((m, i) => {
          if (m.role === "user") return <div key={i} className="ml-8 whitespace-pre-wrap rounded-2xl bg-primary p-3 text-sm text-primary-foreground">{m.content}</div>;
          const { clean, actions } = parseActions(m.content);
          return (
            <div key={i} className="mr-4 space-y-2">
              <div className="md overflow-x-auto rounded-2xl bg-card p-3 text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={["img"]} unwrapDisallowed={false} components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}>{clean}</ReactMarkdown>
              </div>
              {m.unverified && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <span>Сумма {m.unverified.map(rub).join(", ")} рассчитана моделью ориентировочно.</span>
                  <button className="inline-flex items-center gap-1 font-medium text-primary" onClick={() => recalc(i)}><Calculator className="h-3.5 w-3.5" /> Пересчитать по формуле</button>
                </div>
              )}
              {actions.map((a, k) => (
                <ActionCard key={k} a={a} s={s} done={m.done?.includes(k)} onDone={() => setMsgs((all) => all.map((x, j) => (j === i ? { ...x, done: [...(x.done ?? []), k] } : x)))} />
              ))}
            </div>
          );
        })}
        {busy && <div className="mr-4 rounded-2xl bg-card p-3 text-sm text-muted-foreground">Думаю…</div>}
        {err && <p className="rounded-2xl bg-accent p-3 text-sm text-accent-foreground">{err}</p>}
        <div ref={end} />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-10 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-md px-[max(1.25rem,env(safe-area-inset-left))] py-2">
          {img && (
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-card p-2 text-xs">
              <img src={img.dataUrl} alt="" className="h-10 w-10 rounded object-cover" />
              <span className="flex-1 truncate">{img.name}</span>
              <button aria-label="Убрать скриншот" onClick={() => setImg(null)}><X className="h-4 w-4" /></button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <label aria-label="Прикрепить скриншот" className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-md border border-input text-muted-foreground">
              <ImagePlus className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const r = new FileReader();
                r.onload = () => setImg({ dataUrl: String(r.result), type: f.type, name: f.name });
                r.readAsDataURL(f);
              }} />
            </label>
            <Textarea rows={1} className="min-h-10" value={text} onChange={(e) => setText(e.target.value)} placeholder="Спросите о покупке или тратах…" onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); }
            }} />
            <Button size="icon" aria-label="Отправить" disabled={busy || (!text.trim() && !img)} onClick={() => send(text)}><Send /></Button>
            {msgs.length > 0 && <Button size="icon" variant="ghost" aria-label="Новый разговор" title="Новый разговор" onClick={() => setMsgs([])}><Trash2 /></Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ a, s, done, onDone }: { a: Action; s: State; done?: boolean | undefined; onDone: () => void }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const v = describeAction(a, s);
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-3 text-sm">
      <p className="font-medium text-foreground">{v.title}</p>
      <p className="text-xs text-muted-foreground">Было: {v.before}</p>
      <p className="text-xs text-foreground">Станет: {v.after}</p>
      {done ? <p className="text-xs text-primary">Применено</p> : (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { if (applyAction(a)) { toast("Готово"); onDone(); } else toast("Не получилось: на счёте не хватает денег"); }}>Применить</Button>
          <Button size="sm" variant="ghost" onClick={() => setGone(true)}>Отклонить</Button>
        </div>
      )}
    </div>
  );
}
