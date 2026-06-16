'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth/use-auth';
import { KYCStatusCard, type VendorTier } from '@/components/vendor/kyc-status-card';
import { usePaymentUnlockedModal } from '@/hooks/use-payment-unlocked-modal';
import { useVendorDashboard } from '@/hooks/queries/use-vendor-dashboard';
import { Check, Star, Trophy, Rocket, ClipboardList } from 'lucide-react';
import { DashboardErrorBoundary } from '@/components/ui/error-boundary';
import { PageLoadingSkeleton } from '@/components/ui/loading-states';

const PaymentUnlockedModal = dynamic(
  () => import('@/components/modals/payment-unlocked-modal'),
  { ssr: false }
);

interface PendingPickupConfirmation {
  auctionId: string;
  case: {
    claimReference: string;
    assetType: string;
    assetDetails: Record<string, unknown>;
  };
}

function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'No clean data';
  if (value === 0) return '0h';
  if (value < 1) return '<1h';
  if (value < 24) return `${Math.round(value)}h`;
  return `${(value / 24).toFixed(1)}d`;
}

function VendorDashboardContentInner() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [dismissedPickups, setDismissedPickups] = useState<Set<string>>(new Set());

  // Payment unlocked modal
  const {
    isOpen: isPaymentModalOpen,
    paymentData,
    closeModal: closePaymentModal,
  } = usePaymentUnlockedModal();

  // Fetch dashboard data with TanStack Query (cached, instant on return)
  const { data: dashboardData, isLoading: isLoadingData, error: queryError } = useVendorDashboard();

  // Convert query error to string
  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load dashboard data') : null;

  // Load dismissed pickups from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dismissedPickups');
      if (stored) {
        const parsed = JSON.parse(stored);
        setDismissedPickups(new Set(parsed));
      }
    } catch (error) {
      console.error('Failed to load dismissed pickups:', error);
    }
  }, []);

  // Initial auth check
  useEffect(() => {
    // Don't redirect if still loading
    if (isAuthLoading) {
      return;
    }

    // Only redirect to login if definitely not authenticated
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Check role only after we know user is authenticated
    if (user && user.role !== 'vendor') {
      router.push('/login');
      return;
    }
  }, [isAuthenticated, isAuthLoading, user, router]);

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

  // Format asset name for display
  const formatAssetName = (pickup: PendingPickupConfirmation) => {
    const details = pickup.case.assetDetails;
    if (pickup.case.assetType === 'vehicle' && details) {
      const year = typeof details.year === 'string' ? details.year : '';
      const make = typeof details.make === 'string' ? details.make : '';
      const model = typeof details.model === 'string' ? details.model : '';
      return `${year} ${make} ${model}`.trim() || pickup.case.claimReference;
    }
    return pickup.case.claimReference;
  };

  // Handle dismiss pickup card
  const handleDismissPickup = (auctionId: string) => {
    const newDismissed = new Set(dismissedPickups).add(auctionId);
    setDismissedPickups(newDismissed);
    
    // Persist to localStorage
    try {
      localStorage.setItem('dismissedPickups', JSON.stringify(Array.from(newDismissed)));
    } catch (error) {
      console.error('Failed to save dismissed pickups:', error);
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

  if (isAuthLoading || isLoadingData || !dashboardData) {
    return <PageLoadingSkeleton />;
  }

  const {
    performanceStats,
    badges,
    comparisons,
    vendorTier,
    bidLimit,
    pendingPickupConfirmations,
    operationsControl,
  } = dashboardData;
  const visiblePickups = pendingPickupConfirmations?.filter(p => !dismissedPickups.has(p.auctionId)) || [];
  const hasPendingPickups = visiblePickups.length > 0;
  const buyerControl = operationsControl ?? {
    bidLimit,
    wonAwaitingPayment: 0,
    signedAwaitingPayment: 0,
    paidAwaitingPickup: pendingPickupConfirmations?.length ?? 0,
    averagePaymentTimeHours: performanceStats.avgPaymentTimeHours || null,
    averagePickupTimeHours: null,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 md:p-6">
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

        {/* KYC Status Card */}
        <div className="mb-8">
          <KYCStatusCard 
            currentTier={vendorTier}
            bidLimit={bidLimit}
          />
        </div>

        {/* Payment Complete - Ready for Pickup Info */}
        {hasPendingPickups && (
          <div className="bg-green-50 border-2 border-green-400 rounded-lg shadow-md p-4 sm:p-6 mb-8">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-green-400 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                  Payment Complete - Ready for Pickup
                </h2>
                <p className="text-sm sm:text-base text-gray-700">
                  You have {visiblePickups.length} item{visiblePickups.length > 1 ? 's' : ''} ready for pickup. 
                  Your pickup authorization code has been sent via SMS and email.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {visiblePickups.map((pickup) => (
                <div
                  key={pickup.auctionId}
                  className="bg-white rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm sm:text-base">
                          {formatAssetName(pickup)}
                        </p>
                        <p className="text-xs sm:text-sm text-green-600 font-medium flex items-center gap-1">
                          <Check className="w-4 h-4" aria-hidden="true" />
                          <span>Payment verified • Ready for pickup</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDismissPickup(pickup.auctionId)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Dismiss"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    <p className="text-blue-900 font-medium mb-2 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5" aria-hidden="true" />
                      <span>Next Steps:</span>
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-800">
                      <li>Check your SMS and email for the pickup authorization code</li>
                      <li>Bring valid ID and the authorization code to the pickup location</li>
                      <li>Pickup must be completed within 48 hours</li>
                    </ol>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex flex-col gap-1 mb-5">
            <h2 className="text-xl font-bold text-gray-900">Buyer Operations</h2>
            <p className="text-sm text-gray-600">
              Payment obligations, pickup readiness, and reliability signals.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Won unpaid</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">{buyerControl.wonAwaitingPayment}</p>
              <p className="mt-1 text-xs text-gray-500">Auctions needing payment</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Signed unpaid</p>
              <p className="mt-2 text-2xl font-bold text-red-700">{buyerControl.signedAwaitingPayment}</p>
              <p className="mt-1 text-xs text-gray-500">Documents signed, payment pending</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pickup ready</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{buyerControl.paidAwaitingPickup}</p>
              <p className="mt-1 text-xs text-gray-500">Paid assets awaiting handoff</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment cycle</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{formatHours(buyerControl.averagePaymentTimeHours)}</p>
              <p className="mt-1 text-xs text-gray-500">Auction close to verified payment</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pickup cycle</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{formatHours(buyerControl.averagePickupTimeHours)}</p>
              <p className="mt-1 text-xs text-gray-500">Average payment to staff confirmation</p>
            </div>
          </div>
        </div>

        {/* Performance Stats Cards - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
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

          {/* Average Payment Time - Hidden from vendor view (admin/manager only) */}
          {/* <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
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
                ? (
                  <span className="flex items-center gap-1">
                    <span>Fast payer!</span>
                    <Rocket className="w-4 h-4 inline" aria-label="Fast payer badge" />
                  </span>
                )
                : 'Time to payment'}
            </p>
          </div> */}

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
            <p className="text-sm text-gray-600 mt-1">Within 48h pickup SLA</p>
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
            <p className="text-3xl font-bold text-gray-900 leading-tight break-words">
              {performanceStats.ratingLabel || (performanceStats.rating > 0 ? performanceStats.rating.toFixed(1) : 'Not enough data')}
            </p>
            <p className="text-sm text-gray-600 mt-1 break-words">
              {performanceStats.rating >= 4.5 ? (
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 inline fill-current" aria-label="Top rated badge" />
                  <span>Top rated!</span>
                </span>
              ) : performanceStats.rating > 0 ? 'Out of 5 stars' : 'Builds after more bids and payments'}
            </p>
          </div>
        </div>

        {/* Leaderboard Position */}
        <div className="bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-hover)] rounded-lg shadow-lg p-6 mb-8 text-white">
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
                <p className="text-sm mt-2 text-yellow-300 flex items-center gap-2">
                  <Trophy className="w-5 h-5" aria-label="Top 10 badge" />
                  <span>You're in the Top 10! Keep it up!</span>
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
            {badges.map((badge) => {
              // Map badge IDs to proper icons
              const getBadgeIcon = () => {
                switch (badge.id) {
                  case '10_wins':
                    return <Trophy className="w-10 h-10 text-yellow-600" />;
                  case 'top_bidder':
                    return <Star className="w-10 h-10 text-yellow-600 fill-current" />;
                  case 'fast_payer':
                    return <Rocket className="w-10 h-10 text-blue-600" />;
                  case 'verified_bvn':
                    return <Check className="w-10 h-10 text-green-600" />;
                  case 'verified_business':
                    return <ClipboardList className="w-10 h-10 text-purple-600" />;
                  case 'top_rated':
                    return (
                      <div className="flex gap-0.5 justify-center">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-yellow-500 fill-current" />
                        ))}
                      </div>
                    );
                  default:
                    return <Trophy className="w-10 h-10 text-gray-400" />;
                }
              };

              return (
                <div
                  key={badge.id}
                  className={`p-4 rounded-lg border-2 text-center transition-all ${
                    badge.earned
                      ? 'border-[var(--brand-accent)] bg-yellow-50 shadow-md'
                      : 'border-gray-200 bg-gray-50 opacity-50'
                  }`}
                  title={badge.description}
                >
                  <div className="mb-2 flex justify-center">{getBadgeIcon()}</div>
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
              );
            })}
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

        </div>
      </div>

      {/* Payment Unlocked Modal */}
      {isPaymentModalOpen && paymentData && (
        <PaymentUnlockedModal
          isOpen={isPaymentModalOpen}
          onClose={closePaymentModal}
          paymentData={paymentData}
        />
      )}
    </div>
  );
}


// Wrap with error boundary
export default function VendorDashboardContent() {
  return (
    <DashboardErrorBoundary role="vendor">
      <VendorDashboardContentInner />
    </DashboardErrorBoundary>
  );
}
