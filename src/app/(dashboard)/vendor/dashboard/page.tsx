'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';
import { signOut } from 'next-auth/react';
import { TierUpgradeBanner } from '@/components/ui/tier-upgrade-banner';
import { TierUpgradeModal } from '@/components/ui/tier-upgrade-modal';
import { useTierUpgrade } from '@/hooks/use-tier-upgrade';

interface VendorData {
  id: string;
  tier: 'tier1_bvn' | 'tier2_full';
  businessName: string | null;
  rating: string;
  status: string;
  performanceStats: {
    totalBids: number;
    totalWins: number;
    winRate: number;
    avgPaymentTimeHours: number;
    onTimePickupRate: number;
    fraudFlags: number;
  };
}

interface DashboardStats {
  activeAuctions: number;
  watchingCount: number;
  activeBids: number;
  wonAuctions: number;
}

export default function VendorDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  
  const [vendorData, setVendorData] = useState<VendorData | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [highValueAuctionCount, setHighValueAuctionCount] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Initialize tier upgrade hook (must be called before any conditional returns)
  const {
    showUpgradeModal,
    closeUpgradeModal,
    blockedAuctionValue,
    isTier1,
    TIER_1_LIMIT,
  } = useTierUpgrade({
    currentTier: vendorData?.tier || 'tier1_bvn',
    onUpgradeRequired: (value) => {
      // Log for analytics
      console.log(`Tier upgrade required for auction value: ₦${value.toLocaleString()}`);
    },
  });

  // Fetch vendor data on mount
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.push('/login');
      return;
    }

    if (isAuthenticated && user) {
      fetchVendorData();
      fetchDashboardStats();
      fetchHighValueAuctionCount();
    }
  }, [isAuthenticated, isLoading, user, router]);

  const fetchVendorData = async () => {
    try {
      const response = await fetch('/api/vendors/me');
      if (!response.ok) {
        // Use mock data if API doesn't exist yet
        console.warn('Vendor API not available, using mock data');
        setVendorData({
          id: user?.id || 'mock-id',
          tier: 'tier1_bvn',
          businessName: user?.name || 'Your Business',
          rating: '4.5',
          status: 'approved',
          performanceStats: {
            totalBids: 0,
            totalWins: 0,
            winRate: 0,
            avgPaymentTimeHours: 0,
            onTimePickupRate: 0,
            fraudFlags: 0,
          },
        });
        return;
      }
      const data = await response.json();
      setVendorData(data);
    } catch (error) {
      console.error('Error fetching vendor data:', error);
      // Use mock data on error
      setVendorData({
        id: user?.id || 'mock-id',
        tier: 'tier1_bvn',
        businessName: user?.name || 'Your Business',
        rating: '4.5',
        status: 'approved',
        performanceStats: {
          totalBids: 0,
          totalWins: 0,
          winRate: 0,
          avgPaymentTimeHours: 0,
          onTimePickupRate: 0,
          fraudFlags: 0,
        },
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/vendors/dashboard-stats');
      if (!response.ok) {
        // Use mock data if API doesn't exist yet
        console.warn('Dashboard stats API not available, using mock data');
        setDashboardStats({
          activeAuctions: 0,
          watchingCount: 0,
          activeBids: 0,
          wonAuctions: 0,
        });
        return;
      }
      const data = await response.json();
      setDashboardStats(data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Use mock data on error
      setDashboardStats({
        activeAuctions: 0,
        watchingCount: 0,
        activeBids: 0,
        wonAuctions: 0,
      });
    }
  };

  const fetchHighValueAuctionCount = async () => {
    try {
      const response = await fetch('/api/auctions/high-value-count');
      if (!response.ok) {
        // Use mock data if API doesn't exist yet
        console.warn('High-value auction count API not available, using mock data');
        setHighValueAuctionCount(0);
        return;
      }
      const data = await response.json();
      setHighValueAuctionCount(data.count || 0);
    } catch (error) {
      console.error('Error fetching high-value auction count:', error);
      // Use mock data on error
      setHighValueAuctionCount(0);
    }
  };

  // Show loading state
  if (isLoading || isLoadingData || !vendorData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const handleViewAllAuctions = () => {
    router.push('/vendor/auctions');
  };

  const handleViewProfile = () => {
    router.push('/vendor/profile');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Vendor Dashboard
            </h1>
            <p className="text-gray-600">
              Welcome back, {vendorData.businessName || user?.name || 'Vendor'}
            </p>
          </div>
          
          {/* Logout Button */}
          <button
            onClick={async () => {
              if (confirm('Are you sure you want to logout?')) {
                try {
                  // Call logout API to clear server-side session
                  await fetch('/api/auth/logout', { method: 'POST' });
                  // Use NextAuth signOut to clear client session
                  await signOut({ redirect: false });
                  // Clear any local storage
                  localStorage.clear();
                  sessionStorage.clear();
                  // Redirect to login
                  router.push('/login');
                } catch (error) {
                  console.error('Logout error:', error);
                  // Force redirect even if error
                  router.push('/login');
                }
              }
            }}
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>

        {/* Tier Upgrade Banner - Only show for Tier 1 vendors */}
        {isTier1 && (
          <TierUpgradeBanner highValueAuctionCount={highValueAuctionCount} />
        )}

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Tier Status Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Your Tier</h3>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {vendorData.tier === 'tier1_bvn' ? 'Tier 1' : 'Tier 2'}
              </span>
              {vendorData.tier === 'tier1_bvn' && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                  Limited
                </span>
              )}
              {vendorData.tier === 'tier2_full' && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                  Premium
                </span>
              )}
            </div>
            {isTier1 && (
              <p className="text-sm text-gray-600 mt-2">
                Bid limit: ₦{TIER_1_LIMIT.toLocaleString()}
              </p>
            )}
          </div>

          {/* Rating Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Rating</h3>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {parseFloat(vendorData.rating).toFixed(1)}
              </span>
              <span className="text-yellow-500">★</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {vendorData.performanceStats.totalWins} wins
            </p>
          </div>

          {/* Active Bids Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Active Bids</h3>
            <span className="text-2xl font-bold text-gray-900">
              {dashboardStats?.activeBids || 0}
            </span>
            <p className="text-sm text-gray-600 mt-2">
              Watching {dashboardStats?.watchingCount || 0}
            </p>
          </div>

          {/* Win Rate Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Win Rate</h3>
            <span className="text-2xl font-bold text-gray-900">
              {vendorData.performanceStats.winRate.toFixed(1)}%
            </span>
            <p className="text-sm text-gray-600 mt-2">
              {vendorData.performanceStats.totalBids} total bids
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleViewAllAuctions}
              className="px-6 py-3 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors"
            >
              Browse Auctions
            </button>
            <button
              onClick={handleViewProfile}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              View Profile
            </button>
            {isTier1 && (
              <button
                onClick={() => router.push('/vendor/kyc/tier2')}
                className="px-6 py-3 bg-gradient-to-r from-[#800020] to-[#FFD700] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
              >
                Upgrade to Tier 2
              </button>
            )}
          </div>
        </div>

        {/* TEMPORARY: Demo Links - Will be removed when proper navigation is implemented */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow p-6 mb-8 border-2 border-blue-200">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-1">🚀 Demo Mode - Quick Navigation</h2>
              <p className="text-sm text-gray-600 mb-4">
                Temporary links to all completed pages. This section will be removed when proper navigation is implemented.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <button
                  onClick={() => router.push('/demo')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all text-sm"
                >
                  📋 View All Demo Pages
                </button>
                <button
                  onClick={() => router.push('/vendor/kyc/tier1')}
                  className="px-4 py-2 bg-white border-2 border-blue-300 text-blue-700 font-semibold rounded-lg hover:bg-blue-50 transition-colors text-sm"
                >
                  🔐 Tier 1 KYC
                </button>
                <button
                  onClick={() => router.push('/vendor/kyc/tier2')}
                  className="px-4 py-2 bg-white border-2 border-purple-300 text-purple-700 font-semibold rounded-lg hover:bg-purple-50 transition-colors text-sm"
                >
                  🏆 Tier 2 KYC
                </button>
                <button
                  onClick={() => router.push('/manager/vendors')}
                  className="px-4 py-2 bg-white border-2 border-green-300 text-green-700 font-semibold rounded-lg hover:bg-green-50 transition-colors text-sm"
                >
                  ✅ Vendor Approvals
                </button>
                <button
                  onClick={() => router.push('/manager/approvals')}
                  className="px-4 py-2 bg-white border-2 border-orange-300 text-orange-700 font-semibold rounded-lg hover:bg-orange-50 transition-colors text-sm"
                >
                  📦 Case Approvals
                </button>
                <button
                  onClick={() => router.push('/adjuster/cases/new')}
                  className="px-4 py-2 bg-white border-2 border-red-300 text-red-700 font-semibold rounded-lg hover:bg-red-50 transition-colors text-sm"
                >
                  🚗 Create Case
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Overview */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Performance Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Average Payment Time</p>
              <p className="text-lg font-semibold text-gray-900">
                {vendorData.performanceStats.avgPaymentTimeHours.toFixed(1)} hours
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">On-Time Pickup Rate</p>
              <p className="text-lg font-semibold text-gray-900">
                {vendorData.performanceStats.onTimePickupRate.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Wins</p>
              <p className="text-lg font-semibold text-gray-900">
                {vendorData.performanceStats.totalWins}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tier Upgrade Modal */}
      <TierUpgradeModal
        isOpen={showUpgradeModal}
        onClose={closeUpgradeModal}
        auctionValue={blockedAuctionValue}
      />
    </div>
  );
}
