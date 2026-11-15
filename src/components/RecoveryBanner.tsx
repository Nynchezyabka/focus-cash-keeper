import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  dayKey,
  dismissUnreadableBackup,
  getState,
  newerBackup,
  unreadableBackup,
} from "@/lib/budget";

/** Shown when saved data could not be read: the original is kept and can be downloaded. */
export function RecoveryBanner() {
  const [raw, setRaw] = useState<string | null>(null);
  const [future, setFuture] = useState(false);
  useEffect(() => {
    getState();
    setRaw(unreadableBackup());
    setFuture(newerBackup());
  }, []);
  if (raw === null) return null;
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    a.download = `berezhny-budget-unreadable-${dayKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div
      role="alert"
      className="mx-auto my-2 max-w-3xl space-y-2 rounded-xl border border-border bg-card p-3 text-sm"
    >
      <p>
        {future
          ? "Эта копия сделана более новой версией приложения. Обновите приложение. Данные сохранены и не будут перезаписаны."
          : "Не получилось прочитать сохранённый бюджет. Копия сохранена. Можно восстановить из файла (Настройки → импорт) или скачать повреждённые данные."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={download}>
          Скачать сохранённые данные
        </Button>
        {!future && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("Удалить сохранённую копию? Восстановить её будет нельзя.")) {
                dismissUnreadableBackup();
                setRaw(null);
              }
            }}
          >
            Скрыть
          </Button>
        )}
      </div>
    </div>
  );
}
