'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppRouter } from '@/hooks/use-app-router';
import { StatCard, StatTile } from '@/components/ui/stat-card';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth/use-auth';
import { DashboardErrorBoundary } from '@/components/ui/error-boundary';
import { PageLoadingSkeleton } from '@/components/ui/loading-states';
import { usePublicBusinessPolicy } from '@/hooks/use-public-business-policy';
import { getEnabledCaseAssetTypeOptions } from '@/features/business-policy/case-asset-type-options';

// Dynamic import for Recharts to reduce initial bundle size
const LineChart = dynamic(
  () => import('recharts').then(mod => mod.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import('recharts').then(mod => mod.Line),
  { ssr: false }
);
const BarChart = dynamic(
  () => import('recharts').then(mod => mod.BarChart),
  { ssr: false }
);
const Bar = dynamic(
  () => import('recharts').then(mod => mod.Bar),
  { ssr: false }
);
const PieChart = dynamic(
  () => import('recharts').then(mod => mod.PieChart),
  { ssr: false }
);
const Pie = dynamic(
  () => import('recharts').then(mod => mod.Pie),
  { ssr: false }
);
const XAxis = dynamic(
  () => import('recharts').then(mod => mod.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import('recharts').then(mod => mod.YAxis),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import('recharts').then(mod => mod.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import('recharts').then(mod => mod.Tooltip),
  { ssr: false }
);
const Legend = dynamic(
  () => import('recharts').then(mod => mod.Legend),
  { ssr: false }
);
const ResponsiveContainer = dynamic(
  () => import('recharts').then(mod => mod.ResponsiveContainer),
  { ssr: false }
);

interface DashboardKPIs {
  activeAuctions: number;
  totalBidsToday: number;
  averageRecoveryRate: number;
  casesPendingApproval: number;
}

interface RecoveryRateTrend {
  date: string;
  recoveryRate: number;
  totalCases: number;
}

interface TopVendor {
  vendorId: string;
  vendorName: string;
  totalBids: number;
  totalWins: number;
  totalSpent: number;
}

interface PaymentStatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

interface ControlTowerException {
  key: string;
  label: string;
  count: number;
  severity: 'low' | 'medium' | 'high';
}

interface RecoveryControlTower {
  claimsValue: number;
  expectedRecovery: number;
  verifiedRecovery: number;
  recoveryRate: number;
  expectedRecoveryGap: number;
  awaitingPickup: number;
  averageDaysToAssessment: number | null;
  averageDaysToPayment: number | null;
  averageDaysToPickup: number | null;
  exceptions: ControlTowerException[];
}

interface DashboardData {
  kpis: DashboardKPIs;
  controlTower?: RecoveryControlTower;
  charts: {
    recoveryRateTrend: RecoveryRateTrend[];
    topVendors: TopVendor[];
    paymentStatusBreakdown: PaymentStatusBreakdown[];
  };
  filterOptions?: {
    branches: string[];
    brokers: string[];
  };
  lastUpdated: string;
}

// Colors for charts
const COLORS = {
  primary: 'var(--brand-primary)',
  secondary: 'var(--brand-accent)',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
};

function formatNaira(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDays(value: number | null): string {
  if (value === null) return 'N/A';
  if (value === 0) return '0h';
  if (value < 1) {
    const hours = value * 24;
    return hours < 1 ? '<1h' : `${Math.round(hours)}h`;
  }
  return `${value.toFixed(1)}d`;
}

function ManagerDashboardContentInner() {
  const router = useAppRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const dashboardDataRef = useRef<DashboardData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [dateRange, setDateRange] = useState('30');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [assetType, setAssetType] = useState<string>('');
  const [branchName, setBranchName] = useState('');
  const [brokerQuery, setBrokerQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState<{ branches: string[]; brokers: string[] }>({
    branches: [],
    brokers: [],
  });

  const { policy: publicPolicy } = usePublicBusinessPolicy();
  const enabledAssetTypes = useMemo(
    () => getEnabledCaseAssetTypeOptions(publicPolicy?.cases.enabledAssetTypes),
    [publicPolicy]
  );

  // Auto-refresh interval (30 seconds)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    const showFullPageLoader = dashboardDataRef.current == null;
    try {
      if (showFullPageLoader) {
        setIsLoadingData(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      const params = new URLSearchParams();
      params.append('dateRange', dateRange);
      if (dateRange === 'custom') {
        if (customStartDate) params.append('startDate', customStartDate);
        if (customEndDate) params.append('endDate', customEndDate);
      }
      if (assetType) params.append('assetType', assetType);
      if (branchName) params.append('branchName', branchName);
      if (brokerQuery.trim()) params.append('brokerQuery', brokerQuery.trim());

      const response = await fetch(`/api/dashboard/manager?${params.toString()}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        if (response.status === 403) {
          setError('Access denied. Salvage Manager role required.');
          return;
        }
        throw new Error('Failed to fetch dashboard data');
      }

      const data: DashboardData = await response.json();
      dashboardDataRef.current = data;
      setDashboardData(data);
      if (data.filterOptions) {
        setFilterOptions(data.filterOptions);
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoadingData(false);
      setIsRefreshing(false);
    }
  }, [dateRange, customStartDate, customEndDate, assetType, branchName, brokerQuery, router]);

  // Initial fetch and auth check
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.push('/login');
      return;
    }

    if (isAuthenticated && user?.role !== 'salvage_manager') {
      setError('Access denied. Salvage Manager role required.');
      setIsLoadingData(false);
      return;
    }

    if (isAuthenticated && user) {
      fetchDashboardData();
    }
  }, [isAuthenticated, isLoading, user, router, fetchDashboardData]);

  // Refresh dashboard when page becomes visible (e.g., returning from another page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && user) {
        fetchDashboardData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, user, fetchDashboardData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, user, fetchDashboardData]);

  // Handle filter changes
  const handleDateRangeChange = (newRange: string) => {
    setDateRange(newRange);
  };

  const handleBrokerQueryChange = (value: string) => {
    setBrokerQuery(value);
  };

  const dateRangeLabel =
    dateRange === 'all'
      ? 'all time'
      : dateRange === 'custom'
        ? 'selected dates'
        : `last ${dateRange} days`;

  // Handle chart drill-down with proper Recharts types
  const handleRecoveryTrendClick = (data: unknown) => {
    const chartData = data as { activePayload?: Array<{ payload: RecoveryRateTrend }> };
    if (chartData && chartData.activePayload && chartData.activePayload[0]) {
      // Future enhancement: Navigate to detailed view for this date
      // const date = chartData.activePayload[0].payload.date;
      // router.push(`/manager/reports/recovery?date=${date}`);
    }
  };

  const handleVendorClick = (data: TopVendor) => {
    if (data && data.vendorId) {
      // Future enhancement: Navigate to vendor details
      // router.push(`/manager/vendors/${data.vendorId}`);
    }
  };

  const handlePaymentStatusClick = (data: PaymentStatusBreakdown) => {
    if (data && data.status) {
      // Future enhancement: Navigate to payments filtered by status
      // router.push(`/finance/payments?status=${data.status}`);
    }
  };

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2 bg-[var(--brand-primary)] text-white font-semibold rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || isLoadingData || !dashboardData) {
    return <PageLoadingSkeleton />;
  }

  const { kpis, charts, controlTower } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Manager Dashboard
              </h1>
              <p className="text-gray-600">
                Real-time KPIs and performance metrics
              </p>
            </div>
            
            {/* Last Updated */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                Updated {lastRefresh.toLocaleTimeString()}
                {isRefreshing && ' · Refreshing…'}
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 mb-1">
                  Date range
                </label>
                <select
                  id="dateRange"
                  value={dateRange}
                  onChange={(e) => handleDateRangeChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="60">Last 60 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="all">All time</option>
                  <option value="custom">Custom range</option>
                </select>
              </div>

              <div>
                <label htmlFor="assetType" className="block text-sm font-medium text-gray-700 mb-1">
                  Asset type
                </label>
                <select
                  id="assetType"
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                >
                  <option value="">All types</option>
                  {enabledAssetTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="branchName" className="block text-sm font-medium text-gray-700 mb-1">
                  Branch
                </label>
                <select
                  id="branchName"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                >
                  <option value="">All branches</option>
                  {filterOptions.branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="brokerQuery" className="block text-sm font-medium text-gray-700 mb-1">
                  Broker
                </label>
                <input
                  id="brokerQuery"
                  type="search"
                  list="manager-dashboard-brokers"
                  value={brokerQuery}
                  onChange={(e) => handleBrokerQueryChange(e.target.value)}
                  placeholder="Search broker name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                />
                <datalist id="manager-dashboard-brokers">
                  {filterOptions.brokers.map((broker) => (
                    <option key={broker} value={broker} />
                  ))}
                </datalist>
              </div>
            </div>

            {dateRange === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="customStartDate" className="block text-sm font-medium text-gray-700 mb-1">
                    From
                  </label>
                  <input
                    id="customStartDate"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="customEndDate" className="block text-sm font-medium text-gray-700 mb-1">
                    To
                  </label>
                  <input
                    id="customEndDate"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div className="flex items-end justify-between gap-4">
              <p className="text-sm text-gray-500">
                Control tower metrics reflect {dateRangeLabel}.
              </p>
              <button
                onClick={() => {
                  void fetchDashboardData();
                }}
                disabled={isLoadingData || isRefreshing}
                className="px-6 py-2 bg-[var(--brand-primary)] text-white font-semibold rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg
                  className={`w-5 h-5 ${isLoadingData || isRefreshing ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8 min-w-0 md:[grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          <StatCard
            title="Active Auctions"
            value={kpis.activeAuctions}
            subtitle="Currently live"
            icon={
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            }
          />
          <StatCard
            title="Bids Today"
            value={kpis.totalBidsToday}
            subtitle="Since midnight"
            icon={
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            }
          />
          <StatCard
            title="Recovery Rate"
            value={`${kpis.averageRecoveryRate.toFixed(1)}%`}
            subtitle={`Last ${dateRange} days`}
            icon={
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            }
          />
          <StatCard
            title="Pending Approval"
            value={kpis.casesPendingApproval}
            subtitle="Awaiting review"
            icon={
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            }
          />
        </div>

        {controlTower && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Recovery Control Tower</h2>
                <p className="text-sm text-gray-600">
                  Claims value, verified recovery, pickup exposure, and operational exceptions.
                </p>
              </div>
              <button
                onClick={() => router.push('/manager/reports')}
                className="text-sm font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)]"
              >
                Open reports
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 min-w-0 md:[grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
              <StatTile
                title="Claims value"
                value={formatNaira(controlTower.claimsValue)}
                subtitle="Case market value in range"
              />
              <StatTile
                title="Verified recovery"
                value={formatNaira(controlTower.verifiedRecovery)}
                subtitle={`${controlTower.recoveryRate.toFixed(1)}% of claims value in range`}
                valueClassName="text-emerald-700"
              />
              <StatTile
                title="Reserve gap"
                value={formatNaira(controlTower.expectedRecoveryGap)}
                subtitle="Reserve target less verified recovery"
                valueClassName="text-amber-700"
              />
              <StatTile
                title="Awaiting pickup"
                value={controlTower.awaitingPickup}
                subtitle="Paid with pickup authorization, not yet released"
              />
              <StatTile
                title="Avg cycle"
                value={`${formatDays(controlTower.averageDaysToPayment)} payment`}
                subtitle={`${formatDays(controlTower.averageDaysToPickup)} pickup`}
                className="col-span-2 md:col-span-1"
              />
            </div>

            <div className="mt-5 grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {controlTower.exceptions.map((exception) => (
                <div
                  key={exception.key}
                  className={`rounded-lg border px-4 py-3 ${
                    exception.count === 0
                      ? 'border-emerald-200 bg-emerald-50'
                      : exception.severity === 'high'
                        ? 'border-red-200 bg-red-50'
                        : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-800">{exception.label}</p>
                    <span className="text-xl font-bold text-gray-900">{exception.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recovery Rate Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Recovery Rate Trend</h2>
            <p className="text-sm text-gray-600 mb-4">
              Tap any point to drill down into details
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={charts.recoveryRateTrend}
                onClick={handleRecoveryTrendClick}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  label={{ value: 'Recovery Rate (%)', angle: -90, position: 'insideLeft' }}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  content={(props) => {
                    const { active, payload } = props as unknown as {
                      active?: boolean;
                      payload?: Array<{ value: number; name: string }>;
                    };
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0];
                    if (!data) return null;
                    return (
                      <div className="bg-white p-2 border border-gray-300 rounded shadow">
                        <p className="font-semibold">Recovery Rate: {data.value}%</p>
                      </div>
                    );
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="recoveryRate" 
                  stroke={COLORS.primary} 
                  strokeWidth={2}
                  dot={{ fill: COLORS.primary, r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Recovery Rate"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Payment Status Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Status</h2>
            <p className="text-sm text-gray-600 mb-4">
              Tap any segment to view details
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={charts.paymentStatusBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: unknown) => {
                    const data = entry as PaymentStatusBreakdown & { status: string; percentage: number };
                    return `${data.status}: ${data.percentage}%`;
                  }}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                  onClick={(_data: unknown, index: number) => {
                    const entry = charts.paymentStatusBreakdown[index];
                    if (entry) handlePaymentStatusClick(entry);
                  }}
                  className="cursor-pointer"
                />
                <Tooltip 
                  content={(props) => {
                    const { active, payload } = props as unknown as {
                      active?: boolean;
                      payload?: Array<{ payload: PaymentStatusBreakdown }>;
                    };
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0]?.payload;
                    if (!data) return null;
                    return (
                      <div className="bg-white p-2 border border-gray-300 rounded shadow">
                        <p className="font-semibold">{data.status}</p>
                        <p>{data.count} ({data.percentage}%)</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Vendors Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Top 5 Vendors by Volume</h2>
          <p className="text-sm text-gray-600 mb-4">
            Tap any bar to view vendor details
          </p>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={charts.topVendors}
              onClick={(data: unknown) => {
                const chartData = data as { activePayload?: Array<{ payload: TopVendor }> };
                if (chartData && chartData.activePayload && chartData.activePayload[0]) {
                  const vendor = chartData.activePayload[0].payload;
                  handleVendorClick(vendor);
                }
              }}
              className="cursor-pointer"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="vendorName" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis 
                label={{ value: 'Total Bids', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                content={(props) => {
                  const { active, payload } = props as unknown as {
                    active?: boolean;
                    payload?: Array<{ payload: TopVendor }>;
                  };
                  if (!active || !payload || !payload.length) return null;
                  const vendor = payload[0]?.payload;
                  if (!vendor) return null;
                  return (
                    <div className="bg-white p-2 border border-gray-300 rounded shadow">
                      <p className="font-semibold">{vendor.vendorName}</p>
                      <p>Total Bids: {vendor.totalBids}</p>
                      <p>Total Wins: {vendor.totalWins}</p>
                      <p>Total Spent: ₦{Number(vendor.totalSpent).toLocaleString()}</p>
                    </div>
                  );
                }}
              />
              <Legend />
              <Bar dataKey="totalBids" fill={COLORS.primary} name="Total Bids" />
              <Bar dataKey="totalWins" fill={COLORS.secondary} name="Total Wins" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => router.push('/manager/approvals')}
              className="px-6 py-3 bg-[var(--brand-primary)] text-white font-semibold rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Review Cases
            </button>
            <button
              onClick={() => router.push('/manager/vendors')}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Manage Vendors
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// Wrap with error boundary
export default function ManagerDashboardContent() {
  return (
    <DashboardErrorBoundary role="manager">
      <ManagerDashboardContentInner />
    </DashboardErrorBoundary>
  );
}
