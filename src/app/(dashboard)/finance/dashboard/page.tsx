'use client';

import dynamic from 'next/dynamic';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';

const FinanceDashboardContent = dynamic(
  () => import('@/components/finance/finance-dashboard-content'),
  {
    loading: () => <DashboardSkeleton />,
    ssr: false,
  }
);

export default function FinanceDashboardPage() {
  return <FinanceDashboardContent />;
}
