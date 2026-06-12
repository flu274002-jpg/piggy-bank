const CACHE = 'xiaofeihebao-v1';
const STATIC_URLS = [
  '/piggy-bank/',
  '/piggy-bank/index.html',
  '/piggy-bank/manifest.json',
  '/piggy-bank/logo.jpg',
  '/piggy-bank/icons/icon-192x192.png',
  '/piggy-bank/icons/icon-512x512.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC_URLS))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', e => {
  // API 请求不缓存
  if (e.request.url.includes('/api/')) return;
  // 其他请求走网络优先
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(cache => cache.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
