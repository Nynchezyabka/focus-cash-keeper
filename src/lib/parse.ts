import { cachedRate, currency, detectCurrency, stripCurrency, toRub } from "@/lib/fx";
import { cats, type AiSettings } from "./budget";

export interface Parsed {
  note: string;
  amount: number;
  category: string;
  known?: boolean;
  currency?: string;
  orig?: { amount: number; currency: string; rate: number };
}
/** converts items in other currencies to rubles with the cached Bank of Russia rate */
export function applyFx(items: Parsed[]): Parsed[] {
  return items.map((i) => {
    const code = (i.currency ?? "RUB").toUpperCase();
    if (code === "RUB") return i;
    const rate = cachedRate(code);
    if (!rate)
      return { ...i, note: `${i.note} (${i.amount} ${currency(code).sign}, курс неизвестен)` };
    return {
      ...i,
      amount: Math.round(toRub(i.amount, rate)),
      orig: { amount: i.amount, currency: code, rate },
    };
  });
}

/** best match = longest key found in the text (learned keys are more specific) */
export function matchCategory(text: string): string | null {
  const t = text.toLowerCase();
  let best: { id: string; len: number } | null = null;
  for (const c of cats())
    for (const k of c.keys)
      if (k && t.includes(k) && (!best || k.length > best.len)) best = { id: c.id, len: k.length };
  return best?.id ?? null;
}
export function guessCategory(text: string) {
  return matchCategory(text) ?? "shop";
}

export function parseLocal(input: string): Parsed[] {
  return input
    .split(/[,;\n]+|\s+и\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => {
      const m = p.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*(к|тыс)?/i);
      if (!m) return [];
      let amount = parseFloat((m[1] ?? "0").replace(/\s/g, "").replace(",", "."));
      if (m[2]) amount *= 1000;
      const cur = detectCurrency(p);
      const note = stripCurrency(p.replace(m[0], "")).trim() || "Трата";
      const m2 = matchCategory(note);
      return [{ note, amount, category: m2 ?? "shop", known: !!m2, currency: cur }];
    });
}

const PROMPT = () =>
  `Разбери текст пользователя на отдельные траты. Категории (id): ${cats()
    .map((c) => `${c.id}=${c.name}`)
    .join(
      ", ",
    )}. Ответь ТОЛЬКО JSON вида {"items":[{"note":"кофе с круассаном","amount":380,"category":"cafe","currency":"RUB"}]}. currency — код ISO (RUB, USD, EUR, KZT, TRY, CNY, AMD, GEL…), amount — в этой валюте.`;

