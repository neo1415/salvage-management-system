'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Shield, 
  ArrowLeft,
  FileText,
  Building2,
  CreditCard,
  IdCard,
  XCircle,
  Clock,
  User,
  Mail,
  Phone,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { Vendor } from '@/hooks/queries/use-vendors';
import { useVendorTierCache, type VendorTierTab } from '@/hooks/use-vendor-tier-cache';
import { DataLoadingState } from '@/components/ui/loading-states';
import { FilterChip } from '@/components/ui/filters/filter-chip';
import { FacetedFilter, type FilterOption } from '@/components/ui/filters/faceted-filter';
import { SearchInput } from '@/components/ui/filters/search-input';
import { Filter as FilterIcon, X } from 'lucide-react';
import { SwipeTabsBody } from '@/components/ui/swipe-tabs-body';

const VENDOR_TIER_TABS = ['tier0', 'tier1', 'tier2'] as const;

/**
 * Vendor Management Page for Salvage Manager
 * 
 * Comprehensive vendor KYC management with tier-based tabs
 * Features:
 * - Tabs for Tier 0 (no BVN), Tier 1 (BVN verified), Tier 2 (full business KYC)
 * - Filter by approval status: Pending, Approved, Rejected
 * - Approve/reject vendors with reason
 * - Email and SMS notifications on rejection
 * - Allow rejected vendors to resubmit KYC
 * - Hide KYC page for approved vendors
 * 
 * Requirements: 7, NFR5.3
 */

interface VendorApplication extends Vendor {}

type TierTab = VendorTierTab;
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

function vendorDisplayName(application: VendorApplication): string {
  const business = application.businessName?.trim();
  if (business) return business;
  const fullName = application.user.fullName?.trim();
  if (fullName) return fullName;
  return application.user.email || 'Unknown vendor';
}

function getEmptyVendorTitle(
  searchQuery: string,
  hasActiveFilters: boolean,
  statusFilter: StatusFilter
): string {
  if (searchQuery) return `No results found for "${searchQuery}"`;
  if (hasActiveFilters) return 'No vendors match your filters';
  if (statusFilter === 'pending') return 'No Pending Vendors';
  if (statusFilter === 'approved') return 'No Approved Vendors';
  if (statusFilter === 'rejected') return 'No Rejected Vendors';
  return 'No Vendors';
}

function getEmptyVendorDescription(hasActiveFilters: boolean, statusFilter: StatusFilter): string {
  if (hasActiveFilters) return 'Try adjusting your filters to see more results.';
  if (statusFilter === 'pending') {
    return 'All vendors have been reviewed. Check back later for new submissions.';
  }
  return 'No vendors found in this category.';
}

export default function VendorManagementPage() {
  return (
    <Suspense fallback={<DataLoadingState label="Vendor management" variant="page" />}>
      <VendorManagementContent />
    </Suspense>
  );
}

