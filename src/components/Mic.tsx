import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type Rec = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void };

export function MicButton({ onText }: { onText: (t: string) => void }) {
  const [ok, setOk] = useState(false);
  const [on, setOn] = useState(false);
  const rec = useRef<Rec | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    setOk(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  if (!ok) return null;
  const toggle = () => {
    if (on) { rec.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const C = (w.SpeechRecognition || w.webkitSpeechRecognition)!;
    const r = new C();
    r.lang = "ru-RU"; r.interimResults = false;
    r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0]?.transcript ?? "").join(" "));
    r.onend = () => setOn(false);
    rec.current = r; r.start(); setOn(true);
  };
  return (
    <button type="button" onClick={toggle} aria-label={on ? "Остановить запись" : "Надиктовать"}
      className={`absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full ${on ? "animate-pulse bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
      {on ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
