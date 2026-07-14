// 파브르 스케줄 Service Worker
// 앱을 수정할 때마다 아래 버전 숫자를 올리세요 (v2 → v3 → ...)
const CACHE_NAME = 'pabre-schedule-v5';

// 오프라인에서도 앱 화면이 뜨도록 미리 받아두는 파일
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './favicon.ico',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .catch(err => console.warn('일부 캐시 실패(무시):', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase 로그인·DB 통신은 항상 실시간이어야 하므로 캐시하지 않는다
  if (url.hostname.endsWith('firebaseio.com') ||
      url.hostname.endsWith('firebasedatabase.app') ||
      url.hostname.endsWith('googleapis.com') ||
      url.hostname.endsWith('gstatic.com')) {
    return;
  }

  // HTML은 네트워크 우선 — 앱을 수정하면 사용자에게 바로 반영되도록
  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', clone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 그 외 정적 파일(아이콘, CDN 라이브러리)은 캐시 우선
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      });
    })
  );
});
