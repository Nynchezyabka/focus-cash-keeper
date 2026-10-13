import { toast } from "sonner";
import { removeTx, restoreTx, type Tx } from "@/lib/budget";

export function undoable(message: string, undo: () => void) {
  toast(message, { duration: 5000, action: { label: "Отменить", onClick: undo } });
}
export function addedToast(tx: Tx | null | undefined, message: string) {
  if (tx) undoable(message, () => removeTx(tx.id));
}
export function deleteWithUndo(id: string) {
  const t = removeTx(id);
  if (t) undoable("Запись удалена", () => restoreTx(t));
}
