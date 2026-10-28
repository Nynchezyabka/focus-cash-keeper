import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { familyConfigured } from "@/lib/family-api";

// Feedback goes to the same database through protected functions (supabase/feedback-setup.sql).
let client: SupabaseClient | null = null;
function db() {
  if (!client) {
    if (!familyConfigured()) throw new Error("not-configured");
    client = createClient(import.meta.env["VITE_SUPABASE_URL"], import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"], {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: "berezhny-feedback-noauth" },
    });
  }
  return client;
}
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(error.message || "rpc-failed");
  return data as T;
}

export type FbKind = "idea" | "bug" | "question";
export const KIND_LABEL: Record<FbKind, string> = { idea: "Идея", bug: "Неудобно / ошибка", question: "Вопрос" };
export type FbItem = { id: string; kind: FbKind; text: string; author: string; version: string; done: boolean; at: string };

const KEY = "berezhny-feedback-owner";
export const ownerKey = () => (typeof localStorage === "undefined" ? null : localStorage.getItem(KEY));
export const setOwnerKey = (k: string | null) => (k ? localStorage.setItem(KEY, k) : localStorage.removeItem(KEY));

export const feedbackApi = {
  send: (kind: FbKind, text: string, author: string, version: string) =>
    rpc<void>("feedback_send", { p_kind: kind, p_text: text, p_author: author, p_version: version }),
  claim: (key: string) => rpc<boolean>("feedback_claim", { p_key: key }),
  list: (key: string) => rpc<FbItem[]>("feedback_list", { p_key: key }),
  mark: (key: string, id: string, done: boolean) => rpc<void>("feedback_mark", { p_key: key, p_id: id, p_done: done }),
  remove: (key: string, id: string) => rpc<void>("feedback_delete", { p_key: key, p_id: id }),
};

/** plain-text report to paste into the developer chat */
export function report(items: FbItem[]) {
  return items
    .filter((i) => !i.done)
    .map((i, n) => `${n + 1}. [${KIND_LABEL[i.kind]}] ${i.text}${i.author ? ` — ${i.author}` : ""} (v${i.version}, ${new Date(i.at).toLocaleDateString("ru-RU")})`)
    .join("\n");
}
