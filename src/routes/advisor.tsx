import { GUIDE_TEXT } from "@/lib/guide";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Shell, meta } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { calc, cat, forecast, GROUPS, obligationDue, paidAmount, incomeUpcoming, periodOf, rub, setState, type State } from "@/lib/budget";
import { aiChat, detectService, type ChatMsg } from "@/lib/parse";
import { familyTotals, getFamily } from "@/lib/family";

/** «Оценить покупку» on the home screen leaves a ready question here (sessionStorage). */
const ASK_KEY = "berezhny-advisor-ask";

export const Route = createFileRoute("/advisor")({
  head: () => meta("Помощник — Бережный бюджет", "Бережный финансовый помощник: можно ли купить, как дела до дохода, обсуждение трат без упрёков."),
  component: Advisor,
});

const HKEY = "berezhny-advisor-chat";
const d = (x: Date) => x.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

/** Facts of the budget the advisor must rely on — it never invents numbers. */
function context(s: State) {
  const c = calc(s);
  const since = Date.now() - 30 * 86400000;
  const by: Record<string, number> = {};
  for (const t of s.txs) if (t.kind === "expense" && +new Date(t.date) >= since) by[t.category] = (by[t.category] ?? 0) + t.amount;
  const spent = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([id, v]) => `${cat(id).name} (${GROUPS[cat(id).group]}): ${rub(v)}`).join("; ") || "нет записей";
  const obl = s.obligations.map((o) => {
    const due = obligationDue(o), paid = paidAmount(s, o, due);
    const st = paid >= o.amount ? "ОПЛАЧЕНО" : paid > 0 ? `внесено ${rub(paid)} из ${rub(o.amount)}, осталось ${rub(o.amount - paid)}` : "ещё не оплачено";
    return `${o.name} ${rub(o.amount)} — ${d(due)}${o.once ? " (разово)" : " (ежемесячно)"} — ${st}`;
  }).join("; ") || "нет";
  const resv = [...c.reserved.map((r) => `${r.o.name} ${rub(r.o.amount - paidAmount(s, r.o, r.due))}`), ...c.saving.map((x) => `${x.o.name} (копится) ${rub(x.part)}`)].join("; ") || "ничего";
  const month = periodOf(new Date());
  const inc = s.incomes.map((i) => { const u = incomeUpcoming(s, i); return `${i.name} ${rub(i.amount)}${i.method === "cash" ? " наличными" : ""}${i.skip === month ? " — В ЭТОМ МЕСЯЦЕ ОТКЛЮЧЕНА, не рассчитывай на неё" : ""}${u ? ` — ${d(u)}` : ""}`; }).join("; ") || "нет";
  const recent = s.txs.filter((t) => +new Date(t.date) >= since && (t.orig || t.family)).slice(0, 15)
    .map((t) => `${d(new Date(t.date))} ${t.note || cat(t.category).name} ${rub(t.amount)}${t.orig ? ` (= ${t.orig.amount} ${t.orig.currency} по курсу ${t.orig.rate})` : ""}${t.family ? " — перевод внутри семьи, не трата" : ""}`).join("; ") || "нет";
  const f = getFamily();
  let fam = "семейный доступ не подключён";
  if (f?.members?.length) {
    const ft = familyTotals(f.members);
    fam = `участников ${f.members.length}; свободно сегодня вместе ${rub(ft.today)}; на картах и наличными вместе ${rub(ft.total)}; отложено на платежи вместе ${rub(ft.reserve)}; накопления вместе ${rub(ft.cushion)}; до ближайшего дохода через ${ft.nearestDays} дн. вместе можно ${rub(ft.untilIncome)}. Бюджеты раздельные: деньги партнёра — не твои, предлагай их только как тему для разговора, не как источник.`;
  }
  return `ФАКТЫ БЮДЖЕТА (единственный источник цифр):
Сегодня ${d(new Date())}. На карте ${rub(s.balance)}, наличными ${rub(s.cash ?? 0)}, всего ${rub(c.total)}.
Накопления (в «всего» НЕ входят): ${rub(s.cushion)}, из них наличными ${rub(s.cushionCash ?? 0)}.
Ближайший доход ${d(c.next.date)}, через ${c.days} дн.
Нужно на обязательные платежи до дохода и накопление на дальние: ${rub(c.reserve)}; реально отложено ${rub(c.held)}${c.shortfall > 0 ? `, не хватает ${rub(c.shortfall)} (сначала защищён минимум на жизнь ${rub(c.minDaily)}/день)` : ""}.
Свободно сегодня: ${rub(Math.max(0, c.freeToday))}, дневной ориентир ${rub(c.dailyNorm)}, с завтра по ${rub(c.afterSpread)} в день.
Свободно до дохода всего: ${rub(c.dailyNorm * c.days)}.
Что именно отложено сейчас: ${resv}.
Платежи и их состояние (оплаченные уже списаны и не резервируются): ${obl}.
Плановые доходы: ${inc}.
Траты за 30 дней: ${spent}.
Операции в валюте и семейные переводы за 30 дней: ${recent}.
Семья: ${fam}
О пользователе: ${s.advisorAbout?.trim() || "не указано"}.
Кредиты и долги (условия со слов пользователя): ${s.advisorLoans?.trim() || "не указаны"}.
Минимум на жизнь: ${rub(c.minDaily)} в день.
ПРОГНОЗ НА 60 ДНЕЙ (раздел «План», отрезки от дохода до дохода; траты на жизнь не учтены, «в день» = (деньги на начало − платежи) / дней):
${forecastText(s)}`;
}

