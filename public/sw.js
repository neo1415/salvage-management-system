// Service Worker for Salvage Management System PWA
// Implements offline-first caching strategies with Workbox
// Version: 1.0.4 - Harden offline field mode navigation fallbacks

const FALLBACK_HTML_URL = '/offline.html';
const FALLBACK_IMAGE_URL = '/icons/icon-192.png';
const OFFLINE_ENTRY_URLS = ['/login', '/offline-field'];
const OFFLINE_FALLBACK_CACHE = 'offline-fallbacks-v2';

function normalizeNavigationPath(requestUrl) {
  const url = new URL(requestUrl);
  return url.pathname.replace(/\/$/, '') || '/';
}

async function cacheOfflineFallbacks() {
  const cache = await caches.open(OFFLINE_FALLBACK_CACHE);
  await Promise.all(
    [FALLBACK_HTML_URL, FALLBACK_IMAGE_URL, ...OFFLINE_ENTRY_URLS].map(async (url) => {
      try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (response.ok || response.type === 'opaque') {
          await cache.put(url, response);
        }
      } catch (error) {
        console.warn(`Service Worker: Unable to pre-cache offline fallback ${url}`, error);
      }
    })
  );
}

async function getOfflineNavigationFallback(requestUrl) {
  const pathname = normalizeNavigationPath(requestUrl);
  const cachedNavigation = await caches.match(requestUrl, { ignoreSearch: true });
  if (cachedNavigation) return cachedNavigation;

  const cache = await caches.open(OFFLINE_FALLBACK_CACHE);

  if (OFFLINE_ENTRY_URLS.includes(pathname)) {
    const entry = await cache.match(pathname);
    if (entry) return entry;
  }

  return (await cache.match(FALLBACK_HTML_URL)) || Response.error();
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheOfflineFallbacks());
});

// Import Workbox from CDN for runtime caching. Push notification handlers must
// still load if the CDN is temporarily unreachable on a mobile device.
try {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');
} catch (error) {
  console.warn('Workbox failed to load; push notifications remain enabled.', error);
}

if (self.workbox) {
  const workbox = self.workbox;
  console.log('Workbox loaded successfully');

  // Enable debug mode in development (check hostname instead of process.env)
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
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
  // Special handling for auction endpoints to prevent stale data
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.startsWith('/api/auctions'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'auctions-api-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 20,
          maxAgeSeconds: 30, // Only 30 seconds for auction data
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
      networkTimeoutSeconds: 5,
    })
  );

  // Other API routes with longer cache
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auctions'),
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
  // EXCLUDE external domains (Dojah, Paystack, etc.) from caching
  workbox.routing.registerRoute(
    ({ request, url }) =>
      (request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'font') &&
      url.origin === self.location.origin, // Only cache same-origin assets
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

  // Listen for sync events from the browser
  self.addEventListener('sync', (event) => {
    console.log('Sync event triggered:', event.tag);
    
    if (event.tag === 'offline-cases-sync') {
      event.waitUntil(
        // Notify all clients to trigger sync
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'SYNC_OFFLINE_CASES',
              timestamp: Date.now(),
            });
          });
        })
      );
    }
  });

  // Enhanced sync progress reporting
  // Listen for messages from clients to report sync progress
  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_PROGRESS') {
      // Broadcast sync progress to all clients
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_PROGRESS_UPDATE',
            progress: event.data.progress,
            timestamp: Date.now(),
          });
        });
      });
    }
    
    if (event.data && event.data.type === 'SYNC_COMPLETE') {
      // Broadcast sync completion to all clients
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_COMPLETED',
            result: event.data.result,
            timestamp: Date.now(),
          });
        });
      });
    }
    
    if (event.data && event.data.type === 'SYNC_ERROR') {
      // Broadcast sync error to all clients
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_FAILED',
            error: event.data.error,
            timestamp: Date.now(),
          });
        });
      });
    }
  });

  // Skip waiting and claim clients immediately
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // Handle service worker updates
  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });

  workbox.routing.setCatchHandler(async ({ event, request }) => {
    if (request.mode === 'navigate' || request.destination === 'document') {
      return getOfflineNavigationFallback(event.request.url);
    }

    if (request.destination === 'image') {
      return (await caches.match(FALLBACK_IMAGE_URL)) || Response.error();
    }

    return Response.error();
  });

  console.log('Service Worker: All caching strategies registered');
} else {
  console.error('Workbox failed to load');

  self.addEventListener('fetch', (event) => {
    if (event.request.mode === 'navigate') {
      event.respondWith(
        fetch(event.request).catch(() => getOfflineNavigationFallback(event.request.url))
      );
    } else if (event.request.destination === 'image') {
      event.respondWith(
        fetch(event.request).catch(() => caches.match(FALLBACK_IMAGE_URL))
      );
    }
  });
}

// Push Notification Handler
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  if (!event.data) {
    console.warn('Push event has no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('Push notification data:', data);

    const options = {
      body: data.body || 'You have a new notification',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-192.png',
      data: data.data || {},
      tag: data.tag || 'default',
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || [],
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Salvage Management', options)
    );
  } catch (error) {
    console.error('Error handling push notification:', error);
    
    // Fallback notification
    event.waitUntil(
      self.registration.showNotification('Salvage Management', {
        body: 'You have a new notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      })
    );
  }
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;

  // Determine URL based on notification type and action
  let url = '/notifications';

  if (typeof data.url === 'string' && data.url.startsWith('/')) {
    url = data.url;
  } else if (
    data.type === 'outbid' ||
    data.type === 'auction-ending' ||
    data.type === 'auction_closing_soon' ||
    data.type === 'bidding_otp' ||
    data.type === 'auction_won' ||
    data.type === 'payment-confirmation' ||
    data.type === 'payment_confirmation'
  ) {
    if (!action || action === 'view' || action === 'bid') {
      url = data.auctionId ? `/vendor/auctions/${data.auctionId}` : '/vendor/auctions';
    }
  } else if (data.type === 'leaderboard-update') {
    if (action === 'view') {
      url = '/vendor/leaderboard';
    }
  }

  const targetUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if ('focus' in client) {
          const clientPath = new URL(client.url).pathname;
          if (clientPath === new URL(targetUrl).pathname) {
            return client.focus();
          }
        }
      }
      
      // Open new window if no matching window found
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Notification Close Handler
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
  
  // Track notification dismissal (optional analytics)
  const data = event.notification.data || {};
  console.log('Notification dismissed:', data.type);
});

