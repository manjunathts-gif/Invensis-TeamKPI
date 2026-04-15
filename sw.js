const CACHE = 'kpi-v2';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  if(!e.request.url.startsWith(self.location.origin)) return;
  if(e.request.url.includes('supabase.co')) return;
  if(e.request.url.includes('cdn.jsdelivr')) return;
  if(e.request.url.includes('accounts.google')) return;

  e.respondWith(
    fetch(e.request).then(res => {
      // Only cache complete responses (status 200)
      if(res.status === 200 && res.type !== 'opaque'){
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
