const CACHE_NAME = 'purrdrop-v3';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
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

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  const url = event.request.url;

  // Skip non-http(s) requests (chrome-extension, blob:, data:, etc.)
  if (!url.startsWith('http')) return;
  
  // Skip socket.io and API requests
  if (url.includes('/socket.io') || url.includes('/api/')) return;

  // Skip StreamSaver service worker and download URLs
  // StreamSaver uses jimmywarting.github.io for its mitm page
  if (url.includes('jimmywarting.github.io')) return;
  if (url.includes('streamsaver')) return;

  // Skip blob download URLs (object URLs for file downloads)
  if (url.startsWith('blob:')) return;

  // Don't cache very large responses (video, large files)
  // Only cache text/html, scripts, stylesheets, images, fonts
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache small, safe responses
        const contentType = response.headers.get('content-type') || '';
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
        
        // Don't cache responses > 5MB or video/audio content
        const shouldCache = response.status === 200 
          && contentLength < 5 * 1024 * 1024
          && !contentType.includes('video')
          && !contentType.includes('audio')
          && !contentType.includes('octet-stream');

        if (shouldCache) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
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
