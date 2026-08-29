const CACHE_NAME = 'notam-efb-v6';
const ASSETS = [
  './',
  './index.html',
  './aar223_text.js?v=2.6',
  './aar202_text.js?v=2.6',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first so a reload picks up new code, but with a deadline: this is
// flown on a tablet on cabin wifi, and an un-timed fetch leaves the aircraft
// staring at a blank page when the cache already holds a usable copy.
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).protocol.startsWith('chrome-extension')) return;

  e.respondWith((async () => {
    const cached = await caches.match(e.request);

    try {
      const networkRes = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS);
        fetch(e.request).then(
          (r) => { clearTimeout(timer); resolve(r); },
          (err) => { clearTimeout(timer); reject(err); }
        );
      });

      if (networkRes && networkRes.status === 200) {
        const clone = networkRes.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
      }
      return networkRes;
    } catch {
      if (cached) return cached;
      throw new Error('offline and not cached: ' + e.request.url);
    }
  })());
});
