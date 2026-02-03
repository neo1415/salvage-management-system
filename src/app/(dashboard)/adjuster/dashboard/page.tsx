'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  totalCases: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
}

export default function AdjusterDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (session?.user?.role !== 'claims_adjuster') {
      router.push('/vendor/dashboard');
      return;
    }

    fetchDashboardStats();
  }, [session, status, router]);

  const fetchDashboardStats = async () => {
    try {
      // TODO: Create API endpoint for adjuster dashboard stats
      setStats({
        totalCases: 45,
        pendingApproval: 8,
        approved: 32,
        rejected: 5,
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Claims Adjuster Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage salvage cases and submissions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Cases</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.totalCases || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.pendingApproval || 0}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.approved || 0}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.rejected || 0}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/adjuster/cases/new"
            className="p-6 border-2 border-gray-200 rounded-lg hover:border-[#800020] transition-colors text-center"
          >
            <FileText className="w-12 h-12 mx-auto mb-3 text-[#800020]" />
            <p className="font-medium text-lg">Create New Case</p>
            <p className="text-sm text-gray-600 mt-1">Submit a new salvage case</p>
          </Link>

          <button
            onClick={fetchDashboardStats}
            className="p-6 border-2 border-gray-200 rounded-lg hover:border-[#800020] transition-colors text-center"
          >
            <Clock className="w-12 h-12 mx-auto mb-3 text-[#800020]" />
            <p className="font-medium text-lg">View Pending Cases</p>
            <p className="text-sm text-gray-600 mt-1">{stats?.pendingApproval || 0} awaiting approval</p>
          </button>
        </div>
      </div>
    </div>
  );
}
