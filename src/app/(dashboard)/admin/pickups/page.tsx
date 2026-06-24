/**
 * Admin Pickup Confirmations List Page
 * 
 * Displays list of auctions where vendors have confirmed pickup
 * but admin has not yet confirmed. Allows admin to confirm pickups.
 * 
 * Requirements: Requirement 5 - Pickup Confirmation Workflow
 */

'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { useAppRouter } from '@/hooks/use-app-router';
import {
  AdminPickupConfirmation,
  type PickupConfirmationSubmitInput,
} from '@/components/admin/admin-pickup-confirmation';
import { DataLoadingState } from '@/components/ui/loading-states';
import { PickupConfirmationDesk } from '@/components/pickups/pickup-confirmation-desk';

interface PickupConfirmation {
  auctionId: string;
  claimReference: string;
  policyNumber?: string | null;
  assetType: string;
  assetDetails: Record<string, unknown>;
  amount: string;
  vendor: {
    id: string;
    businessName: string;
    fullName: string;
    email: string;
    phone: string;
  };
  vendorConfirmation: {
    confirmed: boolean;
    confirmedAt: string | null;
  };
  adminConfirmation: {
    confirmed: boolean;
    confirmedAt: string | null;
    confirmedBy: string | null;
  };
  payment: {
    id: string;
    amount: string;
    status: string;
    paymentMethod: string;
    verifiedAt?: string | null;
  } | null;
  pickupStatus?: 'not_ready' | 'ready_for_pickup' | 'vendor_confirmed' | 'staff_confirmed';
  pickupDeadline?: string | null;
  pickupEvidence: {
    id: string;
    status: 'not_reviewed' | 'matches_expected' | 'review_needed' | 'material_discrepancy' | string;
    photoCount: number | null;
    findings: string[];
    observedDifferences?: string[];
    confidenceScore?: number | null;
    overallMatchScore?: number | null;
    assetIdentityScore?: number | null;
    quantityMatchScore?: number | null;
    conditionMatchScore?: number | null;
    reviewBand?: string | null;
    method?: string | null;
    recommendedStaffAction?: string | null;
    resolutionStatus?: string | null;
    adjustmentAmount?: string | null;
    reimbursementMethod?: string | null;
    submittedAt: string | null;
  } | null;
  auctionStatus: string;
  caseStatus: string;
  auctionEndTime: string;
}

