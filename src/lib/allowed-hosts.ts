// One list of addresses the app may talk to. Used by the CSP (src/routes/__root.tsx) and by the
// «своё подключение» form, so a blocked address is explained before saving instead of failing later.
export const AI_HOSTS = [
  "api.openai.com",
  "openrouter.ai",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "api.groq.com",
  "api.x.ai",
  "api.deepseek.com",
] as const;
export const OTHER_HOSTS = ["*.supabase.co", "www.cbr-xml-daily.ru"] as const;

export const CONNECT_SRC = [
  "'self'",
  ...[...OTHER_HOSTS, ...AI_HOSTS].map((h) => `https://${h}`),
].join(" ");

/** true when the browser policy lets the app send requests to this AI address */
export function aiHostAllowed(url: string) {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || (u.port && u.port !== "443")) return false;
  return (AI_HOSTS as readonly string[]).includes(u.hostname.toLowerCase());
}
export const blockedHostText = () =>
  `Этот адрес не разрешён политикой безопасности приложения. Подключиться можно только к сервисам из списка: ${AI_HOSTS.join(", ")}. Чтобы добавить свой, нужно добавить его в список разрешённых адресов в коде (src/lib/allowed-hosts.ts).`;
