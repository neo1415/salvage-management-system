# PWA (Progressive Web App) Implementation

## Overview

The Salvage Management System is implemented as a Progressive Web App (PWA) to provide a native app-like experience with offline capabilities, push notifications, and installability.

## Features

### 1. Service Worker with Workbox

The service worker (`public/sw.js`) implements the following caching strategies:

- **CacheFirst for Images**: Images are cached first and served from cache, falling back to network
  - Cache name: `images-cache`
  - Max entries: 100
  - Max age: 30 days

- **NetworkFirst for API Routes**: API calls try network first, fall back to cache if offline
  - Cache name: `api-cache`
  - Max entries: 50
  - Max age: 5 minutes
  - Network timeout: 10 seconds

- **StaleWhileRevalidate for Static Assets**: Serve from cache immediately, update cache in background
  - Cache name: `static-assets-cache`
  - Max entries: 60
  - Max age: 7 days
  - Applies to: CSS, JavaScript, fonts

- **NetworkFirst for HTML Pages**: HTML pages try network first, fall back to cache
  - Cache name: `pages-cache`
  - Max entries: 30
  - Max age: 24 hours

### 2. Background Sync

The service worker implements background sync for offline case submissions:

- Queue name: `case-submissions-queue`
- Max retention time: 24 hours
- Automatically retries failed POST requests to `/api/cases` when connection is restored

### 3. Offline Fallback

When offline and no cached version is available:
- HTML pages: Serve `/offline.html`
- Images: Serve NEM Insurance logo

### 4. PWA Installation

The app can be installed on mobile and desktop devices:

- **Install Prompt**: Shows after 3 seconds on first visit
- **Dismissible**: Can be dismissed for the current session
- **Standalone Mode**: Runs in standalone mode when installed

### 5. Offline Detection

The app includes offline detection and indicators:

- **useOffline Hook**: React hook to detect online/offline status
- **useNetworkStatus Hook**: React hook with detailed connection info
- **OfflineIndicator Component**: Shows banner when offline

## Components

### ServiceWorkerRegister

Client component that registers the service worker on mount.

```tsx
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';

// In layout.tsx
<ServiceWorkerRegister />
```

### InstallPrompt

Shows a prompt to install the PWA when available.

```tsx
import { InstallPrompt } from '@/components/pwa/install-prompt';

// In layout.tsx
<InstallPrompt />
```

### OfflineIndicator

Shows a banner when the user is offline.

```tsx
import { OfflineIndicator } from '@/components/pwa/offline-indicator';

// In layout.tsx
<OfflineIndicator />
```

## Hooks

### useOffline

Returns a boolean indicating if the user is offline.

```tsx
import { useOffline } from '@/hooks/use-offline';

function MyComponent() {
  const isOffline = useOffline();
  
  return (
    <div>
      {isOffline && <p>You are offline</p>}
    </div>
  );
}
```

### useNetworkStatus

Returns detailed network status information.

```tsx
import { useNetworkStatus } from '@/hooks/use-offline';

function MyComponent() {
  const { isOffline, effectiveType, downlink, rtt } = useNetworkStatus();
  
  return (
    <div>
      <p>Status: {isOffline ? 'Offline' : 'Online'}</p>
      <p>Connection: {effectiveType}</p>
      <p>Speed: {downlink} Mbps</p>
      <p>Latency: {rtt} ms</p>
    </div>
  );
}
```

## Utilities

### registerServiceWorker

Registers the service worker and handles updates.

```tsx
import { registerServiceWorker } from '@/lib/utils/register-sw';

// Called automatically by ServiceWorkerRegister component
registerServiceWorker();
```

### unregisterServiceWorker

Unregisters all service workers (useful for development/testing).

```tsx
import { unregisterServiceWorker } from '@/lib/utils/register-sw';

await unregisterServiceWorker();
```

### isStandalone

Checks if the app is running in standalone mode (installed as PWA).

```tsx
import { isStandalone } from '@/lib/utils/register-sw';

if (isStandalone()) {
  console.log('Running as installed PWA');
}
```

### canInstallPWA

Checks if the browser supports PWA installation.

```tsx
import { canInstallPWA } from '@/lib/utils/register-sw';

if (canInstallPWA()) {
  console.log('PWA installation is supported');
}
```

## Manifest

The PWA manifest is located at `public/manifest.json` and includes:

- App name and short name
- Description
- Start URL
- Display mode (standalone)
- Theme colors (Burgundy #800020)
- Icons (192x192 and 512x512)
- Orientation (portrait-primary)

## Testing

### Manual Testing

1. **Install PWA**:
   - Open the app in Chrome/Edge
   - Click the install button in the address bar
   - Or use the install prompt that appears after 3 seconds

2. **Test Offline Mode**:
   - Open DevTools → Network tab
   - Select "Offline" from the throttling dropdown
   - Navigate the app and verify cached pages load
   - Try creating a case offline and verify it syncs when online

3. **Test Service Worker**:
   - Open DevTools → Application tab → Service Workers
   - Verify the service worker is registered and active
   - Check Cache Storage to see cached resources

4. **Test Background Sync**:
   - Go offline
   - Submit a case creation form
   - Go back online
   - Verify the request is retried automatically

### Automated Testing

E2E tests for PWA functionality are located in `tests/e2e/pwa-installation.spec.ts`.

## Browser Support

- Chrome/Edge: Full support
- Safari iOS: Partial support (no background sync)
- Firefox: Partial support (no install prompt)
- Samsung Internet: Full support

## Performance

- Service worker registration: <100ms
- Cache hit rate target: >80%
- Offline page load: <500ms
- Background sync retry: Within 5 minutes of connection restore

## Security

- Service worker only works over HTTPS (or localhost for development)
- Cache is scoped to the origin
- Background sync requires user permission
- Push notifications require user permission

## Troubleshooting

### Service Worker Not Registering

1. Check browser console for errors
2. Verify HTTPS is enabled (or using localhost)
3. Check `public/sw.js` exists and is accessible
4. Clear browser cache and reload

### Offline Mode Not Working

1. Check service worker is active in DevTools
2. Verify resources are cached in Cache Storage
3. Check network requests are being intercepted
4. Verify caching strategies are correct

### Install Prompt Not Showing

1. Check browser supports PWA installation
2. Verify manifest.json is valid
3. Check service worker is registered
4. Verify HTTPS is enabled
5. Check if already dismissed in session storage

## Future Enhancements

- Push notifications for auction updates
- Periodic background sync for auction data
- Web Share API for sharing auctions
- Badging API for unread notifications
- File System Access API for document uploads
