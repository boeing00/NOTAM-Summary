const CACHE_NAME = 'notam-efb-v25';

/* 기내에서 이게 없으면 앱이 아니라 빈 화면이다.
 *
 * 전부 동일 출처다. pdf.js 를 vendor/ 로 들여온 뒤로 조종석 화면(index.html)이
 * 바깥에 의존하는 것은 하나도 없다 — 그 전에는 pdf.js 를 cdnjs 에서 받았고,
 * 기내 와이파이가 없으면 PDF 를 한 장도 못 읽었다. 설치는 되어 있는데 정작
 * 핵심 기능이 없는 상태다.
 *
 * 순서에 뜻이 있다: 목록이 곧 "무엇이 있어야 비행 준비가 된 것인가"의 정의이고,
 * index.html 의 준비 상태 표시가 이 목록을 읽어서 실물을 확인한다(__core__).
 * 목록이 두 군데 있으면 갈라지므로 여기 하나만 둔다. */
const CORE = [
  './',
  './index.html',
  './notam_engine.js?v=3.7',
  './coastline.js?v=2',
  './vendor/pdf.min.js?v=3.11.174',
  './vendor/pdf.worker.min.js?v=3.11.174',
  './manifest.json'
];

/* 있으면 좋지만 없어도 조종석 화면은 돈다 — 데스크톱 화면 전용이거나 샘플이다.
 * 여기 실패가 CORE 캐시를 망가뜨리면 안 된다(아래 cacheEach 참조).
 *
 * lucide 는 버전을 박았다. @latest 를 캐시에 넣으면 그 사본이 어느 판인지
 * 아무도 모르고 재현도 안 된다. */
const OPTIONAL = [
  './desktop.html',
  './aar223_text.js?v=2.6',
  './aar202_text.js?v=2.6',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@1.47.0/dist/umd/lucide.min.js'
];

/* 카카오 애드핏 로더는 일부러 넣지 않는다. 광고이고, 없어도 아무것도 안 깨진다. */

/** CORE 목록을 페이지가 읽을 수 있게 캐시에 둔다. 단일 출처를 위해서다. */
const CORE_MANIFEST = './__core__';

/* cache.addAll 은 원자적이다 — 하나라도 실패하면 전부 롤백된다.
 * 이걸 .catch(() => {}) 로 삼키고 있었다. 약한 회선에서 CDN 하나가 떨어지면
 * 캐시가 통째로 비어 있는 채 설치가 "성공"했고, 아무도 모르는 채 기내에서
 * 빈 화면을 봤다. 한 건씩 넣고, 실패한 것을 이름으로 남긴다. */
async function cacheEach(cache, urls) {
  const failed = [];
  await Promise.all(urls.map(async (u) => {
    try {
      await cache.put(u, await fetchForCache(u));
    } catch (err) {
      failed.push(u);
    }
  }));
  return failed;
}

const isSameOrigin = (u) => new URL(u, self.location.href).origin === self.location.origin;

async function fetchForCache(u) {
  try {
    // 설치 때만큼은 HTTP 캐시를 건너뛴다. GitHub Pages 가 HTML 에
    // max-age=600 을 붙이므로, 그냥 받으면 방금 푸시한 새 파일 대신
    // 10분 전 사본을 캐시에 박아 넣을 수 있다.
    const res = await fetch(new Request(u, { cache: 'reload' }));
    if (res && res.ok) return res;
    throw new Error('HTTP ' + (res && res.status));
  } catch (err) {
    // 교차 출처 CDN 이 CORS 헤더를 안 붙이면 위 요청은 실패한다 —
    // cdn.tailwindcss.com 이 실제로 그렇다. no-cors 로 받으면 내용을 읽지는
    // 못해도(opaque, status 0) 캐시에 넣고 <script src> 로 쓸 수는 있다.
    // 이 한 건이 예전에 addAll 을 통째로 되돌려 캐시를 비우던 것이다.
    if (isSameOrigin(u)) throw err;
    return await fetch(new Request(u, { mode: 'no-cors', cache: 'reload' }));
  }
}

/** CORE 를 채우고 페이지가 읽을 목록을 남긴다. 설치와 활성 양쪽이 쓴다. */
async function populate(why) {
  const cache = await caches.open(CACHE_NAME);
  const coreFailed = await cacheEach(cache, CORE);
  // 선택 자산은 결과를 보지 않는다. 실패해도 설치는 성공이다.
  cacheEach(cache, OPTIONAL).catch(() => {});
  await cache.put(CORE_MANIFEST, new Response(JSON.stringify({
    core: CORE,
    failedAtInstall: coreFailed,
    installedAt: new Date().toISOString(),
    cache: CACHE_NAME,
    filledBy: why
  }), { headers: { 'Content-Type': 'application/json' } }));
  return coreFailed;
}

/** CORE 가 한 건도 빠짐없이 들어 있는가. 버전을 갈아도 되는지의 유일한 기준이다. */
async function coreComplete(cache) {
  for (const u of CORE) if (!(await cache.match(u))) return false;
  return true;
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const failed = await populate('install');
    if (failed.length) {
      // 새 사본이 불완전하다. **여기서 설치를 실패시켜야** 이 워커가 버려지고
      // 기존 워커와 그 캐시가 그대로 살아남는다.
      //
      // 예전에는 실패를 보지 않고 설치를 끝냈고, 뒤이은 activate 가 멀쩡한
      // 구버전 캐시를 지웠다 — 회선이 한 번 나쁜 것만으로 기내에서 쓸 사본이
      // 사라진다. 낡은 사본이 없는 사본보다 낫다.
      throw new Error('CORE 확보 실패: ' + failed.join(', '));
    }
    // 온전할 때만 대기를 건너뛴다. skipWaiting 을 맨 앞에 두면 실패한 판이
    // 곧바로 활성으로 올라온다.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // 설치가 채워 놓았으면 할 일이 없다. 아니면 여기서 채운다.
    if (!(await cache.match(CORE_MANIFEST)) || !(await coreComplete(cache))) {
      await populate('activate');
    }

    // **새 사본이 온전할 때만 옛 캐시를 버린다.** 아니면 그대로 둔다 —
    // 지워 봐야 돌아오는 건 빈 화면뿐이다.
    if (await coreComplete(cache)) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    }

    await self.clients.claim();
  })());
});

/* install 은 워커 버전당 한 번만 돈다. 그래서 이미 설치·활성된 워커 아래에서
 * 캐시가 사라지면 — 저장공간 압박으로 브라우저가 비우는 일이 태블릿에서 실제로
 * 일어난다 — 스크립트가 바뀌기 전까지 아무도 다시 채우지 않는다. 등록은 멀쩡하고
 * 화면도 뜨는데 기내 사본만 없는, 이 앱이 제일 경계하는 그 상태다.
 *
 * 그래서 페이지가 채워 달라고 할 수 있게 열어 둔다. 판정은 페이지가 실물을 보고
 * 하므로(checkOfflineReady), 없다고 본 쪽이 요청한다. */
self.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'refill') return;
  e.waitUntil((async () => {
    const failed = await populate('message');
    (e.source ? [e.source] : await self.clients.matchAll())
      .forEach((c) => c.postMessage({ type: 'refilled', failed }));
  })());
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
