import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSafeBrowserStorage,
  getSafeStorageItem,
  removeSafeStorageItem,
  setSafeStorageItem,
  type BrowserStorageName,
} from '@/lib/utils/safe-browser-storage';

type StorageMethod = 'getItem' | 'setItem' | 'removeItem';

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
const originalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');

function restoreStorageDescriptor(storageName: BrowserStorageName): void {
  const descriptor = storageName === 'localStorage'
    ? originalLocalStorageDescriptor
    : originalSessionStorageDescriptor;

  if (descriptor) {
    Object.defineProperty(window, storageName, descriptor);
  }
}

function defineStorageGetter(storageName: BrowserStorageName, getter: () => Storage | null): void {
  Object.defineProperty(window, storageName, {
    configurable: true,
    get: getter,
  });
}

function createStorageMock(methodToThrow?: StorageMethod): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    getItem: vi.fn((key: string) => {
      if (methodToThrow === 'getItem') throw new DOMException('Blocked', 'SecurityError');
      return values.get(key) ?? null;
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (methodToThrow === 'setItem') throw new DOMException('Blocked', 'SecurityError');
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      if (methodToThrow === 'removeItem') throw new DOMException('Blocked', 'SecurityError');
      values.delete(key);
    }),
  };
}

describe('safe browser storage', () => {
  afterEach(() => {
    restoreStorageDescriptor('localStorage');
    restoreStorageDescriptor('sessionStorage');
    vi.restoreAllMocks();
  });

  it('handles normal localStorage behaviour', () => {
    const storage = createStorageMock();
    defineStorageGetter('localStorage', () => storage);

    setSafeStorageItem('localStorage', 'demo', 'value');

    expect(getSafeStorageItem('localStorage', 'demo')).toBe('value');
    expect(storage.setItem).toHaveBeenCalledWith('demo', 'value');

    removeSafeStorageItem('localStorage', 'demo');

    expect(getSafeStorageItem('localStorage', 'demo')).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith('demo');
  });

  it('handles normal sessionStorage behaviour', () => {
    const storage = createStorageMock();
    defineStorageGetter('sessionStorage', () => storage);

    setSafeStorageItem('sessionStorage', 'demo', 'session-value');

    expect(getSafeStorageItem('sessionStorage', 'demo')).toBe('session-value');
  });

  it('returns null and no-ops when storage properties return null', () => {
    defineStorageGetter('localStorage', () => null);

    expect(getSafeBrowserStorage('localStorage')).toBeNull();
    expect(getSafeStorageItem('localStorage', 'demo')).toBeNull();
    expect(() => setSafeStorageItem('localStorage', 'demo', 'value')).not.toThrow();
    expect(() => removeSafeStorageItem('localStorage', 'demo')).not.toThrow();
  });

  it('returns null and no-ops when storage property access throws', () => {
    defineStorageGetter('localStorage', () => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    expect(getSafeBrowserStorage('localStorage')).toBeNull();
    expect(getSafeStorageItem('localStorage', 'demo')).toBeNull();
    expect(() => setSafeStorageItem('localStorage', 'demo', 'value')).not.toThrow();
    expect(() => removeSafeStorageItem('localStorage', 'demo')).not.toThrow();
  });

  it('returns null when getItem throws', () => {
    defineStorageGetter('localStorage', () => createStorageMock('getItem'));

    expect(getSafeStorageItem('localStorage', 'demo')).toBeNull();
  });

  it('no-ops when setItem throws', () => {
    defineStorageGetter('localStorage', () => createStorageMock('setItem'));

    expect(() => setSafeStorageItem('localStorage', 'demo', 'value')).not.toThrow();
  });

  it('no-ops when removeItem throws', () => {
    defineStorageGetter('localStorage', () => createStorageMock('removeItem'));

    expect(() => removeSafeStorageItem('localStorage', 'demo')).not.toThrow();
  });
});