function forecastText(s: State) {
  const segs = forecast(s, 60);
  if (!segs.length) return "нет данных";
  return segs.map((g, i) => {
    const inc = g.incomes.map((e) => `+${rub(e.amount)} ${e.name}`).join(", ");
    const pays = g.events.map((e) => `${d(e.date)} ${e.name} ${e.paid ? "оплачено" : rub(e.amount)}`).join(", ") || "нет";
    return `${i + 1}) ${d(g.start)} – ${d(g.end)} (${g.days} дн.)${inc ? `, в начале приходит ${inc}` : ""}; деньги на начало ${rub(g.money)}; платежи: ${pays}; итого платежей ${rub(g.payments)}; свободно ≈ ${rub(g.perDay)} в день${g.gap > 0 ? `; НЕ ХВАТАЕТ ${rub(g.gap)}` : ""}.`;
  }).join("\n");
}

const RULES = `Ты — бережный финансовый помощник в приложении «Бережный бюджет». Особенности человека смотри в поле «О себе», если оно есть. Отвечай простым живым русским языком без калек с английского, коротко (до 8 предложений или короткий список), тепло и без морали.
НЕ заканчивай ответ дежурными вопросами и предложениями («Хотите, я…?», «Нужно что-то ещё?»). Уточняющий вопрос задавай, только если без него нельзя посчитать.
Если спрашивают, как пользоваться приложением, отвечай по этой инструкции, не выдумывай кнопок и функций, которых в ней нет:
${GUIDE_TEXT}
ЖЁСТКИЕ ПРАВИЛА:
1. Используй ТОЛЬКО цифры из блока ФАКТЫ. Не выдумывай доходы, накопления, ставки, вклады. Если данных не хватает — так и скажи и спроси.
2. Никогда не ругай и не стыди. Кофе, такси, вкусное, отдых — законный способ восстановиться. Не предлагай урезать их, если пользователь сам не попросит искать, на чём сэкономить.
3. Не советуй тратить подушку или резерв на обязательные платежи на желания и крупные цели (ипотека, вложения). Подушка — на непредвиденное.
4. Не предлагай брать новые кредиты, рассрочки и инвестиции. По уже имеющимся долгам из блока «Кредиты и долги» можно помочь посчитать: когда выгоднее вернуть (учитывай ставку, льготный период, штрафы, дату платежа) — но только из свободных денег, не трогая резерв обязательных платежей и подушку. Если условий не хватает — спроси. Налоговые и медицинские вопросы — к специалисту.
8. Если приложен скриншот — сначала коротко перечисли, что на нём видно (цена, товар, условия), затем отвечай по правилам выше.
5. Оценка покупки: сравни цену со «Свободно до дохода всего» и с дневным ориентиром. Дай вердикт одной фразой («спокойно можно», «можно, но станет тесно до ДАТЫ: ≈ N ₽ в день», «лучше подождать до ДАТЫ»), покажи, сколько останется в день до дохода после покупки (свободно до дохода − цена) / дней. Если сейчас тесно — 1–2 варианта: купить после ДАТЫ дохода или откладывать по N ₽ с каждого дохода (посчитай). Не предлагай таймеры, вишлисты и «подождать 48 часов».
6. Считай аккуратно, показывай простую арифметику.
7. Если человек просто хочет обсудить траты — слушай и отражай, без лишних вопросов.
9. Сценарии «а что если» (доход уменьшится, выплата сдвинется, начнётся декрет, пособие, новый платёж): возьми отрезки из ПРОГНОЗА, замени только то, что изменил пользователь, и пересчитай каждый затронутый отрезок по формуле (деньги на начало − платежи) / дней; остаток или нехватка переходит в следующий отрезок. Покажи короткую таблицу «Период | было в день | станет в день», отметь отрезки ниже минимума на жизнь (он указан в ФАКТАХ) и предложи 1–2 спокойных варианта. Если не хватает данных (сумма, дата) — спроси. Подчеркни, что это прикидка, план в приложении не меняется.`;

const QUICK = [
  "Можно ли купить моющий пылесос за 35 000 ₽?",
  "Как у меня дела до следующего дохода?",
  "Хочу просто обсудить мои траты за месяц",
  "Поищи, на чём можно мягко сэкономить",
  "Что будет, если следующая зарплата будет на 10 000 ₽ меньше?",
];

function Advisor() {
  return <Shell title="Помощник">{(s) => <Chat s={s} />}</Shell>;
}

