// Service Worker for Salvage Management System PWA
// Implements offline-first caching strategies with Workbox

// Import Workbox from CDN (for runtime service worker)
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

if (workbox) {
  console.log('Workbox loaded successfully');

  // Enable debug mode in development
  if (process.env.NODE_ENV === 'development') {
    workbox.setConfig({ debug: true });
  }

  // Precache static assets
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  // Cache Strategy 1: CacheFirst for images
  // Images are cached first and served from cache, falling back to network
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'images-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          purgeOnQuotaError: true,
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // Cache Strategy 2: NetworkFirst for API routes
  // API calls try network first, fall back to cache if offline
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'api-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 5 * 60, // 5 minutes
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
      networkTimeoutSeconds: 10,
    })
  );

  // Cache Strategy 3: StaleWhileRevalidate for static assets
  // Serve from cache immediately, update cache in background
  workbox.routing.registerRoute(
    ({ request }) =>
      request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'font',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'static-assets-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        }),
      ],
    })
  );

  // Cache Strategy 4: NetworkFirst for HTML pages
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'document',
    new workbox.strategies.NetworkFirst({
      cacheName: 'pages-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 30,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        }),
      ],
    })
  );

  // Background Sync for offline case submissions
  // Queue failed POST requests and retry when online
  const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('case-submissions-queue', {
    maxRetentionTime: 24 * 60, // Retry for up to 24 hours (in minutes)
    onSync: async ({ queue }) => {
      let entry;
      while ((entry = await queue.shiftRequest())) {
        try {
          await fetch(entry.request.clone());
          console.log('Background sync: Request replayed successfully');
        } catch (error) {
          console.error('Background sync: Request failed to replay', error);
          // Re-add to queue if it fails
          await queue.unshiftRequest(entry);
          throw error;
        }
      }
    },
  });

  // Register background sync for case creation
  workbox.routing.registerRoute(
    ({ url, request }) =>
      url.pathname.startsWith('/api/cases') && request.method === 'POST',
    new workbox.strategies.NetworkOnly({
      plugins: [bgSyncPlugin],
    }),
    'POST'
  );

  // Skip waiting and claim clients immediately
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // Handle service worker updates
  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });

  // Offline fallback page
  const FALLBACK_HTML_URL = '/offline.html';
  const FALLBACK_IMAGE_URL = '/icons/Nem-insurance-Logo.jpg';

  // Cache fallback resources on install
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open('offline-fallbacks').then((cache) => {
        return cache.addAll([FALLBACK_HTML_URL, FALLBACK_IMAGE_URL]);
      })
    );
  });

  // Serve fallback when offline
  self.addEventListener('fetch', (event) => {
    if (event.request.mode === 'navigate') {
      event.respondWith(
        fetch(event.request).catch(() => {
          return caches.match(FALLBACK_HTML_URL);
        })
      );
    } else if (event.request.destination === 'image') {
      event.respondWith(
        fetch(event.request).catch(() => {
          return caches.match(FALLBACK_IMAGE_URL);
        })
      );
    }
  });

  console.log('Service Worker: All caching strategies registered');
} else {
  console.error('Workbox failed to load');
}
