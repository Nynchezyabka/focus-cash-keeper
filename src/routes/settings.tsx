import { Link, createFileRoute } from "@tanstack/react-router";
import { aiName, detectService } from "@/lib/parse";
import { useEffect, useRef, useState } from "react";
import { APP_VERSION, checkForUpdates, hardReload, updatesSupported } from "@/lib/pwa";
import { Download, Upload, ShieldCheck, ChevronRight, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import { WhatsNew } from "@/components/WhatsNew";
import { Shell, meta } from "@/components/Shell";
import { undoable } from "@/components/Undo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FUTURE_SCHEMA_ERROR,
  MIN_DAILY,
  dayKey,
  getState,
  migrateState,
  replaceState,
  setState,
  type AiSettings,
  type State,
} from "@/lib/budget";
import { Switch } from "@/components/ui/switch";
import { getFamily } from "@/lib/family";
import { AiModels } from "@/components/AiModels";
import { validSchedule } from "@/lib/loan-schedule";
import { validDebtFee } from "@/lib/debt-fee";

export const Route = createFileRoute("/settings")({
  head: () =>
    meta(
      "Настройки — Бережный бюджет",
      "Резервная копия в JSON, свой ключ ИИ для разбора трат. Данные хранятся только на устройстве.",
    ),
  component: () => <Shell title="Настройки">{(s) => <Settings s={s} />}</Shell>,
});

