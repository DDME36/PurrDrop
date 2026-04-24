const CACHE_NAME = 'purrdrop-v4';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/favicon.ico',
  '/offline.html', // We should have an offline page but '/' works if cached
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - Stale-while-revalidate for static, Network-first for navigation
self.addEventListener('fetch', (event) => {
  // Handle POST requests for Share Target
  if (event.request.method === 'POST' && new URL(event.request.url).pathname === '/') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const files = formData.getAll('files');
          
          // In a real robust PWA, we'd store files in IndexedDB here
          // and let the frontend read them on load.
          // For now, we redirect to home. The user will have to manually pick files.
          return Response.redirect('/?shared=true', 303);
        } catch (error) {
          return Response.redirect('/', 303);
        }
      })()
    );
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);

  // Skip non-http(s) requests (chrome-extension, blob:, data:, etc.)
  if (!url.protocol.startsWith('http')) return;
  
  // Skip socket.io and API requests (always network)
  if (url.pathname.includes('/socket.io/') || url.pathname.startsWith('/api/')) return;

  // Skip StreamSaver service worker and download URLs
  if (url.hostname.includes('jimmywarting.github.io')) return;
  if (url.pathname.includes('streamsaver')) return;

  // Is it a navigation request? (e.g., HTML page)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the latest version
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline fallback
          return caches.match('/') || caches.match('/offline.html');
        })
    );
    return;
  }

  // For static assets (images, CSS, JS) - Stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        const contentType = networkResponse.headers.get('content-type') || '';
        const contentLength = parseInt(networkResponse.headers.get('content-length') || '0', 10);
        
        // Don't cache responses > 5MB or video/audio content
        const shouldCache = networkResponse.status === 200 
          && contentLength < 5 * 1024 * 1024
          && !contentType.includes('video')
          && !contentType.includes('audio')
          && !contentType.includes('octet-stream');

        if (shouldCache) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // Ignore fetch errors for static assets if we have cache
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Open new window if no existing window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});