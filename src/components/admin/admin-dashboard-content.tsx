'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Users,
  AlertTriangle,
  ClipboardList,
  Activity,
  TrendingUp,
  Package,
  Database,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { DashboardErrorBoundary } from '@/components/ui/error-boundary';
import { DataLoadingState } from '@/components/ui/loading-states';

interface DashboardStats {
  totalUsers: number;
  activeVendors: number;
  pendingFraudAlerts: number;
  todayAuditLogs: number;
  userGrowth: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  pendingPickupConfirmations: number;
  expiredDocuments: number;
  overdueSignedUnpaid: number;
  healthReasons: string[];
}

function AdminDashboardContentInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const statsRef = useRef<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for session to be fully loaded
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    // Only check role after session is loaded
    if (status === 'authenticated') {
      const userRole = session?.user?.role;
      
      if (userRole !== 'system_admin') {
        // Redirect to appropriate dashboard based on role
        if (userRole === 'vendor') router.push('/vendor/dashboard');
        else if (userRole === 'salvage_manager') router.push('/manager/dashboard');
        else if (userRole === 'claims_adjuster') router.push('/adjuster/dashboard');
        else if (userRole === 'finance_officer') router.push('/finance/dashboard');
        else router.push('/login');
        return;
      }

      // User has correct role, fetch dashboard stats
      fetchDashboardStats();
    }
  }, [session, status, router]);

  const fetchDashboardStats = async () => {
    const showFullPageLoader = statsRef.current == null;
    try {
      if (showFullPageLoader) {
        setLoading(true);
      }
      const response = await fetch('/api/dashboard/admin');
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }

      const data = await response.json();
      statsRef.current = data;
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      const fallback: DashboardStats = {
        totalUsers: 0,
        activeVendors: 0,
        pendingFraudAlerts: 0,
        todayAuditLogs: 0,
        userGrowth: 0,
        systemHealth: 'healthy',
        pendingPickupConfirmations: 0,
        expiredDocuments: 0,
        overdueSignedUnpaid: 0,
        healthReasons: [],
      };
      if (showFullPageLoader) {
        statsRef.current = fallback;
        setStats(fallback);
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading || !stats) {
    return <DataLoadingState label="Admin dashboard" variant="page" />;
  }

  const systemHealthMessage =
    stats.systemHealth === 'healthy'
      ? 'All systems operational. No issues detected.'
      : stats.systemHealth === 'warning'
        ? `Some queues need attention: ${stats.healthReasons.join(', ') || 'review operational tasks'}.`
        : `Critical operational attention required: ${stats.healthReasons.join(', ') || 'review fraud and payment queues immediately'}.`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">
          System overview and management
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <Link
          href="/admin/users"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.totalUsers || 0}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600">
                  +{stats?.userGrowth || 0}% this month
                </span>
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </Link>

        {/* Active Vendors */}
        <Link
          href="/admin/users"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Vendors</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.activeVendors || 0}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Verified & active
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </Link>

        {/* Fraud Alerts */}
        <Link
          href="/admin/fraud"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Fraud Alerts</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.pendingFraudAlerts || 0}
              </p>
              <p className="text-sm text-red-600 mt-2">
                {stats?.pendingFraudAlerts ? 'Requires attention' : 'All clear'}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </Link>

        {/* Audit Logs */}
        <Link
          href="/admin/audit-logs"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Today's Logs</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.todayAuditLogs || 0}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                System activities
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <ClipboardList className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </Link>
      </div>

      {/* Pending Pickup Confirmations Widget */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Pending Pickup Confirmations</h2>
          <div className="p-3 bg-orange-100 rounded-lg">
            <Package className="w-6 h-6 text-orange-600" />
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-4xl font-bold text-gray-900">
              {stats?.pendingPickupConfirmations || 0}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {stats?.pendingPickupConfirmations === 0
                ? 'No pending confirmations'
                : stats?.pendingPickupConfirmations === 1
                ? 'Vendor waiting for confirmation'
                : 'Vendors waiting for confirmation'}
            </p>
          </div>
          
          {stats?.pendingPickupConfirmations ? (
            <Link
              href="/admin/pickups"
              className="px-6 py-3 bg-[var(--brand-primary)] text-white rounded-lg font-medium hover:bg-[var(--brand-primary-hover)] transition-colors"
            >
              Review Pickups
            </Link>
          ) : (
            <div className="text-green-600 font-medium flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>All caught up</span>
            </div>
          )}
        </div>

        {stats?.pendingPickupConfirmations ? (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-orange-600 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" aria-label="Warning" />
              <span>Action required: Confirm vendor pickups to complete transactions</span>
            </p>
          </div>
        ) : null}
      </div>

      {/* System Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">System Health</h2>
        <div className="flex items-center gap-4">
          <div
            className={`w-4 h-4 rounded-full ${
              stats?.systemHealth === 'healthy'
                ? 'bg-green-500'
                : stats?.systemHealth === 'warning'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
          />
        <span className="text-lg font-medium capitalize">
          {stats?.systemHealth || 'Unknown'}
        </span>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {systemHealthMessage}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col gap-1 mb-5">
          <h2 className="text-xl font-bold text-gray-900">Operations Control</h2>
          <p className="text-sm text-gray-600">
            Cross-functional queues that can block recovery, settlement, or release.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Link href="/admin/fraud" className="rounded-lg border border-gray-200 p-4 hover:border-[var(--brand-primary)] transition-colors">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fraud queue</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{stats.pendingFraudAlerts}</p>
            <p className="mt-1 text-xs text-gray-500">Pending alerts to review</p>
          </Link>
          <Link href="/admin/pickups" className="rounded-lg border border-gray-200 p-4 hover:border-[var(--brand-primary)] transition-colors">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pickup queue</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{stats.pendingPickupConfirmations}</p>
            <p className="mt-1 text-xs text-gray-500">Paid assets awaiting confirmation</p>
          </Link>
          <Link href="/reports/operational/document-management" className="rounded-lg border border-gray-200 p-4 hover:border-[var(--brand-primary)] transition-colors">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Document exceptions</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{stats.expiredDocuments}</p>
            <p className="mt-1 text-xs text-gray-500">Expired signing windows</p>
          </Link>
          <Link href="/finance/payments" className="rounded-lg border border-gray-200 p-4 hover:border-[var(--brand-primary)] transition-colors">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment exceptions</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{stats.overdueSignedUnpaid}</p>
            <p className="mt-1 text-xs text-gray-500">Signed but unpaid past deadline</p>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Link
            href="/admin/users"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[var(--brand-primary)] transition-colors text-center"
          >
            <Users className="w-8 h-8 mx-auto mb-2 text-[var(--brand-primary)]" />
            <p className="font-medium">Manage Users</p>
          </Link>

          <Link
            href="/admin/fraud"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[var(--brand-primary)] transition-colors text-center"
          >
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-[var(--brand-primary)]" />
            <p className="font-medium">Review Fraud</p>
          </Link>

          <Link
            href="/manager/vendors?tier=tier2&status=pending"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[var(--brand-primary)] transition-colors text-center"
          >
            <Users className="w-8 h-8 mx-auto mb-2 text-[var(--brand-primary)]" />
            <p className="font-medium">KYC Approvals</p>
          </Link>

          <Link
            href="/admin/audit-logs"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[var(--brand-primary)] transition-colors text-center"
          >
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-[var(--brand-primary)]" />
            <p className="font-medium">View Logs</p>
          </Link>

          <Link
            href="/admin/privacy-requests"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[var(--brand-primary)] transition-colors text-center"
          >
            <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-[var(--brand-primary)]" />
            <p className="font-medium">Privacy Requests</p>
          </Link>
        </div>
      </div>
    </div>
  );
}


// Wrap with error boundary
export default function AdminDashboardContent() {
  return (
    <DashboardErrorBoundary role="admin">
      <AdminDashboardContentInner />
    </DashboardErrorBoundary>
  );
}