function Settings({ s }: { s: State }) {
  const file = useRef<HTMLInputElement>(null);
  const setAi = (p: Partial<AiSettings>) => setState((x) => ({ ...x, ai: { ...x.ai, ...p } }));
  return (
    <div className="space-y-4">
      <h2 className="px-1 pt-2 font-display text-lg text-foreground">Данные и устройства</h2>
      <section className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="text-base font-medium">Резервная копия</h2>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Всё хранится только на этом устройстве. Ключ ИИ в
          копию не попадает.
        </p>
        <p className="text-xs text-muted-foreground">
          {s.lastBackup
            ? `Последняя копия: ${new Date(s.lastBackup).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}.`
            : "Копию ещё не делали."}{" "}
          Раз в месяц приложение напомнит.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setState((x) => ({ ...x, lastBackup: new Date().toISOString() }));
              const data = {
                ...getState(),
                ai: {
                  ...getState().ai,
                  apiKey: "",
                  advisorApiKey: "",
                  connections: getState().ai.connections?.map((c) => ({ ...c, apiKey: "" })),
                },
              };
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = `berezhny-budget-${dayKey(new Date())}.json`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 30000);
            }}
          >
            <Upload /> Экспорт
          </Button>
          <Button variant="secondary" onClick={() => file.current?.click()}>
            <Download /> Импорт
          </Button>
        </div>
        <input
          ref={file}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const data = migrateState(JSON.parse(await f.text()));
              const arr = (v: unknown) => v === undefined || Array.isArray(v);
              const num = (v: unknown) =>
                v === undefined || (typeof v === "number" && Number.isFinite(v));
              if (!data || typeof data !== "object" || !Array.isArray(data.txs)) throw new Error();
              if (
                !data.txs.every(
                  (t) =>
                    t &&
                    typeof t === "object" &&
                    typeof t.amount === "number" &&
                    Number.isFinite(t.amount),
                )
              )
                throw new Error();
              const d = data as unknown as Record<string, unknown>;
              if (
                !num(d["balance"]) ||
                !num(d["cash"]) ||
                !arr(d["incomes"]) ||
                !arr(d["obligations"]) ||
                !arr(d["categories"])
              )
                throw new Error();
              if (
                data.obligations?.some(
                  (o) =>
                    o.schedule !== undefined &&
                    (!Array.isArray(o.schedule) || !validSchedule(o.schedule)),
                )
              )
                throw new Error();
              if (
                data.obligations?.some((o) => o.debtFee !== undefined && !validDebtFee(o.debtFee))
              )
                throw new Error();
              const prev = getState();
              try {
                localStorage.setItem("budget-backup-before-import", JSON.stringify(prev));
              } catch {
                /* нет места — отмена всё равно есть */
              }
              replaceState({ ...data, ai: prev.ai });
              undoable("Данные загружены", () => replaceState(prev));
            } catch (error) {
              toast(
                error instanceof Error && error.message === FUTURE_SCHEMA_ERROR
                  ? "Эта копия сделана более новой версией приложения. Обновите приложение"
                  : "Не получилось прочитать файл",
              );
            }
            e.target.value = "";
          }}
        />
      </section>
      <Link
        to="/devices"
        className="flex items-center justify-between gap-2 rounded-2xl bg-card p-4 shadow-soft"
      >
        <span>
          <span className="block text-base font-medium">Мои устройства</span>
          <span className="text-xs text-muted-foreground">
            Один бюджет на телефоне и компьютере, зашифрованно
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
      </Link>
      <Link
        to="/family"
        search={{ join: undefined }}
        className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-soft"
      >
        <span>
          <span className="block text-base font-medium">Семейный доступ</span>
          <span className="text-xs text-muted-foreground">Общая картина бюджетов по коду</span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>
      <h2 className="px-1 pt-2 font-display text-lg text-foreground">Внешний вид и категории</h2>
      <Appearance />
      <Link
        to="/categories"
        className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-soft"
      >
        <span>
          <span className="block text-base font-medium">Категории</span>
          <span className="text-xs text-muted-foreground">Свои названия, иконки и цвета</span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>
      <h2 className="px-1 pt-2 font-display text-lg text-foreground">Помощник и ИИ</h2>
      <section className="space-y-3 rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="text-base font-medium">Распознавание трат и Помощник</h2>
        <p className="text-sm text-muted-foreground">
          Когда вы пишете «такси 450, кофе 380», приложение раскладывает это на отдельные траты.
        </p>
        <Input
          type="password"
          autoComplete="off"
          placeholder="Вставьте ваш API-ключ (необязательно)"
          value={s.ai.apiKey}
          onChange={(e) => {
            const apiKey = e.target.value;
            const changed = detectService(apiKey)?.name !== detectService(s.ai.apiKey)?.name;
            setAi({ apiKey, ...(changed ? { model: "", advisorModel: "" } : {}) });
          }}
        />
        {(() => {
          if (s.ai.connId && aiName(s.ai))
            return <p className="text-sm text-primary">✓ Распознаёт через «{aiName(s.ai)}».</p>;
          const svc = detectService(s.ai.apiKey);
          if (svc)
            return (
              <p className="text-sm text-primary">
                ✓ Ключ {svc.name} — будет понимать любые формулировки.
              </p>
            );
          if (s.ai.apiKey.trim())
            return (
              <p className="text-sm text-muted-foreground">
                Не узнаю этот ключ. Подходят ключи OpenAI, OpenRouter, Google Gemini, Groq,
                Anthropic, DeepSeek, xAI. Для другого сервиса добавьте «Своё подключение» ниже.
              </p>
            );
          return (
            <div className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
              <p className="font-medium">Сейчас: встроенный режим, без ИИ</p>
              <p className="mt-1 text-xs">
                Работает прямо на телефоне: находит суммы и узнаёт слова вроде «такси», «аптека»,
                «кофе». Бесплатно и без интернета, но сложные фразы («закинула пятихатку на
                телефон») может не понять.
              </p>
            </div>
          );
        })()}
        <p className="text-xs text-muted-foreground">
          Ключ хранится только в этом браузере и уходит напрямую в сервис ИИ. Совет: в кабинете
          сервиса поставьте месячный лимит трат (например, 2–5 $) — тогда даже при утечке ключа
          много не потратят.
        </p>
        <label className="block space-y-1 text-sm">
          <span>Имя Помощника</span>
          <Input
            maxLength={30}
            placeholder="Помощник"
            value={s.advisorName ?? ""}
            onChange={(e) => setState((x) => ({ ...x, advisorName: e.target.value }))}
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>
            Помощник пишет первым
            <span className="block text-xs text-muted-foreground">
              Раз в день, если есть повод. Без уведомлений.
            </span>
          </span>
          <Switch
            checked={s.advisorInitiative !== false}
            onCheckedChange={(v) => setState((x) => ({ ...x, advisorInitiative: v }))}
          />
        </label>
        {getFamily() && (
          <label className="flex items-center justify-between gap-2 text-sm">
            <span>Не показывать Помощнику цифры семьи</span>
            <Switch
              checked={!!s.advisorNoFamily}
              onCheckedChange={(v) => setState((x) => ({ ...x, advisorNoFamily: v }))}
            />
          </label>
        )}
        {aiName(s.ai) && (
          <div className="space-y-2">
            <p className="text-sm">Когда звать ИИ</p>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-xs">
              {(
                [
                  ["auto", "Экономно"],
                  ["always", "Всегда"],
                ] as const
              ).map(([m, l]) => (
                <button
                  key={m}
                  onClick={() => setAi({ mode: m })}
                  className={`rounded-lg py-2 ${(s.ai.mode ?? "auto") === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {(s.ai.mode ?? "auto") === "auto"
                ? "Знакомые слова приложение разбирает само. ИИ зовётся, только если встретилось новое слово. Сохранённые траты запоминаются — в следующий раз ИИ не нужен."
                : "Каждый список отправляется в ИИ. Точнее для сложных фраз, но тратит больше запросов."}
            </p>
          </div>
        )}
        <AiModels ai={s.ai} onChange={setAi} />
        {s.ai.apiKey && (
          <Button variant="ghost" size="sm" onClick={() => setAi({ apiKey: "" })}>
            Убрать ключ
          </Button>
        )}
      </section>
      <h2 className="px-1 pt-2 font-display text-lg text-foreground">Правила расчёта</h2>
      <section className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="text-base font-medium">Минимум на жизнь</h2>
        <p className="text-sm text-muted-foreground">
          Сколько рублей в день оставлять на еду и базовые нужды, даже если на ближайшие платежи не
          хватает. По умолчанию {MIN_DAILY} ₽.
        </p>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={String(MIN_DAILY)}
          value={s.minDaily ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setState((x) => ({ ...x, minDaily: v === "" ? undefined : Math.max(0, Number(v)) }));
          }}
        />
      </section>
      <h2 className="px-1 pt-2 font-display text-lg text-foreground">О приложении</h2>
      <Updates />

      <Link
        to="/feedback"
        className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-soft"
      >
        <span>
          <span className="text-base font-medium">Предложить идею</span>
          <br />
          <span className="text-sm text-muted-foreground">
            Идея, неудобство или вопрос — автору
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>
    </div>
  );
}

function Appearance() {
  const [t, setT] = useState<Theme>("system");
  useEffect(() => setT(getTheme()), []);
  return (
    <section className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
      <h2 className="text-base font-medium">Оформление</h2>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-xs">
        {(
          [
            ["light", "Дневная"],
            ["dark", "Ночная"],
            ["system", "Как в телефоне"],
          ] as const
        ).map(([m, l]) => (
          <button
            key={m}
            onClick={() => {
              setTheme(m);
              setT(m);
            }}
            className={`rounded-lg py-2 ${t === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}
          >
            {l}
          </button>
        ))}
      </div>
    </section>
  );
}

function Updates() {
  const [checking, setChecking] = useState(false);
  const [news, setNews] = useState(false);
  return (
    <section className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
      <h2 className="text-base font-medium">Обновления</h2>
      <p className="text-xs text-muted-foreground">
        Приложение обновляется само, когда есть интернет. Если что-то выглядит по-старому — нажмите
        кнопку.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          disabled={checking}
          onClick={async () => {
            if (!updatesSupported()) {
              toast("Проверка работает в установленном приложении, а не в окне редактора");
              return;
            }
            setChecking(true);
            const r = await checkForUpdates();
            setChecking(false);
            toast(
              r === "updating"
                ? "Есть новая версия — перезапускаю"
                : r === "current"
                  ? "У вас последняя версия"
                  : "Нет интернета, попробуйте позже",
            );
          }}
        >
          <RefreshCw className={checking ? "animate-spin" : ""} />{" "}
          {checking ? "Проверяю…" : "Проверить"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (confirm("Перезагрузить начисто? Деньги, планы и категории сохранятся."))
              void hardReload();
          }}
        >
          <RotateCcw /> Начисто
        </Button>
      </div>
      <button className="text-xs text-muted-foreground underline" onClick={() => setNews(true)}>
        Версия {APP_VERSION} · что нового
      </button>
      <WhatsNew open={news} onClose={() => setNews(false)} />
    </section>
  );
}
