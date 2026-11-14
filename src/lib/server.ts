// Which database family sync and feedback use: the site's built-in one, or the person's own (stored only on this device).
export type Server = { url: string; key: string };
const KEY = "berezhny-own-server";

export function ownServer(): Server | null {
  if (typeof localStorage === "undefined") return null;
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); return s?.url && s?.key ? s : null; } catch { return null; }
}
export function setOwnServer(s: Server | null) {
  if (s) localStorage.setItem(KEY, JSON.stringify({ url: s.url.trim().replace(/\/+$/, ""), key: s.key.trim() }));
  else localStorage.removeItem(KEY);
  location.reload(); // clients are cached per server
}
export function builtInServer(): Server | null {
  const url = import.meta.env["VITE_SUPABASE_URL"], key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  return url && key ? { url, key } : null;
}
export const activeServer = (): Server | null => ownServer() ?? builtInServer();
/** own server must be a hosted project: the security policy only lets the app talk to *.supabase.co */
export const validServerUrl = (u: string) => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(u.trim());
