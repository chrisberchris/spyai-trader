const CACHE_NAME = 'spyai-trader-v1';
const STATIC_CACHE = 'spyai-static-v1';

// App shell files to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/manifest.json',
];

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some assets may not exist yet — that's fine
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network first for API calls, cache first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and browser extensions
  if (event.request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // API calls — network only, no caching (always need fresh data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Supabase auth calls — network only
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets — cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache successful static responses
        if (response.status === 200 && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback — return cached index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});

// Background sync placeholder for future offline trade logging
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-trades') {
    // Future: sync offline trades when connection restored
  }
});
