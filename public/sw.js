// Бережный бюджет. Страница (HTML) — сначала сеть (ждём до 2,5 с), без сети — из памяти.
// Файлы с хэшем в имени (/assets/) — из памяти, они не меняются. Версия приходит в ?v= при регистрации,
// поэтому каждая новая версия приложения = новый воркер и новый кэш, старый удаляется.
const VERSION = new URL(self.location.href).searchParams.get("v") || "0";
const CACHE = "bb-runtime-" + VERSION;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("bb-runtime-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("message", (e) => { if (e.data?.type === "SKIP_WAITING") self.skipWaiting(); });
const put = (req, res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.searchParams.has("_v") || url.pathname === "/sw.js") return;
  const isPage = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isPage) {
    const net = fetch(req, { cache: "no-store" }).then((r) => put(req, r));
    const slow = new Promise((r) => setTimeout(r, 2500)).then(() => caches.match(req).then((h) => h || caches.match("/")));
    e.respondWith(
      Promise.race([net.catch(() => null), slow]).then((r) => r || net)
        .catch(() => caches.match(req).then((h) => h || caches.match("/")).then((h) => h || Response.error())),
    );
    e.waitUntil(net.catch(() => {}));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => put(req, r))));
    return;
  }
  const fresh = fetch(req, { cache: "no-cache" }).then((r) => put(req, r));
  e.respondWith(caches.match(req).then((hit) => { if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; } return fresh; }));
});
