import { useState } from "react";
import { Banknote, CreditCard, Plus } from "lucide-react";
import { CatIcon } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cat, catColor, cats, GROUPS, saveCategories, uid, type Group, type Method } from "@/lib/budget";

/** One category chooser for every screen: group tabs + icon tiles + create-on-the-spot. */
export function CategoryPicker({ value, onPick, groups = ["life", "must", "safe"] }: { value?: string; onPick: (id: string) => void; groups?: Group[] }) {
  const [group, setGroup] = useState<Group>(value ? cat(value).group : groups[0]!);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  return (
    <div className="space-y-3">
      {groups.length > 1 && (
        <div className="flex gap-1 rounded-xl bg-muted p-1 text-xs">
          {groups.map((g) => (
            <button key={g} type="button" onClick={() => setGroup(g)} className={`flex-1 rounded-lg py-2 ${group === g ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>{GROUPS[g]}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {cats().filter((c) => c.group === group).map((c) => (
          <button key={c.id} type="button" onClick={() => onPick(c.id)}
            className={`flex flex-col items-center gap-1 rounded-xl p-3 text-xs text-secondary-foreground active:scale-95 ${value === c.id ? "bg-card ring-2 ring-primary" : "bg-secondary"}`}>
            <span className="grid h-9 w-9 place-items-center rounded-full text-foreground" style={{ background: catColor(c) }}><CatIcon name={c.icon} className="h-5 w-5" /></span>
            <span className="line-clamp-2 text-center">{c.name}</span>
          </button>
        ))}
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border p-3 text-xs text-muted-foreground">
            <Plus className="h-5 w-5" /> Новая
          </button>
        )}
      </div>
      {creating && (
        <div className="flex gap-2">
          <Input autoFocus placeholder={`Новая в «${GROUPS[group]}»`} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="button" disabled={!name.trim()} onClick={() => {
            const id = uid();
            saveCategories([...cats(), { id, name: name.trim(), group, icon: "Tag", keys: [name.trim().toLowerCase().slice(0, 6)] }]);
            setName(""); setCreating(false); onPick(id);
          }}>Готово</Button>
        </div>
      )}
    </div>
  );
}

/** Small tappable chip that opens the shared picker in a sheet. */
export function CategoryChip({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const c = cat(value);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex max-w-[8rem] items-center gap-1 rounded-full bg-card px-2 py-1 text-xs">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: catColor(c) }}><CatIcon name={c.icon} className="h-3 w-3" /></span>
        <span className="truncate">{c.name}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Категория</DialogTitle></DialogHeader>
          <CategoryPicker value={value} onPick={(id) => { onChange(id); setOpen(false); }} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MethodToggle({ value, onChange }: { value: Method; onChange: (m: Method) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm">
      {(["card", "cash"] as const).map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)} className={`flex items-center justify-center gap-2 rounded-lg py-2 ${value === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>
          {m === "card" ? <CreditCard className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}{m === "card" ? "Карта" : "Наличные"}
        </button>
      ))}
    </div>
  );
}

export function MethodBadge({ m }: { m?: Method | undefined }) {
  const cash = m === "cash";
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
      {cash ? <Banknote className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}{cash ? "Наличные" : "Карта"}
    </span>
  );
}

export function DateDialog({ open, title, initial, onClose, onSave }: { open: boolean; title: string; initial: string; onClose: () => void; onSave: (d: string) => void }) {
  const [v, setV] = useState(initial);
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) { setSeen(initial); setV(initial); }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Input type="date" value={v} onChange={(e) => setV(e.target.value)} className="h-12" />
        <p className="text-xs text-muted-foreground">Меняется только ближайший раз. Потом всё вернётся к обычному числу.</p>
        <Button disabled={!v} onClick={() => { onSave(v); onClose(); }}>Перенести</Button>
      </DialogContent>
    </Dialog>
  );
}
