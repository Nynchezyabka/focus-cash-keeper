import { getState, migrateState, replaceState, type State } from "@/lib/budget";
import { isEmptyBudget } from "@/lib/device-sync";
import { requestPersist, shadowLoad } from "@/lib/shadow-store";

/** pick the shadow copy only when the live budget is empty and the copy is not */
export function shadowToRestore(live: State, shadowRaw: string | null): State | null {
  if (!isEmptyBudget(live) || !shadowRaw) return null;
  try {
    const s = migrateState(JSON.parse(shadowRaw));
    return isEmptyBudget(s) ? null : s;
  } catch {
    return null;
  }
}

/** run once at launch, before device sync: restore a wiped budget from IndexedDB */
export async function guardStorage(): Promise<boolean> {
  void requestPersist();
  const s = shadowToRestore(getState(), await shadowLoad());
  if (!s) return false;
  replaceState(s);
  return true;
}
