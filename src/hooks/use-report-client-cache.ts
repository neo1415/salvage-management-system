'use client';

const memoryCache = new Map<string, { data: unknown; at: number }>();

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function buildReportCacheKey(apiPath: string, params: URLSearchParams): string {
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  return `${apiPath}?${new URLSearchParams(sorted).toString()}`;
}

/**
 * In-memory stale-while-revalidate for report JSON (per tab session).
 * Does not persist auth-sensitive data to localStorage.
 */
export async function fetchReportWithClientCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options?: { ttlMs?: number; force?: boolean }
): Promise<{ data: T; fromCache: boolean }> {
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;
  const hit = memoryCache.get(cacheKey);
  const stale = !hit || Date.now() - hit.at > ttl;

  if (hit && !options?.force && !stale) {
    return { data: hit.data as T, fromCache: true };
  }

  const data = await fetcher();
  memoryCache.set(cacheKey, { data, at: Date.now() });
  return { data, fromCache: false };
}

export function invalidateReportClientCache(cacheKey?: string) {
  if (cacheKey) {
    memoryCache.delete(cacheKey);
    return;
  }
  memoryCache.clear();
}
