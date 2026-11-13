import { calc, GROUPS, rub, type Group, type State } from "@/lib/budget";
import { weekSummary } from "@/lib/advisor-calc";
import { useEffect, useState } from "react";
import { ChevronDown, MessageCircleHeart } from "lucide-react";
import { Button } from "./ui/button";
import { aiChat, detectService } from "@/lib/parse";

/** Facts of the last 7 days, calculated on the phone — works offline and without AI. */
export function WeekSummary({ s }: { s: State }) {
  const w = weekSummary(s);
  const c = calc(s);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const signature = JSON.stringify([w.groups, w.income, w.count, w.upcoming.map((e) => [e.refId, e.amount])]);
  useEffect(() => { setNote(""); setError(""); }, [signature]);
  if (!w.count && !w.upcoming.length) return null;
  const groups = (Object.keys(GROUPS) as Group[]).filter((g) => w.groups[g]);
  return (
    <section className="space-y-2 rounded-2xl bg-card p-4 text-sm shadow-soft">
      <button type="button" aria-expanded={open} onClick={() => setOpen((x) => !x)} className="flex w-full items-center justify-between gap-2 text-left">
        <span>За 7 дней потрачено <span className="tabular-nums">{rub(groups.reduce((a, g) => a + (w.groups[g] ?? 0), 0))}</span></span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <>
      {groups.length ? (
        <ul className="space-y-1">
          {groups.map((g) => <li key={g} className="flex justify-between"><span>{GROUPS[g]}</span><span className="tabular-nums">{rub(w.groups[g] ?? 0)}</span></li>)}
        </ul>
      ) : <p className="text-muted-foreground">Трат не записано</p>}
      {w.income > 0 && <p className="flex justify-between"><span>Доходы</span><span className="tabular-nums text-primary">+{rub(w.income)}</span></p>}
      <p className="border-t border-border pt-2 text-xs text-muted-foreground">До дохода {c.next.date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}: ориентир {rub(c.dailyNorm)} в день.</p>
      {w.upcoming.length > 0 && (
        <div className="border-t border-border pt-2">
          <p className="mb-1 text-xs text-muted-foreground">Ближайшие платежи</p>
          {w.upcoming.map((e) => (
            <p key={e.refId + +e.date} className="flex justify-between text-xs"><span className="truncate">{e.date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} · {e.name}</span><span className="tabular-nums">{rub(e.amount)}</span></p>
          ))}
        </div>
      )}
      {detectService(s.ai.apiKey) && <div className="border-t border-border pt-2">
        {note ? <p className="text-sm">{note}</p> : <Button variant="ghost" size="sm" disabled={busy} onClick={async () => {
          setBusy(true); setError("");
          try {
            const reply = await aiChat("Одно короткое доброжелательное наблюдение о неделе, до двух предложений. Не советуй экономить, не оценивай траты, не ругай кофе, такси и отдых. Не вычисляй и не называй суммы, не давай советы по кредитам. Используй только предоставленные факты. Отвечай на русском, обращайся на вы.", [{ role: "user", content: `Сводка за 7 дней: ${groups.map((g) => `${GROUPS[g]} ${rub(w.groups[g] ?? 0)}`).join("; ")}. Доходы ${rub(w.income)}. Ближайшие платежи: ${w.upcoming.map((e) => `${e.name} ${rub(e.amount)}`).join("; ") || "нет"}.` }], s.ai);
            setNote(reply);
          } catch { setError("Не удалось получить наблюдение. Цифры сводки доступны без интернета."); }
          finally { setBusy(false); }
        }}><MessageCircleHeart />{busy ? "Смотрю неделю…" : "Наблюдение Помощника"}</Button>}
        {error && <p role="status" className="text-xs text-muted-foreground">{error}</p>}
      </div>}
      </>}
    </section>
  );
}
