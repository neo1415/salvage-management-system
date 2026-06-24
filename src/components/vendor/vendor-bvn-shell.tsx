'use client';

import { ReactNode, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useAppRouter } from '@/hooks/use-app-router';
import DashboardSidebar from '@/components/layout/dashboard-sidebar';
import { DashboardTopBar } from '@/components/layout/dashboard-top-bar';
import { OfflineIndicator } from '@/components/pwa/offline-indicator';
import { SyncProgressIndicator } from '@/components/ui/sync-progress-indicator';
import {
  isVendorPreBvnPage,
  vendorNeedsBvnVerification,
  VENDOR_TIER1_PATH,
} from '@/lib/auth/vendor-bvn-access';
import { Loader2 } from 'lucide-react';
import { RoleMobileNav } from '@/components/layout/role-mobile-nav';
import { DashboardRouteGuard } from '@/components/layout/dashboard-route-guard';
import { isKycTestingModeClient } from '@/lib/kyc/kyc-testing-mode';

export function VendorBvnShell({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { replace } = useAppRouter();

  const needsBvn = vendorNeedsBvnVerification(session?.user?.role, session?.user?.bvnVerified);
  const onTier1 = isVendorPreBvnPage(pathname);

  useEffect(() => {
    if (status !== 'authenticated') return;

    if (needsBvn && !onTier1) {
      replace(VENDOR_TIER1_PATH);
      return;
    }

    if (
      session?.user?.role === 'vendor' &&
      session.user.bvnVerified &&
      onTier1 &&
      !isKycTestingModeClient()
    ) {
      if (typeof window !== 'undefined' && sessionStorage.getItem('bvn_verification_success') === '1') {
        return;
      }
      replace('/vendor/kyc/tier2');
    }
  }, [status, needsBvn, onTier1, session?.user?.role, session?.user?.bvnVerified, replace]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

  if (needsBvn) {
    if (!onTier1) {
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
