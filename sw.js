// 京选刷题 Service Worker：离线缓存（安装为 APP 后无网可用）
const CACHE = 'jxst-v2';
const CORE = [
  './',
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(CORE.map(u => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isCore = url.origin === location.origin || /cdnjs\.cloudflare\.com/.test(url.hostname);
  if (!isCore) return;
  // 导航请求：缓存优先，后台更新；资源：缓存优先，缺失时联网并回填
  e.respondWith(
    caches.match(req, { ignoreSearch: url.origin === location.origin && url.pathname.endsWith('index.html') }).then(hit => {
      if (hit) {
        // 后台刷新缓存（stale-while-revalidate）
        fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) caches.open(CACHE).then(c => c.put(req, r)); }).catch(() => {});
        return hit;
      }
      return fetch(req).then(r => {
        if (r && (r.ok || r.type === 'opaque')) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return r;
      }).catch(() => {
        // 离线且无缓存：返回应用首页（导航请求兜底）
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
