'use client';

import { useState, useEffect } from 'react';
import { useAppRouter } from '@/hooks/use-app-router';
import { MetricValue, StatCard, StatGrid, StatTile } from '@/components/ui/stat-card';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth/use-auth';
import { KYCStatusCard } from '@/components/vendor/kyc-status-card';
import { usePaymentUnlockedModal } from '@/hooks/use-payment-unlocked-modal';
import { useVendorDashboard } from '@/hooks/queries/use-vendor-dashboard';
import { Check, Star, Trophy, Rocket, ClipboardList } from 'lucide-react';
import { DashboardErrorBoundary } from '@/components/ui/error-boundary';
import { PageLoadingSkeleton } from '@/components/ui/loading-states';
import { formatAssetName as formatCaseAssetName } from '@/lib/utils/asset-name';
import { collectImageFilesMetadata } from '@/features/media/client-image-metadata';
import { uploadPickupEvidenceFiles } from '@/features/pickups/client/pickup-evidence-upload';

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

type PickupEvidenceFormState = {
  pickupAuthCode: string;
  notes: string;
  files: File[];
  submitting: boolean;
  submissionStage: 'uploading' | 'comparing' | null;
  uploadProgress: number;
  message: string | null;
  error: string | null;
  submitted: boolean;
};

function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'No clean data';
  if (value === 0) return '0h';
  if (value < 1) return '<1h';
  if (value < 24) return `${Math.round(value)}h`;
  return `${(value / 24).toFixed(1)}d`;
}

