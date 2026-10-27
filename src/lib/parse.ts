import { cachedRate, currency, detectCurrency, stripCurrency, toRub } from "@/lib/fx";
import { cats, type AiSettings } from "./budget";

export interface Parsed { note: string; amount: number; category: string; known?: boolean; currency?: string; orig?: { amount: number; currency: string; rate: number } }
/** converts items in other currencies to rubles with the cached Bank of Russia rate */
export function applyFx(items: Parsed[]): Parsed[] {
  return items.map((i) => {
    const code = (i.currency ?? "RUB").toUpperCase();
    if (code === "RUB") return i;
    const rate = cachedRate(code);
    if (!rate) return { ...i, note: `${i.note} (${i.amount} ${currency(code).sign}, курс неизвестен)` };
    return { ...i, amount: Math.round(toRub(i.amount, rate)), orig: { amount: i.amount, currency: code, rate } };
  });
}

/** best match = longest key found in the text (learned keys are more specific) */
export function matchCategory(text: string): string | null {
  const t = text.toLowerCase();
  let best: { id: string; len: number } | null = null;
  for (const c of cats()) for (const k of c.keys) if (k && t.includes(k) && (!best || k.length > best.len)) best = { id: c.id, len: k.length };
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

const PROMPT = () => `Разбери текст пользователя на отдельные траты. Категории (id): ${cats().map((c) => `${c.id}=${c.name}`).join(", ")}. Ответь ТОЛЬКО JSON вида {"items":[{"note":"кофе с круассаном","amount":380,"category":"cafe","currency":"RUB"}]}. currency — код ISO (RUB, USD, EUR, KZT, TRY, CNY, AMD, GEL…), amount — в этой валюте.`;

type Svc = { name: string; url: string; model: string; kind: "openai" | "anthropic" | "google" };
export function detectService(key: string): Svc | null {
  const k = key.trim();
  if (!k) return null;
  if (k.startsWith("sk-or-")) return { name: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-4o-mini", kind: "openai" };
  if (k.startsWith("sk-ant-")) return { name: "Anthropic", url: "https://api.anthropic.com/v1/messages", model: "claude-haiku-4-5", kind: "anthropic" };
  if (k.startsWith("AIza")) return { name: "Google Gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-2.5-flash", kind: "google" };
  if (k.startsWith("gsk_")) return { name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", kind: "openai" };
  if (k.startsWith("xai-")) return { name: "xAI Grok", url: "https://api.x.ai/v1/chat/completions", model: "grok-3-mini", kind: "openai" };
  if (/^sk-[a-f0-9]{32}$/.test(k)) return { name: "DeepSeek", url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat", kind: "openai" };
  if (k.startsWith("sk-")) return { name: "OpenAI", url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini", kind: "openai" };
  return null;
}

/** Economy mode: if every item was recognised on the device, AI is not called at all. */
export async function parseSmart(input: string, ai: AiSettings): Promise<{ items: Parsed[]; via: "device" | string }> {
  const local = parseLocal(input);
  const svc = detectService(ai.apiKey);
  if (!svc) return { items: local, via: "device" };
  if ((ai.mode ?? "auto") === "auto" && local.length > 0 && local.every((i) => i.known)) return { items: local, via: "device" };
  return { items: await parseAi(input, ai), via: svc.name };
}

const IMG_PROMPT = () => `На картинке скриншот чека, заказа из магазина или списка операций банка. Выпиши ТОЛЬКО реальные траты (списания со знаком «−» или купленные товары): короткое название места/товара и сумму в рублях (число без знака).
НЕ включай:
- поступления со знаком «+», кэшбэк, бонусы, зачисления, возвраты;
- переводы между своими счетами: «Между своими счетами», «Себе в другой банк», «Пополнение/Перевод средств из Кубышки», «Копилка», «Инвесткопилка», «Внесение наличных», «Снятие наличных», пополнение вкладов и кредиток;
- даты, время, заголовки дней, итоги за день, «Итого», адреса, номера заказов, тип карты.
Категорию выбирай по смыслу места, а НЕ по подписи банка (банк часто ошибается): «Городская ферма», парки, зоопарки, выставки, кино — развлечения; «Госуслуги»/«Gosuslugi» — сад, школа, кружки; Яндекс Такси, каршеринг — транспорт; кафе, фастфуд, бистро, пиццерии — кафе; Пятёрочка, ВкусВилл, супермаркеты — продукты; «Долями», «Сплит», рассрочки — кредиты.
Категории (id): ${cats().map((c) => `${c.id}=${c.name}`).join(", ")}. Ответь ТОЛЬКО JSON {"items":[{"note":"Городская ферма","amount":2300,"category":"fun","currency":"RUB"}]}. currency — код ISO валюты списания, amount — в этой валюте.`;

export async function parseImage(file: File, ai: AiSettings): Promise<Parsed[]> {
  const svc = detectService(ai.apiKey);
  if (!svc) throw new Error("Для скриншотов нужен ключ ИИ — добавьте его в Настройках.");
  if (svc.name === "Groq") throw new Error(`${svc.name} не умеет читать картинки. Подойдёт ключ OpenAI, Gemini, DeepSeek, OpenRouter или Anthropic.`);
  const dataUrl: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
  const b64 = dataUrl.split(",")[1] ?? "";
  let text = "";
  if (svc.kind === "anthropic") {
    const r = await fetch(svc.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ai.apiKey.trim(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: svc.model, max_tokens: 3000, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: file.type || "image/png", data: b64 } }, { type: "text", text: IMG_PROMPT() }] }] }),
    });
    if (!r.ok) throw new Error(`${svc.name} ответил ошибкой ${r.status}. Проверьте ключ.`);
    text = (await r.json()).content?.[0]?.text ?? "";
  } else {
    const r = await fetch(svc.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ai.apiKey.trim()}` },
      body: JSON.stringify({ model: svc.model, max_tokens: 3000, messages: [{ role: "user", content: [{ type: "text", text: IMG_PROMPT() }, { type: "image_url", image_url: { url: dataUrl } }] }] }),
    });
    if (!r.ok) throw new Error(`${svc.name} ответил ошибкой ${r.status}. Проверьте ключ.`);
    text = (await r.json()).choices?.[0]?.message?.content ?? "";
  }
  return toItems(text);
}

function toItems(text: string): Parsed[] {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("ИИ не вернул список трат");
  const items = (JSON.parse(json).items ?? []) as Parsed[];
  return items
    .filter((i) => Number(i.amount) > 0)
    .map((i) => ({ note: String(i.note || "Трата"), amount: Number(i.amount), currency: typeof i.currency === "string" ? i.currency : "RUB", category: cats().some((c) => c.id === i.category) ? i.category : guessCategory(i.note) }));
}

export async function parseAi(input: string, ai: AiSettings): Promise<Parsed[]> {
  const svc = detectService(ai.apiKey);
  if (!svc) return parseLocal(input);
  let text = "";
  if (svc.kind === "anthropic") {
    const r = await fetch(svc.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ai.apiKey.trim(),
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: svc.model, max_tokens: 800, system: PROMPT(), messages: [{ role: "user", content: input }] }),
    });
    if (!r.ok) throw new Error(`${svc.name} ответил ошибкой ${r.status}. Проверьте ключ.`);
    const j = await r.json();
    text = j.content?.[0]?.text ?? "";
  } else {
    const r = await fetch(svc.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ai.apiKey.trim()}` },
      body: JSON.stringify({ model: svc.model, messages: [{ role: "system", content: PROMPT() }, { role: "user", content: input }] }),
    });
    if (!r.ok) throw new Error(`${svc.name} ответил ошибкой ${r.status}. Проверьте ключ.`);
    const j = await r.json();
    text = j.choices?.[0]?.message?.content ?? "";
  }
  return toItems(text);
}

