'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useAppRouter } from '@/hooks/use-app-router';
import DashboardSidebar from '@/components/layout/dashboard-sidebar';
import { DashboardTopBar } from '@/components/layout/dashboard-top-bar';
import { OfflineIndicator } from '@/components/pwa/offline-indicator';
import { SyncProgressIndicator } from '@/components/ui/sync-progress-indicator';
import { Loader2 } from 'lucide-react';
import { RoleMobileNav } from '@/components/layout/role-mobile-nav';
import { DashboardRouteGuard } from '@/components/layout/dashboard-route-guard';
import { isResolvedOnboardingTarget } from '@/lib/auth/vendor-onboarding-paths';

type OnboardingStatus = {
  redirectPath: string | null;
};

export function VendorBvnShell({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { replace } = useAppRouter();
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const isVendor = session?.user?.role === 'vendor';

  useEffect(() => {
    if (status !== 'authenticated' || !isVendor) {
      setInitialLoad(false);
      return;
    }

    let cancelled = false;

    fetch('/api/vendor/onboarding-status', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled) {
          setOnboardingStatus(payload?.data ?? { redirectPath: null });
          setInitialLoad(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOnboardingStatus({ redirectPath: null });
          setInitialLoad(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, isVendor]);

  useEffect(() => {
    if (status !== 'authenticated' || !isVendor || initialLoad) return;

    const redirectPath = onboardingStatus?.redirectPath;
    if (redirectPath) {
      if (!isResolvedOnboardingTarget(pathname, redirectPath)) {
        replace(redirectPath);
      }
    }
  }, [status, isVendor, initialLoad, onboardingStatus, pathname, replace]);

  if (status === 'loading' || (isVendor && initialLoad)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

  const forcedOnboardingPath = onboardingStatus?.redirectPath;
  const needsOnboardingGate = Boolean(forcedOnboardingPath);

  const onForcedOnboardingPage = isResolvedOnboardingTarget(pathname, forcedOnboardingPath);

  if (isVendor && needsOnboardingGate && !onForcedOnboardingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

  if (isVendor && needsOnboardingGate && onForcedOnboardingPage) {
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
