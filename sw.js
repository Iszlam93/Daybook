/* Daybook service worker: caches the site so the app works offline. */
const CACHE = "daybook-v0.2.2";
const SHELL = [
  "./", "index.html", "app/", "app/index.html",
  "css/app.css", "css/landing.css",
  "js/store.js", "js/mascot.js", "js/config.js", "js/app.js", "js/landing.js",
  "js/plugins/obsidian.js", "js/plugins/ics.js", "js/plugins/notion.js",
  "manifest.webmanifest", "icons/favicon.svg", "icons/icon-192.png", "icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  // one missing file must not stop the install
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // network first so updates show up, fall back to the cache when offline
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match("app/index.html")))
  );
});
