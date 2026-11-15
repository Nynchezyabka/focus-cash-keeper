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
  "claude-n-codex.com:8443",
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
  if (u.protocol !== "https:") return false;
  // u.host drops the default 443 port, so plain hosts match as before; custom ports must be listed.
  return (AI_HOSTS as readonly string[]).includes(u.host.toLowerCase());
}
export const blockedHostText = () =>
  `Этот адрес не разрешён политикой безопасности приложения. Подключиться можно только к сервисам из списка: ${AI_HOSTS.join(", ")}. Чтобы добавить свой, нужно добавить его в список разрешённых адресов в коде (src/lib/allowed-hosts.ts).`;