export type ChatMsg = { role: "user" | "assistant"; content: string };
/** free conversation with the user's own AI key */
export async function aiChat(system: string, messages: ChatMsg[], ai: AiSettings, image?: { dataUrl: string; type: string }): Promise<string> {
  const svc = detectService(ai.apiKey);
  if (!svc) throw new Error("Для помощника нужен ключ ИИ — добавьте его в Настройках.");
  if (image && svc.name === "Groq") throw new Error("Groq не умеет читать картинки. Подойдёт ключ OpenAI, Gemini, DeepSeek, OpenRouter или Anthropic.");
  // the screenshot is attached only to the latest user message
  const last = messages.length - 1;
  const b64 = image?.dataUrl.split(",")[1] ?? "";
  if (svc.kind === "anthropic") {
    const r = await fetch(svc.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ai.apiKey.trim(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: svc.model, max_tokens: 1500, system, messages: messages.map((m, i) => (image && i === last ? { role: m.role, content: [{ type: "image", source: { type: "base64", media_type: image.type || "image/png", data: b64 } }, { type: "text", text: m.content }] } : m)) }),
    });
    if (!r.ok) throw new Error(`${svc.name} ответил ошибкой ${r.status}. Проверьте ключ.`);
    return (await r.json()).content?.[0]?.text ?? "";
  }
  const r = await fetch(svc.url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${ai.apiKey.trim()}` },
    body: JSON.stringify({ model: svc.model, messages: [{ role: "system", content: system }, ...messages.map((m, i) => (image && i === last ? { role: m.role, content: [{ type: "text", text: m.content }, { type: "image_url", image_url: { url: image.dataUrl } }] } : m))] }),
  });
  if (!r.ok) throw new Error(`${svc.name} ответил ошибкой ${r.status}. Проверьте ключ.`);
  return (await r.json()).choices?.[0]?.message?.content ?? "";
}
