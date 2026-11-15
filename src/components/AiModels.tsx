import { aiHostAllowed, blockedHostText } from "@/lib/allowed-hosts";
import { useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiUrl, checkAiModel, detectService, endpoint, MODEL_OPTIONS } from "@/lib/parse";
import type { AiConn, AiSettings } from "@/lib/budget";

export function AiModels({
  ai,
  onChange,
}: {
  ai: AiSettings;
  onChange: (p: Partial<AiSettings>) => void;
}) {
  const svc = detectService(ai.apiKey);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(
    () => setResult(null),
    [
      ai.apiKey,
      ai.model,
      ai.advisorModel,
      ai.advisorApiKey,
      ai.connId,
      ai.advisorConnId,
      ai.connections,
    ],
  );
  const conns = ai.connections ?? [];
  const options = svc ? MODEL_OPTIONS[svc.name] : undefined;
  const advSvc = detectService(ai.advisorApiKey ?? "");
  const advOptions = advSvc ? MODEL_OPTIONS[advSvc.name] : options;
  const parseEp = endpoint(ai, "parse"),
    advEp = endpoint(ai, "advisor");
  const builtIn = svc ? svc.name : "встроенный разбор без ИИ";
  return (
    <div className="space-y-3 border-t border-border pt-3">
      {(parseEp || advEp) && (
        <Check2
          ai={ai}
          checking={checking}
          setChecking={setChecking}
          result={result}
          setResult={setResult}
        />
      )}
      {svc && !ai.connId && (
        <ModelField
          key={`${svc.name}-parse`}
          label="Модель"
          value={ai.model}
          fallback={`Рекомендуемая · ${svc.model}`}
          models={(options?.models ?? []).filter((m) => m !== svc.model)}
          onChange={(model) => onChange({ model })}
        />
      )}
      {options && svc && (
        <a
          className="inline-block text-xs text-primary underline"
          href={options.keysUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Получить ключ {svc.name}
        </a>
      )}
      <details
        className="rounded-xl border border-border p-3"
        open={conns.length > 0 || !!ai.advisorApiKey?.trim() || undefined}
      >
        <summary className="cursor-pointer text-sm font-medium">Дополнительно</summary>
        <p className="mt-1 text-xs text-muted-foreground">
          Обычно не нужно: один ключ работает и для распознавания трат, и для Помощника.
        </p>
        <div className="mt-3 space-y-3">
          <Connections ai={ai} onChange={onChange} />
          {conns.length > 0 && (
            <>
              <ConnSelect
                label="Распознавание расходов через"
                value={ai.connId ?? ""}
                builtIn={`Основной ключ · ${builtIn}`}
                conns={conns}
                onChange={(connId) => onChange({ connId: connId || undefined })}
              />
              <ConnSelect
                label="Помощник через"
                value={ai.advisorConnId ?? ""}
                builtIn="Как распознавание или отдельный ключ ниже"
                conns={conns}
                onChange={(advisorConnId) =>
                  onChange({ advisorConnId: advisorConnId || undefined })
                }
              />
            </>
          )}
          {svc && !ai.advisorConnId && (
            <>
              <div className="space-y-1 text-sm">
                <span>
                  Отдельный ключ для Помощника{" "}
                  <span className="text-xs text-muted-foreground">(необязательно)</span>
                </span>
                <Input
                  type="password"
                  autoComplete="off"
                  aria-label="Ключ Помощника"
                  placeholder="Например, ключ Claude"
                  value={ai.advisorApiKey ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const changed =
                      detectService(v)?.name !== detectService(ai.advisorApiKey ?? "")?.name;
                    onChange({ advisorApiKey: v, ...(changed ? { advisorModel: "" } : {}) });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {advSvc
                    ? `✓ Помощник отвечает через ${advSvc.name}. Фото чеков тоже прочитает он, если основная модель не видит картинки.`
                    : ai.advisorApiKey?.trim()
                      ? "Не узнаю этот ключ."
                      : "Пусто — Помощник работает от основного ключа."}
                </p>
              </div>
              <ModelField
                key={`${advSvc?.name ?? svc.name}-advisor`}
                label="Модель Помощника"
                value={ai.advisorModel ?? ""}
                fallback={advSvc ? `Автоматически · ${advSvc.model}` : "Как для распознавания"}
                models={advOptions?.models ?? []}
                onChange={(advisorModel) => onChange({ advisorModel })}
              />
            </>
          )}
        </div>
      </details>
    </div>
  );
}

function ModelField({
  label,
  value,
  fallback,
  models,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  models: string[];
  onChange: (v: string) => void;
}) {
  const [custom, setCustom] = useState(!!value && !models.includes(value));
  return (
    <label className="block space-y-1 text-sm">
      <span>{label}</span>
      <select
        aria-label={label}
        className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
        value={custom ? "custom" : value}
        onChange={(e) => {
          if (e.target.value === "custom") {
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(e.target.value);
        }}
      >
        <option value="">{fallback}</option>
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value="custom">Другая модель…</option>
      </select>
      {custom && (
        <Input
          aria-label={`${label}: своё название`}
          placeholder="Точное название модели"
          maxLength={150}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
type Res = { ok: boolean; text: string } | null;
function friendly(text: string) {
  return /401|403/.test(text)
    ? "Ключ не принят или нет доступа к модели. Проверьте ключ и разрешения в сервисе ИИ."
    : /404/.test(text)
      ? "Адрес или модель не найдены. Проверьте Base URL, формат API и название модели."
      : /429/.test(text)
        ? "Сервис ограничил запросы. Проверьте баланс и лимит, затем попробуйте позже."
        : text;
}
function Check2({
  ai,
  checking,
  setChecking,
  result,
  setResult,
}: {
  ai: AiSettings;
  checking: boolean;
  setChecking: (v: boolean) => void;
  result: Res;
  setResult: (r: Res) => void;
}) {
  const p = endpoint(ai, "parse"),
    a = endpoint(ai, "advisor");
  return (
    <div className="space-y-1">
      <Button
        variant="secondary"
        className="w-full whitespace-normal"
        disabled={checking}
        onClick={async () => {
          setChecking(true);
          setResult(null);
          const out: string[] = [];
          let ok = true;
          for (const [label, purpose, ep] of [
            ["Распознавание", "parse", p],
            ["Помощник", "advisor", a],
          ] as const) {
            if (!ep) continue;
            if (
              purpose === "advisor" &&
              p &&
              ep.url === p.url &&
              ep.key === p.key &&
              ep.model === p.model
            ) {
              out.push(`Помощник: то же подключение.`);
              continue;
            }
            try {
              await checkAiModel(ai, purpose);
              out.push(`${label}: ✓ ${ep.name} · ${ep.model} отвечает.`);
            } catch (e) {
              ok = false;
              out.push(
                `${label} (${ep.name}): ${friendly(e instanceof Error ? e.message : "не удалось проверить.")}`,
              );
            }
          }
          setResult({ ok, text: out.join("\n") });
          setChecking(false);
        }}
      >
        <RefreshCw className={checking ? "animate-spin" : ""} />
        {checking ? "Проверяю…" : "Проверить подключение и модели"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Проверка отправляет короткий запрос в каждую выбранную модель и может стоить небольшую
        сумму. Чтение фото проверяется при загрузке.
      </p>
      {result && (
        <p
          role="status"
          className={`whitespace-pre-line text-sm ${result.ok ? "text-primary" : "text-muted-foreground"}`}
        >
          {result.ok && <Check className="mr-1 inline h-4 w-4" />}
          {result.text}
        </p>
      )}
    </div>
  );
}

function ConnSelect({
  label,
  value,
  builtIn,
  conns,
  onChange,
}: {
  label: string;
  value: string;
  builtIn: string;
  conns: AiConn[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span>{label}</span>
      <select
        aria-label={label}
        className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{builtIn}</option>
        {conns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name || "Своё подключение"} · {c.model || "модель не указана"}
          </option>
        ))}
      </select>
    </label>
  );
}

const blank = (): AiConn => ({
  id: crypto.randomUUID(),
  name: "",
  baseUrl: "",
  format: "openai",
  apiKey: "",
  model: "",
});
function Connections({
  ai,
  onChange,
}: {
  ai: AiSettings;
  onChange: (p: Partial<AiSettings>) => void;
}) {
  const conns = ai.connections ?? [];
  const [edit, setEdit] = useState<AiConn | null>(null);
  const save = () => {
    if (!edit) return;
    const next = conns.some((c) => c.id === edit.id)
      ? conns.map((c) => (c.id === edit.id ? edit : c))
      : [...conns, edit];
    onChange({ connections: next, ...(!ai.connId && !conns.length ? { connId: edit.id } : {}) });
    setEdit(null);
  };
  const remove = (id: string) => {
    if (!confirm("Удалить это подключение? Ключ тоже удалится с устройства.")) return;
    onChange({
      connections: conns.filter((c) => c.id !== id),
      ...(ai.connId === id ? { connId: undefined } : {}),
      ...(ai.advisorConnId === id ? { advisorConnId: undefined } : {}),
    });
  };
  const blocked =
    !!edit?.baseUrl.trim() &&
    /^https?:\/\//i.test(edit.baseUrl.trim()) &&
    !aiHostAllowed(edit.baseUrl);
  const ok =
    edit &&
    edit.baseUrl.trim() &&
    /^https?:\/\//i.test(edit.baseUrl.trim()) &&
    !blocked &&
    edit.apiKey.trim() &&
    edit.model.trim();
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Свои подключения</p>
      <p className="text-xs text-muted-foreground">
        Любой сервис с форматом OpenAI Compatible или Anthropic Messages: свой ключ и модель. Адрес
        — из списка разрешённых сервисов. Ключ хранится только на этом устройстве.
      </p>
      {conns.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between gap-2 rounded-xl bg-muted p-2 text-sm"
        >
          <span className="min-w-0">
            <span className="block truncate">{c.name || "Своё подключение"}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {c.format === "anthropic" ? "Anthropic" : "OpenAI"} · {c.model} · {c.baseUrl}
            </span>
          </span>
          <span className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEdit(c)}>
              Изменить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
              Удалить
            </Button>
          </span>
        </div>
      ))}
      {edit ? (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <Input
            aria-label="Название"
            placeholder="Название, например Claude n Codex"
            maxLength={60}
            value={edit.name}
            onChange={(e) => setEdit({ ...edit, name: e.target.value })}
          />
          <Input
            aria-label="API Base URL"
            placeholder="https://openrouter.ai/api"
            inputMode="url"
            maxLength={300}
            value={edit.baseUrl}
            onChange={(e) => setEdit({ ...edit, baseUrl: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-xs">
            {(
              [
                ["openai", "OpenAI Compatible"],
                ["anthropic", "Anthropic Messages"],
              ] as const
            ).map(([f, l]) => (
              <button
                key={f}
                type="button"
                onClick={() => setEdit({ ...edit, format: f })}
                className={`rounded-lg py-2 ${edit.format === f ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <Input
            aria-label="API-ключ"
            type="password"
            autoComplete="off"
            placeholder="API-ключ"
            value={edit.apiKey}
            onChange={(e) => setEdit({ ...edit, apiKey: e.target.value })}
          />
          <Input
            aria-label="Модель"
            placeholder="Точное название модели, например claude-sonnet-4-5"
            maxLength={150}
            value={edit.model}
            onChange={(e) => setEdit({ ...edit, model: e.target.value })}
          />
          {blocked && (
            <p role="alert" className="text-xs text-destructive">
              {blockedHostText()}
            </p>
          )}
          {edit.baseUrl.trim() && !blocked && (
            <p className="break-all text-xs text-muted-foreground">
              Запросы пойдут на {apiUrl(edit.baseUrl, edit.format)}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={!ok} onClick={save}>
              Сохранить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setEdit(blank())}>
          + Добавить подключение
        </Button>
      )}
    </div>
  );
}
