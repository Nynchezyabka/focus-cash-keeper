// Бережный бюджет: открывается сразу из памяти телефона, свежая версия тихо догружается в фоне.
// Если в памяти ещё ничего нет — идём в сеть. Сеть ждём не дольше 3 секунд, дальше — что есть в памяти.
const CACHE = "bb-runtime-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("bb-runtime-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("message", (e) => { if (e.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.searchParams.has("_v")) return; // update check always goes to the network
  const fresh = fetch(req, { cache: "no-cache" }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  });
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
      const timeout = new Promise((r) => setTimeout(r, 3000)).then(() => caches.match("/"));
      return Promise.race([fresh, timeout.then((r) => r || fresh)])
        .catch(() => caches.match("/").then((r) => r || Response.error()));
    }),
  );
});
