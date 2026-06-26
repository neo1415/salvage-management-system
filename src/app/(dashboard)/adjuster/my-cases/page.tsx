'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useSession } from 'next-auth/react';
import { useAppRouter } from '@/hooks/use-app-router';
import Link from 'next/link';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Gavel,
  Banknote,
  Package,
  Search,
  MapPin,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { formatCompactCurrency, formatRelativeDate } from '@/utils/format-utils';
import {
  isCaseInLiveAuction,
  resolveCaseDisplayStatus,
  type CaseDisplayStatus,
} from '@/lib/metrics/case-display-status';
import { isRejectedTabCase } from '@/lib/metrics/case-rejection';
import { getAllDrafts, type DraftCase, getAllOfflineCases, type OfflineCase } from '@/lib/db/indexeddb';
import { useOffline } from '@/hooks/use-offline';
import { DataLoadingState } from '@/components/ui/loading-states';
import { SwipeTabsBody } from '@/components/ui/swipe-tabs-body';

const CASE_STATUS_SWIPE_ORDER: StatusFilter[] = [
  'all',
  'draft',
  'pending_approval',
  'rejected',
  'approved',
  'active_auction',
  'sold',
];

const INSURANCE_CLASS_LABELS: Record<string, string> = {
  motor: 'Motor',
  goods_in_transit: 'Goods in Transit (GIT)',
  fire: 'Fire and Special Perils',
  burglary: 'Burglary/Theft',
  marine: 'Marine',
  engineering: 'Engineering/Plant',
  agriculture: 'Agriculture',
  liability: 'Liability',
  other: 'Other',
};

