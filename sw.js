/* ===== ENG LIVE Service Worker ===== */
const CACHE_NAME = 'eng-live-v2';
const DATA_CACHE = 'eng-live-data-v2';

// App Shell — Cache First
const APP_SHELL = [
  '/eng-quiz/',
  '/eng-quiz/index.html',
  '/eng-quiz/css/style.css',
  '/eng-quiz/js/app.js',
  '/eng-quiz/js/vocab.js',
  '/eng-quiz/js/reading.js',
  '/eng-quiz/js/translation.js',
  '/eng-quiz/js/progress.js',
  '/eng-quiz/js/livechat.js',
  '/eng-quiz/help.html',
  '/eng-quiz/icons/icon.svg',
  '/eng-quiz/icons/icon-192.png',
  '/eng-quiz/icons/icon-512.png',
  '/eng-quiz/manifest.json',
];

// Install — precache App Shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn('SW: 일부 리소스 캐싱 실패 (정상 동작에 영향 없음)', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-http(s) requests (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  // Data files (JSON) — Network First, fallback to cache
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // App Shell & other assets — Cache First, fallback to network
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        // Cache successful GET responses
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      });
    }).catch(() => {
      // Offline fallback for navigation
      if (e.request.mode === 'navigate') {
        return caches.match('/eng-quiz/index.html');
      }
    })
  );
});
