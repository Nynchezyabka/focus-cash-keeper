import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Camera, Laptop, Lock, RefreshCw, Smartphone, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Shell, meta } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getState } from "@/lib/budget";
import { familyConfigured } from "@/lib/family-api";
import { answerPairing, pollPairing, syncDevices, unlink, useLink } from "@/lib/device-sync";
import { newPairCode, normCode, showCode } from "@/lib/vault-crypto";

export const Route = createFileRoute("/devices")({
  head: () => meta("Мои устройства — Бережный бюджет", "Один бюджет на телефоне и компьютере: подключение по QR-коду, данные зашифрованы на устройстве."),
  component: () => <Shell title="Мои устройства">{() => <Devices />}</Shell>,
});

const PREFIX = "BEREZHNY-SYNC:";

function Devices() {
  const link = useLink();
  const [mode, setMode] = useState<"phone" | "computer" | null>(null);
  useEffect(() => { setMode(window.matchMedia("(min-width: 1024px)").matches ? "computer" : "phone"); }, []);
  if (!familyConfigured()) return <p className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">Сервер не подключён, поэтому связать устройства пока нельзя. Бюджет работает полностью на этом устройстве.</p>;
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <p className="flex gap-2 text-sm text-muted-foreground"><Lock className="mt-0.5 h-4 w-4 shrink-0" /> Бюджет шифруется прямо на устройстве. В сети лежит только зашифрованная копия — без ключа с ваших устройств её никто не прочитает. Ключ ИИ не передаётся.</p>
      {link && <Linked />}
      <div className="grid grid-cols-2 gap-2">
        <Button variant={mode === "phone" ? "default" : "secondary"} onClick={() => setMode("phone")}><Smartphone /> Это телефон</Button>
        <Button variant={mode === "computer" ? "default" : "secondary"} onClick={() => setMode("computer")}><Laptop /> Это компьютер</Button>
      </div>
      {mode === "computer" && <ShowCode />}
      {mode === "phone" && <Scan />}
    </div>
  );
}

function Linked() {
  const l = useLink()!;
  return (
    <section className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
      <h2 className="text-base font-medium">Синхронизация включена</h2>
      <p className="text-xs text-muted-foreground">{l.dirty ? "Есть изменения, отправятся при связи." : l.lastSync ? `Сверено: ${new Date(l.lastSync).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}` : "Ещё не сверялось."}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => void syncDevices().then(() => toast("Сверено"))}><RefreshCw /> Сверить сейчас</Button>
        <Button variant="outline" onClick={() => { if (confirm("Отключить это устройство? Бюджет на нём останется, но перестанет обновляться. Копия в сети удалится, остальные устройства тоже отключатся.")) void unlink(true).then(() => toast("Устройство отключено")).catch(() => toast("Нет связи. Попробуйте позже")); }}><Unlink /> Отключить</Button>
      </div>
    </section>
  );
}

function ShowCode() {
  const [code, setCode] = useState<string | null>(null);
  const [left, setLeft] = useState(600);
  const hasData = getState().txs.length > 0;
  useEffect(() => {
    if (!code) return;
    let stop = false; const t0 = Date.now();
    const tick = async () => {
      if (stop) return;
      const s = Math.max(0, 600 - Math.round((Date.now() - t0) / 1000)); setLeft(s);
      if (s === 0) { setCode(null); return; }
      try { if (await pollPairing(code)) { toast("Телефон подключён — бюджет здесь"); setCode(null); return; } } catch { /* retry */ }
      setTimeout(() => void tick(), 2000);
    };
    void tick();
    return () => { stop = true; };
  }, [code]);
  if (!code) return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-soft">
      <h2 className="font-display text-lg">Подключить телефон</h2>
      <p className="text-sm text-muted-foreground">Покажем QR-код. Откройте приложение на телефоне: Настройки → «Мои устройства» → «Это телефон» и наведите камеру.</p>
      {hasData && <p className="rounded-xl bg-secondary p-3 text-xs text-secondary-foreground">На этом устройстве уже есть записи. После подключения их заменит бюджет с телефона.</p>}
      <Button className="w-full" onClick={() => setCode(newPairCode())}>Показать QR-код</Button>
    </section>
  );
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 text-center shadow-soft">
      <div className="mx-auto w-fit rounded-2xl bg-background p-4"><QRCodeSVG value={PREFIX + code} size={220} /></div>
      <p className="text-sm text-muted-foreground">Или введите на телефоне код:</p>
      <p className="font-mono text-xl tracking-wider tabular-nums">{showCode(code)}</p>
      <p className="text-xs text-muted-foreground">Ждём телефон… код действует ещё {Math.ceil(left / 60)} мин.</p>
      <Button variant="ghost" size="sm" onClick={() => setCode(null)}>Отменить</Button>
    </section>
  );
}

function Scan() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cam, setCam] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const send = async (raw: string) => {
    const c = normCode(raw.replace(PREFIX, ""));
    if (c.length !== 16) { toast("Код из 16 знаков — проверьте его"); return; }
    setBusy(true);
    try { await answerPairing(c); toast("Готово: компьютер получает бюджет"); setCode(""); }
    catch { toast("Не получилось. Проверьте интернет и попробуйте ещё раз"); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!cam) return;
    let stream: MediaStream | null = null, stop = false;
    (async () => {
      try {
        const jsQR = (await import("jsqr")).default;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = video.current!; v.srcObject = stream; await v.play();
        const cv = document.createElement("canvas"), ctx = cv.getContext("2d", { willReadFrequently: true })!;
        const loop = () => {
          if (stop) return;
          if (v.videoWidth) {
            cv.width = v.videoWidth; cv.height = v.videoHeight; ctx.drawImage(v, 0, 0);
            const r = jsQR(ctx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height);
            if (r?.data.startsWith(PREFIX)) { setCam(false); void send(r.data); return; }
          }
          requestAnimationFrame(loop);
        };
        loop();
      } catch { toast("Камера недоступна. Введите код с экрана компьютера"); setCam(false); }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [cam]);
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-soft">
      <h2 className="font-display text-lg">Подключить компьютер</h2>
      <p className="text-sm text-muted-foreground">На компьютере откройте «Мои устройства» → «Показать QR-код». Бюджет с этого телефона появится там и дальше будет обновляться сам.</p>
      {cam ? (
        <div className="space-y-2"><video ref={video} playsInline muted className="w-full rounded-2xl bg-muted" /><Button variant="ghost" className="w-full" onClick={() => setCam(false)}>Закрыть камеру</Button></div>
      ) : <Button className="w-full" disabled={busy} onClick={() => setCam(true)}><Camera /> Сканировать QR-код</Button>}
      <div className="flex gap-2">
        <Input placeholder="XXXX-XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" />
        <Button variant="secondary" disabled={busy || normCode(code).length !== 16} onClick={() => void send(code)}>Ввести</Button>
      </div>
    </section>
  );
}
