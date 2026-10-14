import { createFileRoute } from "@tanstack/react-router";
import { detectService } from "@/lib/parse";
import { useRef } from "react";
import { Download, Upload, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Shell, meta } from "@/components/Shell";
import { undoable } from "@/components/Undo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getState, replaceState, setState, type AiSettings, type State } from "@/lib/budget";

export const Route = createFileRoute("/settings")({
  head: () => meta("Настройки — Бережный бюджет", "Резервная копия в JSON, свой ключ ИИ для разбора трат. Данные хранятся только на устройстве."),
  component: () => <Shell title="Настройки">{(s) => <Settings s={s} />}</Shell>,
});

const MODELS: Record<AiSettings["provider"], string> = { none: "", openai: "gpt-4o-mini", openrouter: "openai/gpt-4o-mini", anthropic: "claude-haiku-4-5" };

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
        {s.ai.apiKey && <Button variant="ghost" size="sm" onClick={() => setAi({ apiKey: "" })}>Убрать ключ</Button>}
      </section>

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
