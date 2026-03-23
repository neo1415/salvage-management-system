'use client';

import dynamic from 'next/dynamic';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';

// Dynamic import for vendor dashboard content with skeleton loader
// This reduces initial bundle size and improves page load performance
const VendorDashboardContent = dynamic(
  () => import('@/components/vendor/vendor-dashboard-content'),
  {
    loading: () => <DashboardSkeleton />,
    ssr: false, // Client-only component with auth checks
  }
);

export default function VendorDashboardPage() {
  return <VendorDashboardContent />;
}
