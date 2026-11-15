import { aiHostAllowed, blockedHostText } from "@/lib/allowed-hosts";
import { useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { checkAiModel, detectService, endpoint, MODEL_OPTIONS } from "@/lib/parse";
import type { AiSettings } from "@/lib/budget";

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
  const options = svc ? MODEL_OPTIONS[svc.name] : undefined;
  const sepAdv =
    ai.advisorApiKey !== undefined &&
    ai.advisorApiKey !== null &&
    ai.advisorSeparate !== false &&
    (ai.advisorSeparate || !!ai.advisorApiKey.trim());
  const advSvc = detectService(ai.advisorApiKey ?? "");
  const advOptions = advSvc ? MODEL_OPTIONS[advSvc.name] : undefined;
  const parseEp = endpoint(ai, "parse"),
    advEp = endpoint(ai, "advisor");
  return (
    <div className="space-y-3 border-t border-border pt-3">
      {svc && (
        <>
          <ModelField
            key={`${svc.name}-parse`}
            label="Модель для трат"
            value={ai.model}
            fallback={`Рекомендуемая · ${svc.model}`}
            models={(options?.models ?? []).filter((m) => m !== svc.model)}
            onChange={(model) => onChange({ model })}
          />
          <BaseUrl
            svcUrl={svc.url}
            kind={svc.kind}
            value={ai.baseUrl ?? ""}
            onChange={(baseUrl) => onChange({ baseUrl })}
          />
          {options && (
            <a
              className="inline-block text-xs text-primary underline"
              href={options.keysUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Получить ключ {svc.name}
            </a>
          )}
        </>
      )}
      {svc && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <label className="flex items-center justify-between gap-2 text-sm">
            <span>
              Помощник: тот же ключ
              <span className="block text-xs text-muted-foreground">
                Выключите, чтобы Помощник работал через другой ключ.
              </span>
            </span>
            <Switch
              checked={!sepAdv}
              onCheckedChange={(same) =>
                onChange(
                  same
                    ? {
                        advisorSeparate: false,
                        advisorApiKey: "",
                        advisorBaseUrl: "",
                        advisorModel: "",
                      }
                    : { advisorSeparate: true, advisorApiKey: ai.advisorApiKey ?? "" },
                )
              }
            />
          </label>
          {!sepAdv && (
            <ModelField
              key={`${svc.name}-advisor-same`}
              label="Модель Помощника"
              value={ai.advisorModel ?? ""}
              fallback="Как для трат"
              models={options?.models ?? []}
              onChange={(advisorModel) => onChange({ advisorModel })}
            />
          )}
          {sepAdv && (
            <>
              <div className="space-y-1 text-sm">
                <span>Ключ для Помощника</span>
                <Input
                  type="password"
                  autoComplete="off"
                  aria-label="Ключ Помощника"
                  placeholder="Вставьте ключ"
                  value={ai.advisorApiKey ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const changed =
                      detectService(v)?.name !== detectService(ai.advisorApiKey ?? "")?.name;
                    onChange({
                      advisorApiKey: v,
                      ...(changed ? { advisorModel: "", advisorBaseUrl: "" } : {}),
                    });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {advSvc
                    ? `✓ Ключ ${advSvc.name}`
                    : ai.advisorApiKey?.trim()
                      ? "Не узнаю этот ключ."
                      : "Пока пусто — Помощник работает от основного ключа."}
                </p>
              </div>
              {advSvc && (
                <>
                  <ModelField
                    key={`${advSvc.name}-advisor`}
                    label="Модель Помощника"
                    value={ai.advisorModel ?? ""}
                    fallback={`Рекомендуемая · ${advSvc.model}`}
                    models={(advOptions?.models ?? []).filter((m) => m !== advSvc.model)}
                    onChange={(advisorModel) => onChange({ advisorModel })}
                  />
                  <BaseUrl
                    svcUrl={advSvc.url}
                    kind={advSvc.kind}
                    value={ai.advisorBaseUrl ?? ""}
                    onChange={(advisorBaseUrl) => onChange({ advisorBaseUrl })}
                  />
                </>
              )}
            </>
          )}
        </div>
      )}
      {(parseEp || advEp) && (
        <Check2
          ai={ai}
          checking={checking}
          setChecking={setChecking}
          result={result}
          setResult={setResult}
        />
      )}
    </div>
  );
}

function BaseUrl({
  svcUrl,
  kind,
  value,
  onChange,
}: {
  svcUrl: string;
  kind: "openai" | "anthropic" | "google";
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(!!value.trim());
  if (kind === "google") return null;
  const def = svcUrl.replace(/\/v\d+[a-z]*\/(chat\/completions|messages)$/i, "");
  const blocked = !!value.trim() && (!/^https:\/\//i.test(value.trim()) || !aiHostAllowed(value));
  if (!open)
    return (
      <button
        type="button"
        className="block text-xs text-primary underline"
        onClick={() => setOpen(true)}
      >
        Свой адрес сервера
      </button>
    );
  return (
    <label className="block space-y-1 text-sm">
      <span>Адрес сервера</span>
      <Input
        aria-label="Адрес сервера"
        inputMode="url"
        maxLength={300}
        placeholder={def}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="block text-xs text-muted-foreground">
        Пусто — стандартный адрес {def}. Меняйте, только если сервис сообщил новый.
      </span>
      {blocked && (
        <span role="alert" className="block text-xs text-destructive">
          {blockedHostText()}
        </span>
      )}
    </label>
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
