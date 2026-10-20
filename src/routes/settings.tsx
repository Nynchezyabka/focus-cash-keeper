import { Link, createFileRoute } from "@tanstack/react-router";
import { detectService } from "@/lib/parse";
import { useRef, useState } from "react";
import { APP_VERSION, checkForUpdates, hardReload, updatesSupported } from "@/lib/pwa";
import { Download, Upload, ShieldCheck, ChevronRight, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { WhatsNew } from "@/components/WhatsNew";
import { Shell, meta } from "@/components/Shell";
import { undoable } from "@/components/Undo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getState, replaceState, setState, type AiSettings, type State } from "@/lib/budget";

export const Route = createFileRoute("/settings")({
  head: () => meta("Настройки — Бережный бюджет", "Резервная копия в JSON, свой ключ ИИ для разбора трат. Данные хранятся только на устройстве."),
  component: () => <Shell title="Настройки">{(s) => <Settings s={s} />}</Shell>,
});


function Settings({ s }: { s: State }) {
  const file = useRef<HTMLInputElement>(null);
  const setAi = (p: Partial<AiSettings>) => setState((x) => ({ ...x, ai: { ...x.ai, ...p } }));
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="font-display text-lg">Распознавание трат</h2>
        <p className="text-sm text-muted-foreground">Когда вы пишете «такси 450, кофе 380», приложение раскладывает это на отдельные траты.</p>
        <Input type="password" autoComplete="off" placeholder="Вставьте ваш API-ключ (необязательно)" value={s.ai.apiKey} onChange={(e) => setAi({ apiKey: e.target.value })} />
        {(() => {
          const svc = detectService(s.ai.apiKey);
          if (svc) return <p className="text-sm text-primary">✓ Ключ {svc.name} — будет понимать любые формулировки.</p>;
          if (s.ai.apiKey.trim()) return <p className="text-sm text-muted-foreground">Не узнаю этот ключ. Подходят ключи OpenAI, OpenRouter, Google Gemini, Groq, Anthropic, DeepSeek, xAI.</p>;
          return (
            <div className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
              <p className="font-medium">Сейчас: встроенный режим, без ИИ</p>
              <p className="mt-1 text-xs">Работает прямо на телефоне: находит суммы и узнаёт слова вроде «такси», «аптека», «кофе». Бесплатно и без интернета, но сложные фразы («закинула пятихатку на телефон») может не понять.</p>
            </div>
          );
        })()}
        <p className="text-xs text-muted-foreground">Ключ хранится только в этом браузере и уходит напрямую в сервис ИИ.</p>
        {detectService(s.ai.apiKey) && (
          <div className="space-y-2">
            <p className="text-sm">Когда звать ИИ</p>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-xs">
              {([["auto", "Экономно"], ["always", "Всегда"]] as const).map(([m, l]) => (
                <button key={m} onClick={() => setAi({ mode: m })} className={`rounded-lg py-2 ${(s.ai.mode ?? "auto") === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{(s.ai.mode ?? "auto") === "auto"
              ? "Знакомые слова приложение разбирает само. ИИ зовётся, только если встретилось новое слово. Сохранённые траты запоминаются — в следующий раз ИИ не нужен."
              : "Каждый список отправляется в ИИ. Точнее для сложных фраз, но тратит больше запросов."}</p>
          </div>
        )}
        {s.ai.apiKey && <Button variant="ghost" size="sm" onClick={() => setAi({ apiKey: "" })}>Убрать ключ</Button>}
      </section>

      <Link to="/categories" className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-soft">
        <span><span className="block font-display text-lg">Категории</span><span className="text-xs text-muted-foreground">Свои названия, иконки и цвета</span></span>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>

      <Updates />

      <section className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="font-display text-lg">Резервная копия</h2>
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Всё хранится только на этом устройстве. Ключ ИИ в копию не попадает.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => {
            const data = { ...getState(), ai: { ...getState().ai, apiKey: "" } };
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
            const a = document.createElement("a"); a.href = url; a.download = `berezhny-budget-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
          }}><Download /> Экспорт</Button>
          <Button variant="secondary" onClick={() => file.current?.click()}><Upload /> Импорт</Button>
        </div>
        <input ref={file} type="file" accept="application/json" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          try {
            const data = JSON.parse(await f.text()) as State;
            if (!Array.isArray(data.txs)) throw new Error();
            const prev = getState();
            replaceState({ ...data, ai: prev.ai });
            undoable("Данные загружены", () => replaceState(prev));
          } catch { toast("Не получилось прочитать файл"); }
          e.target.value = "";
        }} />
      </section>
    </div>
  );
}

function Updates() {
  const [checking, setChecking] = useState(false);
  const [news, setNews] = useState(false);
  return (
    <section className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
      <h2 className="font-display text-lg">Обновления</h2>
      <p className="text-xs text-muted-foreground">Приложение обновляется само, когда есть интернет. Если что-то выглядит по-старому — нажмите кнопку.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={checking} onClick={async () => {
          if (!updatesSupported()) { toast("Проверка работает в установленном приложении, а не в окне редактора"); return; }
          setChecking(true);
          const r = await checkForUpdates();
          setChecking(false);
          toast(r === "updating" ? "Есть новая версия — перезапускаю" : r === "current" ? "У вас последняя версия" : "Нет интернета, попробуйте позже");
        }}><RefreshCw className={checking ? "animate-spin" : ""} /> {checking ? "Проверяю…" : "Проверить"}</Button>
        <Button variant="secondary" onClick={() => { if (confirm("Перезагрузить начисто? Деньги, планы и категории сохранятся.")) void hardReload(); }}><RotateCcw /> Начисто</Button>
      </div>
      <button className="text-xs text-muted-foreground underline" onClick={() => setNews(true)}>Версия {APP_VERSION} · что нового</button>
      <WhatsNew open={news} onClose={() => setNews(false)} />
    </section>
  );
}
