import { ReactNode } from 'react';
import { VendorBvnShell } from '@/components/vendor/vendor-bvn-shell';
import { PwaRouteTracker } from '@/components/pwa/pwa-route-tracker';

/**
 * Dashboard layout — sidebar/top bar unless vendor is pending BVN (onboarding shell).
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <VendorBvnShell>
      <PwaRouteTracker />
      {children}
    </VendorBvnShell>
  );
}
