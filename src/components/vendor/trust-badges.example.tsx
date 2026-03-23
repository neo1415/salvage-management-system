/**
 * Trust Badges Component Examples
 * 
 * This file demonstrates various usage patterns for the TrustBadges component.
 * These examples can be used as reference for implementing trust badges
 * throughout the application.
 */

import { TrustBadges } from './trust-badges';

/**
 * Example 1: Tier 1 Vendor with Basic Verification
 * Shows only the Verified BVN badge
 */
export function Example1_Tier1Basic() {
  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-2">John's Auto Parts</h3>
      <p className="text-sm text-gray-600 mb-3">Tier 1 Vendor</p>
      <TrustBadges
        tier="tier1_bvn"
        rating={3.8}
        avgPaymentTimeHours={8.5}
      />
    </div>
  );
}

/**
 * Example 2: Tier 1 Vendor with Top Rating
 * Shows Verified BVN and Top Rated badges
 */
export function Example2_Tier1TopRated() {
  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-2">Lagos Salvage Co.</h3>
      <p className="text-sm text-gray-600 mb-3">Tier 1 Vendor • 4.8★</p>
      <TrustBadges
        tier="tier1_bvn"
        rating={4.8}
        avgPaymentTimeHours={7.2}
      />
    </div>
  );
}

/**
 * Example 3: Tier 1 Vendor with Fast Payment
 * Shows Verified BVN and Fast Payer badges
 */
export function Example3_Tier1FastPayer() {
  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-2">Quick Pay Motors</h3>
      <p className="text-sm text-gray-600 mb-3">Tier 1 Vendor • Avg 4.2 hours</p>
      <TrustBadges
        tier="tier1_bvn"
        rating={4.2}
        avgPaymentTimeHours={4.2}
      />
    </div>
  );
}

/**
 * Example 4: Tier 2 Vendor with All Badges
 * Shows all four badges (maximum achievement)
 */
export function Example4_Tier2AllBadges() {
  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-2">Premium Salvage Ltd.</h3>
      <p className="text-sm text-gray-600 mb-3">Tier 2 Verified Business • 4.9★</p>
      <TrustBadges
        tier="tier2_full"
        rating={4.9}
        avgPaymentTimeHours={3.5}
        size="lg"
      />
    </div>
  );
}

/**
 * Example 5: Compact Display for Bid List
 * Small size, icon-only badges for space-constrained layouts
 */
