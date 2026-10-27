// Foreign currencies: rates come from the Bank of Russia mirror (works without VPN) and are cached for offline use.
export const CURRENCIES: { code: string; sign: string; name: string; words: RegExp }[] = [
  { code: "RUB", sign: "₽", name: "Рубли", words: /₽|руб|\bр\b/i },
  { code: "USD", sign: "$", name: "Доллары", words: /\$|usd|доллар|бакс/i },
  { code: "EUR", sign: "€", name: "Евро", words: /€|eur|евро/i },
  { code: "KZT", sign: "₸", name: "Тенге", words: /₸|kzt|тенге/i },
  { code: "TRY", sign: "₺", name: "Лиры", words: /₺|try|лир/i },
  { code: "CNY", sign: "¥", name: "Юани", words: /¥|cny|юан/i },
  { code: "AMD", sign: "֏", name: "Драмы", words: /֏|amd|драм/i },
  { code: "GEL", sign: "₾", name: "Лари", words: /₾|gel|лари/i },
  { code: "BYN", sign: "Br", name: "Бел. рубли", words: /byn|бел\.?\s?руб/i },
  { code: "AED", sign: "AED", name: "Дирхамы", words: /aed|дирхам/i },
  { code: "THB", sign: "฿", name: "Баты", words: /฿|thb|бат/i },
  { code: "UZS", sign: "сум", name: "Сумы", words: /uzs|\bсум\b/i },
];
export const currency = (code: string) => CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]!;

const KEY = "berezhny-fx";
type Cache = { at: string; rates: Record<string, number> };
function cache(): Cache | null { try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; } }

/** rubles for one unit; cached value if offline */
export function cachedRate(code: string): number | null {
  if (code === "RUB") return 1;
  return cache()?.rates[code] ?? null;
}
export async function loadRates(): Promise<Cache | null> {
  const c = cache();
  if (c && Date.now() - +new Date(c.at) < 6 * 3600000) return c;
  try {
    const r = await fetch("https://www.cbr-xml-daily.ru/daily_json.js");
    const j = (await r.json()) as { Valute: Record<string, { Value: number; Nominal: number }> };
    const rates: Record<string, number> = {};
    for (const [k, v] of Object.entries(j.Valute)) rates[k] = v.Value / v.Nominal;
    const out = { at: new Date().toISOString(), rates };
    localStorage.setItem(KEY, JSON.stringify(out));
    return out;
  } catch { return c; }
}

/** finds a currency mentioned in a phrase («кофе 4 евро», «$12»); RUB when none */
export function detectCurrency(text: string): string {
  for (const c of CURRENCIES.slice(1)) if (c.words.test(text)) return c.code;
  return "RUB";
}
export const stripCurrency = (text: string) => CURRENCIES.reduce((t, c) => t.replace(new RegExp(c.words.source, "gi"), ""), text).replace(/\s+/g, " ").trim();

export const toRub = (amount: number, rate: number) => Math.round(amount * rate * 100) / 100;
