'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { CreditCard, CheckCircle, Clock, AlertCircle, Wallet, Banknote, Filter } from 'lucide-react';
import { AppLink } from '@/components/navigation/app-link';
import { DashboardErrorBoundary } from '@/components/ui/error-boundary';
import { DataLoadingState } from '@/components/ui/loading-states';
import { StatCard, StatGrid, StatTile } from '@/components/ui/stat-card';
import { useAppRouter } from '@/hooks/use-app-router';
import { formatNgnAmount } from '@/lib/utils/format-ngn';

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
    pickupPriceAdjustments: number;
    paidVsSettledDelta: number;
  };
}

function FinanceDashboardContentInner() {
  const { data: session, status } = useSession();
  const router = useAppRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const statsRef = useRef<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [brokerFilter, setBrokerFilter] = useState('');
  const [insuranceClassFilter, setInsuranceClassFilter] = useState('');
  const [filterOptions, setFilterOptions] = useState<{
    branches: string[];
    brokers: string[];
    insuranceClasses: string[];
  }>({ branches: [], brokers: [], insuranceClasses: [] });

  const buildFilterParams = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (branchFilter) params.set('branch', branchFilter);
    if (brokerFilter) params.set('broker', brokerFilter);
    if (insuranceClassFilter) params.set('insuranceClass', insuranceClassFilter);
    return params;
  };

  const hasActiveFilters =
    dateFrom || dateTo || branchFilter || brokerFilter || insuranceClassFilter;

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setBranchFilter('');
    setBrokerFilter('');
    setInsuranceClassFilter('');
  };

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
  }, [session, status, router.push, dateFrom, dateTo, branchFilter, brokerFilter, insuranceClassFilter]);

  const fetchDashboardStats = async () => {
    const showFullPageLoader = statsRef.current == null;
    try {
      if (showFullPageLoader) {
        setLoading(true);
      }
      const params = buildFilterParams();
      const query = params.toString();
      const response = await fetch(
        query ? `/api/dashboard/finance?${query}` : '/api/dashboard/finance'
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }

      const data = await response.json();
      const { filterOptions: options, ...dashboardStats } = data;
      statsRef.current = dashboardStats as DashboardStats;
      setStats(dashboardStats as DashboardStats);
      if (options) {
        setFilterOptions(options);
      }
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
          pickupPriceAdjustments: 0,
          paidVsSettledDelta: 0,
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

  const formatCurrency = (amount: number) =>
    formatNgnAmount(amount, { decimals: 0, empty: 'NGN 0' });

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

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--brand-primary)]" />
            Filter dashboard
          </h2>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] font-medium"
            >
              Clear filters
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label htmlFor="dashboard-date-from" className="block text-xs font-medium text-gray-700 mb-1">
              From date
            </label>
            <input
              type="date"
              id="dashboard-date-from"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="dashboard-date-to" className="block text-xs font-medium text-gray-700 mb-1">
              To date
            </label>
            <input
              type="date"
              id="dashboard-date-to"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="dashboard-branch" className="block text-xs font-medium text-gray-700 mb-1">
              Branch
            </label>
            <select
              id="dashboard-branch"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
            >
              <option value="">All branches</option>
              {filterOptions.branches.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dashboard-broker" className="block text-xs font-medium text-gray-700 mb-1">
              Broker / Agency
            </label>
            <select
              id="dashboard-broker"
              value={brokerFilter}
              onChange={(e) => setBrokerFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
            >
              <option value="">All brokers</option>
              {filterOptions.brokers.map((broker) => (
                <option key={broker} value={broker}>{broker}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dashboard-insurance-class" className="block text-xs font-medium text-gray-700 mb-1">
              Insurance class
            </label>
            <select
              id="dashboard-insurance-class"
              value={insuranceClassFilter}
              onChange={(e) => setInsuranceClassFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
            >
              <option value="">All classes</option>
              {filterOptions.insuranceClasses.map((insuranceClass) => (
                <option key={insuranceClass} value={insuranceClass}>{insuranceClass}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <StatGrid className="lg:grid-cols-5" minCol={180}>
        <StatCard
          title="Total Payments"
          value={stats?.totalPayments || 0}
          icon={
            <div className="p-3 bg-blue-100 rounded-lg">
              <CreditCard className="w-8 h-8 text-blue-600" />
            </div>
          }
        />
        <StatCard
          title="Pending"
          value={stats?.pendingVerification || 0}
          icon={
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          }
        />
        <StatCard
          title="Verified"
          value={stats?.verified || 0}
          icon={
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          }
        />
        <StatCard
          title="Rejected"
          value={stats?.rejected || 0}
          icon={
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          }
        />
        <StatCard
          title="Verified Receipts"
          value={formatCurrency(stats?.totalAmount || 0)}
          subtitle="Cash collected (verified payments)"
          icon={
            <div className="p-3 bg-purple-100 rounded-lg">
              <Banknote className="w-8 h-8 text-purple-600" />
            </div>
          }
        />
      </StatGrid>

      <StatCard
        title="Escrow Wallet Payments"
        value={stats?.escrowWalletPayments || 0}
        subtitle={`${stats?.escrowWalletPercentage || 0}% of total — pre-funded vendor wallet payments`}
        icon={
          <div className="p-3 bg-[var(--brand-primary)] bg-opacity-10 rounded-lg">
            <Wallet className="w-8 h-8 text-[var(--brand-primary)]" />
          </div>
        }
      />

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col gap-1 mb-5">
          <h2 className="text-xl font-bold text-gray-900">Settlement Control</h2>
          <p className="text-sm text-gray-600">
            Winner auction recovery, payment exceptions, and pickup handoff exposure.
          </p>
        </div>

        <StatGrid minCol={140}>
          <StatTile
            title="Verified recovery"
            value={formatCurrency(stats.settlementControl.verifiedRecovery)}
            subtitle="Winner payments confirmed"
            valueClassName="text-emerald-700"
          />
          <StatTile
            title="Finance queue"
            value={stats.settlementControl.pendingFinanceReview}
            subtitle="Payments needing review"
          />
          <StatTile
            title="Paid awaiting pickup"
            value={stats.settlementControl.paidAwaitingPickup}
            subtitle="Assets still in handoff"
            valueClassName="text-amber-700"
          />
          <StatTile
            title="Overdue unpaid"
            value={stats.settlementControl.overdueSignedUnpaid}
            subtitle="Signed documents past payment date"
            valueClassName="text-red-700"
          />
          <StatTile
            title="Frozen escrow"
            value={stats.settlementControl.frozenEscrowPayments}
            subtitle="Wallet deposits held"
          />
          <StatTile
            title="Avg payment cycle"
            value={formatDays(stats.settlementControl.averageDaysToPayment)}
            subtitle="Auction close to verified payment"
          />
          {stats.settlementControl.pickupPriceAdjustments > 0 ? (
            <StatTile
              title="Pickup adjustments"
              value={stats.settlementControl.pickupPriceAdjustments}
              subtitle={
                stats.settlementControl.paidVsSettledDelta !== 0
                  ? `${formatCurrency(stats.settlementControl.paidVsSettledDelta)} collected vs settled gap`
                  : 'Final sale amount updated after pickup'
              }
              valueClassName="text-blue-700"
            />
          ) : null}
        </StatGrid>
        {stats.settlementControl.pickupPriceAdjustments > 0 &&
          stats.settlementControl.paidVsSettledDelta !== 0 ? (
          <p className="text-sm text-gray-600 mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            Verified receipts total includes amounts actually collected. Recovery metrics use the
            final settled amount when pickup price was adjusted.
            {stats.settlementControl.paidVsSettledDelta > 0
              ? ` Net gap: ${formatCurrency(stats.settlementControl.paidVsSettledDelta)} more collected than settled recovery.`
              : ''}
            See{' '}
            <AppLink href="/finance/reconciliation" className="text-[var(--brand-primary)] underline-offset-2 hover:underline">
              reconciliation
            </AppLink>{' '}
            for case-level detail.
          </p>
        ) : null}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AppLink
            href="/finance/payments"
            className="p-6 border-2 border-gray-200 rounded-lg hover:border-[var(--brand-primary)] transition-colors text-center min-w-0 overflow-hidden"
          >
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-[var(--brand-primary)]" />
            <p className="font-medium text-lg">View All Payments</p>
            <p className="text-sm text-gray-600 mt-1">Manage payment verifications</p>
          </AppLink>

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