function VendorManagementContent() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const searchParams = useSearchParams();
  const isSalvageManager = session?.user?.role === 'salvage_manager';

  // State
  const [selectedApplication, setSelectedApplication] = useState<VendorApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [automaticReviewEnabled, setAutomaticReviewEnabled] = useState(false);
  const [reviewModeLoading, setReviewModeLoading] = useState(true);
  const [reviewModeSaving, setReviewModeSaving] = useState(false);

  // Tab and filter state with URL persistence
  const [activeTab, setActiveTab] = useState<TierTab>(
    (searchParams.get('tier') as TierTab) || 'tier0'
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get('status') as StatusFilter) || 'all'
  );
  const [verificationFilter, setVerificationFilter] = useState<string[]>(
    searchParams.get('verification')?.split(',').filter(Boolean) || []
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [showFilters, setShowFilters] = useState(false);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tier', activeTab);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (verificationFilter.length > 0) params.set('verification', verificationFilter.join(','));
    if (searchQuery) params.set('search', searchQuery);
    
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    window.history.replaceState(null, '', `/manager/vendors${newUrl}`);
  }, [activeTab, statusFilter, verificationFilter, searchQuery]);

  // Check if any filters are active
  const hasActiveFilters = verificationFilter.length > 0 || searchQuery !== '' || statusFilter !== 'all';
  const activeFilterCount = verificationFilter.length + (searchQuery ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  // Clear all filters
  const clearAllFilters = () => {
    setVerificationFilter([]);
    setSearchQuery('');
    setStatusFilter('all');
  };

  useEffect(() => {
    let cancelled = false;

    async function loadReviewMode() {
      try {
        const response = await fetch('/api/kyc/review-mode');
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setAutomaticReviewEnabled(Boolean(data.automaticReviewEnabled));
      } catch (err) {
        console.error('Failed to load Tier 2 review mode:', err);
      } finally {
        if (!cancelled) setReviewModeLoading(false);
      }
    }

    loadReviewMode();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleReviewModeToggle = async () => {
    const nextValue = !automaticReviewEnabled;
    setReviewModeSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/kyc/review-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          automaticReviewEnabled: nextValue,
          reason: `Tier 2 review mode changed to ${nextValue ? 'automatic' : 'manual'} from vendor management`,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update review mode');
      setAutomaticReviewEnabled(Boolean(result.automaticReviewEnabled));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update review mode');
    } finally {
      setReviewModeSaving(false);
    }
  };

  const { vendorsByTier, isInitialLoading, refetchAll } = useVendorTierCache();

  const tierApplications = vendorsByTier[activeTab];

  const applications = useMemo(() => {
    return tierApplications.filter((app) => {
      if (statusFilter !== 'all' && app.kycStatus !== statusFilter) {
        return false;
      }

      if (activeTab !== 'tier0' && verificationFilter.length > 0) {
        const hasAllVerifications = verificationFilter.every((filter) => {
          switch (filter) {
            case 'bvn':
              return app.bvnVerified;
            case 'nin':
              return app.ninVerified;
            case 'bank':
              return app.bankAccountVerified;
            case 'cac':
              return app.cacVerified;
            default:
              return true;
          }
        });
        if (!hasAllVerifications) return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesBusinessName = app.businessName?.toLowerCase().includes(query);
        const matchesFullName = app.user.fullName.toLowerCase().includes(query);
        const matchesEmail = app.user.email.toLowerCase().includes(query);
        const matchesCac = app.cacNumber?.toLowerCase().includes(query);

        if (!matchesBusinessName && !matchesFullName && !matchesEmail && !matchesCac) {
          return false;
        }
      }

      return true;
    });
  }, [tierApplications, statusFilter, activeTab, verificationFilter, searchQuery]);

  // Verification filter options (conditional based on tier)
  const getVerificationOptions = (): FilterOption[] => {
    switch (activeTab) {
      case 'tier0':
        return [];
      case 'tier1':
        return [
          { value: 'bvn', label: 'BVN Verified', count: tierApplications.filter((a) => a.bvnVerified).length },
        ];
      case 'tier2':
        return [
          { value: 'bvn', label: 'BVN Verified', count: tierApplications.filter((a) => a.bvnVerified).length },
          { value: 'nin', label: 'NIN Verified', count: tierApplications.filter((a) => a.ninVerified).length },
          { value: 'bank', label: 'Bank Verified', count: tierApplications.filter((a) => a.bankAccountVerified).length },
          { value: 'cac', label: 'CAC Verified', count: tierApplications.filter((a) => a.cacVerified).length },
        ];
      default:
        return [];
    }
  };

  const verificationOptions = getVerificationOptions();

  // Redirect if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [sessionStatus, router]);

  // Handle review submission
  const handleReviewSubmit = async () => {
    if (!selectedApplication || !reviewAction) return;

    // Validate comment for rejection
    if (reviewAction === 'reject' && (!comment || comment.trim().length === 0)) {
      setError('Please provide a reason for rejection');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      console.log('🔄 Submitting vendor review:', {
        vendorId: selectedApplication.id,
        action: reviewAction,
        hasComment: !!comment,
      });

      const response = await fetch(`/api/vendors/${selectedApplication.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: reviewAction,
          comment: comment.trim() || undefined,
        }),
      });

      console.log('📡 API Response status:', response.status, response.statusText);

      const result = await response.json();
      console.log('📦 API Response data:', result);

      if (!response.ok) {
        console.error('❌ API returned error:', result);
        throw new Error(result.error || result.message || 'Review submission failed');
      }

      // Verify the response has success flag
      if (!result.success) {
        console.error('❌ API response missing success flag:', result);
        throw new Error('Review submission failed - invalid response from server');
      }

      console.log('✅ Vendor review submitted successfully');

      await refetchAll();
      setSelectedApplication(null);
      setReviewAction(null);
      setComment('');
    } catch (err) {
      console.error('❌ Error submitting vendor review:', err);
      setError(err instanceof Error ? err.message : 'Review submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (sessionStatus === 'loading' || isInitialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#800020] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
          </div>
          
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#800020] rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Vendor Management</h1>
              <p className="text-gray-600">Manage vendor KYC approvals across all tiers</p>
            </div>
          </div>

          {/* Tier Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('tier0')}
              className={`px-6 py-3 font-semibold transition-all border-b-2 ${
                activeTab === 'tier0'
                  ? 'border-[#800020] text-[#800020]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Tier 0
              <span className="ml-2 text-xs text-gray-500">(No BVN)</span>
            </button>
            <button
              onClick={() => setActiveTab('tier1')}
              className={`px-6 py-3 font-semibold transition-all border-b-2 ${
                activeTab === 'tier1'
                  ? 'border-[#800020] text-[#800020]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Tier 1
              <span className="ml-2 text-xs text-gray-500">(BVN Verified)</span>
            </button>
            <button
              onClick={() => setActiveTab('tier2')}
              className={`px-6 py-3 font-semibold transition-all border-b-2 ${
                activeTab === 'tier2'
                  ? 'border-[#800020] text-[#800020]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Tier 2
              <span className="ml-2 text-xs text-gray-500">(Full Business KYC)</span>
            </button>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-[#800020] text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'pending'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'approved'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'rejected'
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Rejected
            </button>
          </div>

          {/* Search Bar */}
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by business name, contact name, email, or CAC number..."
            className="w-full mb-4"
          />

          {isSalvageManager && activeTab === 'tier2' && (
            <div className="mb-4 bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">Tier 2 Review Mode</h3>
                    <p className="text-xs text-gray-500">
                      {automaticReviewEnabled
                        ? 'Automatic review is on. Clean submissions are approved immediately; flagged submissions still go to manager review.'
                        : 'Manual review is on. Every Tier 2 submission waits for manager approval.'}
                    </p>
                  </div>
                  <button
                    onClick={handleReviewModeToggle}
                    disabled={reviewModeLoading || reviewModeSaving}
                    className={`relative inline-flex h-7 w-14 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      automaticReviewEnabled ? 'bg-[#800020]' : 'bg-gray-300'
                    }`}
                    aria-pressed={automaticReviewEnabled}
                    aria-label="Toggle Tier 2 automatic review"
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        automaticReviewEnabled ? 'translate-x-8' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              <p className="mt-3 text-xs font-medium text-gray-700">
                Current mode: {automaticReviewEnabled ? 'Automatic' : 'Manual'}
              </p>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {verificationOptions.length > 0 && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2"
                aria-label="Toggle filters"
                aria-expanded={showFilters}
              >
                <FilterIcon size={18} aria-hidden="true" />
                <span className="text-sm font-medium">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 bg-[#800020] text-white rounded-full text-xs font-medium">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}

            {/* Active Filter Chips */}
            {statusFilter !== 'all' && (
              <FilterChip
                label={`Status: ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`}
                onRemove={() => setStatusFilter('all')}
              />
            )}
            {verificationFilter.map(filter => {
              const labels: Record<string, string> = {
                bvn: 'BVN Verified',
                nin: 'NIN Verified',
                bank: 'Bank Verified',
                cac: 'CAC Verified',
              };
              return (
                <FilterChip
                  key={filter}
                  label={labels[filter]}
                  onRemove={() => setVerificationFilter(verificationFilter.filter(f => f !== filter))}
                />
              );
            })}
            {searchQuery && (
              <FilterChip
                label={`Search: "${searchQuery}"`}
                onRemove={() => setSearchQuery('')}
              />
            )}

            {/* Clear All Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2 rounded"
                aria-label="Clear all filters"
              >
                <X size={14} aria-hidden="true" />
                <span>Clear all</span>
              </button>
            )}
          </div>

          {/* Expandable Filters Panel */}
          {showFilters && verificationOptions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Filter Options</h3>
                <span className="text-xs text-gray-500">
                  {applications.length} of {tierApplications.length} vendors
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                {/* Verification Status Faceted Filter */}
                <FacetedFilter
                  title="Verification Status"
                  options={verificationOptions}
                  selected={verificationFilter}
                  onChange={setVerificationFilter}
                />
              </div>
            </div>
          )}

          {/* Results Count */}
          {hasActiveFilters && (
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{applications.length}</span> of <span className="font-semibold text-gray-900">{tierApplications.length}</span> vendors
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && !selectedApplication && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Applications List — swipe left/right on touch to change tier tab */}
        <SwipeTabsBody
          tabs={VENDOR_TIER_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
        {applications.length === 0 && !isInitialLoading ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <CheckCircle2 className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {getEmptyVendorTitle(searchQuery, hasActiveFilters, statusFilter)}
            </h2>
            <p className="text-gray-600">
              {getEmptyVendorDescription(hasActiveFilters, statusFilter)}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="mt-4 px-6 py-2 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {applications.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                tier={activeTab}
                onReview={() => activeTab === 'tier2' ? router.push(`/manager/kyc-approvals/${application.id}`) : setSelectedApplication(application)}
              />
            ))}
          </div>
        )}
        </SwipeTabsBody>

        {/* Review Modal */}
        {selectedApplication && (
          <ReviewModal
            application={selectedApplication}
            tier={activeTab}
            reviewAction={reviewAction}
            comment={comment}
            submitting={submitting}
            error={error}
            onClose={() => {
              setSelectedApplication(null);
              setReviewAction(null);
              setComment('');
              setError(null);
            }}
            onActionChange={setReviewAction}
            onCommentChange={setComment}
            onSubmit={handleReviewSubmit}
          />
        )}
      </div>
    </div>
  );
}

// Application Card Component
function ApplicationCard({ 
  application, 
  tier,
  onReview 
}: { 
  application: VendorApplication;
  tier: TierTab;
  onReview: () => void;
}) {
  const providerEvidence = application.providerEvidence;
  const normalized = (providerEvidence?.normalizedResult ?? {}) as Record<string, unknown>;
  const submittedAt = application.tier2SubmittedAt || providerEvidence?.updatedAt || application.createdAt;
  const flagCount = providerEvidence
    ? (providerEvidence.failedChecks?.length ?? 0) + (providerEvidence.reasonCodes?.length ?? 0)
    : 0;

  // Determine status badge
  const getStatusBadge = () => {
    if (application.kycStatus === 'approved') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Approved
        </div>
      );
    } else if (application.kycStatus === 'rejected') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
          <XCircle className="w-4 h-4" />
          Rejected
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
          <Clock className="w-4 h-4" />
          Pending Review
        </div>
      );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#800020] rounded-full flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{vendorDisplayName(application)}</h3>
              <p className="text-sm text-gray-600">{application.user.fullName}</p>
            </div>
          </div>
          
          {getStatusBadge()}
        </div>

        {/* Vendor Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Contact:</span>
            <span className="font-medium text-gray-900">{application.user.fullName}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Email:</span>
            <span className="font-medium text-gray-900">{application.user.email}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Phone:</span>
            <span className="font-medium text-gray-900">{application.user.phone}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Submitted:</span>
            <span className="font-medium text-gray-900">
              {new Date(submittedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {tier === 'tier2' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500">Source</p>
              <p className="font-semibold text-gray-900 capitalize">{application.verificationSource === 'dojah' ? 'Identity verification' : 'Legacy'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500">Verification Status</p>
              <p className="font-semibold text-gray-900 capitalize">
                {providerEvidence?.status?.replace(/_/g, ' ') || 'Not available'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500">Risk</p>
              <p className={`font-semibold capitalize ${
                providerEvidence?.riskLevel === 'critical' || providerEvidence?.riskLevel === 'high'
                  ? 'text-red-600'
                  : providerEvidence?.riskLevel === 'medium'
                    ? 'text-yellow-600'
                    : 'text-gray-900'
              }`}>
                {providerEvidence?.riskLevel || 'Not available'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500">Flags</p>
              <p className="font-semibold text-gray-900">
                {flagCount}
                {normalized.amlStatus === false ? ' (AML flagged)' : ''}
              </p>
            </div>
          </div>
        )}

        {/* Verification Status */}
        {tier !== 'tier0' && (
          <div className="mb-4">
            <h4 className="font-semibold text-gray-900 mb-3">Verification Status</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {tier === 'tier1' && (
                <VerificationBadge
                  label="BVN"
                  verified={application.bvnVerified}
                />
              )}
              {tier === 'tier2' && (
                <>
                  <VerificationBadge
                    label="BVN"
                    verified={application.bvnVerified}
                  />
                  <VerificationBadge
                    label="NIN"
                    verified={application.ninVerified}
                  />
                  <VerificationBadge
                    label="Bank Account"
                    verified={application.bankAccountVerified}
                  />
                  <VerificationBadge
                    label="CAC"
                    verified={application.cacVerified}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Rejection Reason (if rejected) */}
        {application.kycStatus === 'rejected' && application.kycRejectionReason && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-semibold text-red-900 mb-2">Rejection Reason</h4>
            <p className="text-sm text-red-700">{application.kycRejectionReason}</p>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={onReview}
          className="w-full bg-[#800020] text-white font-bold py-3 px-4 rounded-lg hover:bg-[#600018] transition-colors flex items-center justify-center gap-2"
        >
          <Shield className="w-5 h-5" />
          {application.kycStatus === 'pending' ? 'Review' : 'View Details'}
        </button>
      </div>
    </div>
  );
}

// Verification Badge Component
function VerificationBadge({ label, verified }: { label: string; verified: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
      verified 
        ? 'bg-green-100 text-green-800' 
        : 'bg-gray-100 text-gray-600'
    }`}>
      {verified ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <Clock className="w-4 h-4" />
      )}
      <span>{label}</span>
    </div>
  );
}

// Review Modal Component
function ReviewModal({
  application,
  tier,
  reviewAction,
  comment,
  submitting,
  error,
  onClose,
  onActionChange,
  onCommentChange,
  onSubmit,
}: {
  application: VendorApplication;
  tier: TierTab;
  reviewAction: 'approve' | 'reject' | null;
  comment: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onActionChange: (action: 'approve' | 'reject' | null) => void;
  onCommentChange: (comment: string) => void;
  onSubmit: () => void;
}) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string | null>>({});
  const [loadingUrls, setLoadingUrls] = useState(true);

  // Fetch signed URLs for documents
  useEffect(() => {
    if (tier === 'tier2') {
      const fetchSignedUrls = async () => {
        try {
          setLoadingUrls(true);
          const response = await fetch(`/api/kyc/documents/${application.id}`);
          if (response.ok) {
            const data = await response.json();
            setSignedUrls(data.documents || {});
          } else {
            console.error('Failed to fetch signed URLs:', response.statusText);
          }
        } catch (err) {
          console.error('Error fetching signed URLs:', err);
        } finally {
          setLoadingUrls(false);
        }
      };
      fetchSignedUrls();
    } else {
      setLoadingUrls(false);
    }
  }, [application.id, tier]);

  if (typeof document === 'undefined') return null;
  
  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 999999 }}>
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto pointer-events-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#800020] rounded-full flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{vendorDisplayName(application)}</h2>
              <p className="text-sm text-gray-600">{application.user.fullName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Vendor Information */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Vendor Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Full Name:</span>
                  <span className="ml-2 font-medium text-gray-900">{application.user.fullName}</span>
                </div>
                <div>
                  <span className="text-gray-600">Email:</span>
                  <span className="ml-2 font-medium text-gray-900">{application.user.email}</span>
                </div>
                <div>
                  <span className="text-gray-600">Phone:</span>
                  <span className="ml-2 font-medium text-gray-900">{application.user.phone}</span>
                </div>
                <div>
                  <span className="text-gray-600">Submitted:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {new Date(application.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Business Details */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Business Details</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Business Name:</span>
                  <span className="ml-2 font-medium text-gray-900">{vendorDisplayName(application)}</span>
                </div>
                {tier === 'tier2' && (
                  <>
                    <div>
                      <span className="text-gray-600">CAC Number:</span>
                      <span className="ml-2 font-medium text-gray-900">{application.cacNumber || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">TIN:</span>
                      <span className="ml-2 font-medium text-gray-900">{application.tin || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Bank:</span>
                      <span className="ml-2 font-medium text-gray-900">{application.bankName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Account Number:</span>
                      <span className="ml-2 font-medium text-gray-900">{application.bankAccountNumber || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Account Name:</span>
                      <span className="ml-2 font-medium text-gray-900">{application.bankAccountName || 'N/A'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Verification Status */}
          {tier !== 'tier0' && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Verification Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {tier === 'tier1' && (
                  <VerificationBadge label="BVN" verified={application.bvnVerified} />
                )}
                {tier === 'tier2' && (
                  <>
                    <VerificationBadge label="BVN" verified={application.bvnVerified} />
                    <VerificationBadge label="NIN" verified={application.ninVerified} />
                    <VerificationBadge label="Bank Account" verified={application.bankAccountVerified} />
                    <VerificationBadge label="CAC" verified={application.cacVerified} />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Uploaded Documents (Tier 2 only) */}
          {tier === 'tier2' && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Uploaded Documents</h3>
              {loadingUrls ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-[#800020] animate-spin" />
                  <span className="ml-3 text-gray-600">Loading documents...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <DocumentPreview
                    label="CAC Certificate"
                    url={signedUrls.cacCertificateUrl}
                    icon={<Building2 className="w-6 h-6" />}
                  />
                  <DocumentPreview
                    label="NIN Card"
                    url={signedUrls.ninCardUrl}
                    icon={<IdCard className="w-6 h-6" />}
                  />
                  <DocumentPreview
                    label="Address Proof"
                    url={signedUrls.addressProofUrl}
                    icon={<FileText className="w-6 h-6" />}
                  />
                  <DocumentPreview
                    label="Bank Statement"
                    url={signedUrls.bankStatementUrl}
                    icon={<CreditCard className="w-6 h-6" />}
                  />
                  <DocumentPreview
                    label="Photo ID"
                    url={signedUrls.photoIdUrl}
                    icon={<User className="w-6 h-6" />}
                  />
                </div>
              )}
            </div>
          )}

          {/* Previous Rejection Reason (if exists) */}
          {application.kycStatus === 'rejected' && application.kycRejectionReason && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-lg font-bold text-red-900 mb-2">Previous Rejection Reason</h3>
              <p className="text-sm text-red-700">{application.kycRejectionReason}</p>
            </div>
          )}

          {/* Review Actions */}
          {tier === 'tier0' || tier === 'tier1' ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              {tier === 'tier1' ? (
                <p>
                  Tier 1 is approved automatically when BVN verification matches the vendor&apos;s registered name and details.
                  No manual approve or reject action is required.
                </p>
              ) : (
                <p>Tier 0 vendors have not completed BVN verification yet. Review their profile information only.</p>
              )}
            </div>
          ) : application.kycStatus !== 'pending' ? (
            <div className={`rounded-lg border p-4 text-sm ${
              application.kycStatus === 'approved'
                ? 'border-green-200 bg-green-50 text-green-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}>
              <p className="font-semibold">
                {application.kycStatus === 'approved' ? 'This application is already approved.' : 'This application was rejected.'}
              </p>
            </div>
          ) : (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Review Decision</h3>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => onActionChange('approve')}
                disabled={submitting}
                className={`flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-bold transition-all ${
                  reviewAction === 'approve'
                    ? 'bg-green-600 text-white shadow-lg scale-105'
                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <CheckCircle2 className="w-5 h-5" />
                Approve
              </button>
              
              <button
                onClick={() => onActionChange('reject')}
                disabled={submitting}
                className={`flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-bold transition-all ${
                  reviewAction === 'reject'
                    ? 'bg-red-600 text-white shadow-lg scale-105'
                    : 'bg-red-100 text-red-800 hover:bg-red-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <XCircle className="w-5 h-5" />
                Reject
              </button>
            </div>

            {/* Comment Field */}
            {reviewAction && (
              <div className="space-y-2">
                <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
                  {reviewAction === 'reject' ? (
                    <>Comment <span className="text-red-500">*</span> (Required for rejection)</>
                  ) : (
                    'Comment (Optional)'
                  )}
                </label>
                <textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => onCommentChange(e.target.value)}
                  disabled={submitting}
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={
                    reviewAction === 'approve'
                      ? 'Add any notes about this approval (optional)'
                      : 'Please explain why this application is being rejected and what the vendor needs to correct'
                  }
                />
                {reviewAction === 'reject' && (
                  <p className="text-sm text-gray-600">
                    This comment will be sent to the vendor via email and SMS
                  </p>
                )}
              </div>
            )}
          </div>
          )}

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tier === 'tier0' || tier === 'tier1' || application.kycStatus !== 'pending' ? 'Close' : 'Cancel'}
          </button>
          
          {tier !== 'tier0' && tier !== 'tier1' && application.kycStatus === 'pending' && (
          <button
            onClick={onSubmit}
            disabled={!reviewAction || submitting}
            className="px-6 py-3 bg-[#800020] text-white font-bold rounded-lg hover:bg-[#600018] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Submit Review
              </>
            )}
          </button>
          )}
        </div>
      </div>
    </div>
  </div>,
    document.body
  );
}

// Document Preview Component
function DocumentPreview({ 
  label, 
  url, 
  icon 
}: { 
  label: string; 
  url: string | null | undefined; 
  icon: React.ReactNode;
}) {
  // Handle missing documents
  if (!url) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 opacity-60">
        <div className="flex items-center gap-2 mb-3">
          <div className="text-gray-400">{icon}</div>
          <h4 className="font-semibold text-gray-600 text-sm">{label}</h4>
        </div>
        
        <div className="bg-white rounded-lg p-8 flex flex-col items-center justify-center border border-gray-200 mb-3">
          <FileText className="w-12 h-12 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">Not provided</p>
        </div>
        
        <div className="flex items-center justify-center w-full px-4 py-2 bg-gray-300 text-gray-500 text-sm font-medium rounded-lg cursor-not-allowed">
          Not Available
        </div>
      </div>
    );
  }

  const isPDF = url.toLowerCase().endsWith('.pdf');

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[#800020]">{icon}</div>
        <h4 className="font-semibold text-gray-900 text-sm">{label}</h4>
      </div>
      
      {isPDF ? (
        <div className="bg-white rounded-lg p-8 flex flex-col items-center justify-center border border-gray-200 mb-3">
          <FileText className="w-12 h-12 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">PDF Document</p>
        </div>
      ) : (
        <div className="relative w-full h-40 bg-white rounded-lg overflow-hidden border border-gray-200 mb-3">
          <Image
            src={url}
            alt={label}
            fill
            className="object-contain"
          />
        </div>
      )}
      
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-[#800020] text-white text-sm font-medium rounded-lg hover:bg-[#600018] transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        View Full Document
      </a>
    </div>
  );
}
