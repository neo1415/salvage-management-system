'use client';

export type BrowserStorageName = 'localStorage' | 'sessionStorage';

export function getSafeBrowserStorage(storageName: BrowserStorageName): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window[storageName] ?? null;
  } catch {
    return null;
  }
}

export function getSafeStorageItem(storageName: BrowserStorageName, key: string): string | null {
  try {
    return getSafeBrowserStorage(storageName)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function setSafeStorageItem(
  storageName: BrowserStorageName,
  key: string,
  value: string
): void {
  try {
    getSafeBrowserStorage(storageName)?.setItem(key, value);
  } catch {
    // Storage can be blocked by browser privacy settings or enterprise policy.
  }
}

export function removeSafeStorageItem(storageName: BrowserStorageName, key: string): void {
  try {
    getSafeBrowserStorage(storageName)?.removeItem(key);
  } catch {
    // Storage can be blocked by browser privacy settings or enterprise policy.
  }
}
