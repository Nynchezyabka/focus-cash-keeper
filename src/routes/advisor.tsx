import { activeGoals, familyCollected, goalSaved, unassigned } from "@/lib/goals";
import { GUIDE_TEXT } from "@/lib/guide";
import { paymentObligations } from "@/lib/loan-schedule";
import { debtFeeAt } from "@/lib/debt-fee";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Send, Trash2, X, Settings2, Eye, Calculator, Brain } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyAction, describeAction, parseActions, precompute, unverifiedSums, type AdvisorAction, freeUntilIncome } from "@/lib/advisor-calc";
import { toast } from "sonner";
import { TONES, STARTERS, greeting, isNextStep, nameOf, personaRules, toneOf } from "@/lib/persona";
import { Shell, meta } from "@/components/Shell";
import { HONEST_RULE, MEMORY_MAX, addMemory, extractRemember, forgetMemory, markOpener, memoryCommand, memoryOk, memoryPrompt, openerDue } from "@/lib/advisor-memory";
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
  dayKey,
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
function context(s: State, readable = false) {
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
        return `${o.name}${readable ? "" : ` [id=${o.id}]`} ${rub(o.amount)} — ${d(due)}${o.once ? " (разово)" : " (ежемесячно)"} — ${st}`;
      })
      .join(readable ? "\n" : "; ") || "нет";
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
        return `${i.name}${readable ? "" : ` [id=${i.id}]`} ${rub(i.amount)}${i.method === "cash" ? " наличными" : ""}${i.skip === month ? (readable ? " — отключён в этом месяце" : " — В ЭТОМ МЕСЯЦЕ ОТКЛЮЧЕНА, не рассчитывай на неё") : ""}${u ? ` — ${d(u)}` : ""}`;
      })
      .join(readable ? "\n" : "; ") || "нет";
  const recent =
    s.txs
      .filter((t) => +new Date(t.date) >= since)
      .slice(0, 15)
      .map(
        (t) =>
          `${d(new Date(t.date))} ${KIND[t.kind] ?? t.kind}: ${t.note || cat(t.category).name} ${rub(Math.abs(t.amount))}${t.method === "cash" ? " (наличные)" : ""}${t.orig ? ` (= ${t.orig.amount} ${t.orig.currency} по курсу ${t.orig.rate})` : ""}${t.family ? " — перевод внутри семьи, не трата" : ""}`,
      )
      .join(readable ? "\n" : "; ") || "нет";
  const f = getFamily();
  let fam = "семейный доступ не подключён";
  if (f?.members?.length && s.advisorNoFamily) fam = "пользователь попросил не передавать цифры семьи";
  else if (f?.members?.length) {
    const ft = familyTotals(f.members);
    fam = `участников ${f.members.length}; свободно сегодня вместе ${rub(ft.today)}; на картах и наличными вместе ${rub(ft.total)}; отложено на платежи вместе ${rub(ft.reserve)}; накопления вместе ${rub(ft.cushion)}; до ближайшего дохода через ${ft.nearestDays} дн. вместе можно ${rub(ft.untilIncome)}. ${readable ? "Бюджеты участников остаются раздельными." : "Бюджеты раздельные: деньги партнёра — не твои, предлагай их только как тему для разговора, не как источник."}`;
  }
  const goalsText = activeGoals(s).map((g) => {
    const mine = goalSaved(s, g.id);
    return `«${g.name}» нужно ${rub(g.target)}${g.date ? ` к ${g.date}` : ""}, ${g.family && !s.advisorNoFamily ? `мой вклад ${rub(mine)}, всего собрано вместе ${rub(familyCollected(g.id, mine))} (семейная)` : `собрано ${rub(mine)}`}`;
  }).join(readable ? "\n" : "; ") + `${readable ? "\n" : "; "}без цели ${rub(unassigned(s))}`;
  if (readable) return [
    `Деньги сейчас: На карте ${rub(s.balance)}, наличными ${rub(s.cash ?? 0)}, всего ${rub(c.total)}.\nНакопления ${rub(s.cushion)}, из них наличными ${rub(s.cushionCash ?? 0)} — не входят в общий остаток.`,
    `До ближайшего дохода: ${d(c.next.date)}, через ${c.days} дн.\nСвободно сегодня ${rub(Math.max(0, c.freeToday))}. Дневной ориентир ${rub(c.dailyNorm)}, с завтрашнего дня ${rub(c.afterSpread)} в день.\nСвободно до дохода ${rub(freeUntilIncome(c))}. Минимум на жизнь ${rub(c.minDaily)} в день.`,
    `Отложено на платежи: ${rub(c.held)} из необходимых ${rub(c.reserve)}.${c.shortfall > 0 ? `\nНа платежи не хватает ${rub(c.payGap)}${c.shortfall !== c.payGap ? `; вместе с минимумом на жизнь — ${rub(c.shortfall)}` : ""}.` : ""}\n${resv}`,
    `Платежи: ${obl}`,
    `Плановые доходы: ${inc}`,
    `Траты за 30 дней: ${spent}`,
    `Последние операции: ${recent}`,
    `Семья: ${fam}`,
    `Цели накоплений: ${goalsText}`,
    `О вас и ваши правила: ${s.advisorAbout?.trim() || "не указано"}`,
    `Кредиты и долги: ${s.advisorLoans?.trim() || "не указаны"}\n${s.obligations.filter((o) => o.debtFee).map((o) => { const r = debtFeeAt(s, o, dayKey(new Date())); const due = o.once ? debtFeeAt(s, o, o.once) : null; return `${o.name}: ${r ? `плата на сегодня ${rub(r.fee)}, в день ${rub(r.daily)}` : "расчёт недоступен"}${due ? `; к ${d(obligationDue(o))} плата ${rub(due.fee)}, вместе с долгом ${rub(due.total)}` : ""}`; }).join("\n")}`,
    `Подтверждённые предпочтения: ${s.advisorMemory?.join("\n") || "пока нет"}`,
    `Прогноз на 60 дней: ${forecastText(s)}`,
  ].join("\n\n");
  return `ТЕКУЩИЕ ФАКТЫ (собраны на устройстве ${new Date().toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}; единственный источник цифр, цифры из прошлых сообщений устарели):
Сегодня ${d(new Date())}, ${new Date().toLocaleDateString("ru-RU", { weekday: "long", year: "numeric" })}. На карте ${rub(s.balance)}, наличными ${rub(s.cash ?? 0)}, всего ${rub(c.total)}.
Накопления (в «всего» НЕ входят): ${rub(s.cushion)}, из них наличными ${rub(s.cushionCash ?? 0)}.
Ближайший доход ${d(c.next.date)}, через ${c.days} дн.
Нужно на обязательные платежи до дохода и накопление на дальние: ${rub(c.reserve)}; реально отложено ${rub(c.held)}${c.shortfall > 0 ? `, на платежи не хватает ${rub(c.payGap)}${c.shortfall !== c.payGap ? `, а вместе с минимумом на жизнь ${rub(c.minDaily)}/день — ${rub(c.shortfall)}` : ""}` : ""}.
Свободно сегодня: ${rub(Math.max(0, c.freeToday))}, дневной ориентир ${rub(c.dailyNorm)}, с завтрашнего дня по ${rub(c.afterSpread)} в день.
Сегодня потрачено (все траты дня, кроме оплаты плановых платежей): ${rub(c.spentToday)}${c.spentToday > 0 ? ` — ${s.txs.filter((t) => t.kind === "expense" && !t.obligationId && !t.goal && dayKey(new Date(t.date)) === c.todayKey).map((t) => `${t.note || cat(t.category).name} ${rub(t.amount)}`).join(", ")}` : ""}; из дневного ориентира ${rub(c.dailyNorm)}.
Свободно до дохода всего (с учётом потраченного сегодня): ${rub(freeUntilIncome(c))}.
Что именно отложено сейчас: ${resv}.
Платежи и их состояние (оплаченные уже списаны и не резервируются): ${obl}.
Плановые доходы: ${inc}.
Траты за 30 дней: ${spent}.
Последние операции за 30 дней (до 15): ${recent}.
Семья: ${fam}
Цели накоплений (часть накоплений, не отдельные деньги): ${goalsText}.
О пользователе и мои правила: ${s.advisorAbout?.trim() || "не указано"}.
Кредиты и долги (условия со слов пользователя): ${s.advisorLoans?.trim() || "не указаны"}.
Плата по сохранённым условиям долгов: ${s.obligations.filter((o) => o.debtFee).map((o) => { const r = debtFeeAt(s, o, dayKey(new Date())); const due = o.once ? debtFeeAt(s, o, o.once) : null; return `${o.name}: ${r ? `на сегодня ${rub(r.fee)}, в день ${rub(r.daily)}` : "расчёт недоступен"}${due ? `; к дате возврата ${o.once} плата ${rub(due.fee)}, с долгом ${rub(due.total)}` : ""}`; }).join("; ") || "не заданы"}.
Минимум на жизнь: ${rub(c.minDaily)} в день.
ПРОГНОЗ НА 60 ДНЕЙ (раздел «План», отрезки от дохода до дохода; дневной ориентир сглажен с учётом следующих отрезков, деньги на начало уже учитывают плановые траты на жизнь в предыдущих отрезках; не дели остаток самостоятельно):
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

const RULES = `Ты — помощник по личному бюджету в приложении «Бережный бюджет». Обращайся к человеку на «вы». Особенности человека смотри в поле «О себе», если оно есть. Отвечай простым живым русским языком без калек с английского, коротко (до 8 предложений или короткий список), тепло и без морали.
ГЛАВНЫЙ ПРИНЦИП: считает приложение, ты объясняешь. Если есть блок «РАСЧЁТ ПРИЛОЖЕНИЯ» — бери вердикт и цифры только оттуда, не пересчитывай их по-своему.
Разделяй источники: то, что взято из бюджета, начинай с «Из ваших данных:»; справку о налогах, пособиях, законах помечай «Общая информация (справочно):».
Не выдумывай кнопки, разделы и настройки. Если такой функции в приложении нет — честно скажи, что её нет.
ДЕЙСТВИЯ: если человек просит что-то сделать в приложении, добавь в конец ответа тег (он станет карточкой с кнопкой «Применить», сама ты ничего не меняешь):
[[transfer:card|СУММА]] — снять с карты в наличные; [[transfer:cash|СУММА]] — наличные на карту;
[[payment:НАЗВАНИЕ|СУММА|ГГГГ-ММ-ДД]] — разовый платёж в план; [[goal:НАЗВАНИЕ|СУММА]] — цель накоплений.
[[movePayment:ID|ГГГГ-ММ-ДД]] — перенести платёж; [[moveIncome:ID|ГГГГ-ММ-ДД]] — перенести ближайший доход. ID бери только из текущих фактов, никогда не выдумывай. Если запись неоднозначна, уточни название. Оплаченные строки графика не переноси.
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
1. Используй ТОЛЬКО цифры и дату из блока ФАКТЫ. Не выдумывай доходы, накопления, ставки, вклады. Если человек называет другую дату («сегодня 19 ноября») или другую сумму остатка — спокойно уточни, не ошибка ли это, и ничего не пересчитывай: считай по ФАКТАМ, пока данные в приложении не изменятся. Если данных не хватает — задай один короткий вопрос, не гадай.
2. Никогда не ругай и не стыди. Кофе, такси, вкусное, отдых — законный способ восстановиться. Не предлагай урезать их, если пользователь сам не попросит искать, на чём сэкономить.
3. Не советуй тратить накопления или резерв на обязательные платежи на желания и крупные цели (ипотека, вложения). Накопления — на непредвиденное.
4. Не предлагай брать новые кредиты, рассрочки и инвестиции. По уже имеющимся долгам объясняй только плату, рассчитанную приложением по сохранённым условиям: остаток, дата получения, бесплатные дни, ступени платы, дневной предел, включение дня возврата. Текст в «Кредиты и долги» — контекст, а не готовый расчёт: ставки из него не превращай в свои вычисления. Если расчёта нет — уточни недостающие условия или предложи сохранить их в карточке разового долга в «План → Платежи». Не используй резерв обязательных платежей и накопления. Налоговые и медицинские вопросы — к специалисту.
8. Если приложен скриншот — сначала коротко перечисли, что на нём видно (цена, товар, условия), затем отвечай по правилам выше.
5. Оценка покупки: сравни цену со «Свободно до дохода всего» и с дневным ориентиром. Дай вердикт одной фразой («спокойно можно», «можно, но станет тесно до ДАТЫ: ≈ N ₽ в день», «лучше подождать до ДАТЫ»), покажи, сколько останется в день до дохода после покупки (свободно до дохода − цена) / дней. Если сейчас тесно — 1–2 варианта: купить после ДАТЫ дохода или откладывать по N ₽ с каждого дохода (посчитай). Не предлагай таймеры, вишлисты и «подождать 48 часов».
6. Считай аккуратно, показывай простую арифметику.
7. Если человек просто хочет обсудить траты — слушай и отражай, без лишних вопросов.
9. Сценарии «а что если»: используй только РАСЧЁТ ПРИЛОЖЕНИЯ. Если он отсутствует, не пересчитывай прогноз сама: уточни сумму и дату или объясни, что такой расчёт пока недоступен. План от сценария не меняется.`;

type Msg = ChatMsg & { calc?: string; unverified?: number[]; done?: number[]; remember?: string; opener?: boolean };

function Advisor() {
  return <Shell title="Помощник" wide>{(s) => <Chat s={s} />}</Shell>;
}

function Chat({ s }: { s: State }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [panel, setPanel] = useState<"" | "rules" | "facts" | "memory">("");
  const [about, setAbout] = useState(s.advisorAbout ?? "");
  const [loans, setLoans] = useState(s.advisorLoans ?? "");
  const [img, setImg] = useState<{ dataUrl: string; type: string; name: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const grew = useRef(false);
  const hasKey = !!detectService(s.ai.apiKey);
  const [noKeyOpener] = useState(() => (hasKey ? null : openerDue(s)?.text(toneOf(s.advisorTone)) ?? null));

  useEffect(() => {
    let h: Msg[] = [];
    try {
      h = JSON.parse(localStorage.getItem(HKEY) ?? "[]");
    } catch {
      /* empty */
    }
    const op = hasKey ? openerDue(s) : null;
    if (op) { h = [...h, { role: "assistant", content: op.text(toneOf(s.advisorTone)), opener: true }]; grew.current = true; }
    if (op || noKeyOpener) markOpener();
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
    const pre = q.trim() ? precompute(s, q) : null;
    const cmd = !shot ? memoryCommand(q) : null;
    if (cmd) {
      let reply: string;
      if (cmd.add) {
        const ok = memoryOk(cmd.add);
        if (ok) setState((x) => ({ ...x, advisorMemory: addMemory(x.advisorMemory, cmd.add!) }));
        reply = ok ? `Запомнила: «${cmd.add}». Список — в «Что я помню о вас».` : "Это не запоминаю: суммы, даты, здоровье и настроение дня я беру из приложения или не храню вовсе.";
      } else {
        const before = s.advisorMemory?.length ?? 0;
        const after = forgetMemory(s.advisorMemory, cmd.forget!);
        setState((x) => ({ ...x, advisorMemory: after }));
        reply = after.length < before ? "Забыла. Больше это не учитываю." : "Такого в памяти не нашла. Посмотрите «Что я помню о вас».";
      }
      grew.current = true;
      setMsgs([...base, { role: "user", content: q.trim() }, { role: "assistant", content: reply }]);
      setText("");
      return;
    }
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
      const tone = toneOf(s.advisorTone);
      const sys = `${RULES}\n\n${personaRules(tone, nameOf(s.advisorName))}\n${HONEST_RULE}\n${memoryPrompt(s.advisorMemory)}${isNextStep(q) ? "\nЭТО ВОПРОС ПРО СЛЕДУЮЩИЙ ШАГ: ответь одним шагом." : ""}\n\n${facts}${pre ? `\n\nРАСЧЁТ ПРИЛОЖЕНИЯ ДЛЯ ЭТОГО ВОПРОСА (точный, объясни его, не меняй цифры):\n${pre}` : ""}`;
      const raw = (await aiChat(sys, next.slice(-12).map(({ role, content }) => ({ role, content })), s.ai, shot ?? undefined)).trim();
      const { clean: a, remember } = extractRemember(raw);
      const unverified = unverifiedSums(parseActions(a).clean, [facts, pre ?? "", ...next.filter((m) => m.role === "user").map((m) => m.content)]);
      grew.current = true;
      setMsgs([...next, { role: "assistant", content: a || "Не получилось ответить, попробуйте ещё раз.", ...(pre ? { calc: pre } : {}), ...(unverified.length ? { unverified } : {}), ...(remember && !s.advisorMemory?.includes(remember) ? { remember } : {}) }]);
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
        {noKeyOpener && <p className="rounded-xl bg-secondary p-3 text-secondary-foreground">{noKeyOpener}</p>}
        <p>
          Помощнику нужен ваш ключ ИИ (например, DeepSeek). Он видит только цифры из приложения и не ругает за кофе.
        </p>
        <Button asChild>
          <Link to="/settings">Добавить ключ в Настройках</Link>
        </Button>
      </div>
    );

  return (
    <div className="flex h-[calc(100dvh-11rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-64 flex-col lg:relative lg:mx-auto lg:h-[calc(100dvh-7rem)] lg:max-w-4xl lg:pl-60">
      <div className="mb-3 flex flex-wrap gap-2 lg:absolute lg:left-0 lg:top-0 lg:w-52 lg:flex-col lg:items-stretch">
        <p className="hidden px-1 text-xs text-muted-foreground lg:block">{nameOf(s.advisorName)} учитывает ваши правила, память и цифры приложения. Характер — над полем ввода.</p>
        <Button variant="secondary" size="sm" className="rounded-full lg:justify-start" onClick={() => setPanel("rules")}><Settings2 /> Мои правила</Button>
        <Button variant="secondary" size="sm" className="rounded-full lg:justify-start" onClick={() => setPanel("facts")}><Eye /> Что помощник видит</Button>
        <Button variant="secondary" size="sm" className="rounded-full lg:justify-start" onClick={() => setPanel("memory")}><Brain /> Что я помню{s.advisorMemory?.length ? ` (${s.advisorMemory.length})` : ""}</Button>
      </div>
      <Dialog open={panel === "memory"} onOpenChange={(o) => !o && setPanel("")}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Что я помню о вас</DialogTitle></DialogHeader>
          <MemoryList list={s.advisorMemory ?? []} />
        </DialogContent>
      </Dialog>
      <Dialog open={panel === "rules"} onOpenChange={(o) => !o && setPanel("")}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Мои правила</DialogTitle></DialogHeader>
          <Textarea rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Например: скоро декрет. Муж платит за квартиру. Кофе и такси — мой отдых, не предлагать их урезать." />
          <p className="text-xs text-muted-foreground">Помощник учитывает это в каждом ответе. Разговор целиком он не хранит — постоянное пишите сюда, а короткие предпочтения он может запомнить сам с вашего согласия.</p>
          <p className="text-sm text-muted-foreground">Кредиты и долги — чтобы спрашивать, когда лучше вернуть</p>
          <Textarea rows={3} value={loans} onChange={(e) => setLoans(e.target.value)} placeholder="Например: кредитка, долг 40 000 ₽, беспроцентный период до 15 декабря, потом 30% годовых, минимальный платёж 2 000 ₽ 5-го числа." />
          <Button onClick={() => { setState((x) => ({ ...x, advisorAbout: about, advisorLoans: loans })); toast("Сохранено"); setPanel(""); }}>Сохранить</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={panel === "facts"} onOpenChange={(o) => !o && setPanel("")}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Что Помощник видит сейчас</DialogTitle></DialogHeader>
          <div className="min-w-0 space-y-5 text-sm leading-relaxed">
            {context(s, true).split("\n\n").map((section, i) => {
              const colon = section.indexOf(": ");
              return <section key={i} className="min-w-0 border-t border-border pt-4 first:border-0 first:pt-0">
                <h3 className="mb-2 font-medium text-foreground">{section.slice(0, colon)}</h3>
                <p className="whitespace-pre-line break-words text-muted-foreground [overflow-wrap:anywhere]">{section.slice(colon + 2)}</p>
              </section>;
            })}
          </div>
        </DialogContent>
      </Dialog>

      {msgs.length === 0 && (
        <div className="space-y-2">
          <p className="rounded-2xl bg-card p-3 text-sm">{greeting(toneOf(s.advisorTone), nameOf(s.advisorName))}</p>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((q) => (
              <Button variant="outline" size="sm" key={q} className="rounded-full" onClick={() => (q.endsWith("…") ? setText(q.slice(0, -1) + " ") : send(q))}>{q}</Button>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-3">
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
                  <Button variant="ghost" size="sm" className="h-auto p-0 text-xs" onClick={() => recalc(i)}><Calculator className="h-3.5 w-3.5" /> Пересчитать по формуле</Button>
                </div>
              )}
              {m.remember && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs">
                  <span className="flex-1">Запомнить: «{m.remember}»?</span>
                  <Button size="sm" className="h-7" onClick={() => { setState((x) => ({ ...x, advisorMemory: addMemory(x.advisorMemory, m.remember!) })); setMsgs((all) => all.map((x, j) => (j === i ? { ...x, remember: undefined } : x)) as Msg[]); toast("Запомнила"); }}>Да</Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setMsgs((all) => all.map((x, j) => (j === i ? { ...x, remember: undefined } : x)) as Msg[])}>Не нужно</Button>
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

      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur">
        <div className="py-2">
          <div role="radiogroup" aria-label="Режим" className="mb-2 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-xs">
            {TONES.map((t) => (
              <button key={t.id} role="radio" aria-checked={toneOf(s.advisorTone) === t.id} onClick={() => setState((x) => ({ ...x, advisorTone: t.id }))} className={`rounded-lg py-1.5 ${toneOf(s.advisorTone) === t.id ? "bg-card font-medium shadow-soft" : "text-muted-foreground"}`}>{t.label}</button>
            ))}
          </div>
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
            <Textarea rows={1} className="min-h-10" value={text} onChange={(e) => setText(e.target.value)} placeholder="Спросите о покупке или планах" onKeyDown={(e) => {
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

function ActionCard({ a, s, done, onDone }: { a: AdvisorAction; s: State; done?: boolean | undefined; onDone: () => void }) {
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
          <Button size="sm" onClick={() => { if (applyAction(a)) { toast("Готово"); onDone(); } else toast(a.type === "transfer" ? "На счёте не хватает денег" : "Не удалось применить: проверьте запись, дату и наличие оплаты"); }}>Применить</Button>
          <Button size="sm" variant="ghost" onClick={() => setGone(true)}>Отклонить</Button>
        </div>
      )}
    </div>
  );
}

function MemoryList({ list }: { list: string[] }) {
  const save = (next: string[]) => setState((x) => ({ ...x, advisorMemory: next }));
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-muted-foreground">Короткие предпочтения, которые вы подтвердили. Хранятся только на этом телефоне и попадают в резервную копию. Суммы и даты Помощник всегда берёт из приложения. Можно сказать в чате «запомни, что…» или «забудь…».</p>
      {list.length === 0 && <p className="text-muted-foreground">Пока ничего.</p>}
      {list.map((line, i) => (
        <div key={i} className="flex items-center gap-2">
          <Textarea rows={1} className="min-h-9 flex-1" defaultValue={line} onBlur={(e) => { const v = e.target.value.trim(); if (v === line) return; if (!v) save(list.filter((_, j) => j !== i)); else if (memoryOk(v)) save(list.map((x, j) => (j === i ? v : x))); else { toast("Без сумм, дат и здоровья"); e.target.value = line; } }} />
          <Button size="sm" variant="ghost" onClick={() => save(list.filter((_, j) => j !== i))}>Удалить</Button>
        </div>
      ))}
      {list.length < MEMORY_MAX && (
        <div className="flex gap-2">
          <Textarea rows={1} className="min-h-9 flex-1" value={draft} placeholder="Например: лучше один шаг, а не список" onChange={(e) => setDraft(e.target.value)} />
          <Button size="sm" disabled={!draft.trim()} onClick={() => { if (!memoryOk(draft)) { toast("Без сумм, дат и здоровья"); return; } save(addMemory(list, draft)); setDraft(""); }}>Добавить</Button>
        </div>
      )}
      {list.length > 0 && <Button variant="outline" size="sm" onClick={() => { if (window.confirm("Стереть всё, что Помощник помнит?")) save([]); }}>Стереть всё</Button>}
    </div>
  );
}
