/**
 * Service Worker Registration Utility
 * Registers the service worker and handles updates
 */

export function registerServiceWorker(): (() => void) | undefined {
  if (typeof window === 'undefined') {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => undefined);
    }
    return;
  }

  if ('serviceWorker' in navigator) {
    let updateTimer: ReturnType<typeof setInterval> | undefined;
    let registration: ServiceWorkerRegistration | undefined;

    const updateRegistration = async () => {
      if (!registration || !navigator.onLine) return;
      try {
        await registration.update();
      } catch (error) {
        console.warn('Service Worker update deferred until the network is available:', error);
      }
    };

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registered) => {
          registration = registered;
          console.log('Service Worker registered successfully:', registered.scope);

          // Check for updates periodically
          updateTimer = setInterval(() => {
            void updateRegistration();
          }, 60 * 60 * 1000); // Check every hour

          // Handle service worker updates
          registered.addEventListener('updatefound', () => {
            const newWorker = registered.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available, prompt user to update
                  if (confirm('New version available! Reload to update?')) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn('Service Worker registration deferred:', error);
        });
    };

    const onControllerChange = () => window.location.reload();
    window.addEventListener('load', onLoad);
    window.addEventListener('online', updateRegistration);

    // Handle controller change (new service worker activated)
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      window.removeEventListener('load', onLoad);
      window.removeEventListener('online', updateRegistration);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      if (updateTimer) clearInterval(updateTimer);
    };
  } else {
    console.warn('Service Workers are not supported in this browser');
  }
}

/**
 * Unregister service worker (useful for development/testing)
 */
export async function unregisterServiceWorker() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
    console.log('All service workers unregistered');
  }
}

/**
 * Check if app is running in standalone mode (installed as PWA)
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  interface NavigatorStandalone extends Navigator {
    standalone?: boolean;
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as NavigatorStandalone).standalone === true
  );
}

/**
 * Check if browser supports PWA installation
 */
export function canInstallPWA(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return 'serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window;
}
