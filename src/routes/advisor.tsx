import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { Shell, meta } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { calc, cat, GROUPS, obligationDue, incomeUpcoming, rub, setState, type State } from "@/lib/budget";
import { aiChat, detectService, type ChatMsg } from "@/lib/parse";

export const Route = createFileRoute("/advisor")({
  head: () => meta("Советник — Бережный бюджет", "Бережный финансовый советник: можно ли купить, как дела до дохода, обсуждение трат без упрёков."),
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
  const obl = s.obligations.map((o) => `${o.name} ${rub(o.amount)} — ${d(obligationDue(o))}${o.once ? " (разово)" : " (ежемесячно)"}`).join("; ") || "нет";
  const inc = s.incomes.map((i) => { const u = incomeUpcoming(s, i); return `${i.name} ${rub(i.amount)}${u ? ` — ${d(u)}` : ""}`; }).join("; ") || "нет";
  return `ФАКТЫ БЮДЖЕТА (единственный источник цифр):
Сегодня ${d(new Date())}. На карте ${rub(s.balance)}, наличными ${rub(s.cash ?? 0)}, всего ${rub(c.total)}.
Подушка (уже отложенные накопления, в «всего» НЕ входит): ${rub(s.cushion)}.
Ближайший доход ${d(c.next.date)}, через ${c.days} дн.
Зарезервировано под обязательные платежи до дохода и накопление на дальние: ${rub(c.reserve)}.
Свободно сегодня: ${rub(Math.max(0, c.freeToday))}, дневной ориентир ${rub(c.dailyNorm)}.
Свободно до дохода всего (всего − резерв): ${rub(Math.max(0, c.total - c.reserve))}.
Плановые платежи: ${obl}.
Плановые доходы: ${inc}.
Траты за 30 дней: ${spent}.
О пользователе: ${s.advisorAbout?.trim() || "не указано"}.`;
}

const RULES = `Ты — бережный финансовый советник в приложении «Бережный бюджет» для людей с СДВГ. Отвечай по-русски, коротко (до 8 предложений или короткий список), тепло и без морали.
ЖЁСТКИЕ ПРАВИЛА:
1. Используй ТОЛЬКО цифры из блока ФАКТЫ. Не выдумывай доходы, накопления, ставки, вклады. Если данных не хватает — так и скажи и спроси.
2. Никогда не ругай и не стыди. Кофе, такси, вкусное, отдых — законный способ восстановиться (особенно при СДВГ и беременности). Не предлагай урезать их, если пользователь сам не попросит искать, на чём сэкономить.
3. Не советуй тратить подушку или резерв на обязательные платежи на желания и крупные цели (ипотека, вложения). Подушка — на непредвиденное.
4. Не давай инвестиционных, кредитных, налоговых и медицинских рекомендаций; не предлагай кредиты, рассрочки и инвестиции. Для таких вопросов предложи обратиться к специалисту.
5. Оценка покупки: сравни цену со «Свободно до дохода всего» и с дневным ориентиром. Дай вердикт одной фразой («спокойно можно», «можно, но станет тесно до ДАТЫ: ≈ N ₽ в день», «лучше подождать до ДАТЫ»), потом 1–3 мягких варианта: подождать дохода, копить по N ₽ с каждого дохода (посчитай), посмотреть б/у или подождать акцию. Упомяни правило 48 часов для импульсивных покупок без давления.
6. Считай аккуратно, показывай простую арифметику.
7. Если человек просто хочет обсудить траты — слушай, отражай, задавай один уточняющий вопрос.`;

const QUICK = [
  "Можно ли купить моющий пылесос за 35 000 ₽?",
  "Как у меня дела до следующего дохода?",
  "Хочу просто обсудить мои траты за месяц",
  "Поищи, на чём можно мягко сэкономить",
];

function Advisor() {
  return <Shell title="Советник">{(s) => <Chat s={s} />}</Shell>;
}

function Chat({ s }: { s: State }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [about, setAbout] = useState(s.advisorAbout ?? "");
  const end = useRef<HTMLDivElement>(null);
  const hasKey = !!detectService(s.ai.apiKey);

  useEffect(() => { try { setMsgs(JSON.parse(localStorage.getItem(HKEY) ?? "[]")); } catch { /* empty */ } }, []);
  useEffect(() => { localStorage.setItem(HKEY, JSON.stringify(msgs.slice(-30))); end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send(q: string) {
    if (!q.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: q.trim() }];
    setMsgs(next); setText(""); setErr(""); setBusy(true);
    try {
      const a = await aiChat(`${RULES}\n\n${context(s)}`, next.slice(-12), s.ai);
      setMsgs([...next, { role: "assistant", content: a.trim() || "Не получилось ответить, попробуйте ещё раз." }]);
    } catch (e) { setErr(e instanceof Error ? e.message : "Не удалось связаться с ИИ"); }
    setBusy(false);
  }

  if (!hasKey) return (
    <div className="space-y-3 rounded-2xl bg-card p-5 text-sm">
      <p>Советнику нужен ваш ключ ИИ (например, DeepSeek). Он видит только цифры из приложения и не ругает за кофе.</p>
      <Button asChild><Link to="/settings">Добавить ключ в Настройках</Link></Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <details className="rounded-2xl bg-card p-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground">О себе — чтобы советы подходили именно вам</summary>
        <Textarea className="mt-3" rows={3} value={about} onChange={(e) => setAbout(e.target.value)}
          placeholder="Например: СДВГ, беременность, скоро декрет. Кофе и такси — мой отдых, не предлагать их урезать." />
        <Button size="sm" className="mt-2" onClick={() => setState((x) => ({ ...x, advisorAbout: about }))}>Сохранить</Button>
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
          <div key={i} className={`whitespace-pre-wrap rounded-2xl p-3 text-sm ${m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-4 bg-card"}`}>{m.content}</div>
        ))}
        {busy && <div className="mr-4 rounded-2xl bg-card p-3 text-sm text-muted-foreground">Думаю…</div>}
        {err && <p className="rounded-2xl bg-accent p-3 text-sm text-accent-foreground">{err}</p>}
        <div ref={end} />
      </div>

      <div className="sticky bottom-20 flex gap-2 bg-background py-2">
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Спросите о покупке или тратах…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }} />
        <div className="flex flex-col gap-1">
          <Button size="icon" aria-label="Отправить" disabled={busy || !text.trim()} onClick={() => send(text)}><Send /></Button>
          {msgs.length > 0 && <Button size="icon" variant="ghost" aria-label="Очистить разговор" onClick={() => setMsgs([])}><Trash2 /></Button>}
        </div>
      </div>
    </div>
  );
}
