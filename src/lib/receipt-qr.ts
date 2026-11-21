// Разбор QR-кода российского кассового чека: t=20261121T1530&s=857.00&fn=…&i=…&fp=…&n=1
export type ReceiptQr = { amount: number; date?: string };

export function parseReceiptQr(raw: string): ReceiptQr | null {
  const text = raw.trim();
  if (!/(^|&)s=/.test(text) || !/(^|&)t=/.test(text)) return null;
  const p = new URLSearchParams(text.replace(/^.*\?/, ""));
  const s = Number((p.get("s") ?? "").replace(",", "."));
  if (!(s > 0)) return null;
  const t = p.get("t") ?? "";
  const m = t.match(/^(\d{4})(\d{2})(\d{2})/);
  return { amount: Math.round(s), ...(m ? { date: `${m[1]}-${m[2]}-${m[3]}` } : {}) };
}