function Chat({ s }: { s: State }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [about, setAbout] = useState(s.advisorAbout ?? "");
  const [loans, setLoans] = useState(s.advisorLoans ?? "");
  const [img, setImg] = useState<{ dataUrl: string; type: string; name: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const hasKey = !!detectService(s.ai.apiKey);

  useEffect(() => {
    let h: ChatMsg[] = [];
    try { h = JSON.parse(localStorage.getItem(HKEY) ?? "[]"); } catch { /* empty */ }
    setMsgs(h);
    const raw = sessionStorage.getItem(ASK_KEY);
    if (raw && hasKey) {
      sessionStorage.removeItem(ASK_KEY);
      try { const a = JSON.parse(raw); void send(a.q, h, a.img ?? null); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { localStorage.setItem(HKEY, JSON.stringify(msgs.slice(-30))); end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send(q: string, base: ChatMsg[] = msgs, shot = img) {
    if ((!q.trim() && !shot) || busy) return;
    const content = (q.trim() || "Посмотри скриншот") + (shot ? "\n📷 скриншот" : "");
    const next = [...base, { role: "user" as const, content }];
    setMsgs(next); setText(""); setImg(null); setErr(""); setBusy(true);
    try {
      const a = await aiChat(`${RULES}\n\n${context(s)}`, next.slice(-12), s.ai, shot ?? undefined);
      setMsgs([...next, { role: "assistant", content: a.trim() || "Не получилось ответить, попробуйте ещё раз." }]);
    } catch (e) { setErr(e instanceof Error ? e.message : "Не удалось связаться с ИИ"); }
    setBusy(false);
  }

  if (!hasKey) return (
    <div className="space-y-3 rounded-2xl bg-card p-5 text-sm">
      <p>Помощнику нужен ваш ключ ИИ (например, DeepSeek). Он видит только цифры из приложения и не ругает за кофе.</p>
      <Button asChild><Link to="/settings">Добавить ключ в Настройках</Link></Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <details className="rounded-2xl bg-card p-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground">О себе — чтобы советы подходили именно вам</summary>
        <Textarea className="mt-3" rows={3} value={about} onChange={(e) => setAbout(e.target.value)}
          placeholder="Например: скоро декрет. Кофе и такси — мой отдых, не предлагать их урезать." />
        <p className="mt-3 text-muted-foreground">Кредиты и долги — чтобы спрашивать, когда лучше вернуть</p>
        <Textarea className="mt-1" rows={3} value={loans} onChange={(e) => setLoans(e.target.value)}
          placeholder="Например: кредитка Т-Банк, долг 40 000 ₽, беспроцентный период до 15 декабря, потом 30% годовых, минимальный платёж 2 000 ₽ 5-го числа. Маме должна 10 000 ₽ без срока." />
        <Button size="sm" className="mt-2" onClick={() => { setState((x) => ({ ...x, advisorAbout: about, advisorLoans: loans })); toast("Сохранено"); }}>Сохранить</Button>
      </details>

      {msgs.length === 0 && (
        <div className="grid gap-2">
          {QUICK.map((q) => (
            <button key={q} onClick={() => send(q)} className="rounded-2xl border border-border bg-card p-3 text-left text-sm">{q}</button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {msgs.map((m, i) => (
          m.role === "user"
            ? <div key={i} className="ml-8 whitespace-pre-wrap rounded-2xl bg-primary p-3 text-sm text-primary-foreground">{m.content}</div>
            : <div key={i} className="md mr-4 rounded-2xl bg-card p-3 text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}>{m.content}</ReactMarkdown></div>
        ))}
        {busy && <div className="mr-4 rounded-2xl bg-card p-3 text-sm text-muted-foreground">Думаю…</div>}
        {err && <p className="rounded-2xl bg-accent p-3 text-sm text-accent-foreground">{err}</p>}
        <div ref={end} />
      </div>

      <div className="sticky bottom-20 bg-background py-2">
      {img && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-card p-2 text-xs">
          <img src={img.dataUrl} alt="" className="h-10 w-10 rounded object-cover" />
          <span className="flex-1 truncate">{img.name}</span>
          <button aria-label="Убрать скриншот" onClick={() => setImg(null)}><X className="h-4 w-4" /></button>
        </div>
      )}
      <div className="flex gap-2">
        <label aria-label="Прикрепить скриншот" className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-md border border-input text-muted-foreground">
          <ImagePlus className="h-4 w-4" />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            const r = new FileReader(); r.onload = () => setImg({ dataUrl: String(r.result), type: f.type, name: f.name }); r.readAsDataURL(f);
          }} />
        </label>
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Спросите о покупке или тратах…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }} />
        <div className="flex flex-col gap-1">
          <Button size="icon" aria-label="Отправить" disabled={busy || (!text.trim() && !img)} onClick={() => send(text)}><Send /></Button>
          {msgs.length > 0 && <Button size="icon" variant="ghost" aria-label="Очистить разговор" onClick={() => setMsgs([])}><Trash2 /></Button>}
        </div>
      </div>
      </div>
    </div>
  );
}
