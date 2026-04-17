'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';
import { TrustBadges } from '@/components/vendor/trust-badges';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useCachedLeaderboard } from '@/hooks/use-cached-leaderboard';
import { Trophy, Medal, Award, Star, TrendingUp, Target, Clock, WifiOff, AlertTriangle, Banknote } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  vendorId: string;
  vendorName: string;
  businessName: string | null;
  profilePictureUrl?: string | null;
  tier: string;
  totalBids: number;
  wins: number;
  totalSpent: string;
  winRate: number;
  participationRate: number;
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
  const { data: leaderboardData, isLoading: isLoadingData, isOffline, lastCached, refresh, error: cacheError } = useCachedLeaderboard();

  const [error, setError] = useState<string | null>(null);
  const [currentVendorId, setCurrentVendorId] = useState<string | null>(null);

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
      return;
    }

    if (isAuthenticated && user) {
      fetchCurrentVendorId();
    }
  }, [isAuthenticated, isLoading, user, router, fetchCurrentVendorId]);

  // Get trophy icon for top 3
  const getTrophyIcon = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg">
          <Trophy className="w-6 h-6 text-white" />
        </div>
      );
    } else if (rank === 2) {
      return (
        <div className="w-12 h-12 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center shadow-lg">
          <Medal className="w-6 h-6 text-white" />
        </div>
      );
    } else if (rank === 3) {
      return (
        <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
          <Award className="w-6 h-6 text-white" />
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
  if (isLoading || isLoadingData) {
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
  if (error || cacheError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error || cacheError?.message}</p>
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
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Vendor Leaderboard
            </h1>
          </div>
          <p className="text-gray-600">
            Top 10 vendors this month • Updated weekly
          </p>
        </div>

        {/* Offline indicator banner */}
        {isOffline && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <div className="flex items-center">
              <WifiOff className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">
                  You are offline. Showing cached leaderboard.
                </p>
                {lastCached && (
                  <p className="text-xs text-yellow-700 mt-1">
                    Last updated: {new Date(lastCached).toLocaleString('en-NG', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Update Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
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
                    Win Rate
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total Spent
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
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          profilePictureUrl={entry.profilePictureUrl}
                          userName={entry.vendorName}
                          size="lg"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">{entry.vendorName}</p>
                          {entry.businessName && (
                            <p className="text-sm text-gray-500">{entry.businessName}</p>
                          )}
                          <div className="mt-2">
                            <TrustBadges
                              tier={entry.tier as 'tier1_bvn' | 'tier2_full'}
                              rating={parseFloat(entry.rating)}
                              avgPaymentTimeHours={0}
                              size="sm"
                            />
                          </div>
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
                      <div className="flex items-center justify-center gap-2">
                        <Target className="w-4 h-4 text-[#800020]" />
                        <p className="text-lg font-bold text-[#800020]">
                          {(entry.winRate || 0).toFixed(1)}%
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Banknote className="w-4 h-4 text-gray-600" />
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(entry.totalSpent)}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
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
                  <UserAvatar
                    profilePictureUrl={entry.profilePictureUrl}
                    userName={entry.vendorName}
                    size="md"
                  />
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

              {/* Trust Badges */}
              <div className="mb-4">
                <TrustBadges
                  tier={entry.tier as 'tier1_bvn' | 'tier2_full'}
                  rating={parseFloat(entry.rating)}
                  avgPaymentTimeHours={0}
                  size="sm"
                />
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
                  <p className="text-xs text-gray-500 mb-1">Win Rate</p>
                  <div className="flex items-center gap-1">
                    <Target className="w-4 h-4 text-[#800020]" />
                    <p className="text-xl font-bold text-[#800020]">
                      {(entry.winRate || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Total Spent</p>
                  <div className="flex items-center gap-1">
                    <Banknote className="w-4 h-4 text-gray-600" />
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(entry.totalSpent)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Rating */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">Rating</p>
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    <p className="text-xl font-bold text-gray-900">
                      {parseFloat(entry.rating).toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {leaderboard.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-10 h-10 text-gray-400" />
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

        {/* Future: Rewards & Penalties Section - Ready for Implementation */}
        {/* 
        <div className="mt-8 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-600" />
            Rewards & Recognition
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4">
              <Award className="w-8 h-8 text-yellow-500 mb-2" />
              <h4 className="font-semibold text-gray-900">Top Performer</h4>
              <p className="text-sm text-gray-600">Exclusive auction access</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <Zap className="w-8 h-8 text-blue-500 mb-2" />
              <h4 className="font-semibold text-gray-900">Fast Payer</h4>
              <p className="text-sm text-gray-600">Priority bidding</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <Shield className="w-8 h-8 text-green-500 mb-2" />
              <h4 className="font-semibold text-gray-900">Reliable Vendor</h4>
              <p className="text-sm text-gray-600">Lower deposit requirements</p>
            </div>
          </div>
        </div>
        */}
      </div>
    </div>
  );
}
