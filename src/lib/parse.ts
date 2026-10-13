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

export async function parseAi(input: string, ai: AiSettings): Promise<Parsed[]> {
  if (ai.provider === "none" || !ai.apiKey) return parseLocal(input);
  let text = "";
  if (ai.provider === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ai.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: ai.model || "claude-haiku-4-5", max_tokens: 800, system: PROMPT, messages: [{ role: "user", content: input }] }),
    });
    if (!r.ok) throw new Error(`Сервис ИИ ответил ${r.status}`);
    const j = await r.json();
    text = j.content?.[0]?.text ?? "";
  } else {
    const url = ai.provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ai.apiKey}` },
      body: JSON.stringify({
        model: ai.model || (ai.provider === "openai" ? "gpt-4o-mini" : "openai/gpt-4o-mini"),
        messages: [{ role: "system", content: PROMPT }, { role: "user", content: input }],
      }),
    });
    if (!r.ok) throw new Error(`Сервис ИИ ответил ${r.status}`);
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
