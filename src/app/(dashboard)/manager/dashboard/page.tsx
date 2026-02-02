'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

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

interface DashboardData {
  kpis: DashboardKPIs;
  charts: {
    recoveryRateTrend: RecoveryRateTrend[];
    topVendors: TopVendor[];
    paymentStatusBreakdown: PaymentStatusBreakdown[];
  };
  lastUpdated: string;
}

// Colors for charts
const COLORS = {
  primary: '#800020', // Burgundy
  secondary: '#FFD700', // Gold
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: COLORS.warning,
  verified: COLORS.success,
  rejected: COLORS.danger,
  overdue: '#DC2626',
};

export default function ManagerDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [dateRange, setDateRange] = useState('30'); // Default 30 days
  const [assetType, setAssetType] = useState<string>(''); // Empty = all

  // Auto-refresh interval (30 seconds)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      params.append('dateRange', dateRange);
      if (assetType) {
        params.append('assetType', assetType);
      }

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
      setDashboardData(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoadingData(false);
    }
  }, [dateRange, assetType, router]);

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
    setIsLoadingData(true);
  };

  const handleAssetTypeChange = (newType: string) => {
    setAssetType(newType);
    setIsLoadingData(true);
  };

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

  // Loading state
  if (isLoading || (isLoadingData && !dashboardData)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

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
            className="px-6 py-2 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const { kpis, charts } = dashboardData;

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
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            {/* Date Range Filter */}
            <div className="flex-1">
              <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <select
                id="dateRange"
                value={dateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="60">Last 60 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>

            {/* Asset Type Filter */}
            <div className="flex-1">
              <label htmlFor="assetType" className="block text-sm font-medium text-gray-700 mb-1">
                Asset Type
              </label>
              <select
                id="assetType"
                value={assetType}
                onChange={(e) => handleAssetTypeChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="vehicle">Vehicle</option>
                <option value="property">Property</option>
                <option value="electronics">Electronics</option>
              </select>
            </div>

            {/* Refresh Button */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setIsLoadingData(true);
                  fetchDashboardData();
                }}
                disabled={isLoadingData}
                className="px-6 py-2 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg 
                  className={`w-5 h-5 ${isLoadingData ? 'animate-spin' : ''}`} 
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

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          {/* Active Auctions */}
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Active Auctions</h3>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{kpis.activeAuctions}</p>
            <p className="text-sm text-gray-600 mt-1">Currently live</p>
          </div>

          {/* Total Bids Today */}
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Bids Today</h3>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{kpis.totalBidsToday}</p>
            <p className="text-sm text-gray-600 mt-1">Since midnight</p>
          </div>

          {/* Average Recovery Rate */}
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Recovery Rate</h3>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{kpis.averageRecoveryRate.toFixed(1)}%</p>
            <p className="text-sm text-gray-600 mt-1">Last {dateRange} days</p>
          </div>

          {/* Cases Pending Approval */}
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Pending Approval</h3>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{kpis.casesPendingApproval}</p>
            <p className="text-sm text-gray-600 mt-1">Awaiting review</p>
          </div>
        </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => router.push('/manager/approvals')}
              className="px-6 py-3 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors flex items-center justify-center gap-2"
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
            <button
              onClick={() => router.push('/vendor/auctions')}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              View Auctions
            </button>
            <button
              onClick={() => router.push('/finance/payments')}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              View Payments
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
