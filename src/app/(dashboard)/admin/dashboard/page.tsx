'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Users,
  AlertTriangle,
  ClipboardList,
  Activity,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  totalUsers: number;
  activeVendors: number;
  pendingFraudAlerts: number;
  todayAuditLogs: number;
  userGrowth: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (session?.user?.role !== 'system_admin') {
      router.push('/vendor/dashboard');
      return;
    }

    // Fetch dashboard stats
    fetchDashboardStats();
  }, [session, status, router]);

  const fetchDashboardStats = async () => {
    try {
      // TODO: Create API endpoint for admin dashboard stats
      // For now, using mock data
      setStats({
        totalUsers: 156,
        activeVendors: 89,
        pendingFraudAlerts: 3,
        todayAuditLogs: 1247,
        userGrowth: 12.5,
        systemHealth: 'healthy',
      });
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020]"></div>
      </div>
    );
  }

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
          All systems operational. No issues detected.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/users"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[#800020] transition-colors text-center"
          >
            <Users className="w-8 h-8 mx-auto mb-2 text-[#800020]" />
            <p className="font-medium">Manage Users</p>
          </Link>

          <Link
            href="/admin/fraud"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[#800020] transition-colors text-center"
          >
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-[#800020]" />
            <p className="font-medium">Review Fraud</p>
          </Link>

          <Link
            href="/admin/audit-logs"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[#800020] transition-colors text-center"
          >
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-[#800020]" />
            <p className="font-medium">View Logs</p>
          </Link>

          <button
            onClick={fetchDashboardStats}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[#800020] transition-colors text-center"
          >
            <Activity className="w-8 h-8 mx-auto mb-2 text-[#800020]" />
            <p className="font-medium">Refresh Stats</p>
          </button>
        </div>
      </div>
    </div>
  );
}
