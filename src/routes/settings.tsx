import { createFileRoute } from "@tanstack/react-router";
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
      <section className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="font-display text-lg">Умный разбор (свой ключ ИИ)</h2>
        <p className="text-xs text-muted-foreground">Ключ хранится только в этом браузере и отправляется напрямую выбранному сервису. Без ключа разбор работает на устройстве попроще.</p>
        <select value={s.ai.provider} onChange={(e) => { const p = e.target.value as AiSettings["provider"]; setAi({ provider: p, model: MODELS[p] }); }} className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm">
          <option value="none">Без ИИ (на устройстве)</option>
          <option value="openai">OpenAI</option>
          <option value="openrouter">OpenRouter</option>
          <option value="anthropic">Anthropic</option>
        </select>
        {s.ai.provider !== "none" && (
          <>
            <Input type="password" placeholder="API-ключ" value={s.ai.apiKey} onChange={(e) => setAi({ apiKey: e.target.value })} />
            <Input placeholder="Модель" value={s.ai.model} onChange={(e) => setAi({ model: e.target.value })} />
          </>
        )}
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
