import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, LogOut, RefreshCw, Trash2, Users, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Shell, meta } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getState, rub } from "@/lib/budget";
import { familyConfigured } from "@/lib/family-api";
import { familyTotals, patchFamily, setFamily, snapshotOf, syncFamily, useFamily, type FamilyLocal } from "@/lib/family";

export const Route = createFileRoute("/family")({
  validateSearch: (s: Record<string, unknown>) => ({ join: typeof s["join"] === "string" ? (s["join"] as string) : undefined }),
  head: () => meta("Семья — Бережный бюджет", "Общая картина двух личных бюджетов: сколько свободно сегодня и до ближайшего дохода."),
  component: () => <Shell title="Семья">{() => <Family />}</Shell>,
});

const ago = (iso?: string) => {
  if (!iso) return "ещё не обновлялось";
  const m = Math.round((Date.now() - +new Date(iso)) / 60000);
  return m < 2 ? "только что" : m < 60 ? `${m} мин назад` : m < 1440 ? `${Math.round(m / 60)} ч назад` : new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
};

function Family() {
  const f = useFamily();
  const { join } = Route.useSearch();
  useEffect(() => { void syncFamily(); }, []);
  return f ? <Joined f={f} /> : <Setup initialCode={join ?? ""} />;
}

function Setup({ initialCode }: { initialCode: string }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const run = async (kind: "create" | "join") => {
    if (!name.trim()) { toast("Напишите, как вас назвать"); return; }
    setBusy(true);
    try {
      const { api } = await import("@/lib/family-api");
      const snapshot = snapshotOf(getState());
      if (kind === "create") {
        const r = await api.create(name, snapshot);
        setFamily({ ...r, name, shareTxs: false, dirty: false, lastPush: new Date().toISOString() });
      } else {
        const r = await api.join(code, name, snapshot);
        if ("error" in r) { toast(r.error === "full" ? "В этой семье уже много участников" : "Код не подошёл. Проверьте его или попросите новый"); return; }
        setFamily({ ...r, name, shareTxs: false, dirty: false, lastPush: new Date().toISOString() });
      }
      void syncFamily();
    } catch { const { checkCloud } = await import("@/lib/family-api"); toast((await checkCloud()).text); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-5">
      {!familyConfigured() && <p className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">На этом сайте семейный доступ ещё не настроен. Личный бюджет работает полностью. Чтобы включить семью, владельцу сайта нужно один раз подготовить базу и вписать два значения на хостинге — шаги в README.</p>}
      <p className="text-sm text-muted-foreground">Каждый ведёт свой бюджет на своём телефоне. Здесь будет общая картина двух бюджетов. Ничего не объединяется и не заменяется.</p>
      <Input placeholder="Как вас назвать? (Наталья, Муж)" value={name} onChange={(e) => setName(e.target.value)} />
      <section className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="font-display text-lg">Создать семью</h2>
        <p className="text-xs text-muted-foreground">Получите код и QR — покажите их второму человеку.</p>
        <Button className="w-full" disabled={busy} onClick={() => run("create")}><Users /> Создать семью</Button>
      </section>
      <section className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="font-display text-lg">Присоединиться</h2>
        <p className="text-xs text-muted-foreground">Введите код или наведите камеру телефона на QR — он откроет эту страницу с кодом.</p>
        <Input placeholder="XXXX-XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button variant="secondary" className="w-full" disabled={busy || code.replace(/[^a-z0-9]/gi, "").length < 16} onClick={() => run("join")}>Присоединиться</Button>
      </section>
      <CloudCheck />
    </div>
  );
}

function Joined({ f }: { f: FamilyLocal }) {
  const members = f.members ?? [];
  const t = familyTotals(members);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  const link = typeof window !== "undefined" ? `${window.location.origin}/family?join=${encodeURIComponent(f.code)}` : "";
  const [showCode, setShowCode] = useState(members.length < 2);
  const act = async (k: "leave" | "rotate" | "delete") => {
    const { api } = await import("@/lib/family-api");
    try {
      if (k === "rotate") { const code = await api.rotate(f.memberId, f.token); patchFamily({ code }); toast("Новый код готов, старый больше не работает"); return; }
      if (k === "leave") await api.leave(f.memberId, f.token); else await api.remove(f.memberId, f.token);
      setFamily(null);
      toast(k === "leave" ? "Вы вышли из семьи. Ваш бюджет остался на телефоне" : "Семья и облачные данные удалены");
    } catch { toast("Нет связи. Попробуйте, когда появится интернет"); }
  };
  const Row = ({ label, value, hint }: { label: string; value: number; hint?: string }) => (
    <div className="flex items-baseline justify-between gap-2 py-2"><span className="text-sm">{label}{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span><span className="tabular-nums">{rub(value)}</span></div>
  );
  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">{offline ? "Нет связи, показаны последние данные" : f.dirty ? "Ждёт связи" : `Обновлено ${ago(f.lastPull)}`}</p>
      <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
        <p className="text-sm text-muted-foreground">Сегодня свободно вместе</p>
        <p className="mt-1 font-display text-4xl tabular-nums">{rub(t.today)}</p>
        {t.nearestDays > 0 && <p className="mt-2 text-sm text-muted-foreground">До ближайшего дохода ({t.nearestDays} дн.): {rub(t.untilIncome)}</p>}
      </div>
      <section className="divide-y divide-border rounded-2xl bg-card px-4 shadow-soft">
        <Row label="На картах и в наличных" value={t.total} />
        <Row label="Обязательные платежи впереди" value={t.reserve} />
        <Row label="Отложено на чёрный день" value={t.cushion} />
        <Row label="Траты за месяц" value={t.monthSpent} hint="без переводов внутри семьи" />
        <Row label="Доходы за месяц" value={t.monthIncome} />
      </section>
      <section className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="rounded-2xl bg-card p-4 shadow-soft">
            <p className="flex justify-between text-sm"><span>{m.name || "Без имени"}{m.me ? " (вы)" : ""}</span><span className="text-xs text-muted-foreground">{ago(m.updatedAt)}</span></p>
            {m.snapshot ? <p className="mt-1 text-xs text-muted-foreground">Сегодня {rub(m.snapshot.freeToday)} · на счетах {rub(m.snapshot.total)} · платежи {rub(m.snapshot.reserve)} · накопления {rub(m.snapshot.cushion)}</p> : <p className="mt-1 text-xs text-muted-foreground">Данных пока нет</p>}
            {!m.me && m.txs && m.txs.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-border pt-2 text-xs">
                {m.txs.slice(0, 15).map((x, i) => (
                  <li key={i} className="flex justify-between gap-2"><span className="truncate">{x.note || x.category} <span className="text-muted-foreground">· {new Date(x.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span></span><span className="tabular-nums">{x.kind === "income" ? "+" : "−"}{rub(x.amount)}</span></li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {members.length < 2 && <p className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">Пока здесь только вы. Покажите код второму человеку.</p>}
      </section>

      <section className="space-y-3 rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="font-display text-lg">Что видит партнёр</h2>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-xs">
          {([[false, "Только итоги"], [true, "Итоги и траты"]] as const).map(([v, l]) => (
            <button key={l} onClick={() => { patchFamily({ shareTxs: v, dirty: true }); void syncFamily(); }} className={`rounded-lg py-2 ${f.shareTxs === v ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Траты партнёр только смотрит. Ключ ИИ, чат Помощника и «О себе» никогда не передаются.</p>
        <Input placeholder="Как вас назвать" value={f.name} onChange={(e) => patchFamily({ name: e.target.value, dirty: true })} onBlur={() => void syncFamily()} />
      </section>

      <section className="space-y-3 rounded-2xl bg-card p-4 shadow-soft">
        <button className="font-display text-lg" onClick={() => setShowCode(!showCode)}>Код семьи {showCode ? "▴" : "▾"}</button>
        {showCode && (
          <>
            <div className="mx-auto w-fit rounded-xl bg-background p-3"><QRCodeSVG value={link} size={160} /></div>
            <p className="text-center font-mono text-lg tracking-wider">{f.code}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(f.code); toast("Код скопирован"); }}><Copy /> Копировать</Button>
              <Button variant="secondary" onClick={() => act("rotate")}><RefreshCw /> Новый код</Button>
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => { if (confirm("Выйти из семьи? Ваш бюджет останется на телефоне.")) void act("leave"); }}><LogOut /> Выйти</Button>
          <Button variant="outline" onClick={() => { if (confirm("Удалить семью и все облачные данные для всех участников?")) void act("delete"); }}><Trash2 /> Удалить</Button>
        </div>
      </section>
      <CloudCheck />
    </div>
  );
}

function CloudCheck() {
  const [r, setR] = useState<string | null>(null);
  return (
    <div className="space-y-1 text-center">
      <Button variant="ghost" size="sm" onClick={async () => {
        setR("Проверяю…");
        const { checkCloud } = await import("@/lib/family-api");
        setR((await checkCloud()).text);
      }}><Wifi /> Проверить связь с облаком</Button>
      {r && <p className="text-xs text-muted-foreground">{r}</p>}
    </div>
  );
}
