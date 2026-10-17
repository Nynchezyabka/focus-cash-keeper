import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CatIcon, Shell, meta } from "@/components/Shell";
import { undoable } from "@/components/Undo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { catColor, cats, DEFAULT_CATEGORIES, GROUP_SHADES, GROUPS, saveCategories, uid, type Category, type Group, type State } from "@/lib/budget";

export const Route = createFileRoute("/categories")({
  head: () => meta("Категории — Бережный бюджет", "Свои категории трат: название, иконка, цвет и кучка — обязательное, безопасность или радости."),
  component: () => <Shell title="Категории">{(s) => <Categories s={s} />}</Shell>,
});

const ICONS = [
  "ShoppingBasket", "Coffee", "Car", "ShoppingBag", "Sparkles", "Pill", "House", "Smartphone", "Landmark", "School",
  "PiggyBank", "Umbrella", "Baby", "Dog", "Cat", "Shirt", "Gift", "Heart", "Plane", "Bus", "Fuel", "Utensils",
  "Pizza", "Wine", "Cookie", "Apple", "Dumbbell", "Scissors", "Palette", "BookOpen", "Gamepad2", "Music",
  "Film", "Wifi", "Zap", "Droplets", "Wrench", "Stethoscope", "GraduationCap", "Flower2", "Store", "CreditCard",
];

function Categories({ s }: { s: State }) {
  const list = cats(s);
  const [edit, setEdit] = useState<Category | null>(null);
  const save = (c: Category) => {
    const exists = list.some((x) => x.id === c.id);
    saveCategories(exists ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c]);
    setEdit(null);
  };
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Нажмите на категорию, чтобы поменять название, иконку или группу. Цвет зависит от группы.</p>
      {(Object.keys(GROUPS) as Group[]).map((g) => (
        <section key={g} className="space-y-2">
          <h2 className="flex items-center gap-2 font-display text-lg"><span className="h-3 w-3 rounded-full" style={{ background: GROUP_SHADES[g][0] }} />{GROUPS[g]}</h2>
          <div className="grid grid-cols-3 gap-2">
            {list.filter((c) => c.group === g).map((c) => (
              <button key={c.id} onClick={() => setEdit(c)} className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 text-xs shadow-soft active:scale-95">
                <span className="grid h-10 w-10 place-items-center rounded-full text-foreground" style={{ background: catColor(c) }}><CatIcon name={c.icon} className="h-5 w-5" /></span>
                <span className="line-clamp-2 text-center">{c.name}</span>
              </button>
            ))}
            <button onClick={() => setEdit({ id: uid(), name: "", group: g, icon: "Heart", keys: [] })}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-3 text-xs text-muted-foreground">
              <Plus className="h-5 w-5" /> Своя
            </button>
          </div>
        </section>
      ))}
      <Button variant="ghost" className="w-full" onClick={() => {
        const prev = s.categories;
        saveCategories(DEFAULT_CATEGORIES);
        undoable("Категории сброшены", () => setStateCats(prev));
      }}>Вернуть стандартные категории</Button>
      {edit && <Editor c={edit} isNew={!list.some((x) => x.id === edit.id)} onSave={save} onClose={() => setEdit(null)} onDelete={() => {
        const prev = list;
        saveCategories(list.filter((x) => x.id !== edit.id));
        setEdit(null);
        undoable(`«${edit.name}» удалена`, () => saveCategories(prev));
      }} />}
    </div>
  );
}

function setStateCats(prev: Category[] | undefined) { saveCategories(prev ?? DEFAULT_CATEGORIES); }

function Editor({ c, isNew, onSave, onClose, onDelete }: { c: Category; isNew: boolean; onSave: (c: Category) => void; onClose: () => void; onDelete: () => void }) {
  const [v, setV] = useState<Category>({ ...c, color: undefined });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto">
        <DialogHeader><DialogTitle>{isNew ? "Новая категория" : "Категория"}</DialogTitle></DialogHeader>
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-foreground" style={{ background: GROUP_SHADES[v.group][0] }}><CatIcon name={v.icon} className="h-6 w-6" /></span>
          <Input autoFocus placeholder="Название" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <div className="flex gap-1 rounded-xl bg-muted p-1 text-xs">
          {(Object.keys(GROUPS) as Group[]).map((g) => (
            <button key={g} onClick={() => setV({ ...v, group: g })} className={`flex-1 rounded-lg py-2 ${v.group === g ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>{GROUPS[g]}</button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Цвет подбирается сам — у каждой группы свой оттенок.</p>
        <p className="text-xs text-muted-foreground">Иконка</p>
        <div className="grid grid-cols-7 gap-1">
          {ICONS.map((i) => (
            <button key={i} aria-label={i} onClick={() => setV({ ...v, icon: i })}
              className={`grid h-10 place-items-center rounded-lg ${v.icon === i ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              <CatIcon name={i} className="h-4 w-4" />
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-sm">Подсказки для автоматического выбора</p>
          <Input placeholder="рынок, фикспрайс, яблоки" value={v.keys.join(", ")} onChange={(e) => setV({ ...v, keys: e.target.value.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean) })} />
          <p className="text-xs text-muted-foreground">Необязательно. Когда вы пишете траты списком без ключа ИИ, приложение ищет эти слова: «рынок 800» сразу попадёт сюда. С ключом ИИ понимает смысл сам, а эти слова — запасной вариант без интернета.</p>
        </div>
        <div className="flex gap-2">
          {!isNew && <Button variant="outline" size="icon" aria-label="Удалить" onClick={onDelete}><Trash2 /></Button>}
          <Button className="flex-1" disabled={!v.name.trim()} onClick={() => onSave({ ...v, name: v.name.trim() })}>Сохранить</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
