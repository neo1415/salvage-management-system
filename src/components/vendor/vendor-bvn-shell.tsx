'use client';

import { ReactNode, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import DashboardSidebar from '@/components/layout/dashboard-sidebar';
import { DashboardTopBar } from '@/components/layout/dashboard-top-bar';
import { OfflineIndicator } from '@/components/pwa/offline-indicator';
import { SyncProgressIndicator } from '@/components/ui/sync-progress-indicator';
import { NavigationProgressBar } from '@/components/ui/loading-states';
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
  const router = useRouter();

  const needsBvn = vendorNeedsBvnVerification(session?.user?.role, session?.user?.bvnVerified);
  const onTier1 = isVendorPreBvnPage(pathname);

  useEffect(() => {
    if (status !== 'authenticated') return;

    if (needsBvn && !onTier1) {
      router.replace(VENDOR_TIER1_PATH);
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
      router.replace('/vendor/kyc/tier2');
    }
  }, [status, needsBvn, onTier1, session?.user?.role, session?.user?.bvnVerified, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#800020]" />
      </div>
    );
  }

  if (needsBvn) {
    if (!onTier1) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-[#800020]" />
        </div>
      );
    }

    return (
      <>
        <NavigationProgressBar />
        <div className="min-h-screen">{children}</div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardRouteGuard />
      <NavigationProgressBar />
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
