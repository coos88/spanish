// Offline support. All URLs are relative to the SW scope so this works on /spanish/ (GitHub Pages) and / (Docker).
// Bump CACHE on every deploy that changes the shell, otherwise old files can linger.
const CACHE = 'es-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon.svg',
  'data/vocab.json', 'data/phrases.json', 'data/verbs.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SHELL.map((p) => new URL(p, self.registration.scope).href)))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isAudio = req.url.includes('/audio/');
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    // audio never changes under the same name unless the manifest hash does: cache-first.
    if (hit && isAudio) return hit;
    // everything else: stale-while-revalidate
    const net = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => hit || Response.error());
    return hit || net;
  }));
});
