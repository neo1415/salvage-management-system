'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Users,
  AlertTriangle,
  ClipboardList,
  Activity,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { AppLink } from '@/components/navigation/app-link';
import { DashboardErrorBoundary } from '@/components/ui/error-boundary';
import { DataLoadingState } from '@/components/ui/loading-states';
import { StatCard, StatGrid } from '@/components/ui/stat-card';
import { useAppRouter } from '@/hooks/use-app-router';

interface DashboardStats {
  totalUsers: number;
  activeVendors: number;
  pendingFraudAlerts: number;
  todayAuditLogs: number;
  userGrowth: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  pendingPickupConfirmations: number;
  overdueSignedUnpaid: number;
  healthReasons: string[];
}

function mobileAdminStatSpan(value: number, subtitle?: string): string {
  const valueText = String(value);
  if (valueText.length > 5) return 'col-span-3';
  if (subtitle && subtitle.length > 22) return 'col-span-3';
  return 'col-span-1';
}

function AdminDashboardContentInner() {
  const { data: session, status } = useSession();
  const router = useAppRouter();
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

      <div className="space-y-3 md:hidden">
        <StatCard
          href="/admin/users"
          title="Total Users"
          value={stats.totalUsers || 0}
          subtitle={`+${stats.userGrowth || 0}% this month`}
          icon={
            <div className="p-2.5 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          }
        />
        <div className="grid grid-cols-3 gap-2 min-w-0">
          <StatCard
            href="/admin/users"
            title="Active Vendors"
            value={stats.activeVendors || 0}
            subtitle="Verified & active"
            className={`!p-3 ${mobileAdminStatSpan(stats.activeVendors || 0, 'Verified & active')}`}
            icon={
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
            }
          />
          <StatCard
            href="/admin/fraud"
            title="Fraud Alerts"
            value={stats.pendingFraudAlerts || 0}
            subtitle={stats.pendingFraudAlerts ? 'Requires attention' : 'All clear'}
            valueClassName={stats.pendingFraudAlerts ? 'text-red-700' : undefined}
            className={`!p-3 ${mobileAdminStatSpan(
              stats.pendingFraudAlerts || 0,
              stats.pendingFraudAlerts ? 'Requires attention' : 'All clear'
            )}`}
            icon={
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
            }
          />
          <StatCard
            href="/admin/audit-logs"
            title="Today's Logs"
            value={stats.todayAuditLogs || 0}
            subtitle="System activities"
            className={`!p-3 ${mobileAdminStatSpan(stats.todayAuditLogs || 0, 'System activities')}`}
            icon={
              <div className="p-2 bg-purple-100 rounded-lg">
                <ClipboardList className="w-5 h-5 text-purple-600" />
              </div>
            }
          />
        </div>
      </div>

      <StatGrid minCol={200} className="hidden md:grid">
        <StatCard
          href="/admin/users"
          title="Total Users"
          value={stats.totalUsers || 0}
          subtitle={`+${stats.userGrowth || 0}% this month`}
          icon={
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          }
        />
        <StatCard
          href="/admin/users"
          title="Active Vendors"
          value={stats.activeVendors || 0}
          subtitle="Verified & active"
          icon={
            <div className="p-3 bg-green-100 rounded-lg">
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          }
        />
        <StatCard
          href="/admin/fraud"
          title="Fraud Alerts"
          value={stats.pendingFraudAlerts || 0}
          subtitle={stats.pendingFraudAlerts ? 'Requires attention' : 'All clear'}
          valueClassName={stats.pendingFraudAlerts ? 'text-red-700' : undefined}
          icon={
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          }
        />
        <StatCard
          href="/admin/audit-logs"
          title="Today's Logs"
          value={stats.todayAuditLogs || 0}
          subtitle="System activities"
          icon={
            <div className="p-3 bg-purple-100 rounded-lg">
              <ClipboardList className="w-8 h-8 text-purple-600" />
            </div>
          }
        />
      </StatGrid>

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
            <AppLink
              href="/admin/pickups"
              className="px-6 py-3 bg-[var(--brand-primary)] text-white rounded-lg font-medium hover:bg-[var(--brand-primary-hover)] transition-colors"
            >
              Review Pickups
            </AppLink>
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

      {/*
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col gap-1 mb-5">
          <h2 className="text-xl font-bold text-gray-900">Operations Control</h2>
          <p className="text-sm text-gray-600">
            Cross-functional queues that can block recovery, settlement, or release.
          </p>
        </div>

        <StatGrid minCol={160}>
          <StatTile
            href="/admin/fraud"
            title="Fraud queue"
            value={stats.pendingFraudAlerts}
            subtitle="Pending alerts to review"
          />
          <StatTile
            href="/admin/pickups"
            title="Pickup queue"
            value={stats.pendingPickupConfirmations}
            subtitle="Paid assets awaiting confirmation"
          />
          <StatTile
            href="/finance/payments"
            title="Payment exceptions"
            value={stats.overdueSignedUnpaid}
            subtitle="Signed but unpaid past deadline"
          />
        </StatGrid>
      </div>
      */}

      <div className="hidden md:block bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <AppLink
            href="/admin/users"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[var(--brand-primary)] transition-colors text-center"
          >
            <Users className="w-8 h-8 mx-auto mb-2 text-[var(--brand-primary)]" />
            <p className="font-medium">Manage Users</p>
          </AppLink>

          <AppLink
            href="/admin/fraud"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[var(--brand-primary)] transition-colors text-center"
          >
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-[var(--brand-primary)]" />
            <p className="font-medium">Review Fraud</p>
          </AppLink>

          <AppLink
            href="/manager/vendors?tier=tier2&status=pending"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[var(--brand-primary)] transition-colors text-center"
          >
            <Users className="w-8 h-8 mx-auto mb-2 text-[var(--brand-primary)]" />
            <p className="font-medium">KYC Approvals</p>
          </AppLink>

          <AppLink
            href="/admin/audit-logs"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[var(--brand-primary)] transition-colors text-center"
          >
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-[var(--brand-primary)]" />
            <p className="font-medium">View Logs</p>
          </AppLink>

          <AppLink
            href="/admin/privacy-requests"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[var(--brand-primary)] transition-colors text-center"
          >
            <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-[var(--brand-primary)]" />
            <p className="font-medium">Privacy Requests</p>
          </AppLink>
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
