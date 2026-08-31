const CACHE_NAME = 'reps-v20';
const ASSETS = ['./','./index.html','./app.js','./program.js','./milestones.js','./manifest.json'];

self.addEventListener('install', e => {
  /* addAll() on plain URLs can be answered from the HTTP cache, which fills the
     new cache with the files it was meant to replace. Force the network. */
  e.waitUntil(caches.open(CACHE_NAME).then(c =>
    c.addAll(ASSETS.map(u => new Request(u, {cache: 'reload'})))));
  self.skipWaiting();
});

/* Only ever delete this app's own old caches. The Cache API is scoped to the
   origin, not to the path, and this account serves more than one app from
   jmlalande.github.io. An unfiltered sweep here reads as "delete every cache
   that is not mine", which was right while Reps was alone on the domain and
   wipes the neighbour's offline files now that it is not. */
const CACHE_PREFIX = 'reps-';

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
                    .map(k => caches.delete(k)))));
  self.clients.claim();
});

/* Network first, cache as the fallback. Cache first is the faster strategy and
   it is the reason a bad build could pin itself on the phone for days: once the
   cache held stale files, nothing in the normal path ever went and looked. The
   whole app is a few dozen kilobytes, so the network round trip costs little,
   and offline still works because every successful response is written back. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.ok && new URL(e.request.url).origin === self.location.origin) {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return r;
    }).catch(() => caches.match(e.request).then(cached =>
      cached || caches.match(new URL('./', self.location).href)))
  );
});