function VendorDashboardContentInner() {
  const router = useAppRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [dismissedPickups, setDismissedPickups] = useState<Set<string>>(new Set());
  const [pickupEvidenceForms, setPickupEvidenceForms] = useState<Record<string, PickupEvidenceFormState>>({});

  // Payment unlocked modal
  const {
    isOpen: isPaymentModalOpen,
    paymentData,
    closeModal: closePaymentModal,
  } = usePaymentUnlockedModal();

  // Fetch dashboard data with TanStack Query (cached, instant on return)
  const {
    data: dashboardData,
    isLoading: isLoadingData,
    error: queryError,
    refetch: refetchDashboard,
  } = useVendorDashboard();

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
    return formatCaseAssetName(pickup.case.assetType, pickup.case.assetDetails, 'Auction item');
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

  const evidenceFormFor = (auctionId: string): PickupEvidenceFormState => pickupEvidenceForms[auctionId] || {
    pickupAuthCode: '',
    notes: '',
    files: [],
    submitting: false,
    submissionStage: null,
    uploadProgress: 0,
    message: null,
    error: null,
    submitted: false,
  };

  const updateEvidenceForm = (auctionId: string, patch: Partial<PickupEvidenceFormState>) => {
    setPickupEvidenceForms((current) => ({
      ...current,
      [auctionId]: {
        ...(current[auctionId] || {
          pickupAuthCode: '', notes: '', files: [], submitting: false,
          submissionStage: null, uploadProgress: 0, message: null, error: null, submitted: false,
        }),
        ...patch,
      },
    }));
  };

  const submitPickupEvidence = async (pickup: PendingPickupConfirmation) => {
    const form = evidenceFormFor(pickup.auctionId);
    const pickupAuthCode = form.pickupAuthCode.trim();

    if (!user?.vendorId) {
      updateEvidenceForm(pickup.auctionId, { error: 'Vendor account is not loaded yet.', message: null });
      return;
    }

    if (pickupAuthCode.length < 6) {
      updateEvidenceForm(pickup.auctionId, { error: 'Enter the pickup authorization code first.', message: null });
      return;
    }

    if (form.files.length < 3) {
      updateEvidenceForm(pickup.auctionId, { error: 'Upload at least 3 pickup photos from different angles.', message: null });
      return;
    }

    try {
      updateEvidenceForm(pickup.auctionId, {
        submitting: true,
        submissionStage: 'uploading',
        uploadProgress: 0,
        error: null,
        message: null,
      });
      const [photoMetadata, photoUrls] = await Promise.all([
        collectImageFilesMetadata(form.files, 'browser_camera_input'),
        uploadPickupEvidenceFiles(pickup.auctionId, form.files, (uploaded, total) => {
          updateEvidenceForm(pickup.auctionId, { uploadProgress: Math.round((uploaded / total) * 100) });
        }),
      ]);
      updateEvidenceForm(pickup.auctionId, { submissionStage: 'comparing' });

      const response = await fetch(`/api/auctions/${pickup.auctionId}/pickup-evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: user.vendorId,
          pickupAuthCode,
          photoUrls,
          photoMetadata,
          notes: form.notes,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Pickup evidence submission failed.');
      }

      updateEvidenceForm(pickup.auctionId, {
        submitting: false,
        submissionStage: null,
        uploadProgress: 100,
        message: data.message || 'Pickup evidence submitted.',
        error: null,
        files: [],
        submitted: true,
      });
      await refetchDashboard();
    } catch (error) {
      updateEvidenceForm(pickup.auctionId, {
        submitting: false,
        submissionStage: null,
        error: error instanceof Error ? error.message : 'Pickup evidence submission failed.',
        message: null,
      });
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
              {visiblePickups.map((pickup) => {
                const evidenceForm = evidenceFormFor(pickup.auctionId);
                const evidenceSubmitted = (pickup.pickupEvidence?.submitted ?? false) || evidenceForm.submitted;

                return (
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
                          <span>
                            Payment verified • {evidenceSubmitted ? 'Evidence under review' : 'Ready for pickup'}
                          </span>
                        </p>
                        {evidenceSubmitted && (
                          <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            Under review
                          </span>
                        )}
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

                    {evidenceSubmitted ? (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <p className="font-semibold">Pickup evidence submitted</p>
                        <p className="mt-1 text-xs text-amber-800">
                          Staff are reviewing your photos. You cannot resubmit until pickup is confirmed.
                          {pickup.pickupEvidence?.submittedAt
                            ? ` Submitted ${new Date(pickup.pickupEvidence.submittedAt).toLocaleString()}.`
                            : ''}
                        </p>
                        <Link href="/vendor/pickups" className="mt-2 inline-flex text-xs font-semibold text-[var(--brand-primary)]">
                          View on pickups page
                        </Link>
                      </div>
                    ) : (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-gray-900">Pickup evidence</p>
                      <p className="mt-1 text-xs text-gray-600">
                        Submit at least 3 photos from the pickup point so staff can compare handoff condition with the original inspection.
                      </p>
                      <Link href="/vendor/pickups" className="mt-2 inline-flex text-xs font-semibold text-[var(--brand-primary)]">
                        Open full pickups page
                      </Link>
                    </div>
                    {evidenceForm.message && (
                      <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs font-medium text-emerald-800">
                        {evidenceForm.message}
                      </div>
                    )}
                    {evidenceForm.error && (
                      <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-800">
                        {evidenceForm.error}
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block text-xs font-medium text-gray-700">
                        Pickup authorization code
                        <input
                          type="text"
                          value={evidenceForm.pickupAuthCode}
                          onChange={(event) => updateEvidenceForm(pickup.auctionId, {
                            pickupAuthCode: event.target.value.toUpperCase(),
                            error: null,
                            message: null,
                          })}
                          placeholder="AUTH-..."
                          disabled={evidenceForm.submitting}
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono uppercase focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
                        />
                      </label>
                      <label className="block text-xs font-medium text-gray-700">
                        Photos
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic"
                          capture="environment"
                          multiple
                          disabled={evidenceForm.submitting}
                          onChange={(event) => {
                            updateEvidenceForm(pickup.auctionId, {
                              files: [
                                ...evidenceForm.files,
                                ...Array.from(event.target.files || []),
                              ].slice(0, 12),
                              error: null,
                              message: null,
                            });
                            event.currentTarget.value = '';
                          }}
                          className="mt-1 block w-full text-xs text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--brand-primary)] hover:file:bg-gray-100"
                        />
                        <span className="mt-1 block text-[11px] text-gray-500">
                          {evidenceForm.files.length > 0
                            ? `${evidenceForm.files.length} selected`
                            : '3 to 12 photos'}
                        </span>
                      </label>
                    </div>
                    <label className="mt-3 block text-xs font-medium text-gray-700">
                      Notes
                      <textarea
                        value={evidenceForm.notes}
                        onChange={(event) => updateEvidenceForm(pickup.auctionId, {
                          notes: event.target.value,
                          error: null,
                          message: null,
                        })}
                        rows={2}
                        disabled={evidenceForm.submitting}
                        placeholder="Condition observed at pickup, missing parts, quantity notes, or handoff remarks"
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void submitPickupEvidence(pickup)}
                      disabled={evidenceForm.submitting}
                      className="mt-3 rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {evidenceForm.submitting
                        ? evidenceForm.submissionStage === 'uploading'
                          ? `Uploading photos ${evidenceForm.uploadProgress}%`
                          : 'Comparing evidence'
                        : 'Submit Evidence'}
                    </button>
                    {evidenceForm.submitting && (
                      <p className="mt-2 text-xs text-gray-600" role="status" aria-live="polite">
                        Evidence is being secured. This may take a moment.
                      </p>
                    )}
                  </div>
                    )}
                </div>
              );
              })}
            </div>
          </div>
        )}

        <div className="relative left-1/2 mb-8 w-screen max-w-[100vw] -translate-x-1/2 bg-[var(--brand-primary)] px-4 py-6 md:static md:left-auto md:w-auto md:max-w-none md:translate-x-0 md:rounded-lg md:bg-white md:shadow md:p-6">
          <div className="flex flex-col gap-1 mb-5">
            <h2 className="text-xl font-bold text-white md:text-gray-900">Buyer Operations</h2>
            <p className="text-sm text-white/85 md:text-gray-600">
              Payment obligations, pickup readiness, and reliability signals.
            </p>
          </div>

          <div className="space-y-3 md:hidden">
            <div className="grid grid-cols-2 gap-3 min-w-0">
              <StatTile
                title="Won unpaid"
                value={buyerControl.wonAwaitingPayment}
                subtitle="Auctions needing payment"
                valueClassName="text-amber-700"
                className="bg-white/95 border-white/20"
              />
              <StatTile
                title="Signed unpaid"
                value={buyerControl.signedAwaitingPayment}
                subtitle="Documents signed, payment pending"
                valueClassName="text-red-700"
                className="bg-white/95 border-white/20"
              />
            </div>
            <StatTile
              title="Pickup ready"
              value={buyerControl.paidAwaitingPickup}
              subtitle="Paid assets awaiting handoff"
              valueClassName="text-emerald-700"
              className="bg-white/95 border-white/20"
            />
            <div className="grid grid-cols-2 gap-3 min-w-0">
              <StatTile
                title="Payment cycle"
                value={formatHours(buyerControl.averagePaymentTimeHours)}
                subtitle="Auction close to verified payment"
                className="bg-white/95 border-white/20"
              />
              <StatTile
                title="Pickup cycle"
                value={formatHours(buyerControl.averagePickupTimeHours)}
                subtitle="Average payment to staff confirmation"
                className="bg-white/95 border-white/20"
              />
            </div>
          </div>

          <StatGrid minCol={140} className="hidden md:grid">
            <StatTile title="Won unpaid" value={buyerControl.wonAwaitingPayment} subtitle="Auctions needing payment" valueClassName="text-amber-700" />
            <StatTile title="Signed unpaid" value={buyerControl.signedAwaitingPayment} subtitle="Documents signed, payment pending" valueClassName="text-red-700" />
            <StatTile title="Pickup ready" value={buyerControl.paidAwaitingPickup} subtitle="Paid assets awaiting handoff" valueClassName="text-emerald-700" />
            <StatTile title="Payment cycle" value={formatHours(buyerControl.averagePaymentTimeHours)} subtitle="Auction close to verified payment" />
            <StatTile title="Pickup cycle" value={formatHours(buyerControl.averagePickupTimeHours)} subtitle="Average payment to staff confirmation" />
          </StatGrid>
        </div>

        <div className="md:hidden mb-4">
          <StatCard
            title="Win Rate"
            value={`${performanceStats.winRate.toFixed(1)}%`}
            subtitle={`${performanceStats.totalWins} wins / ${performanceStats.totalBids} bids`}
            icon={
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" />
                </svg>
              </div>
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8 min-w-0 md:hidden">
          <StatCard
            title="On-Time Pickup"
            value={`${performanceStats.onTimePickupRate.toFixed(1)}%`}
            subtitle="Within 48h pickup SLA"
            icon={
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            }
          />
          <StatCard
            title="Rating"
            value={performanceStats.ratingLabel || (performanceStats.rating > 0 ? performanceStats.rating.toFixed(1) : 'Not enough data')}
            subtitle={
              performanceStats.rating >= 4.5
                ? 'Top rated!'
                : performanceStats.rating > 0
                  ? 'Out of 5 stars'
                  : 'Builds after more bids and payments'
            }
            icon={
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            }
          />
        </div>

        <StatGrid className="mb-8 hidden md:grid" minCol={200}>
          <StatCard
            title="Win Rate"
            value={`${performanceStats.winRate.toFixed(1)}%`}
            subtitle={`${performanceStats.totalWins} wins / ${performanceStats.totalBids} bids`}
            icon={
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
            }
          />

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

          <StatCard
            title="On-Time Pickup"
            value={`${performanceStats.onTimePickupRate.toFixed(1)}%`}
            subtitle="Within 48h pickup SLA"
            icon={
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            }
          />
          <StatCard
            title="Rating"
            value={performanceStats.ratingLabel || (performanceStats.rating > 0 ? performanceStats.rating.toFixed(1) : 'Not enough data')}
            subtitle={
              performanceStats.rating >= 4.5
                ? 'Top rated!'
                : performanceStats.rating > 0
                  ? 'Out of 5 stars'
                  : 'Builds after more bids and payments'
            }
            icon={
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            }
          />
        </StatGrid>

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
        <div className="hidden md:block bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Comparison to Last Month
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
            {comparisons.map((comparison) => (
              <div
                key={comparison.metric}
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow min-w-0 overflow-hidden"
              >
                <h3 className="text-sm font-medium text-gray-500 mb-2 truncate">
                  {comparison.metric}
                </h3>
                <div className="flex items-baseline gap-2 mb-2 min-w-0">
                  <MetricValue className="text-gray-900">
                    {comparison.metric.includes('Time')
                      ? `${comparison.currentValue.toFixed(1)}h`
                      : comparison.metric.includes('Rate')
                      ? `${comparison.currentValue.toFixed(1)}%`
                      : comparison.currentValue}
                  </MetricValue>
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
