// Second copy of the budget in IndexedDB: browsers' "clear cache" often wipes localStorage but keeps it.
const DB = "berezhny-budget";
const STORE = "kv";
const KEY = "state";

function open(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      if (typeof indexedDB === "undefined") return res(null);
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: string | null = null;
/** debounced write of the serialized budget */
export function shadowSave(json: string) {
  pending = json;
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    const v = pending;
    pending = null;
    const db = await open();
    if (!db || v === null) return;
    try {
      db.transaction(STORE, "readwrite").objectStore(STORE).put(v, KEY);
    } catch {
      /* ignore */
    }
  }, 400);
}

export async function shadowLoad(): Promise<string | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((res) => {
    try {
      const r = db.transaction(STORE).objectStore(STORE).get(KEY);
      r.onsuccess = () => res(typeof r.result === "string" ? r.result : null);
      r.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}

/** ask the browser not to evict our data; silently ignored where unsupported */
export async function requestPersist(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
