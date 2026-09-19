const CACHE_NAME = 'notam-efb-v17';
const ASSETS = [
  './',
  './index.html',
  './desktop.html',
  './coastline.js?v=2',
  './notam_engine.js?v=3.4',
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

const sameOrigin = (req) => new URL(req.url).origin === self.location.origin;

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).protocol.startsWith('chrome-extension')) return;

  // The network fetch is started once and outlives the timeout. Before this,
  // a fetch slower than the deadline returned the cached copy and its late
  // response was thrown away - so on slow cabin/LTE links the cache was never
  // refreshed and the tablet stayed on the old version indefinitely.
  const cachedP = caches.match(e.request);
  const networkP = fetch(sameOrigin(e.request) ? new Request(e.request, { cache: 'reload' }) : e.request)
    .then((r) => {
      if (r && r.status === 200) {
        const clone = r.clone();
        return caches.open(CACHE_NAME).then((c) => c.put(e.request, clone)).then(() => r);
      }
      return r;
    });
  e.waitUntil(networkP.catch(() => {}));

  e.respondWith((async () => {
    const cached = await cachedP;
    try {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS);
        networkP.then(
          (r) => { clearTimeout(timer); resolve(r); },
          (err) => { clearTimeout(timer); reject(err); }
        );
      });
    } catch {
      if (cached) return cached;
      return networkP;            // nothing cached: wait for the network after all
    }
  })());
});
