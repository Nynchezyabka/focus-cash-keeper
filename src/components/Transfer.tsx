import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addedToast } from "@/components/Undo";
import { rub, transfer, type Method } from "@/lib/budget";

export function TransferButton({ card, cash }: { card: number; cash: number }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<Method>("card");
  const [val, setVal] = useState("");
  const have = from === "cash" ? cash : card;
  const amount = Number(val.replace(/\s/g, "").replace(",", "."));
  const tooMuch = amount > have;
  const ok = amount > 0 && !tooMuch;
  return (
    <>
      <button type="button" onClick={() => { setVal(""); setOpen(true); }} className="mx-auto -mt-1 mb-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground">
        <ArrowLeftRight className="h-3.5 w-3.5" /> Перевести между картой и наличными
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Перевод</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {([["card", "С карты в наличные"], ["cash", "Из наличных на карту"]] as const).map(([m, l]) => (
              <Button key={m} type="button" variant={from === m ? "default" : "secondary"} className="h-auto whitespace-normal py-3" onClick={() => setFrom(m)}>{l}</Button>
            ))}
          </div>
          <Input inputMode="decimal" autoFocus placeholder="Сумма" value={val} onChange={(e) => setVal(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            {tooMuch ? `${from === "cash" ? "Наличными" : "На карте"} сейчас ${rub(have)} — больше перевести не получится.` : "Общая сумма и «Сегодня свободно» не изменятся. Это не трата и не доход."}
          </p>
          <Button disabled={!ok} onClick={() => { addedToast(transfer(amount, from), "Перевод записан"); setOpen(false); }}>Перевести</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