type Svc = { name: string; url: string; model: string; kind: "openai" | "anthropic" | "google" };
export const MODEL_OPTIONS: Record<string, { models: string[]; keysUrl: string }> = {
  OpenAI: {
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"],
    keysUrl: "https://platform.openai.com/api-keys",
  },
  Anthropic: {
    models: ["claude-haiku-4-5", "claude-sonnet-4-5"],
    keysUrl: "https://console.anthropic.com/settings/keys",
  },
  OpenRouter: {
    models: ["openai/gpt-4o-mini", "google/gemini-2.5-flash", "anthropic/claude-sonnet-4.5"],
    keysUrl: "https://openrouter.ai/settings/keys",
  },
  DeepSeek: {
    models: ["deepseek-chat", "deepseek-reasoner"],
    keysUrl: "https://platform.deepseek.com/api_keys",
  },
  Groq: {
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    keysUrl: "https://console.groq.com/keys",
  },
  "Google Gemini": {
    models: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
    keysUrl: "https://aistudio.google.com/apikey",
  },
  "Claude n Codex": {
    models: ["claude-sonnet-5", "claude-sonnet-4-6", "claude-opus-5.5"],
    keysUrl: "https://claude-n-codex.com/",
  },
  "xAI Grok": { models: ["grok-3-mini", "grok-3", "grok-4"], keysUrl: "https://console.x.ai" },
};
/** Settings for advisor calls: a separate advisor key (if set) replaces the main one. */
export function advisorAi(ai: AiSettings): AiSettings {
  const k = ai.advisorApiKey?.trim();
  return k ? { ...ai, apiKey: k, model: "", advisorApiKey: "", connId: undefined } : ai;
}
export function selectedModel(ai: AiSettings, purpose: "parse" | "advisor" = "parse") {
  return endpoint(ai, purpose)?.model ?? "";
}
/** Normalises any pasted address (host, …/v1, full endpoint) to the request URL of the chosen format. */
export function apiUrl(base: string, format: "openai" | "anthropic") {
  let u = base
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(chat\/completions|messages)$/, "")
    .replace(/\/+$/, "");
  if (!/\/v\d+[a-z]*$/i.test(u)) u += "/v1";
  return u + (format === "anthropic" ? "/messages" : "/chat/completions");
}
export type Endpoint = Svc & { key: string };
/** One place decides which service, key and model answer for parsing or for the advisor. */
export function endpoint(ai: AiSettings, purpose: "parse" | "advisor" = "parse"): Endpoint | null {
  const conns = ai.connections ?? [];
  const advKey = ai.advisorApiKey?.trim();
  const ownAdv = purpose === "advisor" && (!!ai.advisorConnId || !!advKey);
  const id = purpose === "advisor" ? ai.advisorConnId || (advKey ? "" : ai.connId) : ai.connId;
  const c = id ? conns.find((x) => x.id === id) : undefined;
  if (c) {
    if (!c.apiKey.trim() || !c.baseUrl.trim()) return null;
    const model =
      (purpose === "advisor" && !ownAdv ? ai.advisorModel?.trim() : "") || c.model.trim();
    return {
      name: c.name.trim() || "Своё подключение",
      url: apiUrl(c.baseUrl, c.format),
      model,
      kind: c.format,
      key: c.apiKey.trim(),
    };
  }
  if (purpose === "advisor" && advKey) {
    const svc = detectService(advKey);
    return svc && { ...svc, key: advKey, model: ai.advisorModel?.trim() || svc.model };
  }
  const svc = detectService(ai.apiKey);
  if (!svc) return null;
  const model =
    (purpose === "advisor" ? ai.advisorModel?.trim() || ai.model.trim() : ai.model.trim()) ||
    svc.model;
  return { ...svc, key: ai.apiKey.trim(), model };
}
/** Name of the AI that parses spending, or "" when only the built-in parser works. */
export const aiName = (ai: AiSettings) => endpoint(ai, "parse")?.name ?? "";

async function post(ep: Endpoint, body: Record<string, unknown>): Promise<string> {
  let r: Response;
  try {
    r = await fetch(ep.url, {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers:
        ep.kind === "anthropic"
          ? {
              "content-type": "application/json",
              "x-api-key": ep.key,
              "anthropic-version": "2023-06-01",
              "anthropic-dangerous-direct-browser-access": "true",
            }
          : { "content-type": "application/json", authorization: `Bearer ${ep.key}` },
      body: JSON.stringify({ model: ep.model, ...body }),
    });
  } catch (e) {
    if (e instanceof Error && /timeout|abort/i.test(e.name + e.message))
      throw new Error(`${ep.name} не ответил за 30 секунд (timeout).`);
    throw new Error(
      `Нет связи с ${ep.name} (fetch): сервер недоступен или не разрешает запросы из браузера (CORS). Проверьте адрес и интернет.`,
    );
  }
  if (!r.ok) {
    const detail = await Promise.resolve()
      .then(() => r.json())
      .then((j) => String(j?.error?.message ?? j?.message ?? "").slice(0, 200))
      .catch(() => "");
    throw new Error(
      `${ep.name} ответил ошибкой ${r.status}${detail ? `: ${detail}` : ". Проверьте ключ."}`,
    );
  }
  const j = await r.json().catch(() => {
    throw new Error(`${ep.name} прислал ответ не в том формате. Проверьте формат API.`);
  });
  const text =
    ep.kind === "anthropic"
      ? (j.content?.find?.((p: { type?: string }) => p.type === "text")?.text ??
        j.content?.[0]?.text)
      : j.choices?.[0]?.message?.content;
  if (typeof text !== "string")
    throw new Error(`${ep.name} прислал ответ не в том формате. Проверьте формат API.`);
  return text;
}
async function chatCall(
  ep: Endpoint,
  system: string,
  messages: { role: string; content: unknown }[],
  extra: Record<string, unknown> = {},
) {
  return ep.kind === "anthropic"
    ? post(ep, { max_tokens: 1500, system, messages, ...extra })
    : post(ep, { messages: [{ role: "system", content: system }, ...messages], ...extra });
}

