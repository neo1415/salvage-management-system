'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { CreditCard, CheckCircle, Clock, AlertCircle, DollarSign, Wallet } from 'lucide-react';
import Link from 'next/link';
import { DashboardErrorBoundary } from '@/components/ui/error-boundary';

interface DashboardStats {
  totalPayments: number;
  pendingVerification: number;
  verified: number;
  rejected: number;
  totalAmount: number;
  escrowWalletPayments: number;
  escrowWalletPercentage: number;
  paymentMethodBreakdown: {
    paystack: number;
    bank_transfer: number;
    escrow_wallet: number;
  };
}

function FinanceDashboardContentInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
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

    // Only check role after session is authenticated
    if (status === 'authenticated') {
      const userRole = session?.user?.role;
      
      if (userRole !== 'finance_officer') {
        // Redirect to their correct dashboard
        if (userRole === 'vendor') router.push('/vendor/dashboard');
        else if (userRole === 'salvage_manager') router.push('/manager/dashboard');
        else if (userRole === 'claims_adjuster') router.push('/adjuster/dashboard');
        else if (userRole === 'system_admin' || userRole === 'admin') router.push('/admin/dashboard');
        else router.push('/login');
        return;
      }

      // User has correct role, fetch dashboard data
      fetchDashboardStats();
    }
  }, [session, status, router]);

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/dashboard/finance');
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      // Set default values on error
      setStats({
        totalPayments: 0,
        pendingVerification: 0,
        verified: 0,
        rejected: 0,
        totalAmount: 0,
        escrowWalletPayments: 0,
        escrowWalletPercentage: 0,
        paymentMethodBreakdown: {
          paystack: 0,
          bank_transfer: 0,
          escrow_wallet: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  if (status === 'loading' || loading) {
    return null; // Skeleton will be shown by parent
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Finance Dashboard</h1>
        <p className="text-gray-600 mt-2">Payment verification and management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Payments</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.totalPayments || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <CreditCard className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.pendingVerification || 0}
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
              <p className="text-sm text-gray-600">Verified</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.verified || 0}
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

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(stats?.totalAmount || 0)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Escrow Wallet Payments Stat Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#800020] bg-opacity-10 rounded-lg">
              <Wallet className="w-8 h-8 text-[#800020]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Escrow Wallet Payments</h2>
              <p className="text-sm text-gray-600">Pre-funded vendor wallet payments</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">
              {stats?.escrowWalletPayments || 0}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {stats?.escrowWalletPercentage || 0}% of total
            </p>
          </div>
        </div>
      </div>

      {/* Payment Methods Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Methods Breakdown</h2>
        <div className="space-y-4">
          {/* Escrow Wallet */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Wallet className="w-5 h-5 text-[#800020]" />
                <span className="font-medium text-gray-900">Escrow Wallet</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {stats?.paymentMethodBreakdown?.escrow_wallet || 0} ({stats?.totalPayments ? Math.round(((stats?.paymentMethodBreakdown?.escrow_wallet || 0) / stats.totalPayments) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-[#800020] h-3 rounded-full transition-all duration-500"
                style={{ 
                  width: `${stats?.totalPayments ? ((stats?.paymentMethodBreakdown?.escrow_wallet || 0) / stats.totalPayments) * 100 : 0}%` 
                }}
              />
            </div>
          </div>

          {/* Paystack */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-900">Paystack</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {stats?.paymentMethodBreakdown?.paystack || 0} ({stats?.totalPayments ? Math.round(((stats?.paymentMethodBreakdown?.paystack || 0) / stats.totalPayments) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ 
                  width: `${stats?.totalPayments ? ((stats?.paymentMethodBreakdown?.paystack || 0) / stats.totalPayments) * 100 : 0}%` 
                }}
              />
            </div>
          </div>

          {/* Bank Transfer */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="font-medium text-gray-900">Bank Transfer</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {stats?.paymentMethodBreakdown?.bank_transfer || 0} ({stats?.totalPayments ? Math.round(((stats?.paymentMethodBreakdown?.bank_transfer || 0) / stats.totalPayments) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-green-600 h-3 rounded-full transition-all duration-500"
                style={{ 
                  width: `${stats?.totalPayments ? ((stats?.paymentMethodBreakdown?.bank_transfer || 0) / stats.totalPayments) * 100 : 0}%` 
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/finance/payments"
            className="p-6 border-2 border-gray-200 rounded-lg hover:border-[#800020] transition-colors text-center"
          >
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-[#800020]" />
            <p className="font-medium text-lg">View All Payments</p>
            <p className="text-sm text-gray-600 mt-1">Manage payment verifications</p>
          </Link>

          <button
            onClick={fetchDashboardStats}
            className="p-6 border-2 border-gray-200 rounded-lg hover:border-[#800020] transition-colors text-center"
          >
            <Clock className="w-12 h-12 mx-auto mb-3 text-[#800020]" />
            <p className="font-medium text-lg">Pending Verifications</p>
            <p className="text-sm text-gray-600 mt-1">{stats?.pendingVerification || 0} awaiting review</p>
          </button>
        </div>
      </div>
    </div>
  );
}


// Wrap with error boundary
export default function FinanceDashboardContent() {
  return (
    <DashboardErrorBoundary role="finance">
      <FinanceDashboardContentInner />
    </DashboardErrorBoundary>
  );
}
