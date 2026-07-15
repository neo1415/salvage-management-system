import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COOKIE_BANNER_DISMISSED_KEY,
  COOKIE_CONSENT_STORAGE_KEY,
  dismissCookieBanner,
  hasCookieConsent,
  persistCookiePreferences,
  readStoredCookiePreferences,
} from '@/lib/cookies/cookie-consent';

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
const originalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');

function restoreStorageDescriptors(): void {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor);
  }
  if (originalSessionStorageDescriptor) {
    Object.defineProperty(window, 'sessionStorage', originalSessionStorageDescriptor);
  }
}

function createStorageMock(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
}

describe('cookie consent storage safety', () => {
  afterEach(() => {
    restoreStorageDescriptors();
    document.documentElement.dataset.cookieFunctional = '';
    document.documentElement.dataset.cookieAnalytics = '';
    vi.restoreAllMocks();
  });

  it('reads and writes preferences through available browser storage', () => {
    const localStorageMock = createStorageMock();
    const sessionStorageMock = createStorageMock();

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => localStorageMock,
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => sessionStorageMock,
    });

    persistCookiePreferences({ essential: true, functional: false, analytics: true });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      COOKIE_BANNER_DISMISSED_KEY,
      '1'
    );
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
      COOKIE_CONSENT_STORAGE_KEY,
      expect.stringContaining('"essential":true')
    );
    expect(readStoredCookiePreferences()).toMatchObject({
      essential: true,
      functional: false,
      analytics: true,
    });
    expect(hasCookieConsent()).toBe(true);
  });

  it('does not throw when storage properties are null', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => null,
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => null,
    });

    expect(readStoredCookiePreferences()).toBeNull();
    expect(hasCookieConsent()).toBe(false);
    expect(() => dismissCookieBanner()).not.toThrow();
    expect(() => persistCookiePreferences({ essential: true, functional: true, analytics: false })).not.toThrow();
  });

  it('does not throw when storage property access throws', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });

    expect(readStoredCookiePreferences()).toBeNull();
    expect(hasCookieConsent()).toBe(false);
    expect(() => dismissCookieBanner()).not.toThrow();
    expect(() => persistCookiePreferences({ essential: true, functional: true, analytics: false })).not.toThrow();
  });
});