export async function checkAiModel(ai: AiSettings, purpose: "parse" | "advisor") {
  const ep = endpoint(ai, purpose);
  if (!ep) throw new Error("Подключение не настроено: нужны адрес, ключ и модель.");
  if (!ep.model) throw new Error("Укажите название модели.");
  const reply = await chatCall(
    ep,
    "Ответь одним словом: OK.",
    [{ role: "user", content: "Проверка подключения" }],
    { max_tokens: 20 },
  );
  if (!reply.trim()) throw new Error("Модель ответила без текста. Попробуйте другую модель.");
}
export function detectService(key: string): Svc | null {
  const k = key.trim();
  if (!k) return null;
  if (k.startsWith("sk-myapi_"))
    return {
      name: "Claude n Codex",
      url: "https://claude-n-codex.com:8443/v1/messages",
      model: "claude-sonnet-5",
      kind: "anthropic",
    };
  if (k.startsWith("sk-or-"))
    return {
      name: "OpenRouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "openai/gpt-4o-mini",
      kind: "openai",
    };
  if (k.startsWith("sk-ant-"))
    return {
      name: "Anthropic",
      url: "https://api.anthropic.com/v1/messages",
      model: "claude-haiku-4-5",
      kind: "anthropic",
    };
  if (k.startsWith("AIza"))
    return {
      name: "Google Gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      model: "gemini-2.5-flash",
      kind: "google",
    };
  if (k.startsWith("gsk_"))
    return {
      name: "Groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: "llama-3.3-70b-versatile",
      kind: "openai",
    };
  if (k.startsWith("xai-"))
    return {
      name: "xAI Grok",
      url: "https://api.x.ai/v1/chat/completions",
      model: "grok-3-mini",
      kind: "openai",
    };
  if (/^sk-[a-f0-9]{32}$/.test(k))
    return {
      name: "DeepSeek",
      url: "https://api.deepseek.com/chat/completions",
      model: "deepseek-chat",
      kind: "openai",
    };
  if (k.startsWith("sk-"))
    return {
      name: "OpenAI",
      url: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
      kind: "openai",
    };
  return null;
}

/** Economy mode: if every item was recognised on the device, AI is not called at all. */
export async function parseSmart(
  input: string,
  ai: AiSettings,
): Promise<{ items: Parsed[]; via: "device" | string }> {
  const local = parseLocal(input);
  const svc = endpoint(ai, "parse");
  if (!svc) return { items: local, via: "device" };
  if ((ai.mode ?? "auto") === "auto" && local.length > 0 && local.every((i) => i.known))
    return { items: local, via: "device" };
  return { items: await parseAi(input, ai), via: svc.name };
}

const IMG_PROMPT =
  () => `На картинке скриншот чека, заказа из магазина или списка операций банка. Выпиши ТОЛЬКО реальные траты (списания со знаком «−» или купленные товары): короткое название места/товара и сумму в рублях (число без знака).
НЕ включай:
- поступления со знаком «+», кэшбэк, бонусы, зачисления, возвраты;
- переводы между своими счетами: «Между своими счетами», «Себе в другой банк», «Пополнение/Перевод средств из Кубышки», «Копилка», «Инвесткопилка», «Внесение наличных», «Снятие наличных», «Перевод себе», СБП на свой счёт, накопительный счёт, вклад, пополнение вкладов и кредиток;
- даты, время, заголовки дней, итоги за день, «Итого», адреса, номера заказов, тип карты.
Категорию выбирай по смыслу места, а НЕ по подписи банка (банк часто ошибается): «Городская ферма», парки, зоопарки, выставки, кино — развлечения; «Госуслуги»/«Gosuslugi» — сад, школа, кружки; Яндекс Такси, каршеринг — транспорт; кафе, фастфуд, бистро, пиццерии — кафе; Пятёрочка, ВкусВилл, супермаркеты — продукты; «Долями», «Сплит», рассрочки — кредиты.
Категории (id): ${cats()
    .map((c) => `${c.id}=${c.name}`)
    .join(
      ", ",
    )}. Ответь ТОЛЬКО JSON {"items":[{"note":"Городская ферма","amount":2300,"category":"fun","currency":"RUB"}]}. currency — код ISO валюты списания, amount — в этой валюте.`;

