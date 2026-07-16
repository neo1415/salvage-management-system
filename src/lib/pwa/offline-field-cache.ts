'use client';

const OFFLINE_FIELD_CACHE = 'offline-field-shell-v1';
const OFFLINE_FIELD_ROUTES = ['/login', '/offline-field?offline=1'];
const NEXT_STATIC_ASSET_PATTERN = /["'(](\/_next\/static\/[^"'()<>\\\s]+)["')]/g;

function canUseCacheStorage(): boolean {
  return typeof window !== 'undefined' && 'caches' in window && typeof window.fetch === 'function';
}

function collectNextStaticAssets(html: string): string[] {
  const assets = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = NEXT_STATIC_ASSET_PATTERN.exec(html)) !== null) {
    assets.add(match[1]);
  }

  return Array.from(assets);
}

async function cacheRoute(cache: Cache, route: string): Promise<string[]> {
  const response = await fetch(route, {
    cache: 'reload',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    return [];
  }

  const responseForCache = response.clone();
  await cache.put(route, responseForCache);

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return [];
  }

  return collectNextStaticAssets(await response.text());
}

export async function warmOfflineFieldModeCache(): Promise<void> {
  if (!canUseCacheStorage()) return;

  try {
    const cache = await caches.open(OFFLINE_FIELD_CACHE);
    const assets = new Set<string>();

    for (const route of OFFLINE_FIELD_ROUTES) {
      const routeAssets = await cacheRoute(cache, route);
      routeAssets.forEach((asset) => assets.add(asset));
    }

    await Promise.all(
      Array.from(assets).map(async (asset) => {
        try {
          const response = await fetch(asset, {
            cache: 'reload',
            credentials: 'same-origin',
          });

          if (response.ok) {
            await cache.put(asset, response);
          }
        } catch {
          // Individual chunk failures should not block the login flow.
        }
      })
    );
  } catch (error) {
    console.warn('Offline field mode cache warm-up failed:', error);
  }
}

export const offlineFieldCacheInternals = {
  collectNextStaticAssets,
};
