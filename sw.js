// Invensis KPI Tracker — Service Worker
const CACHE = 'kpi-v1';

// On install — cache the main page only
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/']))
  );
});

// On activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network first — always fetch fresh data, fall back to cache if offline
self.addEventListener('fetch', e => {
  // Only handle GET requests to our own origin
  if(e.request.method !== 'GET') return;
  if(!e.request.url.startsWith(self.location.origin)) return;
  // Never cache Supabase API calls
  if(e.request.url.includes('supabase.co')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache the fresh response
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
