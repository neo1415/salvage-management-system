'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAppRouter } from '@/hooks/use-app-router';
import { useSession } from 'next-auth/react';
import { isPathAllowedForRole } from '@/lib/auth/rbac';

/**
 * Client-side backup guard (server RBAC in proxy is authoritative).
 */
export function DashboardRouteGuard() {
  const pathname = usePathname();
  const { replace } = useAppRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated' || !pathname) return;

    const role = session?.user?.role;
    if (!isPathAllowedForRole(pathname, role)) {
      replace(`/unauthorized?from=${encodeURIComponent(pathname)}`);
    }
  }, [status, session?.user?.role, pathname, replace]);

  return null;
}