export function Example5_CompactBidList() {
  const bids = [
    {
      id: '1',
      vendor: 'Premium Salvage Ltd.',
      amount: 850000,
      tier: 'tier2_full' as const,
      rating: 4.9,
      avgPaymentTimeHours: 3.5,
    },
    {
      id: '2',
      vendor: 'Quick Pay Motors',
      amount: 820000,
      tier: 'tier1_bvn' as const,
      rating: 4.2,
      avgPaymentTimeHours: 4.2,
    },
    {
      id: '3',
      vendor: 'Lagos Salvage Co.',
      amount: 800000,
      tier: 'tier1_bvn' as const,
      rating: 4.8,
      avgPaymentTimeHours: 7.2,
    },
  ];

  return (
    <div className="space-y-2">
      <h3 className="font-semibold mb-3">Current Bids</h3>
      {bids.map((bid) => (
        <div key={bid.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
          <div>
            <p className="font-medium text-sm">{bid.vendor}</p>
            <p className="text-xs text-gray-600">₦{bid.amount.toLocaleString()}</p>
          </div>
          <TrustBadges
            tier={bid.tier}
            rating={bid.rating}
            avgPaymentTimeHours={bid.avgPaymentTimeHours}
            size="sm"
            showLabels={false}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Example 6: Leaderboard Display
 * Medium size badges with horizontal layout
 */
export function Example6_Leaderboard() {
  const topVendors = [
    {
      id: '1',
      rank: 1,
      name: 'Premium Salvage Ltd.',
      tier: 'tier2_full' as const,
      rating: 4.9,
      avgPaymentTimeHours: 3.5,
      totalWins: 45,
      winRate: 78,
    },
    {
      id: '2',
      rank: 2,
      name: 'Lagos Salvage Co.',
      tier: 'tier1_bvn' as const,
      rating: 4.8,
      avgPaymentTimeHours: 7.2,
      totalWins: 38,
      winRate: 72,
    },
    {
      id: '3',
      rank: 3,
      name: 'Quick Pay Motors',
      tier: 'tier1_bvn' as const,
      rating: 4.2,
      avgPaymentTimeHours: 4.2,
      totalWins: 32,
      winRate: 68,
    },
  ];

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-4">Top Vendors This Month</h2>
      {topVendors.map((vendor) => (
        <div key={vendor.id} className="flex items-center gap-4 p-4 bg-white rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-400 w-8">#{vendor.rank}</div>
          <div className="flex-1">
            <h3 className="font-semibold">{vendor.name}</h3>
            <TrustBadges
              tier={vendor.tier}
              rating={vendor.rating}
              avgPaymentTimeHours={vendor.avgPaymentTimeHours}
              size="sm"
            />
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Win Rate</p>
            <p className="text-lg font-bold text-green-600">{vendor.winRate}%</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Example 7: Vertical Layout for Sidebar
 * Vertical stacking for narrow layouts
 */
export function Example7_VerticalSidebar() {
  return (
    <div className="w-64 p-4 bg-white rounded-lg shadow">
      <h3 className="font-semibold mb-2">Premium Salvage Ltd.</h3>
      <p className="text-sm text-gray-600 mb-3">Tier 2 Verified</p>
      <TrustBadges
        tier="tier2_full"
        rating={4.9}
        avgPaymentTimeHours={3.5}
        layout="vertical"
        size="md"
      />
      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-gray-600">Member since Jan 2024</p>
      </div>
    </div>
  );
}

/**
 * Example 8: Mobile Vendor Card
 * Optimized for mobile display
 */
export function Example8_MobileCard() {
  return (
    <div className="max-w-sm bg-white rounded-lg shadow p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold">Premium Salvage Ltd.</h3>
          <p className="text-sm text-gray-600">45 wins • 4.9★</p>
        </div>
      </div>
      <TrustBadges
        tier="tier2_full"
        rating={4.9}
        avgPaymentTimeHours={3.5}
        size="sm"
      />
      <div className="mt-4 flex gap-2">
        <button className="flex-1 px-4 py-2 bg-burgundy-600 text-white rounded-lg text-sm font-medium">
          View Profile
        </button>
        <button className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium">
          Contact
        </button>
      </div>
    </div>
  );
}

/**
 * Example 9: Auction Winner Display
 * Large badges for prominent winner announcement
 */
export function Example9_AuctionWinner() {
  return (
    <div className="p-6 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border-2 border-green-500">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🏆</span>
        <h3 className="text-xl font-bold text-green-800">Auction Winner!</h3>
      </div>
      <p className="text-lg font-semibold mb-2">Premium Salvage Ltd.</p>
      <p className="text-sm text-gray-700 mb-3">Winning Bid: ₦850,000</p>
      <TrustBadges
        tier="tier2_full"
        rating={4.9}
        avgPaymentTimeHours={3.5}
        size="lg"
      />
    </div>
  );
}

/**
 * Example 10: Profile Header
 * Full-width display with custom styling
 */
export function Example10_ProfileHeader() {
  return (
    <div className="bg-gradient-to-r from-burgundy-600 to-burgundy-800 text-white p-8 rounded-lg">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Premium Salvage Ltd.</h1>
            <p className="text-burgundy-100">Verified Business • Member since Jan 2024</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">4.9★</p>
            <p className="text-sm text-burgundy-100">45 reviews</p>
          </div>
        </div>
        <TrustBadges
          tier="tier2_full"
          rating={4.9}
          avgPaymentTimeHours={3.5}
          size="lg"
          className="justify-start"
        />
      </div>
    </div>
  );
}

/**
 * Example 11: Loading State
 * Show placeholder while data is loading
 */
export function Example11_LoadingState() {
  const isLoading = true;

  if (isLoading) {
    return (
      <div className="flex gap-2">
        <div className="h-8 w-32 bg-gray-200 rounded-full animate-pulse" />
        <div className="h-8 w-32 bg-gray-200 rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <TrustBadges
      tier="tier2_full"
      rating={4.9}
      avgPaymentTimeHours={3.5}
    />
  );
}

/**
 * Example 12: Conditional Display
 * Only show badges when vendor has qualifying achievements
 */
export function Example12_ConditionalDisplay() {
  const vendor = {
    tier: 'tier1_bvn' as const,
    rating: 3.2,
    avgPaymentTimeHours: 10.5,
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-2">New Vendor</h3>
      <p className="text-sm text-gray-600 mb-3">Building reputation...</p>
      <TrustBadges
        tier={vendor.tier}
        rating={vendor.rating}
        avgPaymentTimeHours={vendor.avgPaymentTimeHours}
      />
      {vendor.rating < 4.5 && (
        <p className="text-xs text-gray-500 mt-2">
          Complete more transactions to earn more badges!
        </p>
      )}
    </div>
  );
}
