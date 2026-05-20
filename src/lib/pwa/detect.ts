/** Detect installed PWA / iOS standalone */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Splash length: 5–7s based on connectivity (not page load). */
export function getPwaSplashDurationMs(): number {
  if (typeof navigator === 'undefined') return 6000;

  const MIN_MS = 5000;
  const MAX_MS = 7000;

  if (!navigator.onLine) return MAX_MS;

  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  }).connection;

  if (connection?.saveData) return MAX_MS;

  const type = connection?.effectiveType;
  if (type === 'slow-2g' || type === '2g' || type === '3g') return MAX_MS;
  if (type === '4g') return 6000;

  return MIN_MS;
}

export const PWA_SPLASH_COMPLETE_EVENT = 'salvage-splash-complete';
export const PWA_LAST_PATH_KEY = 'salvage-last-path';
export const PWA_SPLASH_DONE_KEY = 'salvage-splash-complete';
/** Set after first splash this browser session — prevents splash on login/logout navigation */
export const PWA_SPLASH_SESSION_KEY = 'salvage-splash-session-v1';
