import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Family sharing talks to the database directly through protected functions (see supabase/family-setup.sql),
// so it works on any hosting, even static. Only the public address and publishable key are needed at build time.

let client: SupabaseClient | null = null;
export const familyConfigured = () => !!(import.meta.env["VITE_SUPABASE_URL"] && import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);
function db(): SupabaseClient {
  if (!client) {
    if (!familyConfigured()) throw new Error("not-configured");
    client = createClient(import.meta.env["VITE_SUPABASE_URL"], import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"], {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: "berezhny-family-noauth" },
    });
  }
  return client;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args ?? {});
  if (error) throw new Error(error.message || "rpc-failed");
  return data as T;
}

type Snap = unknown;
export const api = {
  create: (name: string, snapshot: Snap) => rpc<{ code: string; memberId: string; token: string }>("family_create", { p_name: name, p_snapshot: snapshot }),
  join: (code: string, name: string, snapshot: Snap) => rpc<{ code: string; memberId: string; token: string } | { error: "bad-code" | "full" }>("family_join", { p_code: code, p_name: name, p_snapshot: snapshot }),
  push: (m: string, t: string, name: string, share: boolean, snapshot: Snap, txs: unknown) => rpc<void>("family_push", { p_member: m, p_token: t, p_name: name, p_share: share, p_snapshot: snapshot, p_txs: txs }),
  pull: (m: string, t: string) => rpc<unknown[]>("family_pull", { p_member: m, p_token: t }),
  leave: (m: string, t: string) => rpc<void>("family_leave", { p_member: m, p_token: t }),
  rotate: (m: string, t: string) => rpc<string>("family_rotate", { p_member: m, p_token: t }),
  remove: (m: string, t: string) => rpc<void>("family_delete", { p_member: m, p_token: t }),
};

/** step-by-step check of the whole chain, answered in plain Russian */
export async function checkCloud(): Promise<{ ok: boolean; text: string }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, text: "Нет интернета. Приложение работает и без него, семья обновится позже." };
  if (!familyConfigured()) return { ok: false, text: "Не настроены адрес и ключ базы на хостинге. Как это сделать — в README, раздел «Как выложить своё приложение»." };
  const url = import.meta.env["VITE_SUPABASE_URL"] as string;
  const t0 = performance.now();
  try {
    const r = await fetch(`${url}/rest/v1/rpc/family_ping`, {
      method: "POST",
      headers: { apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"], "content-type": "application/json" },
      body: "{}",
    });
    const ms = Math.round(performance.now() - t0);
    if (r.status === 401 || r.status === 403) return { ok: false, text: "База отвечает, но ключ не подходит. Проверьте ключ на хостинге и пересоберите сайт." };
    if (r.status === 404) return { ok: false, text: "База отвечает, но не подготовлена для семьи. Выполните файл supabase/family-setup.sql (см. README)." };
    if (!r.ok) return { ok: false, text: `База ответила ошибкой (${r.status}). Попробуйте позже.` };
    const j = (await r.json()) as { ok?: boolean };
    if (!j.ok) return { ok: false, text: "База отвечает, но запись и чтение не получились." };
    return { ok: true, text: `Всё работает: связь, ключ, запись и чтение (${ms} мс).` };
  } catch {
    return { ok: false, text: "База не отвечает. Возможно, она недоступна из вашей сети — попробуйте другой интернет (Wi-Fi или мобильный)." };
  }
}
