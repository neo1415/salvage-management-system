'use client';

import dynamic from 'next/dynamic';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';

const ManagerDashboardContent = dynamic(
  () => import('@/components/manager/manager-dashboard-content'),
  {
    loading: () => <DashboardSkeleton />,
    ssr: false,
  }
);
export default function ManagerDashboardPage() {
  return <ManagerDashboardContent />;
}
