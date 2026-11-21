import { useEffect, useRef, useState } from "react";
import { Camera, Flashlight, ImageIcon, RefreshCw, Sparkles, X } from "lucide-react";
import { parseReceiptQr, type ReceiptQr } from "@/lib/receipt-qr";

export function SmartCameraIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span className="relative inline-flex">
      <Camera className={className} />
      <Sparkles className="absolute -right-1.5 -top-1.5 h-3 w-3" />
    </span>
  );
}

export function CameraCapture({
  open,
  onClose,
  onPhoto,
  onQr,
  title = "Чек или фото покупки",
}: {
  open: boolean;
  onClose: () => void;
  onPhoto: (f: File) => void;
  onQr?: (r: ReceiptQr) => void;
  title?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [torch, setTorch] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [failed, setFailed] = useState(false);
  const qrRef = useRef(onQr);
  qrRef.current = onQr;
  const wantQr = !!onQr;

  useEffect(() => {
    if (!open) return;
    let stop = false;
    setFailed(false);
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
        if (stop) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        const caps = s.getVideoTracks()[0]?.getCapabilities?.() as { torch?: boolean } | undefined;
        setCanTorch(!!caps?.torch);
        const v = video.current!;
        v.srcObject = s;
        await v.play();
        if (!wantQr) return;
        const jsQR = (await import("jsqr")).default;
        const cv = document.createElement("canvas");
        const ctx = cv.getContext("2d", { willReadFrequently: true })!;
        let last = 0;
        const loop = (ts: number) => {
          if (stop) return;
          if (ts - last > 250 && v.videoWidth) {
            last = ts;
            const k = Math.min(1, 640 / v.videoWidth);
            cv.width = v.videoWidth * k;
            cv.height = v.videoHeight * k;
            ctx.drawImage(v, 0, 0, cv.width, cv.height);
            const r = jsQR(ctx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height);
            const q = r ? parseReceiptQr(r.data) : null;
            if (q) {
              navigator.vibrate?.(40);
              qrRef.current?.(q);
              return;
            }
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      stop = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      setTorch(false);
    };
  }, [open, facing, wantQr]);

  if (!open) return null;

  const shoot = () => {
    const v = video.current;
    if (!v?.videoWidth) return;
    const cv = document.createElement("canvas");
    cv.width = v.videoWidth;
    cv.height = v.videoHeight;
    cv.getContext("2d")!.drawImage(v, 0, 0);
    cv.toBlob(
      (b) => b && onPhoto(new File([b], `photo-${Date.now()}.jpg`, { type: "image/jpeg" })),
      "image/jpeg",
      0.85,
    );
  };
  const toggleTorch = async () => {
    const t = stream.current?.getVideoTracks()[0];
    if (!t) return;
    try {
      await t.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      setCanTorch(false);
    }
  };
  const btn = "flex h-12 w-12 items-center justify-center rounded-full active:scale-95";

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="camera-ui fixed inset-0 z-[100] flex flex-col">
      <div className="flex items-center gap-3 px-3 pb-2 pt-[max(env(safe-area-inset-top),12px)]">
        <button type="button" aria-label="Закрыть" onClick={onClose} className={btn}>
          <X className="h-6 w-6" />
        </button>
        <h2 className="flex-1 pr-12 text-center text-lg">{title}</h2>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        {failed && (
          <p className="absolute inset-0 flex items-center justify-center p-8 text-center">
            Камера недоступна. Можно выбрать готовое фото из галереи — кнопка слева внизу.
          </p>
        )}
      </div>
      <p className="px-4 py-3 text-center text-sm opacity-90">
        {onQr ? "Наведите на QR-код чека или сделайте фото" : "Сделайте фото"}
      </p>
      <div className="flex items-center justify-around px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-2">
        <label className={`${btn} cursor-pointer`}>
          <span className="sr-only">Из галереи</span>
          <ImageIcon className="h-7 w-7" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onPhoto(f);
            }}
          />
        </label>
        <button
          type="button"
          aria-label="Сделать снимок"
          onClick={shoot}
          disabled={failed}
          className="camera-shutter h-[72px] w-[72px] rounded-full active:scale-95 disabled:opacity-40"
        />
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Сменить камеру"
            onClick={() => setFacing(facing === "environment" ? "user" : "environment")}
            className={btn}
          >
            <RefreshCw className="h-6 w-6" />
          </button>
          {canTorch && (
            <button type="button" aria-label="Фонарик" aria-pressed={torch} onClick={toggleTorch} className={btn}>
              <Flashlight className={`h-6 w-6 ${torch ? "opacity-100" : "opacity-70"}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
