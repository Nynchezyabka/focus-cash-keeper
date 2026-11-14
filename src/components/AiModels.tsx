import { useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkAiModel, detectService, MODEL_OPTIONS, selectedModel } from "@/lib/parse";
import type { AiSettings } from "@/lib/budget";

export function AiModels({ ai, onChange }: { ai: AiSettings; onChange: (p: Partial<AiSettings>) => void }) {
  const svc = detectService(ai.apiKey);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setResult(null), [ai.apiKey, ai.model, ai.advisorModel, ai.advisorApiKey]);
  if (!svc) return null;
  const options = MODEL_OPTIONS[svc.name];
  const advSvc = detectService(ai.advisorApiKey ?? "");
  const advOptions = advSvc ? MODEL_OPTIONS[advSvc.name] : options;
  return <div className="space-y-3 border-t border-border pt-3">
    <ModelField key={`${svc.name}-parse`} label="Модель для распознавания" value={ai.model} fallback={`Автоматически · ${svc.model}`} models={options?.models ?? []} onChange={(model) => onChange({ model })} />
    <div className="space-y-1 text-sm">
      <span>Отдельный ключ для Помощника <span className="text-xs text-muted-foreground">(необязательно)</span></span>
      <Input type="password" autoComplete="off" aria-label="Ключ Помощника" placeholder="Например, ключ Claude" value={ai.advisorApiKey ?? ""} onChange={(e) => {
        const v = e.target.value;
        const changed = detectService(v)?.name !== detectService(ai.advisorApiKey ?? "")?.name;
        onChange({ advisorApiKey: v, ...(changed ? { advisorModel: "" } : {}) });
      }} />
      <p className="text-xs text-muted-foreground">{advSvc ? `✓ Помощник отвечает через ${advSvc.name}. Фото чеков тоже прочитает он, если основная модель не видит картинки.` : ai.advisorApiKey?.trim() ? "Не узнаю этот ключ." : "Пусто — Помощник работает от основного ключа."}</p>
    </div>
    <ModelField key={`${advSvc?.name ?? svc.name}-advisor`} label="Модель Помощника" value={ai.advisorModel ?? ""} fallback={advSvc ? `Автоматически · ${advSvc.model}` : "Как для распознавания"} models={advOptions?.models ?? []} onChange={(advisorModel) => onChange({ advisorModel })} />
    <Button variant="secondary" className="w-full whitespace-normal" disabled={checking} onClick={async () => {
      setChecking(true); setResult(null);
      try {
        await checkAiModel(ai, "parse");
        if (ai.advisorApiKey?.trim() || selectedModel(ai, "advisor") !== selectedModel(ai)) await checkAiModel(ai, "advisor");
        setResult({ ok: true, text: "Ключ и выбранные модели отвечают. Чтение изображений проверяется при загрузке фото." });
      } catch (e) {
        const text = e instanceof Error ? e.message : "Не удалось проверить подключение.";
        setResult({ ok: false, text: /401|403/.test(text) ? "Ключ не принят или нет доступа к модели. Проверьте ключ и разрешения в сервисе ИИ." : /404/.test(text) ? "Модель не найдена. Проверьте её название или выберите другую." : /429/.test(text) ? "Сервис ограничил запросы. Проверьте баланс и лимит, затем попробуйте позже." : /fetch|timeout|abort/i.test(text) ? "Нет ответа от сервиса. Проверьте интернет и доступность сервиса, затем попробуйте снова." : text });
      } finally { setChecking(false); }
    }}><RefreshCw className={checking ? "animate-spin" : ""} />{checking ? "Проверяю…" : "Проверить ключ и модели"}</Button>
    <p className="text-xs text-muted-foreground">Проверка отправляет короткий запрос в каждую выбранную модель и может стоить небольшую сумму.</p>
    {result && <p role="status" className={`text-sm ${result.ok ? "text-primary" : "text-muted-foreground"}`}>{result.ok && <Check className="mr-1 inline h-4 w-4" />}{result.text}</p>}
    {options && <a className="inline-block text-xs text-primary underline" href={options.keysUrl} target="_blank" rel="noopener noreferrer">Получить ключ {svc.name}</a>}
  </div>;
}

function ModelField({ label, value, fallback, models, onChange }: { label: string; value: string; fallback: string; models: string[]; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState(!!value && !models.includes(value));
  return <label className="block space-y-1 text-sm">
    <span>{label}</span>
    <select aria-label={label} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={custom ? "custom" : value} onChange={(e) => {
      if (e.target.value === "custom") { setCustom(true); return; }
      setCustom(false); onChange(e.target.value);
    }}>
      <option value="">{fallback}</option>
      {models.map((m) => <option key={m} value={m}>{m}</option>)}
      <option value="custom">Другая модель…</option>
    </select>
    {custom && <Input aria-label={`${label}: своё название`} placeholder="Точное название модели" maxLength={150} value={value} onChange={(e) => onChange(e.target.value)} />}
  </label>;
}