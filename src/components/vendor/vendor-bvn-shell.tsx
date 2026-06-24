'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useAppRouter } from '@/hooks/use-app-router';
import DashboardSidebar from '@/components/layout/dashboard-sidebar';
import { DashboardTopBar } from '@/components/layout/dashboard-top-bar';
import { OfflineIndicator } from '@/components/pwa/offline-indicator';
import { SyncProgressIndicator } from '@/components/ui/sync-progress-indicator';
import { isVendorOnboardingPage } from '@/lib/auth/vendor-bvn-access';
import { Loader2 } from 'lucide-react';
import { RoleMobileNav } from '@/components/layout/role-mobile-nav';
import { DashboardRouteGuard } from '@/components/layout/dashboard-route-guard';

type OnboardingStatus = {
  redirectPath: string | null;
};

export function VendorBvnShell({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { replace } = useAppRouter();
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const onOnboardingPage = isVendorOnboardingPage(pathname);

  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.role !== 'vendor') {
      setLoadingStatus(false);
      return;
    }

    let cancelled = false;
    setLoadingStatus(true);

    fetch('/api/vendor/onboarding-status', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled) {
          setOnboardingStatus(payload?.data ?? { redirectPath: null });
          setLoadingStatus(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOnboardingStatus({ redirectPath: null });
          setLoadingStatus(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.role, pathname]);

  useEffect(() => {
    if (status !== 'authenticated' || loadingStatus) return;

    const redirectPath = onboardingStatus?.redirectPath;
    if (redirectPath && !onOnboardingPage) {
      const targetBase = redirectPath.split('?')[0];
      if (pathname !== targetBase && !pathname.startsWith(`${targetBase}/`)) {
        replace(redirectPath);
      }
    }
  }, [status, loadingStatus, onboardingStatus, onOnboardingPage, pathname, replace]);

  if (status === 'loading' || loadingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

  const needsOnboardingGate = Boolean(onboardingStatus?.redirectPath);

  if (needsOnboardingGate) {
    if (!onOnboardingPage) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
        </div>
      );
    }

    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardRouteGuard />
      <DashboardSidebar />
      <div className="hidden lg:block">
        <DashboardTopBar />
      </div>
      <OfflineIndicator />
      <main className="fixed inset-0 lg:left-64 top-16 lg:top-16 overflow-y-auto pb-16 lg:pb-0">
        <div className="p-4 lg:p-8 pb-6">{children}</div>
      </main>
      <RoleMobileNav />
      <SyncProgressIndicator />
    </div>
  );
}