export async function parseImage(file: File, main: AiSettings): Promise<Parsed[]> {
  const blind = (n?: string) => n === "Groq" || n === "DeepSeek";
  let ep = endpoint(main, "parse");
  // a text-only main model: read the photo with the advisor connection, if it can see
  const adv = endpoint(main, "advisor");
  if (
    (!ep || blind(ep.name)) &&
    adv &&
    !blind(adv.name) &&
    (main.advisorApiKey?.trim() || main.advisorConnId)
  )
    ep = adv;
  if (!ep) throw new Error("Для скриншотов нужен ключ ИИ — добавьте его в Настройках.");
  if (blind(ep.name))
    throw new Error(
      "Эта модель не читает картинки. Выберите модель с поддержкой изображений в Настройках.",
    );
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const b64 = dataUrl.split(",")[1] ?? "";
  const content =
    ep.kind === "anthropic"
      ? [
          {
            type: "image",
            source: { type: "base64", media_type: file.type || "image/png", data: b64 },
          },
          { type: "text", text: IMG_PROMPT() },
        ]
      : [
          { type: "text", text: IMG_PROMPT() },
          { type: "image_url", image_url: { url: dataUrl } },
        ];
  const text = await post(ep, { max_tokens: 3000, messages: [{ role: "user", content }] });
  return toItems(text).filter((i) => !isOwnTransfer(i.note));
}

/** Moves between one's own accounts are not spending — dropped even if the model returned them. */
export function isOwnTransfer(note: string) {
  return /(между своими|себе в друг|перевод себе|на свой сч[её]т|кубышк|копилк|накопительн|вклад|снятие наличн|внесение наличн|пополнение (сч[её]та|карты|кредитк))/i.test(
    note,
  );
}

function toItems(text: string): Parsed[] {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("ИИ не вернул список трат");
  const items = (JSON.parse(json).items ?? []) as Parsed[];
  return items
    .filter((i) => Number(i.amount) > 0)
    .map((i) => ({
      note: String(i.note || "Трата"),
      amount: Number(i.amount),
      currency: typeof i.currency === "string" ? i.currency : "RUB",
      category: cats().some((c) => c.id === i.category) ? i.category : guessCategory(i.note),
    }));
}

export async function parseAi(input: string, ai: AiSettings): Promise<Parsed[]> {
  const ep = endpoint(ai, "parse");
  if (!ep) return parseLocal(input);
  return toItems(
    await chatCall(ep, PROMPT(), [{ role: "user", content: input }], { max_tokens: 800 }),
  );
}

export type ChatMsg = { role: "user" | "assistant"; content: string };
/** free conversation with the user's own AI key */
export async function aiChat(
  system: string,
  messages: ChatMsg[],
  settings: AiSettings,
  image?: { dataUrl: string; type: string },
): Promise<string> {
  const ep = endpoint(settings, "advisor");
  if (!ep) throw new Error("Для помощника нужен ключ ИИ — добавьте его в Настройках.");
  if (image && (ep.name === "Groq" || ep.name === "DeepSeek"))
    throw new Error(
      "Эта модель не читает картинки. Выберите модель с поддержкой изображений в Настройках.",
    );
  // the screenshot is attached only to the latest user message
  const last = messages.length - 1;
  const b64 = image?.dataUrl.split(",")[1] ?? "";
  const msgs = messages.map((m, i) =>
    image && i === last
      ? {
          role: m.role,
          content:
            ep.kind === "anthropic"
              ? [
                  {
                    type: "image",
                    source: { type: "base64", media_type: image.type || "image/png", data: b64 },
                  },
                  { type: "text", text: m.content },
                ]
              : [
                  { type: "text", text: m.content },
                  { type: "image_url", image_url: { url: image.dataUrl } },
                ],
        }
      : m,
  );
  return chatCall(ep, system, msgs, { temperature: 0.3 });
}
