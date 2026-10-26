import { createServerFn } from "@tanstack/react-start";

// Family sharing. Nobody signs in: access is checked here by a long random family code
// (only its hash is stored) and a per-member secret token. Each member writes only their own row.

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function sha(s: string) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(n = 16) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  const s = [...b].map((x) => ALPH[x % ALPH.length]).join("");
  return s.match(/.{1,4}/g)!.join("-");
}
const norm = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");
const MAX = 6;

type Snap = Record<string, string | number> | null;
type Txs = { date: string; kind: string; amount: number; note: string; category: string }[] | null;
const clip = (s: string) => String(s ?? "").slice(0, 40);

async function admin() { return (await import("@/integrations/supabase/client.server")).supabaseAdmin; }
async function me(memberId: string, token: string) {
  const db = await admin();
  const { data } = await db.from("family_members").select("id, family_id, token_hash").eq("id", memberId).maybeSingle();
  if (!data || data.token_hash !== (await sha(token))) throw new Error("not-member");
  return { db, row: data };
}

export const familyPing = createServerFn({ method: "GET" }).handler(async () => ({ ok: true, at: new Date().toISOString() }));

export const createFamily = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; snapshot: Snap }) => d)
  .handler(async ({ data }) => {
    const db = await admin();
    const code = randomCode();
    const token = randomCode(24);
    const { data: fam, error } = await db.from("families").insert({ code_hash: await sha(norm(code)) }).select("id").single();
    if (error || !fam) throw new Error("create-failed");
    const { data: m, error: e2 } = await db.from("family_members")
      .insert({ family_id: fam.id, token_hash: await sha(token), name: clip(data.name), snapshot: data.snapshot as never }).select("id").single();
    if (e2 || !m) throw new Error("create-failed");
    return { code, memberId: m.id, token };
  });

export const joinFamily = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; name: string; snapshot: Snap }) => d)
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: fam } = await db.from("families").select("id").eq("code_hash", await sha(norm(data.code))).maybeSingle();
    if (!fam) return { error: "bad-code" as const };
    const { count } = await db.from("family_members").select("id", { count: "exact", head: true }).eq("family_id", fam.id);
    if ((count ?? 0) >= MAX) return { error: "full" as const };
    const token = randomCode(24);
    const { data: m } = await db.from("family_members")
      .insert({ family_id: fam.id, token_hash: await sha(token), name: clip(data.name), snapshot: data.snapshot as never }).select("id").single();
    if (!m) return { error: "bad-code" as const };
    return { memberId: m.id, token, code: data.code };
  });

export const pushFamily = createServerFn({ method: "POST" })
  .inputValidator((d: { memberId: string; token: string; name: string; shareTxs: boolean; snapshot: Snap; txs: Txs }) => d)
  .handler(async ({ data }) => {
    const { db } = await me(data.memberId, data.token);
    await db.from("family_members").update({
      name: clip(data.name), share_txs: data.shareTxs, snapshot: data.snapshot as never,
      txs: (data.shareTxs ? (data.txs ?? []).slice(0, 200) : null) as never, updated_at: new Date().toISOString(),
    }).eq("id", data.memberId);
    return { ok: true };
  });

export const pullFamily = createServerFn({ method: "POST" })
  .inputValidator((d: { memberId: string; token: string }) => d)
  .handler(async ({ data }) => {
    const { db, row } = await me(data.memberId, data.token);
    const { data: rows } = await db.from("family_members").select("id, name, share_txs, snapshot, txs, updated_at").eq("family_id", row.family_id);
    return { members: (rows ?? []).map((r) => ({ id: r.id, name: r.name, snapshot: r.snapshot as Snap, txs: r.share_txs ? (r.txs as Txs) : null, updatedAt: r.updated_at, me: r.id === data.memberId })) };
  });

export const leaveFamily = createServerFn({ method: "POST" })
  .inputValidator((d: { memberId: string; token: string }) => d)
  .handler(async ({ data }) => {
    const { db, row } = await me(data.memberId, data.token);
    await db.from("family_members").delete().eq("id", data.memberId);
    const { count } = await db.from("family_members").select("id", { count: "exact", head: true }).eq("family_id", row.family_id);
    if (!count) await db.from("families").delete().eq("id", row.family_id);
    return { ok: true };
  });

/** new code; the old one stops working at once */
export const rotateFamilyCode = createServerFn({ method: "POST" })
  .inputValidator((d: { memberId: string; token: string }) => d)
  .handler(async ({ data }) => {
    const { db, row } = await me(data.memberId, data.token);
    const code = randomCode();
    await db.from("families").update({ code_hash: await sha(norm(code)) }).eq("id", row.family_id);
    return { code };
  });

export const deleteFamily = createServerFn({ method: "POST" })
  .inputValidator((d: { memberId: string; token: string }) => d)
  .handler(async ({ data }) => {
    const { db, row } = await me(data.memberId, data.token);
    await db.from("families").delete().eq("id", row.family_id);
    return { ok: true };
  });
