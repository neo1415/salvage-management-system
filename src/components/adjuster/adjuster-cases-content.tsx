/**
 * Cases List Page Content
 * 
 * Display all cases created by the adjuster with filtering and status badges
 * Uses modern filter UI with faceted navigation and URL persistence
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useCases, type StatusFilter } from '@/hooks/queries/use-cases';
import { useDeleteCase } from '@/hooks/queries/use-case-mutation';
import { Trash2, Loader2, Filter as FilterIcon, X, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { FilterChip } from '@/components/ui/filters/filter-chip';
import { FacetedFilter, type FilterOption } from '@/components/ui/filters/faceted-filter';
import { SearchInput } from '@/components/ui/filters/search-input';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh-indicator';
import { StickyActionBar } from '@/components/ui/sticky-action-bar';
import { RippleButton } from '@/components/ui/ripple-button';
import { DashboardErrorBoundary } from '@/components/ui/error-boundary';

function AdjusterCasesContentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize filters from URL
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get('status') as StatusFilter) || 'all'
  );
  const [assetTypeFilter, setAssetTypeFilter] = useState<string[]>(
    searchParams.get('assetType')?.split(',').filter(Boolean) || []
  );
  const [severityFilter, setSeverityFilter] = useState<string[]>(
    searchParams.get('severity')?.split(',').filter(Boolean) || []
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (assetTypeFilter.length > 0) params.set('assetType', assetTypeFilter.join(','));
    if (severityFilter.length > 0) params.set('severity', severityFilter.join(','));
    if (searchQuery) params.set('search', searchQuery);
    
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    window.history.replaceState(null, '', `/adjuster/cases${newUrl}`);
  }, [statusFilter, assetTypeFilter, severityFilter, searchQuery]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showExportMenu && !target.closest('.export-dropdown')) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  // Fetch cases with TanStack Query (cached, instant tab switching)
  const { data: cases = [], isLoading, error: queryError, refetch } = useCases({
    status: statusFilter,
    createdByMe: true,
  });

  // Pull-to-refresh for mobile
  const {
    scrollableRef,
    isRefreshing: isPullRefreshing,
    pullDistance,
    isThresholdReached,
  } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
    },
    threshold: 80,
    enabled: true,
  });

  // Delete case mutation with optimistic updates
  const deleteCaseMutation = useDeleteCase();

  // Convert query error to string
  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load cases') : null;

  // Client-side filtering for asset type, severity, and search
  const filteredCases = cases.filter(caseItem => {
    // Asset type filter
    if (assetTypeFilter.length > 0 && !assetTypeFilter.includes(caseItem.assetType)) {
      return false;
    }
    
    // Severity filter
    if (severityFilter.length > 0) {
      const severity = caseItem.damageSeverity || 'none';
      if (!severityFilter.includes(severity)) {
        return false;
      }
    }
    
    // Search filter - search in claimReference, assetType, assetDetails, and locationName
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesReference = caseItem.claimReference.toLowerCase().includes(query);
      const matchesLocation = caseItem.locationName.toLowerCase().includes(query);
      const matchesAssetType = caseItem.assetType.toLowerCase().includes(query);
      
      // Search in assetDetails JSON fields
      let matchesAssetDetails = false;
      if (caseItem.assetDetails) {
        const details = caseItem.assetDetails as Record<string, any>;
        // Search in common fields across all asset types
        const searchableFields = ['make', 'model', 'year', 'brand', 'description', 'propertyType'];
        matchesAssetDetails = searchableFields.some(field => {
          const value = details[field];
          return value && String(value).toLowerCase().includes(query);
        });
      }
      
      if (!matchesReference && !matchesLocation && !matchesAssetType && !matchesAssetDetails) {
        return false;
      }
    }
    
    return true;
  });

  // Determine if we should use virtualization (count > 50)
  const shouldVirtualize = filteredCases.length > 50;

  // Filter options
  const assetTypeOptions: FilterOption[] = [
    { value: 'vehicle', label: 'Vehicle', count: cases.filter(c => c.assetType === 'vehicle').length },
    { value: 'property', label: 'Property', count: cases.filter(c => c.assetType === 'property').length },
    { value: 'electronics', label: 'Electronics', count: cases.filter(c => c.assetType === 'electronics').length },
  ];

  const severityOptions: FilterOption[] = [
    { value: 'none', label: 'Not Assessed', count: cases.filter(c => !c.damageSeverity || c.damageSeverity === 'none').length },
    { value: 'minor', label: 'Minor', count: cases.filter(c => c.damageSeverity === 'minor').length },
    { value: 'moderate', label: 'Moderate', count: cases.filter(c => c.damageSeverity === 'moderate').length },
    { value: 'severe', label: 'Severe', count: cases.filter(c => c.damageSeverity === 'severe').length },
  ];

  // Clear all filters
  const clearAllFilters = () => {
    setStatusFilter('all');
    setAssetTypeFilter([]);
    setSeverityFilter([]);
    setSearchQuery('');
  };

  // Check if any filters are active
  const hasActiveFilters = statusFilter !== 'all' || assetTypeFilter.length > 0 || severityFilter.length > 0 || searchQuery !== '';
  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + assetTypeFilter.length + severityFilter.length + (searchQuery ? 1 : 0);

  // Export handler
  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setIsExporting(true);
      setShowExportMenu(false);

      // Build query parameters
      const params = new URLSearchParams();
      params.set('format', format);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);
      params.set('createdByMe', 'true'); // Only export cases created by current user

      // Trigger download
      const response = await fetch(`/api/cases/export?${params.toString()}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `cases-export.${format}`;

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert(error instanceof Error ? error.message : 'Failed to export cases');
    } finally {
      setIsExporting(false);
    }
  };

  // Format status filter for display
  const formatStatusFilter = (status: StatusFilter): string => {
    if (status === 'all') return 'All';
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getStatusBadge = (status: 'draft' | 'pending_approval' | 'approved' | 'active_auction' | 'sold' | 'cancelled') => {
    const badges = {
      draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
      pending_approval: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800' },
      approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
      active_auction: { label: 'Payment Pending', color: 'bg-orange-100 text-orange-800' },
      sold: { label: 'Sold', color: 'bg-purple-100 text-purple-800' },
      cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
      rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
    };

    const badge = badges[status] || badges.draft;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const getSeverityBadge = (severity: 'none' | 'minor' | 'moderate' | 'severe' | null) => {
    if (!severity || severity === 'none') {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
          Not Assessed
        </span>
      );
    }

    const badges: Record<string, { label: string; color: string }> = {
      minor: { label: 'Minor', color: 'bg-green-100 text-green-800' },
      moderate: { label: 'Moderate', color: 'bg-yellow-100 text-yellow-800' },
      severe: { label: 'Severe', color: 'bg-red-100 text-red-800' },
    };

    const badge = badges[severity];
    if (!badge) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
          Unknown
        </span>
      );
    }
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  // Render a single case card
  const renderCaseCard = (caseItem: typeof cases[0]) => (
    <div
      key={caseItem.id}
      onClick={() => router.push(`/adjuster/cases/${caseItem.id}`)}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900">{caseItem.claimReference}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {caseItem.assetType.charAt(0).toUpperCase() + caseItem.assetType.slice(1)}
          </p>
        </div>
        {getStatusBadge(caseItem.status)}
      </div>

      {/* Photo Preview */}
      {caseItem.photos && caseItem.photos.length > 0 && (
        <div className="mb-3">
          <Image
            src={caseItem.photos[0]}
            alt="Case preview"
            width={400}
            height={200}
            unoptimized
            className="w-full h-32 object-cover rounded-lg"
          />
        </div>
      )}

      {/* AI Assessment Results */}
      {caseItem.damageSeverity && caseItem.damageSeverity !== 'none' && (
        <div className="mb-3 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">AI Assessment</span>
            {getSeverityBadge(caseItem.damageSeverity)}
          </div>
          {caseItem.estimatedSalvageValue && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Est. Value:</span>
              <span className="font-bold text-green-600">
                ₦{caseItem.estimatedSalvageValue.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Location */}
      <div className="flex items-center text-sm text-gray-600 mb-2">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="truncate">{caseItem.locationName}</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
        <span>
          {new Date(caseItem.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        <div className="flex items-center gap-3">
          {caseItem.status === 'draft' && (
            <button
              onClick={async (e) => {
                e.stopPropagation(); // Prevent card click
                if (confirm('Delete this draft case? This cannot be undone.')) {
                  try {
                    await deleteCaseMutation.mutateAsync(caseItem.id);
                    alert('Draft deleted successfully');
                  } catch (error) {
                    console.error('Error deleting case:', error);
                    alert(error instanceof Error ? error.message : 'Error deleting case');
                  }
                }
              }}
              className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
              title="Delete draft"
              disabled={deleteCaseMutation.isPending}
            >
              {deleteCaseMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>Delete</span>
                </>
              )}
            </button>
          )}
          <span className="text-[#800020] font-medium">View Details →</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#800020] text-white p-4 sticky top-0 z-10 shadow-md">
        <h1 className="text-xl font-bold">My Cases</h1>
      </div>
      
      {/* Scrollable content area with pull-to-refresh */}
      <div 
        ref={scrollableRef as React.RefObject<HTMLDivElement>}
        className="overflow-y-auto"
        style={{ height: 'calc(100vh - 64px - 80px)' }} // Account for header and action bar
      >
        {/* Pull-to-refresh indicator */}
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          threshold={80}
          isRefreshing={isPullRefreshing}
          isThresholdReached={isThresholdReached}
        />

        <div className="p-4 space-y-4">
        {/* Create New Case Button - Moved to sticky action bar at bottom */}
        
        {/* Search Bar */}
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by claim reference, location, or asset type..."
          className="w-full"
        />

        {/* Filter Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <RippleButton
            onClick={() => setShowFilters(!showFilters)}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
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
          </RippleButton>

          {/* Export Dropdown Button */}
          <div className="relative export-dropdown">
            <RippleButton
              onClick={() => setShowExportMenu(!showExportMenu)}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
              aria-label="Export cases"
              aria-expanded={showExportMenu}
              disabled={isExporting || filteredCases.length === 0}
            >
              {isExporting ? (
                <>
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  <span className="text-sm font-medium">Exporting...</span>
                </>
              ) : (
                <>
                  <Download size={18} aria-hidden="true" />
                  <span className="text-sm font-medium">Export</span>
                </>
              )}
            </RippleButton>

            {/* Export Dropdown Menu */}
            {showExportMenu && !isExporting && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[160px]">
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <FileSpreadsheet size={16} aria-hidden="true" />
                  <span>Export to CSV</span>
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
                >
                  <FileText size={16} aria-hidden="true" />
                  <span>Export to PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Active Filter Chips */}
          {statusFilter !== 'all' && (
            <FilterChip
              label={`Status: ${formatStatusFilter(statusFilter)}`}
              onRemove={() => setStatusFilter('all')}
            />
          )}
          {assetTypeFilter.map(type => (
            <FilterChip
              key={type}
              label={`Type: ${type.charAt(0).toUpperCase() + type.slice(1)}`}
              onRemove={() => setAssetTypeFilter(assetTypeFilter.filter(t => t !== type))}
            />
          ))}
          {severityFilter.map(severity => (
            <FilterChip
              key={severity}
              label={`Severity: ${severity === 'none' ? 'Not Assessed' : severity.charAt(0).toUpperCase() + severity.slice(1)}`}
              onRemove={() => setSeverityFilter(severityFilter.filter(s => s !== severity))}
            />
          ))}
          {searchQuery && (
            <FilterChip
              label={`Search: "${searchQuery}"`}
              onRemove={() => setSearchQuery('')}
            />
          )}

          {/* Clear All Filters */}
          {hasActiveFilters && (
            <RippleButton
              onClick={clearAllFilters}
              variant="ghost"
              size="sm"
              className="flex items-center gap-1"
              aria-label="Clear all filters"
            >
              <X size={14} aria-hidden="true" />
              <span>Clear all</span>
            </RippleButton>
          )}
        </div>

        {/* Expandable Filters Panel */}
        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Filter Options</h3>
              <span className="text-xs text-gray-500">
                {filteredCases.length} of {cases.length} cases
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* Status Filter (kept as tabs for primary navigation) */}
              <div className="w-full">
                <label className="block text-xs font-medium text-gray-700 mb-2">Status</label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {(['all', 'pending_approval', 'approved', 'draft'] as StatusFilter[]).map((filter) => (
                    <RippleButton
                      key={filter}
                      onClick={() => setStatusFilter(filter)}
                      variant={statusFilter === filter ? 'primary' : 'secondary'}
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      {formatStatusFilter(filter)}
                    </RippleButton>
                  ))}
                </div>
              </div>

              {/* Asset Type Faceted Filter */}
              <FacetedFilter
                title="Asset Type"
                options={assetTypeOptions}
                selected={assetTypeFilter}
                onChange={setAssetTypeFilter}
              />

              {/* Severity Faceted Filter */}
              <FacetedFilter
                title="Damage Severity"
                options={severityOptions}
                selected={severityFilter}
                onChange={setSeverityFilter}
              />
            </div>
          </div>
        )}

        {/* Results Count */}
        {hasActiveFilters && (
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredCases.length}</span> of <span className="font-semibold text-gray-900">{cases.length}</span> cases
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Error loading cases</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <RippleButton
              onClick={() => refetch()}
              variant="primary"
              size="sm"
              className="mt-3 bg-red-600 hover:bg-red-700"
            >
              Try Again
            </RippleButton>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredCases.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 text-gray-600 font-medium">
              {hasActiveFilters 
                ? 'No cases match your filters' 
                : statusFilter === 'all' 
                  ? 'No cases yet' 
                  : `No ${formatStatusFilter(statusFilter)} cases`
              }
            </p>
            <p className="mt-2 text-gray-500 text-sm">
              {hasActiveFilters ? 'Try adjusting your filters' : (statusFilter === 'all' ? 'Create your first case to get started' : 'Try a different filter')}
            </p>
            {hasActiveFilters && (
              <RippleButton
                onClick={clearAllFilters}
                variant="primary"
                size="md"
                className="mt-4"
              >
                Clear all filters
              </RippleButton>
            )}
          </div>
        )}

        {/* Cases List */}
        {!isLoading && !error && filteredCases.length > 0 && (
          shouldVirtualize ? (
            // Use virtualized list for large datasets (> 50 items)
            <div className="h-[calc(100vh-300px)]">
              <VirtualizedList
                items={filteredCases}
                renderItem={renderCaseCard}
                estimateSize={280} // Approximate card height
                overscan={5}
              />
            </div>
          ) : (
            // Use regular list for small datasets (<= 50 items)
            <div className="space-y-4">
              {filteredCases.map((caseItem) => renderCaseCard(caseItem))}
            </div>
          )
        )}
      </div>
      </div>

      {/* Sticky Action Bar - Primary action in thumb zone (lower third) */}
      <StickyActionBar position="bottom">
        <RippleButton
          onClick={() => router.push('/adjuster/cases/new')}
          variant="primary"
          size="lg"
          fullWidth
          className="flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Create New Case</span>
        </RippleButton>
      </StickyActionBar>
    </div>
  );
}


// Wrap with error boundary
export default function AdjusterCasesContent() {
  return (
    <DashboardErrorBoundary role="adjuster">
      <AdjusterCasesContentInner />
    </DashboardErrorBoundary>
  );
}
