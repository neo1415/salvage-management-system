export const COOKIE_CONSENT_STORAGE_KEY = 'cookie-consent-v1';
export const COOKIE_PREFERENCES_STORAGE_KEY = 'cookie-preferences-v1';
export const COOKIE_BANNER_DISMISSED_KEY = 'cookie-banner-dismissed-v1';

export interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  timestamp?: string;
}

const DEFAULT_PREFERENCES: CookiePreferences = {
  essential: true,
  functional: true,
  analytics: true,
};

function safeStorageGet(storage: Storage | null | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeStorageSet(storage: Storage | null | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage can be unavailable in strict privacy modes. Consent should fail closed.
  }
}

function parsePreferences(raw: string | null): CookiePreferences | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CookiePreferences>;
    if (typeof parsed.essential !== 'boolean') return null;

    return {
      essential: true,
      functional: Boolean(parsed.functional),
      analytics: Boolean(parsed.analytics),
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : undefined,
    };
  } catch {
    return null;
  }
}

export function readStoredCookiePreferences(): CookiePreferences | null {
  if (typeof window === 'undefined') return null;

  return (
    parsePreferences(safeStorageGet(window.localStorage, COOKIE_CONSENT_STORAGE_KEY))
    ?? parsePreferences(safeStorageGet(window.localStorage, COOKIE_PREFERENCES_STORAGE_KEY))
    ?? parsePreferences(safeStorageGet(window.sessionStorage, COOKIE_CONSENT_STORAGE_KEY))
  );
}

export function hasCookieConsent(): boolean {
  if (typeof window === 'undefined') return false;
  if (readStoredCookiePreferences() !== null) return true;
  return safeStorageGet(window.localStorage, COOKIE_BANNER_DISMISSED_KEY) === '1';
}

export function dismissCookieBanner(): void {
  if (typeof window === 'undefined') return;
  safeStorageSet(window.localStorage, COOKIE_BANNER_DISMISSED_KEY, '1');
  window.dispatchEvent(new CustomEvent('salvage:cookie-banner-dismissed'));
}

export function persistCookiePreferences(preferences: CookiePreferences): void {
  if (typeof window === 'undefined') return;

  const payload: CookiePreferences = {
    essential: true,
    functional: preferences.functional,
    analytics: preferences.analytics,
    timestamp: preferences.timestamp ?? new Date().toISOString(),
  };

  const serialized = JSON.stringify(payload);
  safeStorageSet(window.localStorage, COOKIE_CONSENT_STORAGE_KEY, serialized);
  safeStorageSet(window.localStorage, COOKIE_PREFERENCES_STORAGE_KEY, serialized);
  safeStorageSet(window.localStorage, COOKIE_BANNER_DISMISSED_KEY, '1');
  safeStorageSet(window.sessionStorage, COOKIE_CONSENT_STORAGE_KEY, serialized);

  applyCookiePreferences(payload);
}

export function applyCookiePreferences(preferences: CookiePreferences): void {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  root.dataset.cookieFunctional = preferences.functional ? 'allowed' : 'denied';
  root.dataset.cookieAnalytics = preferences.analytics ? 'allowed' : 'denied';

  if (!preferences.analytics) {
    window.dispatchEvent(new CustomEvent('salvage:cookie-analytics-disabled'));
  }
}

export function getDefaultCookiePreferences(): CookiePreferences {
  return { ...DEFAULT_PREFERENCES };
}
