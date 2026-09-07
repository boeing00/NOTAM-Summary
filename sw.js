const CACHE_NAME = 'notam-efb-v11';
const ASSETS = [
  './',
  './index.html',
  './ipad.html',
  './notam_engine.js?v=3.2',
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

  e.respondWith((async () => {
    const cached = await caches.match(e.request);

    try {
      const networkRes = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS);
        // Network-first only means network-first if the fetch actually goes to
        // the network. GitHub Pages serves HTML with Cache-Control: max-age=600,
        // and a plain fetch() is served out of the browser's HTTP cache for
        // those ten minutes - so a reload after a deploy kept showing the old
        // page even with no service worker involved. Same-origin requests
        // therefore bypass the HTTP cache; the CDN files are left alone, since
        // they are version-pinned and re-downloading them on cabin wifi costs
        // more than it saves.
        fetch(sameOrigin(e.request) ? new Request(e.request, { cache: 'reload' }) : e.request).then(
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
