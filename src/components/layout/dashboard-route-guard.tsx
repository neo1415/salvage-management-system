'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { isPathAllowedForRole } from '@/lib/auth/rbac';

/**
 * Client-side backup guard (server RBAC in proxy is authoritative).
 */
export function DashboardRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated' || !pathname) return;

    const role = session?.user?.role;
    if (!isPathAllowedForRole(pathname, role)) {
      router.replace(`/unauthorized?from=${encodeURIComponent(pathname)}`);
    }
  }, [status, session?.user?.role, pathname, router]);

  return null;
}
