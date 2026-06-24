'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useNavigation } from '@/components/navigation/navigation-provider';

type AppRouter = ReturnType<typeof useRouter>;
type NavigateOptions = Parameters<AppRouter['push']>[1];

/**
 * Router wrapper that shows global navigation feedback during programmatic route changes.
 * Return value is memoized — do not use the whole object as a useEffect dependency unless
 * you only need push/replace/back (those callbacks are stable).
 */
export function useAppRouter() {
  const router = useRouter();
  const { startNavigation } = useNavigation();

  const push = useCallback(
    (href: string, options?: NavigateOptions) => {
      startNavigation(href);
      router.push(href, options);
    },
    [router, startNavigation]
  );

  const replace = useCallback(
    (href: string, options?: NavigateOptions) => {
      startNavigation(href);
      router.replace(href, options);
    },
    [router, startNavigation]
  );

  const back = useCallback(() => {
    startNavigation();
    router.back();
  }, [router, startNavigation]);

  return useMemo(
    () => ({
      push,
      replace,
      back,
      refresh: router.refresh,
      prefetch: router.prefetch,
    }),
    [push, replace, back, router.refresh, router.prefetch]
  );
}
