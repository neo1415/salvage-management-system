'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';

interface PerformanceStats {
  winRate: number;
  avgPaymentTimeHours: number;
  onTimePickupRate: number;
  rating: number;
  leaderboardPosition: number;
  totalVendors: number;
  totalBids: number;
  totalWins: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
}

interface Comparison {
  metric: string;
  currentValue: number;
  previousValue: number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
}

interface VendorDashboardData {
  performanceStats: PerformanceStats;
  badges: Badge[];
  comparisons: Comparison[];
  lastUpdated: string;
}

export default function VendorDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [dashboardData, setDashboardData] = useState<VendorDashboardData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/dashboard/vendor');
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        if (response.status === 403) {
          setError('Access denied. Vendor role required.');
          return;
        }
        throw new Error('Failed to fetch dashboard data');
      }

      const data: VendorDashboardData = await response.json();
      setDashboardData(data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoadingData(false);
    }
  }, [router]);

  // Initial fetch and auth check
  useEffect(() => {
    // Don't redirect if still loading
    if (isLoading) {
      return;
    }

    // Only redirect to login if definitely not authenticated
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Check role only after we know user is authenticated
    if (user && user.role !== 'vendor') {
      setError('Access denied. Vendor role required.');
      setIsLoadingData(false);
      return;
    }

    // Fetch dashboard data only if authenticated and is vendor
    if (user && user.role === 'vendor') {
      fetchDashboardData();
    }
  }, [isAuthenticated, isLoading, user, router, fetchDashboardData]);

  // Get trend indicator
  const getTrendIndicator = (trend: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') {
      return (
        <span className="text-green-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          ↑
        </span>
      );
    } else if (trend === 'down') {
      return (
        <span className="text-red-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          ↓
        </span>
      );
    }
    return <span className="text-gray-500">—</span>;
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

  const { performanceStats, badges, comparisons } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            My Performance Dashboard
          </h1>
          <p className="text-gray-600">
            Track your stats and improve your ranking
          </p>
        </div>

        {/* Performance Stats Cards - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          {/* Win Rate */}
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Win Rate</h3>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{performanceStats.winRate.toFixed(1)}%</p>
            <p className="text-sm text-gray-600 mt-1">
              {performanceStats.totalWins} wins / {performanceStats.totalBids} bids
            </p>
          </div>

          {/* Average Payment Time */}
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Avg Payment Time</h3>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {performanceStats.avgPaymentTimeHours > 0 
                ? `${performanceStats.avgPaymentTimeHours.toFixed(1)}h` 
                : 'N/A'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {performanceStats.avgPaymentTimeHours < 6 && performanceStats.avgPaymentTimeHours > 0
                ? 'Fast payer! 🚀'
                : 'Time to payment'}
            </p>
          </div>

          {/* On-Time Pickup Rate */}
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">On-Time Pickup</h3>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{performanceStats.onTimePickupRate.toFixed(1)}%</p>
            <p className="text-sm text-gray-600 mt-1">Reliability score</p>
          </div>

          {/* Rating */}
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Rating</h3>
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {performanceStats.rating > 0 ? performanceStats.rating.toFixed(1) : 'N/A'}
            </p>
            <p className="text-sm text-gray-600 mt-1 break-words">
              {performanceStats.rating >= 4.5 ? '⭐ Top rated!' : 'Out of 5 stars'}
            </p>
          </div>
        </div>

        {/* Leaderboard Position */}
        <div className="bg-gradient-to-r from-[#800020] to-[#600018] rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold mb-2">Leaderboard Position</h2>
              <p className="text-3xl font-black">
                #{performanceStats.leaderboardPosition}
                <span className="text-lg font-normal ml-2">
                  of {performanceStats.totalVendors} vendors
                </span>
              </p>
              {performanceStats.leaderboardPosition <= 10 && (
                <p className="text-sm mt-2 text-yellow-300">
                  🏆 You're in the Top 10! Keep it up!
                </p>
              )}
            </div>
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Badges Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Your Badges</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`p-4 rounded-lg border-2 text-center transition-all ${
                  badge.earned
                    ? 'border-[#FFD700] bg-yellow-50 shadow-md'
                    : 'border-gray-200 bg-gray-50 opacity-50'
                }`}
                title={badge.description}
              >
                <div className="text-4xl mb-2">{badge.icon}</div>
                <p className={`text-xs font-semibold ${badge.earned ? 'text-gray-900' : 'text-gray-500'}`}>
                  {badge.name}
                </p>
                {badge.earned && (
                  <div className="mt-2">
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                      Earned
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Comparison to Last Month */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Comparison to Last Month
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {comparisons.map((comparison) => (
              <div
                key={comparison.metric}
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  {comparison.metric}
                </h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-2xl font-bold text-gray-900">
                    {comparison.metric.includes('Time')
                      ? `${comparison.currentValue.toFixed(1)}h`
                      : comparison.metric.includes('Rate')
                      ? `${comparison.currentValue.toFixed(1)}%`
                      : comparison.currentValue}
                  </p>
                  {getTrendIndicator(comparison.trend)}
                </div>
                <p className="text-xs text-gray-600">
                  {comparison.change > 0 ? '+' : ''}
                  {comparison.metric.includes('Time')
                    ? `${comparison.change.toFixed(1)}h`
                    : comparison.metric.includes('Rate')
                    ? `${comparison.change.toFixed(1)}%`
                    : comparison.change}{' '}
                  from last month
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Previous: {comparison.metric.includes('Time')
                    ? `${comparison.previousValue.toFixed(1)}h`
                    : comparison.metric.includes('Rate')
                    ? `${comparison.previousValue.toFixed(1)}%`
                    : comparison.previousValue}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => router.push('/vendor/auctions')}
              className="px-6 py-3 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Browse Auctions
            </button>
            <button
              onClick={() => router.push('/vendor/wallet')}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              My Wallet
            </button>
            <button
              onClick={() => router.push('/vendor/leaderboard')}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Leaderboard
            </button>
            <button
              onClick={() => router.push('/vendor/kyc/tier2')}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Upgrade Tier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
