'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { CreditCard, CheckCircle, Clock, AlertCircle, Wallet, Banknote } from 'lucide-react';
import Link from 'next/link';
import { DashboardErrorBoundary } from '@/components/ui/error-boundary';
import { DataLoadingState } from '@/components/ui/loading-states';

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
  settlementControl: {
    verifiedRecovery: number;
    pendingFinanceReview: number;
    paidAwaitingPickup: number;
    overdueSignedUnpaid: number;
    frozenEscrowPayments: number;
    averageDaysToPayment: number | null;
  };
}

function FinanceDashboardContentInner() {
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
    const showFullPageLoader = statsRef.current == null;
    try {
      if (showFullPageLoader) {
        setLoading(true);
      }
      const response = await fetch('/api/dashboard/finance');
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }

      const data = await response.json();
      statsRef.current = data;
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      const fallback: DashboardStats = {
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
        settlementControl: {
          verifiedRecovery: 0,
          pendingFinanceReview: 0,
          paidAwaitingPickup: 0,
          overdueSignedUnpaid: 0,
          frozenEscrowPayments: 0,
          averageDaysToPayment: null,
        },
      };
      if (showFullPageLoader) {
        statsRef.current = fallback;
        setStats(fallback);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `\u20A6${amount.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDays = (days: number | null) => {
    if (days === null) return 'No clean data';
    if (days === 0) return '0h';
    if (days < 1) {
      const hours = days * 24;
      return hours < 1 ? '<1h' : `${Math.round(hours)}h`;
    }
    return `${days.toFixed(1)}d`;
  };

  if (status === 'loading' || loading || !stats) {
    return <DataLoadingState label="Finance dashboard" variant="page" />;
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
              <Banknote className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Escrow Wallet Payments Stat Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[var(--brand-primary)] bg-opacity-10 rounded-lg">
              <Wallet className="w-8 h-8 text-[var(--brand-primary)]" />
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

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col gap-1 mb-5">
          <h2 className="text-xl font-bold text-gray-900">Settlement Control</h2>
          <p className="text-sm text-gray-600">
            Winner auction recovery, payment exceptions, and pickup handoff exposure.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Verified recovery</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {formatCurrency(stats.settlementControl.verifiedRecovery)}
            </p>
            <p className="mt-1 text-xs text-gray-500">Winner payments confirmed</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Finance queue</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {stats.settlementControl.pendingFinanceReview}
            </p>
            <p className="mt-1 text-xs text-gray-500">Payments needing review</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paid awaiting pickup</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">
              {stats.settlementControl.paidAwaitingPickup}
            </p>
            <p className="mt-1 text-xs text-gray-500">Assets still in handoff</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Overdue unpaid</p>
            <p className="mt-2 text-2xl font-bold text-red-700">
              {stats.settlementControl.overdueSignedUnpaid}
            </p>
            <p className="mt-1 text-xs text-gray-500">Signed documents past payment date</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Frozen escrow</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {stats.settlementControl.frozenEscrowPayments}
            </p>
            <p className="mt-1 text-xs text-gray-500">Wallet deposits held</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Avg payment cycle</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatDays(stats.settlementControl.averageDaysToPayment)}
            </p>
            <p className="mt-1 text-xs text-gray-500">Auction close to verified payment</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/finance/payments"
            className="p-6 border-2 border-gray-200 rounded-lg hover:border-[var(--brand-primary)] transition-colors text-center"
          >
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-[var(--brand-primary)]" />
            <p className="font-medium text-lg">View All Payments</p>
            <p className="text-sm text-gray-600 mt-1">Manage payment verifications</p>
          </Link>

          <button
            onClick={fetchDashboardStats}
            className="p-6 border-2 border-gray-200 rounded-lg hover:border-[var(--brand-primary)] transition-colors text-center"
          >
            <Clock className="w-12 h-12 mx-auto mb-3 text-[var(--brand-primary)]" />
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
