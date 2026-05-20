'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { PWA_LAST_PATH_KEY } from '@/lib/pwa/detect';

const SKIP_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/launch',
  '/forgot-password',
  '/reset-password',
  '/verify-otp',
  '/complete-oauth',
]);

/**
 * Remembers last in-app route so the PWA can restore it after splash.
 */
export function PwaRouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || SKIP_PATHS.has(pathname) || pathname.startsWith('/api')) return;
    sessionStorage.setItem(PWA_LAST_PATH_KEY, pathname);
  }, [pathname]);

  return null;
}
