import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2, Lock } from "lucide-react";
import { Shell, meta } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { APP_VERSION } from "@/lib/pwa";
import { familyConfigured } from "@/lib/family-api";
import { KIND_LABEL, feedbackApi, ownerKey, report, setOwnerKey, type FbItem, type FbKind } from "@/lib/feedback";

export const Route = createFileRoute("/feedback")({
  head: () => meta("Предложить идею — Бережный бюджет", "Напишите идею, неудобство или вопрос — автор приложения прочитает."),
  component: () => <Shell title="Идеи и отзывы">{() => <Feedback />}</Shell>,
});

function Feedback() {
  const [owner, setOwner] = useState<string | null>(null);
  useEffect(() => setOwner(ownerKey()), []);
  if (!familyConfigured()) return <p className="text-sm text-muted-foreground">Отправка отзывов работает, когда у приложения подключена база.</p>;
  return (
    <div className="space-y-6">
      <SendForm />
      {owner ? <Inbox k={owner} onExit={() => { setOwnerKey(null); setOwner(null); }} /> : <OwnerLogin onOk={(k) => { setOwnerKey(k); setOwner(k); }} />}
    </div>
  );
}

function SendForm() {
  const [kind, setKind] = useState<FbKind>("idea");
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setAuthor(localStorage.getItem("berezhny-feedback-name") ?? ""), []);
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-soft">
      <p className="text-sm text-muted-foreground">Пришла мысль — запишите сразу. Можно голосом через микрофон на клавиатуре.</p>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-xs">
        {(Object.keys(KIND_LABEL) as FbKind[]).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-lg py-2 ${kind === k ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>{KIND_LABEL[k]}</button>
        ))}
      </div>
      <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Что было бы удобнее?" />
      <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Ваше имя (необязательно)" />
      <Button className="w-full" disabled={busy || !text.trim()} onClick={async () => {
        setBusy(true);
        try {
          localStorage.setItem("berezhny-feedback-name", author);
          await feedbackApi.send(kind, text.trim(), author.trim(), APP_VERSION);
          setText("");
          toast.success("Спасибо! Отправлено");
        } catch { toast.error("Не отправилось. Проверьте интернет и попробуйте ещё раз"); }
        setBusy(false);
      }}>Отправить</Button>
    </section>
  );
}

function OwnerLogin({ onOk }: { onOk: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const [k, setK] = useState("");
  if (!open) return <button onClick={() => setOpen(true)} className="mx-auto flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Я автор приложения</button>;
  return (
    <section className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
      <h2 className="font-display text-lg">Вход для автора</h2>
      <p className="text-xs text-muted-foreground">Первый введённый ключ становится вашим. Придумайте от 8 символов и сохраните — без него отзывы не открыть.</p>
      <Input type="password" value={k} onChange={(e) => setK(e.target.value)} placeholder="Ключ автора" />
      <Button className="w-full" disabled={k.length < 8} onClick={async () => {
        try { (await feedbackApi.claim(k)) ? onOk(k) : toast.error("Ключ не подходит"); }
        catch { toast.error("База не подготовлена для отзывов или нет интернета"); }
      }}>Открыть отзывы</Button>
    </section>
  );
}

function Inbox({ k, onExit }: { k: string; onExit: () => void }) {
  const [items, setItems] = useState<FbItem[] | null>(null);
  const load = () => feedbackApi.list(k).then(setItems).catch(() => { toast.error("Не удалось загрузить"); setItems([]); });
  useEffect(() => { load(); }, [k]);
  const open = items?.filter((i) => !i.done).length ?? 0;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Все отзывы · новых {open}</h2>
        <button onClick={onExit} className="text-xs text-muted-foreground">Выйти</button>
      </div>
      <Button variant="secondary" className="w-full" disabled={!open} onClick={async () => {
        await navigator.clipboard.writeText(report(items ?? []));
        toast.success("Скопировано — вставьте в чат разработки");
      }}><Copy className="h-4 w-4" />Скопировать невнедрённые</Button>
      {items === null && <p className="text-sm text-muted-foreground">Загружаю…</p>}
      {items?.length === 0 && <p className="text-sm text-muted-foreground">Пока отзывов нет.</p>}
      {items?.map((i) => (
        <div key={i.id} className={`flex gap-3 rounded-2xl bg-card p-3 shadow-soft ${i.done ? "opacity-50" : ""}`}>
          <input type="checkbox" aria-label="Внедрено" className="mt-1 h-5 w-5 accent-primary" checked={i.done} onChange={async (e) => {
            const d = e.target.checked;
            setItems((xs) => xs?.map((x) => (x.id === i.id ? { ...x, done: d } : x)) ?? null);
            feedbackApi.mark(k, i.id, d).catch(() => toast.error("Не сохранилось"));
          }} />
          <div className="min-w-0 flex-1">
            <p className={`whitespace-pre-wrap text-sm ${i.done ? "line-through" : ""}`}>{i.text}</p>
            <p className="mt-1 text-xs text-muted-foreground">{KIND_LABEL[i.kind]} · {i.author || "без имени"} · {new Date(i.at).toLocaleDateString("ru-RU")} · v{i.version}</p>
          </div>
          <button aria-label="Удалить" onClick={async () => {
            if (!confirm("Удалить отзыв?")) return;
            await feedbackApi.remove(k, i.id).catch(() => toast.error("Не удалилось"));
            setItems((xs) => xs?.filter((x) => x.id !== i.id) ?? null);
          }}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
        </div>
      ))}
    </section>
  );
}
