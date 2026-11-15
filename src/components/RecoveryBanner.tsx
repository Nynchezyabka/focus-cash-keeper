import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { dismissUnreadableBackup, getState, unreadableBackup } from "@/lib/budget";

/** Shown when saved data could not be read: the original is kept and can be downloaded. */
export function RecoveryBanner() {
  const [raw, setRaw] = useState<string | null>(null);
  useEffect(() => { getState(); setRaw(unreadableBackup()); }, []);
  if (raw === null) return null;
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    a.download = `berezhny-budget-unreadable-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  };
  return <div role="alert" className="mx-auto my-2 max-w-3xl space-y-2 rounded-xl border border-border bg-card p-3 text-sm">
    <p>Не получилось прочитать сохранённый бюджет. Копия сохранена. Можно восстановить из файла (Настройки → импорт) или скачать повреждённые данные.</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={download}>Скачать повреждённые данные</Button>
      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Удалить сохранённую копию? Восстановить её будет нельзя.")) { dismissUnreadableBackup(); setRaw(null); } }}>Скрыть</Button>
    </div>
  </div>;
}
