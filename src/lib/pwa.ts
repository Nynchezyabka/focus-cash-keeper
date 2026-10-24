// Обновления приложения: сервис-воркер «сначала сеть», ручная проверка и перезагрузка начисто.
export const APP_VERSION = "1.8.0";

function refused(): boolean {
  if (!import.meta.env.PROD) return true;
  try { if (window.self !== window.top) return true; } catch { return true; }
  const h = window.location.hostname;
  return h.startsWith("id-preview--") || h.startsWith("preview--") || h.endsWith("lovableproject.com") || h.endsWith("lovableproject-dev.com");
}

async function unregister() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(regs.map((r) => r.unregister()));
}

export function initPwa() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (refused()) { unregister().catch(() => {}); return; }
  navigator.serviceWorker.register("/sw.js").then((reg) => {
    const check = () => reg.update().catch(() => {});
    setInterval(check, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  }).catch(() => {});
}

export const updatesSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && !refused();

/** Тянем свежую страницу из сети; если версия другая — перезагружаемся. */
export async function checkForUpdates(): Promise<"current" | "updating" | "offline"> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    const res = await fetch("/?_v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return "offline";
    const html = await res.text();
    const fresh = [...html.matchAll(/assets\/[^"']+\.js/g)].map((m) => m[0]).sort().join();
    const now = [...document.querySelectorAll("script[src]")].map((s) => (s as HTMLScriptElement).src.match(/assets\/[^"']+\.js/)?.[0]).filter(Boolean).sort().join();
    if (fresh && now && fresh !== now) { setTimeout(() => window.location.reload(), 800); return "updating"; }
    return "current";
  } catch { return "offline"; }
}

/** Удаляет кэш файлов приложения. Деньги, планы и категории остаются. */
export async function hardReload() {
  try {
    await unregister();
    if ("caches" in window) { const n = await caches.keys(); await Promise.allSettled(n.map((k) => caches.delete(k))); }
  } finally {
    const u = new URL(window.location.href); u.searchParams.set("v", String(Date.now()));
    window.location.replace(u.toString());
  }
}
