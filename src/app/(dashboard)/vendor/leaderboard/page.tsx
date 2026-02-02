'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';

interface LeaderboardEntry {
  rank: number;
  vendorId: string;
  vendorName: string;
  businessName: string | null;
  tier: string;
  totalBids: number;
  wins: number;
  totalSpent: string;
  onTimePickupRate: number;
  rating: string;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  lastUpdated: string;
  nextUpdate: string;
}

export default function VendorLeaderboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentVendorId, setCurrentVendorId] = useState<string | null>(null);

  // Fetch leaderboard data
  const fetchLeaderboardData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/vendors/leaderboard');
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch leaderboard data');
      }

      const data: LeaderboardResponse = await response.json();
      setLeaderboardData(data);
    } catch (err) {
      console.error('Error fetching leaderboard data:', err);
      setError('Failed to load leaderboard. Please try again.');
    } finally {
      setIsLoadingData(false);
    }
  }, [router]);

  // Fetch current vendor ID
  const fetchCurrentVendorId = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/vendor');
      
      if (response.ok) {
        const data = await response.json();
        // The vendor ID should be available in the user session or dashboard data
        // For now, we'll extract it from the response if available
        if (data.vendorId) {
          setCurrentVendorId(data.vendorId);
        }
      }
    } catch (err) {
      console.error('Error fetching vendor ID:', err);
    }
  }, []);

  // Initial fetch and auth check
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.push('/login');
      return;
    }

    if (isAuthenticated && user?.role !== 'vendor') {
      setError('Access denied. Vendor role required.');
      setIsLoadingData(false);
      return;
    }

    if (isAuthenticated && user) {
      fetchLeaderboardData();
      fetchCurrentVendorId();
    }
  }, [isAuthenticated, isLoading, user, router, fetchLeaderboardData, fetchCurrentVendorId]);

  // Get trophy icon for top 3
  const getTrophyIcon = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg">
          <span className="text-2xl">🏆</span>
        </div>
      );
    } else if (rank === 2) {
      return (
        <div className="w-12 h-12 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center shadow-lg">
          <span className="text-2xl">🥈</span>
        </div>
      );
    } else if (rank === 3) {
      return (
        <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
          <span className="text-2xl">🥉</span>
        </div>
      );
    }
    return (
      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
        <span className="text-lg font-bold text-gray-600">#{rank}</span>
      </div>
    );
  };

  // Format currency
  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    if (num >= 1000000) {
      return `₦${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `₦${(num / 1000).toFixed(0)}K`;
    }
    return `₦${num.toFixed(0)}`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Check if entry is current vendor
  const isCurrentVendor = (vendorId: string) => {
    return currentVendorId === vendorId;
  };

  // Loading state
  if (isLoading || (isLoadingData && !leaderboardData)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leaderboard...</p>
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => fetchLeaderboardData()}
            className="px-6 py-2 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!leaderboardData) {
    return null;
  }

  const { leaderboard, lastUpdated, nextUpdate } = leaderboardData;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Vendor Leaderboard
            </h1>
          </div>
          <p className="text-gray-600">
            Top 10 vendors this month • Updated weekly
          </p>
        </div>

        {/* Update Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">Last updated:</span> {formatDate(lastUpdated)}
              </p>
              <p className="text-sm text-blue-900 mt-1">
                <span className="font-semibold">Next update:</span> {formatDate(nextUpdate)}
              </p>
            </div>
          </div>
        </div>

        {/* Leaderboard Table - Desktop */}
        <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total Bids
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Wins
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total Spent
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    On-Time Pickup
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaderboard.map((entry) => (
                  <tr
                    key={entry.vendorId}
                    className={`transition-colors ${
                      isCurrentVendor(entry.vendorId)
                        ? 'bg-yellow-50 border-l-4 border-l-yellow-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {getTrophyIcon(entry.rank)}
                        {isCurrentVendor(entry.vendorId) && (
                          <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">{entry.vendorName}</p>
                        {entry.businessName && (
                          <p className="text-sm text-gray-500">{entry.businessName}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${
                            entry.tier === 'tier2_full'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {entry.tier === 'tier2_full' ? 'Tier 2' : 'Tier 1'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="text-lg font-bold text-gray-900">{entry.totalBids}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="text-lg font-bold text-green-600">{entry.wins}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="text-lg font-bold text-[#800020]">
                        {formatCurrency(entry.totalSpent)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${entry.onTimePickupRate}%` }}
                          ></div>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">
                          {entry.onTimePickupRate.toFixed(0)}%
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        <p className="text-lg font-bold text-gray-900">
                          {parseFloat(entry.rating).toFixed(1)}
                        </p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leaderboard Cards - Mobile */}
        <div className="md:hidden space-y-4">
          {leaderboard.map((entry) => (
            <div
              key={entry.vendorId}
              className={`bg-white rounded-lg shadow p-4 ${
                isCurrentVendor(entry.vendorId)
                  ? 'border-2 border-yellow-500 bg-yellow-50'
                  : ''
              }`}
            >
              {/* Header with Rank and Trophy */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getTrophyIcon(entry.rank)}
                  <div>
                    <p className="font-bold text-gray-900">{entry.vendorName}</p>
                    {entry.businessName && (
                      <p className="text-sm text-gray-500">{entry.businessName}</p>
                    )}
                  </div>
                </div>
                {isCurrentVendor(entry.vendorId) && (
                  <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-semibold rounded-full">
                    You
                  </span>
                )}
              </div>

              {/* Tier Badge */}
              <div className="mb-4">
                <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
                  entry.tier === 'tier2_full'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {entry.tier === 'tier2_full' ? 'Tier 2 Vendor' : 'Tier 1 Vendor'}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Total Bids</p>
                  <p className="text-xl font-bold text-gray-900">{entry.totalBids}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Wins</p>
                  <p className="text-xl font-bold text-green-600">{entry.wins}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Total Spent</p>
                  <p className="text-xl font-bold text-[#800020]">
                    {formatCurrency(entry.totalSpent)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Rating</p>
                  <div className="flex items-center gap-1">
                    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <p className="text-xl font-bold text-gray-900">
                      {parseFloat(entry.rating).toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              {/* On-Time Pickup Rate */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">On-Time Pickup Rate</p>
                  <p className="text-sm font-bold text-gray-900">
                    {entry.onTimePickupRate.toFixed(0)}%
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${entry.onTimePickupRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {leaderboard.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Leaderboard Data Yet</h3>
            <p className="text-gray-600 mb-6">
              Start bidding on auctions to appear on the leaderboard!
            </p>
            <button
              onClick={() => router.push('/vendor/auctions')}
              className="px-6 py-3 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors"
            >
              Browse Auctions
            </button>
          </div>
        )}

        {/* Back to Dashboard Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/vendor/dashboard')}
            className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