export default function AdminPickupsPage() {
  const { data: session } = useSession();
  const router = useAppRouter();
  const [allPickups, setAllPickups] = useState<PickupConfirmation[]>([]);
  const pickupsRef = useRef<PickupConfirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPickup, setSelectedPickup] = useState<PickupConfirmation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<'pending' | 'evidence_issues' | 'all'>('pending');
  const [sortBy, setSortBy] = useState<'confirmedAt' | 'amount' | 'claimRef'>('confirmedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Redirect if not admin or manager
  useEffect(() => {
    if (session && !['salvage_manager', 'system_admin'].includes(session.user.role)) {
      router.push('/dashboard');
    }
  }, [session, router]);

  // Fetch all pickup confirmations once; filter/sort client-side
  const fetchPickups = useCallback(async () => {
    const showFullPageLoader = pickupsRef.current.length === 0;
    try {
      if (showFullPageLoader) {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams({
        status: 'all',
        sortBy: 'confirmedAt',
        sortOrder: 'desc',
      });

      const response = await fetch(`/api/admin/pickups?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch pickup confirmations');
      }

      const data = await response.json();
      const nextPickups = data.pickups || [];
      pickupsRef.current = nextPickups;
      setAllPickups(nextPickups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pickup confirmations');
      if (showFullPageLoader) {
        pickupsRef.current = [];
        setAllPickups([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPickups();
  }, [fetchPickups]);

  const pickups = useMemo(() => {
    let list = [...allPickups];
    if (statusFilter === 'pending') {
      list = list.filter((p) => !p.adminConfirmation.confirmed);
    } else if (statusFilter === 'evidence_issues') {
      list = list.filter((p) =>
        p.pickupEvidence?.status === 'review_needed'
        || p.pickupEvidence?.status === 'material_discrepancy'
      );
    }

    const sorted = [...list];
    if (sortBy === 'amount') {
      sorted.sort((a, b) => {
        const amountA = parseFloat(a.amount || '0');
        const amountB = parseFloat(b.amount || '0');
        return sortOrder === 'desc' ? amountB - amountA : amountA - amountB;
      });
    } else if (sortBy === 'claimRef') {
      sorted.sort((a, b) => {
        const comparison = a.claimReference.localeCompare(b.claimReference);
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    } else {
      sorted.sort((a, b) => {
        const dateA = a.vendorConfirmation.confirmedAt
          ? new Date(a.vendorConfirmation.confirmedAt).getTime()
          : 0;
        const dateB = b.vendorConfirmation.confirmedAt
          ? new Date(b.vendorConfirmation.confirmedAt).getTime()
          : 0;
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
    }
    return sorted;
  }, [allPickups, statusFilter, sortBy, sortOrder]);

  // Handle admin confirmation
  const handleConfirmPickup = async (input: PickupConfirmationSubmitInput) => {
    if (!selectedPickup) return;

    try {
      const response = await fetch(
        `/api/admin/auctions/${selectedPickup.auctionId}/confirm-pickup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            adminId: session?.user.id,
            notes: input.notes,
            resolutionStatus: input.resolutionStatus,
            adjustmentAmount: input.adjustmentAmount,
            reimbursementMethod: input.reimbursementMethod,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to confirm pickup');
      }

      // Refresh list
      await fetchPickups();
      setIsModalOpen(false);
      setSelectedPickup(null);
    } catch (err) {
      throw err; // Let the component handle the error
    }
  };

  // Format asset name
  const formatAssetName = (pickup: PickupConfirmation) => {
    const details = pickup.assetDetails as Record<string, string>;
    if (pickup.assetType === 'vehicle') {
      return `${details.year || ''} ${details.make || ''} ${details.model || ''}`.trim();
    }
    return pickup.assetType;
  };

  const evidenceTone = (status?: string | null) => {
    if (status === 'material_discrepancy') return 'bg-red-50 border-red-200 text-red-800';
    if (status === 'review_needed' || status === 'not_reviewed') return 'bg-amber-50 border-amber-200 text-amber-800';
    if (status === 'matches_expected') return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    return 'bg-gray-50 border-gray-200 text-gray-700';
  };

  const evidenceLabel = (status?: string | null) => {
    if (status === 'material_discrepancy') return 'Discrepancy';
    if (status === 'review_needed') return 'Review needed';
    if (status === 'not_reviewed') return 'Not reviewed';
    if (status === 'matches_expected') return 'Evidence ok';
    return 'No evidence';
  };

  const scoreTone = (score?: number | null) => {
    if (score == null) return 'text-gray-500';
    if (score >= 85) return 'text-emerald-700';
    if (score >= 70) return 'text-amber-700';
    return 'text-red-700';
  };

  // Filter pickups by search query
  const filteredPickups = pickups.filter((pickup) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      pickup.claimReference.toLowerCase().includes(query) ||
      pickup.vendor.businessName.toLowerCase().includes(query) ||
      pickup.vendor.fullName.toLowerCase().includes(query) ||
      formatAssetName(pickup).toLowerCase().includes(query) ||
      (pickup.pickupEvidence?.findings || []).some((finding) => finding.toLowerCase().includes(query)) ||
      (pickup.pickupEvidence?.observedDifferences || []).some((difference) => difference.toLowerCase().includes(query))
    );
  });

  if (loading && allPickups.length === 0) {
    return <DataLoadingState label="Pickup confirmations" variant="page" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pickup Confirmations</h1>
          <p className="mt-2 text-gray-600">
            Confirm vendor pickups and complete transactions
          </p>
        </div>

        <div className="mb-6">
          <PickupConfirmationDesk onConfirmed={fetchPickups} />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                id="search"
                placeholder="Search by claim ref, vendor, asset, or evidence note..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'pending' | 'evidence_issues' | 'all')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
              >
                <option value="pending">Pending Only</option>
                <option value="evidence_issues">Evidence Issues</option>
                <option value="all">All Pickups</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'confirmedAt' | 'amount' | 'claimRef')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
              >
                <option value="confirmedAt">Confirmation Date</option>
                <option value="amount">Amount</option>
                <option value="claimRef">Claim Reference</option>
              </select>
            </div>
          </div>

          {/* Sort Order Toggle */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Pickups List */}
        {filteredPickups.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No pending pickups</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery
                ? 'No pickups match your search'
                : 'All pickups have been confirmed'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPickups.map((pickup) => (
              <div key={pickup.auctionId} className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                  {/* Auction Details */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Auction Details</h3>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-gray-600">Claim:</span>{' '}
                        <span className="font-medium">{pickup.claimReference}</span>
                      </p>
                      {pickup.policyNumber && (
                        <p>
                          <span className="text-gray-600">Policy:</span>{' '}
                          <span className="font-medium">{pickup.policyNumber}</span>
                        </p>
                      )}
                      <p>
                        <span className="text-gray-600">Asset:</span>{' '}
                        <span className="font-medium">{formatAssetName(pickup)}</span>
                      </p>
                      <p>
                        <span className="text-gray-600">Amount:</span>{' '}
                        <span className="font-medium">
                          ₦{parseFloat(pickup.amount || '0').toLocaleString()}
                        </span>
                      </p>
                      <p>
                        <span className="text-gray-600">Closed:</span>{' '}
                        <span className="font-medium">
                          {new Date(pickup.auctionEndTime).toLocaleDateString()}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Vendor Details */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Vendor</h3>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-gray-600">Name:</span>{' '}
                        <span className="font-medium">{pickup.vendor.fullName}</span>
                      </p>
                      <p>
                        <span className="text-gray-600">Business:</span>{' '}
                        <span className="font-medium">{pickup.vendor.businessName}</span>
                      </p>
                      <p>
                        <span className="text-gray-600">Email:</span>{' '}
                        <span className="font-medium break-all">{pickup.vendor.email}</span>
                      </p>
                      <p>
                        <span className="text-gray-600">Phone:</span>{' '}
                        <span className="font-medium">{pickup.vendor.phone}</span>
                      </p>
                    </div>
                  </div>

                  {/* Confirmation Status */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Status</h3>
                    <div className="space-y-2">
                      <div className={`p-2 rounded-lg ${
                        pickup.vendorConfirmation.confirmed
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-yellow-50 border border-yellow-200'
                      }`}>
                        <p className={`text-xs font-medium ${
                          pickup.vendorConfirmation.confirmed
                            ? 'text-green-800'
                            : 'text-yellow-800'
                        }`}>
                          Vendor: {pickup.vendorConfirmation.confirmed ? '✓ Confirmed' : 'Pending'}
                        </p>
                        {pickup.vendorConfirmation.confirmedAt && (
                          <p className="text-xs text-gray-600 mt-1">
                            {new Date(pickup.vendorConfirmation.confirmedAt).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className={`p-2 rounded-lg ${
                        pickup.adminConfirmation.confirmed
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-yellow-50 border border-yellow-200'
                      }`}>
                        <p className={`text-xs font-medium ${
                          pickup.adminConfirmation.confirmed
                            ? 'text-green-800'
                            : 'text-yellow-800'
                        }`}>
                          Admin: {pickup.adminConfirmation.confirmed ? '✓ Confirmed' : 'Pending'}
                        </p>
                        {pickup.adminConfirmation.confirmedAt && (
                          <p className="text-xs text-gray-600 mt-1">
                            {new Date(pickup.adminConfirmation.confirmedAt).toLocaleString()}
                          </p>
                        )}
                      </div>

                      {pickup.payment && (
                        <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                          <p className="text-xs font-medium text-blue-800">
                            Payment: {pickup.payment.status.toUpperCase()}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {pickup.payment.paymentMethod.replace('_', ' ')}
                          </p>
                        </div>
                      )}

                      <div className={`p-2 rounded-lg border ${evidenceTone(pickup.pickupEvidence?.status)}`}>
                        <p className="text-xs font-medium">
                          Evidence: {pickup.pickupEvidence ? evidenceLabel(pickup.pickupEvidence.status) : 'Not submitted'}
                        </p>
                        {pickup.pickupEvidence?.submittedAt && (
                          <p className="text-xs text-gray-600 mt-1">
                            {pickup.pickupEvidence.photoCount ?? 0} photo{pickup.pickupEvidence.photoCount === 1 ? '' : 's'}
                            {' · '}
                            {new Date(pickup.pickupEvidence.submittedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {pickup.pickupEvidence && (
                  <div className={`rounded-lg border p-4 text-sm ${evidenceTone(pickup.pickupEvidence.status)}`}>
                    <p className="font-semibold text-gray-900">Evidence review</p>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <p>Identity: <span className={scoreTone(pickup.pickupEvidence.assetIdentityScore)}>{pickup.pickupEvidence.assetIdentityScore ?? 'N/A'}%</span></p>
                      <p>Quantity: <span className={scoreTone(pickup.pickupEvidence.quantityMatchScore)}>{pickup.pickupEvidence.quantityMatchScore ?? 'N/A'}%</span></p>
                      <p>Condition: <span className={scoreTone(pickup.pickupEvidence.conditionMatchScore)}>{pickup.pickupEvidence.conditionMatchScore ?? 'N/A'}%</span></p>
                      <p>Method: {pickup.pickupEvidence.method || 'unknown'}</p>
                    </div>
                    <p className={`mt-2 text-xs ${scoreTone(pickup.pickupEvidence.overallMatchScore)}`}>
                      Overall match: {pickup.pickupEvidence.overallMatchScore ?? pickup.pickupEvidence.confidenceScore ?? 'N/A'}%
                      {pickup.pickupEvidence.reviewBand ? ` (${pickup.pickupEvidence.reviewBand.replace(/_/g, ' ')})` : ''}
                    </p>
                    {pickup.pickupEvidence.findings?.length > 0 && (
                      <ul className="mt-3 list-disc space-y-1 pl-4 text-xs">
                        {pickup.pickupEvidence.findings.slice(0, 4).map((finding, index) => (
                          <li key={index}>{finding}</li>
                        ))}
                      </ul>
                    )}
                    {pickup.pickupEvidence.recommendedStaffAction && (
                      <p className="mt-3 text-xs font-medium">{pickup.pickupEvidence.recommendedStaffAction}</p>
                    )}
                    {pickup.pickupEvidence.resolutionStatus && pickup.pickupEvidence.resolutionStatus !== 'not_required' && (
                      <div className="mt-3 rounded-md bg-white/70 p-3 text-xs">
                        <p className="font-semibold">Resolution: {pickup.pickupEvidence.resolutionStatus.replace(/_/g, ' ')}</p>
                        {pickup.pickupEvidence.adjustmentAmount && (
                          <p>Adjustment: NGN {Number(pickup.pickupEvidence.adjustmentAmount).toLocaleString('en-NG')}</p>
                        )}
                        {pickup.pickupEvidence.reimbursementMethod && (
                          <p>Method: {pickup.pickupEvidence.reimbursementMethod}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 border-t border-gray-100 pt-4">
                  {!pickup.adminConfirmation.confirmed ? (
                    <button
                      onClick={() => {
                        setSelectedPickup(pickup);
                        setIsModalOpen(true);
                      }}
                      className="w-full sm:w-auto sm:min-w-[200px] px-4 py-2.5 bg-[var(--brand-primary)] text-white rounded-lg font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors text-sm"
                    >
                      Confirm Pickup
                    </button>
                  ) : (
                    <div className="w-full sm:w-auto text-center px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-medium text-green-800">✓ Pickup completed</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pickup Confirmation Modal */}
        {isModalOpen && selectedPickup && session?.user && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0" style={{ zIndex: 999999 }}>
            <div className="fixed inset-0 bg-black/50" onClick={() => {
              setIsModalOpen(false);
              setSelectedPickup(null);
            }} />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Confirm Pickup</h2>
                    <button
                      onClick={() => {
                        setIsModalOpen(false);
                        setSelectedPickup(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Pickup Details */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Claim:</span> {selectedPickup.claimReference}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Asset:</span> {formatAssetName(selectedPickup)}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Vendor:</span> {selectedPickup.vendor.fullName} ({selectedPickup.vendor.businessName})
                    </p>
                  </div>

                  {selectedPickup.pickupEvidence && (
                    <div className={`mb-6 rounded-lg border p-4 ${evidenceTone(selectedPickup.pickupEvidence.status)}`}>
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold">
                          Pickup Evidence: {evidenceLabel(selectedPickup.pickupEvidence.status)}
                        </p>
                        <p className="text-xs">
                          {selectedPickup.pickupEvidence.photoCount ?? 0} photo{selectedPickup.pickupEvidence.photoCount === 1 ? '' : 's'}
                          {typeof selectedPickup.pickupEvidence.confidenceScore === 'number'
                            ? ` | ${selectedPickup.pickupEvidence.confidenceScore}% confidence`
                            : ''}
                          {selectedPickup.pickupEvidence.method
                            ? ` | ${selectedPickup.pickupEvidence.method.replace(/_/g, ' ')}`
                            : ''}
                        </p>
                      </div>
                      {selectedPickup.pickupEvidence.findings.length > 0 && (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
                          {selectedPickup.pickupEvidence.findings.map((finding, index) => (
                            <li key={`${selectedPickup.pickupEvidence?.id}-${index}`}>{finding}</li>
                          ))}
                        </ul>
                      )}
                      {!!selectedPickup.pickupEvidence.observedDifferences?.length && (
                        <div className="mt-3 rounded-md bg-white/60 p-3 text-xs">
                          <p className="font-semibold">Observed differences</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            {selectedPickup.pickupEvidence.observedDifferences.map((difference, index) => (
                              <li key={`${selectedPickup.pickupEvidence?.id}-difference-${index}`}>{difference}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selectedPickup.pickupEvidence.recommendedStaffAction && (
                        <p className="mt-3 text-xs font-medium">
                          Action: {selectedPickup.pickupEvidence.recommendedStaffAction}
                        </p>
                      )}
                      {selectedPickup.pickupEvidence.resolutionStatus && selectedPickup.pickupEvidence.resolutionStatus !== 'not_required' && (
                        <div className="mt-3 rounded-md bg-white/70 p-3 text-xs">
                          <p className="font-semibold">Recorded resolution</p>
                          <p>{selectedPickup.pickupEvidence.resolutionStatus.replace(/_/g, ' ')}</p>
                          {selectedPickup.pickupEvidence.adjustmentAmount && (
                            <p>Adjustment: NGN {Number(selectedPickup.pickupEvidence.adjustmentAmount).toLocaleString('en-NG')}</p>
                          )}
                          {selectedPickup.pickupEvidence.reimbursementMethod && (
                            <p>Method: {selectedPickup.pickupEvidence.reimbursementMethod}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* AdminPickupConfirmation Component */}
                  <AdminPickupConfirmation
                    auctionId={selectedPickup.auctionId}
                    adminId={session.user.id}
                    vendorPickupStatus={{
                      confirmed: selectedPickup.vendorConfirmation.confirmed,
                      confirmedAt: selectedPickup.vendorConfirmation.confirmedAt,
                    }}
                    evidenceNeedsReview={
                      selectedPickup.pickupEvidence?.status === 'review_needed'
                      || selectedPickup.pickupEvidence?.status === 'material_discrepancy'
                    }
                    onConfirm={handleConfirmPickup}
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
