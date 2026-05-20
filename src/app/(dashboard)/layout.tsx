import { ReactNode } from 'react';
import { VendorBvnShell } from '@/components/vendor/vendor-bvn-shell';

/**
 * Dashboard layout — sidebar/top bar unless vendor is pending BVN (onboarding shell).
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <VendorBvnShell>{children}</VendorBvnShell>;
}
