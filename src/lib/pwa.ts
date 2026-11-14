// Обновления приложения: автоматическая проверка при запуске, ручная проверка и перезагрузка начисто.
export const APP_VERSION = "1.49.1";

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
  if (typeof window === "undefined") return;
  // Просим браузер не стирать данные сам (Safari чистит неустановленные сайты)
  navigator.storage?.persist?.().catch(() => {});
  window.addEventListener("budget-save-failed", () => {
    import("sonner").then(({ toast }) => toast("Не удалось сохранить: на устройстве мало места. Сделайте резервную копию в Настройках."));
  });
  remindBackup();
  if (!("serviceWorker" in navigator)) return;
  if (refused()) { unregister().catch(() => {}); return; }
  // Новый воркер взял управление — один раз перезагружаемся на свежую версию
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  navigator.serviceWorker.register("/sw.js?v=" + APP_VERSION, { updateViaCache: "none" }).then((reg) => {
    const check = () => { reg.update().catch(() => {}); void checkForUpdates(); };
    check();
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
    if (fresh && now && fresh !== now) {
      // свежая страница в кэш, чтобы перезагрузка не достала старую
      if ("caches" in window) { const n = await caches.keys(); await Promise.allSettled(n.filter((k) => k.startsWith("bb-runtime-")).map((k) => caches.delete(k))); }
      if (sessionStorage.getItem("bb-upd") === fresh) return "current"; // защита от петли
      sessionStorage.setItem("bb-upd", fresh);
      import("sonner").then(({ toast }) => toast("Загружаю новую версию…"));
      setTimeout(() => window.location.reload(), 800);
      return "updating";
    }
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

/** раз в месяц мягко напоминаем сделать копию (не чаще раза в неделю) */
function remindBackup() {
  import("@/lib/budget").then(({ getState }) => {
    const s = getState(), day = 86400000, now = Date.now();
    const last = +new Date(s.lastBackup ?? s.createdAt);
    const shown = Number(localStorage.getItem("berezhny-backup-hint") ?? 0);
    const v = localStorage.getItem("berezhny-seen-version");
    if (v && v !== APP_VERSION) return; // сначала «Что нового», копия — в следующий запуск
    if (now - last < 30 * day || now - shown < 7 * day || !s.txs.length) return;
    localStorage.setItem("berezhny-backup-hint", String(now));
    import("sonner").then(({ toast }) => toast("Давно не было резервной копии. Её можно сделать в Настройках — одна кнопка «Экспорт».", { duration: 8000 }));
  }).catch(() => {});
}
