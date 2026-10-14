import { CATEGORIES, type AiSettings } from "./budget";

export interface Parsed { note: string; amount: number; category: string }

export function guessCategory(text: string) {
  const t = text.toLowerCase();
  return CATEGORIES.find((c) => c.keys.some((k) => t.includes(k)))?.id ?? "shop";
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
      const note = p.replace(m[0], "").replace(/(₽|руб\.?|р\.)/gi, "").trim() || "Трата";
      return [{ note, amount, category: guessCategory(note) }];
    });
}

const PROMPT = `Разбери текст пользователя на отдельные траты. Категории (id): ${CATEGORIES.map((c) => `${c.id}=${c.name}`).join(", ")}. Ответь ТОЛЬКО JSON вида {"items":[{"note":"кофе с круассаном","amount":380,"category":"cafe"}]}.`;

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
      body: JSON.stringify({ model: svc.model, max_tokens: 800, system: PROMPT, messages: [{ role: "user", content: input }] }),
    });
    if (!r.ok) throw new Error(`${svc.name} ответил ошибкой ${r.status}. Проверьте ключ.`);
    const j = await r.json();
    text = j.content?.[0]?.text ?? "";
  } else {
    const r = await fetch(svc.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ai.apiKey.trim()}` },
      body: JSON.stringify({ model: svc.model, messages: [{ role: "system", content: PROMPT }, { role: "user", content: input }] }),
    });
    if (!r.ok) throw new Error(`${svc.name} ответил ошибкой ${r.status}. Проверьте ключ.`);
    const j = await r.json();
    text = j.choices?.[0]?.message?.content ?? "";
  }
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("ИИ не вернул список трат");
  const items = (JSON.parse(json).items ?? []) as Parsed[];
  return items
    .filter((i) => Number(i.amount) > 0)
    .map((i) => ({ note: String(i.note || "Трата"), amount: Number(i.amount), category: CATEGORIES.some((c) => c.id === i.category) ? i.category : guessCategory(i.note) }));
}
