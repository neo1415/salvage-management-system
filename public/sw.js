// Service Worker for PWA
// This will be configured with Workbox in a later task

self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Fetch event handling will be implemented with Workbox
  event.respondWith(fetch(event.request));
});