function formatInsuranceClass(value?: string | null): string {
  if (!value) return '-';
  return INSURANCE_CLASS_LABELS[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface Case {
  id: string;
  claimReference: string;
  policyNumber?: string | null;
  assetType: string;
  insuranceClass?: string | null;
  brokerName?: string | null;
  agencyName?: string | null;
  branchName?: string | null;
  estimatedValue: string;
  locationName: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  approverName: string | null;
  adjusterName?: string | null;
  // Auction data for real-time status checking
  auctionId: string | null;
  auctionStatus: string | null;
  auctionEndTime: string | null;
  // Payment data for verification status
  paymentId: string | null;
  paymentStatus: string | null;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  rejectedByName?: string | null;
  wasRejected?: boolean;
}

type StatusFilter =
  | 'all'
  | 'draft'
  | 'pending_approval'
  | 'rejected'
  | 'approved'
  | 'active_auction'
  | 'sold';

export function CasePortfolioPage() {
  const { data: session, status } = useSession();
  const router = useAppRouter();
  const isOffline = useOffline();
  const [cases, setCases] = useState<Case[]>([]);
  const [drafts, setDrafts] = useState<DraftCase[]>([]);
  const [offlineCases, setOfflineCases] = useState<OfflineCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [searchQuery, setSearchQuery] = useState('');
  
  // Export states
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const userRole = session?.user?.role;
  const isClaimsAdjuster = userRole === 'claims_adjuster';
  const isSalvageManager = userRole === 'salvage_manager';
  const isManagerPortfolio = isSalvageManager;

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated') {
      if (isClaimsAdjuster) {
        router.push('/adjuster/cases/new');
        return;
      }

      if (!isSalvageManager) {
        router.push('/login');
        return;
      }

      // Only fetch once on mount, not on every navigation
      fetchMyCases();
    }
  }, [status, isClaimsAdjuster, isSalvageManager]); // Keep role-aware routing stable after session hydration

  useEffect(() => {
    filterCases();
  }, [cases, statusFilter, searchQuery]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showExportMenu && !target.closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showExportMenu]);

  const fetchMyCases = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      
      if (isClaimsAdjuster) {
        try {
          const localDrafts = await getAllDrafts();
          setDrafts(localDrafts);
          
          const localOfflineCases = await getAllOfflineCases();
          setOfflineCases(localOfflineCases);
        } catch (error) {
          console.error('Failed to load local data from IndexedDB:', error);
          setDrafts([]);
          setOfflineCases([]);
        }
      } else {
        setDrafts([]);
        setOfflineCases([]);
      }
      
      // Only fetch from API when online
      if (!isOffline) {
        // Add timestamp to bust cache
        const timestamp = Date.now();
        const casesPath = isSalvageManager
          ? `/api/cases?limit=500&_t=${timestamp}`
          : `/api/cases?createdByMe=true&limit=500&_t=${timestamp}`;
        const response = await fetch(
          casesPath
        );
        
        if (!response.ok) {
          let errorMessage = 'Failed to fetch cases';
          try {
            const errorResult = await response.json();
            errorMessage = errorResult?.error || errorResult?.message || errorMessage;
          } catch {
            errorMessage = `${errorMessage} (${response.status})`;
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        
        if (result.success) {
          // CRITICAL FIX: Deduplicate cases by ID
          // The API LEFT JOINs with auctions and payments, which can create duplicate rows
          // when a case has multiple auctions or payments
          const rawCases = result.data || [];
          const uniqueCases = new Map<string, Case>();
          
          for (const caseItem of rawCases) {
            // If we haven't seen this case ID yet, or if this row has more complete data
            if (!uniqueCases.has(caseItem.id)) {
              uniqueCases.set(caseItem.id, caseItem);
            } else {
              // If we've seen this case, keep the row with payment data (if available)
              const existing = uniqueCases.get(caseItem.id)!;
              if (caseItem.paymentId && !existing.paymentId) {
                uniqueCases.set(caseItem.id, caseItem);
              }
            }
          }
          
          setCases(Array.from(uniqueCases.values()));
        } else {
          console.error('API returned error:', result.error);
          setLoadError(result.error || 'Cases could not be loaded.');
          setCases([]);
        }
      } else {
        // When offline, only show local data
        setCases([]);
      }
    } catch (error) {
      console.error('Failed to fetch cases:', error);
      setLoadError(error instanceof Error ? error.message : 'Cases could not be loaded.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const filterCases = () => {
    // Combine online cases and offline cases
    let filtered = [...cases];
    
    // Add offline cases that match the filter
    const offlineCasesAsRegular = offlineCases.map(oc => ({
      id: oc.id,
      claimReference: oc.claimReference,
      assetType: oc.assetType,
      estimatedValue: oc.marketValue.toString(),
      locationName: oc.locationName,
      status: oc.status,
      createdAt: oc.createdAt.toString(),
      approvedAt: null,
      approvedBy: null,
      approverName: null,
      auctionId: null,
      auctionStatus: null,
      auctionEndTime: null,
      paymentId: null,
      paymentStatus: null,
    }));
    
    filtered = [...filtered, ...offlineCasesAsRegular];

    // Filter by status - CRITICAL: Each filter must be mutually exclusive
    if (statusFilter !== 'all') {
      if (statusFilter === 'draft') {
        // Draft filter will show drafts from IndexedDB (handled separately in render)
        filtered = [];
      } else if (statusFilter === 'approved') {
        // Approved filter shows all cases with approvedBy field
        filtered = filtered.filter(c => c.approvedBy !== null && c.approvedBy !== undefined);
      } else if (statusFilter === 'pending_approval') {
        filtered = filtered.filter(
          (c) => c.status === 'pending_approval' && !c.approvedBy
        );
      } else if (statusFilter === 'rejected') {
        filtered = filtered.filter((c) => isRejectedTabCase(c));
      } else if (statusFilter === 'active_auction') {
        filtered = filtered.filter((c) => isCaseInLiveAuction(c));
      } else if (statusFilter === 'sold') {
        // CRITICAL: Only show cases that are truly sold (with verified payment)
        filtered = filtered.filter(c => {
          // Must have sold status
          if (c.status !== 'sold') return false;
          
          // If has payment data, check if verified
          if (c.paymentId && c.paymentStatus) {
            return c.paymentStatus === 'verified' || c.paymentStatus === 'completed';
          }
          
          // If no payment data but status is sold, include it (legacy data)
          return true;
        });
      } else {
        // Fallback: exact status match
        filtered = filtered.filter(c => c.status === statusFilter);
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.claimReference.toLowerCase().includes(query) ||
        (c.policyNumber ?? '').toLowerCase().includes(query) ||
        c.assetType.toLowerCase().includes(query) ||
        c.locationName.toLowerCase().includes(query) ||
        (c.insuranceClass ?? '').toLowerCase().includes(query) ||
        (c.branchName ?? '').toLowerCase().includes(query) ||
        (c.brokerName ?? '').toLowerCase().includes(query) ||
        (c.agencyName ?? '').toLowerCase().includes(query)
      );
    }

    setFilteredCases(filtered);
  };

  const getStatusBadge = (caseItem: Case) => {
    const displayStatus: CaseDisplayStatus = resolveCaseDisplayStatus(caseItem);

    const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
      draft: {
        label: 'Draft',
        className: 'bg-gray-100 text-gray-800',
        icon: FileText
      },
      pending_approval: {
        label: 'Pending Approval',
        className: 'bg-yellow-100 text-yellow-800',
        icon: Clock
      },
      rejected: {
        label: 'Rejected',
        className: 'bg-red-100 text-red-800',
        icon: XCircle
      },
      approved: {
        label: 'Approved',
        className: 'bg-green-100 text-green-800',
        icon: CheckCircle
      },
      cancelled: {
        label: 'Cancelled',
        className: 'bg-red-100 text-red-800',
        icon: XCircle
      },
      active_auction: {
        label: 'Active Auction',
        className: 'bg-blue-100 text-blue-800',
        icon: Gavel
      },
      awaiting_payment: {
        label: 'Awaiting Payment',
        className: 'bg-orange-100 text-orange-800',
        icon: Banknote
      },
      awaiting_pickup: {
        label: 'Awaiting Pickup',
        className: 'bg-amber-100 text-amber-800',
        icon: Package
      },
      closed: {
        label: 'Closed',
        className: 'bg-gray-100 text-gray-800',
        icon: XCircle,
      },
      sold: {
        label: 'Sold',
        className: 'bg-purple-100 text-purple-800',
        icon: Package
      }
    };

    const config = statusConfig[displayStatus] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </span>
    );
  };

  const getStatusCounts = () => {
    // Helper function to check if case is truly sold (payment verified)
    const isTrulySold = (caseItem: Case) => {
      // Must have sold status
      if (caseItem.status !== 'sold') return false;
      
      // If has payment data, check if verified
      if (caseItem.paymentId && caseItem.paymentStatus) {
        return caseItem.paymentStatus === 'verified' || caseItem.paymentStatus === 'completed';
      }
      
      // If no payment data but status is sold, count it (legacy data)
      return true;
    };
    
    return {
      all: cases.length + offlineCases.length,
      draft: drafts.length, // Count drafts from IndexedDB
      // Only count cases that are truly pending (not approved yet)
      pending_approval: cases.filter(c => c.status === 'pending_approval' && !c.approvedBy).length + offlineCases.filter(c => c.status === 'pending_approval').length,
      rejected: cases.filter((c) => isRejectedTabCase(c)).length,
      approved: cases.filter(c => c.approvedBy !== null && c.approvedBy !== undefined).length,
      // Only count auctions that are truly active (not closed)
      active_auction: cases.filter((c) => isCaseInLiveAuction(c)).length,
      // Sold includes only cases with verified payments
      sold: cases.filter(c => isTrulySold(c)).length,
    };
  };

  const exportableStatusFilters = new Set([
    'pending_approval',
    'rejected',
    'approved',
    'active_auction',
    'sold',
  ]);

  const handleExportFromApi = async (format: 'csv' | 'pdf') => {
    if (statusFilter === 'draft') {
      alert('Draft cases are stored locally. Submit drafts before using the comprehensive export.');
      setShowExportMenu(false);
      return;
    }

    try {
      setExporting(true);
      setShowExportMenu(false);

      const params = new URLSearchParams();
      params.set('format', format);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (exportableStatusFilters.has(statusFilter)) {
        params.set('status', statusFilter);
      }
      if (!isManagerPortfolio) {
        params.set('createdByMe', 'true');
      }

      const response = await fetch(`/api/cases/export?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'Export failed');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `cases-export.${format}`;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting cases:', err);
      alert(err instanceof Error ? err.message : 'Failed to export cases. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (status === 'loading' || (loading && cases.length === 0)) {
    return <DataLoadingState label="My cases" variant="page" />;
  }

  const statusCounts = getStatusCounts();
  const statusTabs = [
    { key: 'all', label: 'All Cases', count: statusCounts.all },
    ...(isClaimsAdjuster ? [{ key: 'draft' as const, label: 'Draft', count: statusCounts.draft }] : []),
    { key: 'pending_approval', label: 'Pending', count: statusCounts.pending_approval },
    { key: 'rejected', label: 'Rejected', count: statusCounts.rejected },
    { key: 'approved', label: 'Approved', count: statusCounts.approved },
    { key: 'active_auction', label: 'Active Auction', count: statusCounts.active_auction },
    { key: 'sold', label: 'Sold', count: statusCounts.sold },
  ] satisfies Array<{ key: StatusFilter; label: string; count: number }>;
  const swipeOrder = isClaimsAdjuster
    ? CASE_STATUS_SWIPE_ORDER
    : CASE_STATUS_SWIPE_ORDER.filter((tab) => tab !== 'draft');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">
            {isManagerPortfolio ? 'Case Portfolio' : 'My Cases'}
          </h1>
          <p className="text-gray-600 mt-2">
            {isManagerPortfolio
              ? 'Review submitted, approved, auctioned, and sold salvage cases across adjusters'
              : "View the cases you've reported and their review status"}
          </p>
        </div>
        <div className="flex w-full flex-row items-center gap-3 sm:w-auto">
          {/* Export Dropdown */}
          <div className="relative export-menu-container">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowExportMenu(!showExportMenu);
              }}
              disabled={loading || filteredCases.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleExportFromApi('csv');
                  }}
                  disabled={exporting}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Export as CSV</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleExportFromApi('pdf');
                  }}
                  disabled={exporting}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 border-t border-gray-100 disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Export as PDF</span>
                </button>
              </div>
            )}
          </div>
          
          {isClaimsAdjuster && (
            <Link
              href="/adjuster/cases/new"
              className="flex flex-1 items-center justify-center rounded-lg bg-[var(--brand-primary)] px-4 py-3 text-center font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)] sm:flex-none sm:px-6"
            >
              Create New Case
            </Link>
          )}
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-red-600" />
              <div>
                <h2 className="font-semibold">Cases could not be loaded</h2>
                <p className="mt-1 text-sm text-red-800">
                  {loadError}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchMyCases}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by claim reference, asset type, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as StatusFilter)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  statusFilter === tab.key
                    ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {tab.label}
                <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Cases List */}
        <SwipeTabsBody
          tabs={swipeOrder}
          activeTab={statusFilter}
          onTabChange={setStatusFilter}
          className="p-6"
        >
          {statusFilter === 'draft' ? (
            // Show drafts from IndexedDB
            drafts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No drafts found</h3>
                <p className="text-gray-600 mb-6">
                  Drafts are auto-saved as you work on the case creation form.
                </p>
                {isClaimsAdjuster && (
                  <Link
                    href="/adjuster/cases/new"
                    className="inline-flex items-center px-6 py-3 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors font-medium"
                  >
                    Create New Case
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {drafts.map((draft) => (
                  <DraftCard key={draft.id} draft={draft} onDelete={fetchMyCases} />
                ))}
              </div>
            )
          ) : filteredCases.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery ? `No results found for "${searchQuery}"` : 'No cases found'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery
                  ? 'Try adjusting your search query or filters.'
                  : statusFilter === 'rejected'
                    ? 'No rejected cases yet. Cases returned by a salvage manager will show the rejection reason here.'
                    : statusFilter === 'all'
                      ? isManagerPortfolio
                        ? 'No submitted cases are available yet.'
                        : "You haven't created any cases yet."
                      : `No cases with status "${statusFilter.replace('_', ' ')}".`}
              </p>
              {isClaimsAdjuster && statusFilter === 'all' && !searchQuery && (
                <Link
                  href="/adjuster/cases/new"
                  className="inline-flex items-center px-6 py-3 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors font-medium"
                >
                  Create Your First Case
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {isOffline && offlineCases.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-blue-800">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">
                      You're offline. Showing {offlineCases.length} case{offlineCases.length !== 1 ? 's' : ''} pending sync.
                    </span>
                  </div>
                </div>
              )}
              {filteredCases.map((caseItem) => {
                const isOfflineCase = offlineCases.some(oc => oc.id === caseItem.id);
                return (
                  <CaseCard
                    key={caseItem.id}
                    caseItem={caseItem}
                    onDelete={caseItem.status === 'draft' ? fetchMyCases : undefined}
                    showRejectionReason={statusFilter === 'rejected' || Boolean(caseItem.rejectionReason)}
                    getStatusBadge={getStatusBadge}
                    isOfflineCase={isOfflineCase}
                    detailsBasePath={isManagerPortfolio ? '/manager/cases' : '/adjuster/cases'}
                    showSubmittedBy={isManagerPortfolio}
                  />
                );
              })}
            </div>
          )}
        </SwipeTabsBody>
      </div>
    </div>
  );
}

export default function AdjusterMyCasesPage() {
  return <CasePortfolioPage />;
}

// Draft Card Component for IndexedDB drafts
interface DraftCardProps {
  draft: DraftCase;
  onDelete: () => void;
}

function DraftCard({ draft, onDelete }: DraftCardProps) {
  const router = useAppRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleResume = () => {
    router.push(`/adjuster/cases/new?draftId=${draft.id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirm('Delete this draft? This cannot be undone.')) {
      setIsDeleting(true);
      try {
        const { deleteDraft } = await import('@/lib/db/indexeddb');
        await deleteDraft(draft.id);
        onDelete();
      } catch (error) {
        console.error('Error deleting draft:', error);
        alert('Error deleting draft');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const claimReference = draft.formData.claimReference as string;
  const assetType = draft.formData.assetType as string;
  const photos = (draft.formData.photos as string[]) || [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow p-4">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 flex-1">
          {claimReference || 'Untitled Draft'}
        </h3>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
          <FileText className="w-4 h-4" />
          Draft
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        {assetType && (
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Asset</p>
              <p className="font-medium text-gray-900 truncate capitalize">{assetType}</p>
            </div>
          </div>
        )}

        {draft.marketValue && draft.marketValue > 0 && (
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Value</p>
              <p className="font-medium text-[var(--brand-primary)]">
                {formatCompactCurrency(draft.marketValue.toString())}
              </p>
            </div>
          </div>
        )}

        {photos.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 text-gray-400 flex-shrink-0">📷</div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Photos</p>
              <p className="font-medium text-gray-900">{photos.length} uploaded</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Last saved</p>
            <p className="font-medium text-gray-900">
              {formatRelativeDate(draft.autoSavedAt.toString())}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={handleResume}
          className="flex-1 px-4 py-2 bg-[var(--brand-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors"
        >
          Resume Editing
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-4 py-2 bg-white border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

// Compact Case Card Component with max 5 fields and expandable sections
interface CaseCardProps {
  caseItem: Case;
  onDelete?: () => void;
  getStatusBadge: (caseItem: Case) => ReactElement;
  isOfflineCase?: boolean;
  showRejectionReason?: boolean;
  detailsBasePath?: '/adjuster/cases' | '/manager/cases';
  showSubmittedBy?: boolean;
}

function CaseCard({
  caseItem,
  onDelete,
  getStatusBadge,
  isOfflineCase = false,
  showRejectionReason = false,
  detailsBasePath = '/adjuster/cases',
  showSubmittedBy = false,
}: CaseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useAppRouter();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirm('Delete this draft case? This cannot be undone.')) {
      try {
        const response = await fetch(`/api/cases/${caseItem.id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          alert('Draft deleted successfully');
          onDelete?.();
        } else {
          const data = await response.json();
          alert(data.error || 'Failed to delete case');
        }
      } catch (error) {
        console.error('Error deleting case:', error);
        alert('Error deleting case');
      }
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <Link
        href={`${detailsBasePath}/${caseItem.id}`}
        className="block p-4"
      >
        {/* Header: Claim Reference + Status Badge */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 flex-1">
            {caseItem.claimReference}
          </h3>
          <div className="flex items-center gap-2">
            {isOfflineCase && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Pending Sync
              </span>
            )}
            {getStatusBadge(caseItem)}
          </div>
        </div>

        {/* Core Fields (Max 5) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {/* Field 1: Asset Type with icon */}
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Asset</p>
              <p className="font-medium text-gray-900 truncate">{caseItem.assetType}</p>
            </div>
          </div>

          {/* Field 2: Value with compact format */}
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Value</p>
              <p className="font-medium text-[var(--brand-primary)]">
                {formatCompactCurrency(caseItem.estimatedValue)}
              </p>
            </div>
          </div>

          {/* Field 3: Location with icon */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Location</p>
              <p className="font-medium text-gray-900 truncate">{caseItem.locationName}</p>
            </div>
          </div>

          {/* Field 4: Created date with relative format */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Created</p>
              <p className="font-medium text-gray-900">
                {formatRelativeDate(caseItem.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {(caseItem.policyNumber || caseItem.insuranceClass || caseItem.branchName || caseItem.brokerName || caseItem.agencyName) && (
          <div className="mb-3 grid gap-2 rounded-lg bg-gray-50 p-3 text-sm md:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Policy Number</p>
              <p className="font-medium text-gray-900">{caseItem.policyNumber || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Insurance Class</p>
              <p className="font-medium text-gray-900">{formatInsuranceClass(caseItem.insuranceClass)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Branch</p>
              <p className="font-medium text-gray-900">{caseItem.branchName || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Business Source</p>
              <p className="font-medium text-gray-900">
                {caseItem.brokerName ? `Broker: ${caseItem.brokerName}` : caseItem.agencyName ? `Agency: ${caseItem.agencyName}` : '-'}
              </p>
            </div>
          </div>
        )}

        {showRejectionReason && caseItem.rejectionReason && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-800">
              Rejection reason
              {caseItem.rejectedByName ? ` · ${caseItem.rejectedByName}` : ''}
            </p>
            <p className="mt-1 text-sm text-red-900">{caseItem.rejectionReason}</p>
            {caseItem.rejectedAt && (
              <p className="mt-1 text-xs text-red-700">
                Rejected {formatRelativeDate(caseItem.rejectedAt)}
              </p>
            )}
          </div>
        )}
        {showRejectionReason &&
          !caseItem.rejectionReason &&
          caseItem.status === 'cancelled' && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-800">
                Cancelled
              </p>
              <p className="mt-1 text-sm text-red-900">
                You cancelled this case before it was approved or auctioned.
              </p>
            </div>
          )}

        {/* Expandable Section for Optional Details */}
        {(caseItem.approvedAt || caseItem.status === 'draft' || (showSubmittedBy && caseItem.createdAt)) && (
          <div className="border-t border-gray-100 pt-3">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors w-full"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{isExpanded ? 'Hide' : 'Show'} details</span>
            </button>

            {isExpanded && (
              <div className="mt-3 space-y-2 text-sm">
                {showSubmittedBy && caseItem.createdAt && (
                  <div className="flex items-start gap-2 text-blue-700">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-medium">
                        Submitted {formatRelativeDate(caseItem.createdAt)}
                      </p>
                      {caseItem.adjusterName && (
                        <p className="text-xs text-gray-600">by {caseItem.adjusterName}</p>
                      )}
                    </div>
                  </div>
                )}

                {!showSubmittedBy && caseItem.approvedAt && (
                  <div className="flex items-start gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-medium">
                        Approved {formatRelativeDate(caseItem.approvedAt)}
                      </p>
                      {caseItem.approverName && (
                        <p className="text-xs text-gray-600">by {caseItem.approverName}</p>
                      )}
                    </div>
                  </div>
                )}

                {caseItem.status === 'draft' && onDelete && (
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors w-full"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    <span>Delete draft</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Link>
    </div>
  );
}
