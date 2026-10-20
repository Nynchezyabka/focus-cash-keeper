import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/lib/pwa";
import { CHANGELOG, markSeen, unseenChanges } from "@/lib/whatsnew";

type Entry = (typeof CHANGELOG)[number];

export function WhatsNew({ open: forced, onClose }: { open?: boolean; onClose?: () => void }) {
  const [list, setList] = useState<Entry[] | null>(null);
  useEffect(() => { if (forced === undefined) setList(unseenChanges(APP_VERSION)); }, [forced]);
  const shown = forced ? CHANGELOG.slice(0, 3) : list;
  const close = () => { markSeen(APP_VERSION); setList(null); onClose?.(); };
  return (
    <Dialog open={!!shown?.length && (forced ?? true)} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[85vh] max-w-sm overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Что нового</DialogTitle></DialogHeader>
        {shown?.map((c) => (
          <section key={c.version} className="space-y-1">
            <p className="text-xs text-muted-foreground">Версия {c.version} · {c.date}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">{c.items.map((i) => <li key={i}>{i}</li>)}</ul>
          </section>
        ))}
        <Button onClick={close}>Понятно</Button>
      </DialogContent>
    </Dialog>
  );
}
