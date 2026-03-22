'use client';

import dynamic from 'next/dynamic';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';

const AdminDashboardContent = dynamic(
  () => import('@/components/admin/admin-dashboard-content'),
  {
    loading: () => <DashboardSkeleton />,
    ssr: false,
  }
);

export default function AdminDashboardPage() {
  return <AdminDashboardContent />;
}
