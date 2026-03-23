'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/utils/register-sw';

/**
 * Service Worker Registration Component
 * Registers the service worker on mount (client-side only)
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
}
