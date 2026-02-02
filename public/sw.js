// Service Worker for Salvage Management System PWA
// TEMPORARILY DISABLED - Causing CSP issues with authentication
// Will be re-enabled after proper Workbox setup

console.log('Service Worker: Minimal version loaded');

// Basic service worker without Workbox
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through all requests without caching
  event.respondWith(fetch(event.request));
});
