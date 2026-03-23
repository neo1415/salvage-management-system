/**
 * Mobile Auction Browsing UI
 * 
 * Requirements:
 * - Requirement 16: Mobile Auction Browsing
 * - NFR1.1: Performance (page load <2s on 3G)
 * - NFR5.3: User Experience
 * - Enterprise Standards Section 9.1: UI/UX Design
 * 
 * Features:
 * - Mobile-optimized card layout (2 cards per row)
 * - Modern faceted filters with URL persistence
 * - Search by asset name and claim reference with 300ms debounce
 * - Lazy loading (20 auctions initially)
 * - Infinite scroll
 * - Pull-to-refresh
 * - Real-time countdown timers
 * - Watching count display
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { formatConditionForDisplay, type QualityTier } from '@/features/valuations/services/condition-mapping.service';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { FilterChip } from '@/components/ui/filters/filter-chip';
import { FacetedFilter, type FilterOption } from '@/components/ui/filters/faceted-filter';
import { SearchInput } from '@/components/ui/filters/search-input';
import { Filter as FilterIcon, X, Circle, DollarSign, Trophy, ClipboardList, MapPin, Clock, Eye } from 'lucide-react';
import { formatCompactCurrency, formatRelativeDate } from '@/utils/format-utils';

// Types
interface Auction {
  id: string;
  caseId: string;
  startTime: string;
  endTime: string;
  currentBid: string | null;
  minimumIncrement: string;
  status: 'scheduled' | 'active' | 'extended' | 'closed' | 'cancelled';
  watchingCount: number;
  isWinner?: boolean;
  case: {
    id: string;
    claimReference: string;
    assetType: 'vehicle' | 'property' | 'electronics';
    assetDetails: Record<string, unknown>;
    marketValue: string;
    estimatedSalvageValue: string;
    reservePrice: string;
    damageSeverity: 'minor' | 'moderate' | 'severe';
    locationName: string;
    photos: string[];
    vehicleCondition?: QualityTier;
  };
}

interface Filters {
  assetType: string;
  priceMin: string;
  priceMax: string;
  sortBy: 'ending_soon' | 'newest' | 'price_low' | 'price_high';
  location: string;
  search: string;
  tab: 'active' | 'my_bids' | 'won' | 'completed';
}

export default function AuctionBrowsingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  
  // Initialize filters from URL
  const [activeTab, setActiveTab] = useState<Filters['tab']>(
    (searchParams.get('tab') as Filters['tab']) || 'active'
  );
  const [assetTypeFilter, setAssetTypeFilter] = useState<string[]>(
    searchParams.get('assetType')?.split(',').filter(Boolean) || []
  );
  const [priceMin, setPriceMin] = useState(searchParams.get('priceMin') || '');
  const [priceMax, setPriceMax] = useState(searchParams.get('priceMax') || '');
  const [sortBy, setSortBy] = useState<Filters['sortBy']>(
    (searchParams.get('sortBy') as Filters['sortBy']) || 'ending_soon'
  );
  const [locationFilter, setLocationFilter] = useState(searchParams.get('location') || '');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [showFilters, setShowFilters] = useState(false);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== 'active') params.set('tab', activeTab);
    if (assetTypeFilter.length > 0) params.set('assetType', assetTypeFilter.join(','));
    if (priceMin) params.set('priceMin', priceMin);
    if (priceMax) params.set('priceMax', priceMax);
    if (sortBy !== 'ending_soon') params.set('sortBy', sortBy);
    if (locationFilter) params.set('location', locationFilter);
    if (searchQuery) params.set('search', searchQuery);
    
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    window.history.replaceState(null, '', `/vendor/auctions${newUrl}`);
  }, [activeTab, assetTypeFilter, priceMin, priceMax, sortBy, locationFilter, searchQuery]);

  // Build filters object for API
  const filters: Filters = {
    assetType: assetTypeFilter.join(','),
    priceMin,
    priceMax,
    sortBy,
    location: locationFilter,
    search: searchQuery,
    tab: activeTab,
  };

  // Check if any filters are active (excluding tab and sortBy)
  const hasActiveFilters = assetTypeFilter.length > 0 || priceMin !== '' || priceMax !== '' || locationFilter !== '' || searchQuery !== '';
  const activeFilterCount = assetTypeFilter.length + (priceMin ? 1 : 0) + (priceMax ? 1 : 0) + (locationFilter ? 1 : 0) + (searchQuery ? 1 : 0);

  // Clear all filters
  const clearAllFilters = () => {
    setAssetTypeFilter([]);
    setPriceMin('');
    setPriceMax('');
    setLocationFilter('');
    setSearchQuery('');
    // Keep tab and sortBy
  };

  // Refs
  const observerTarget = useRef<HTMLDivElement>(null);
  const pullStartY = useRef(0);
  const pullDistance = useRef(0);
  const expiryCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch auctions - using ref to avoid circular dependency
  const filtersRef = useRef(filters);
  
  // Keep ref in sync with filters
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const fetchAuctions = useCallback(async (pageNum: number, reset: boolean = false) => {
    try {
      if (reset) {
        setIsLoading(true);
        setAuctions([]); // Clear immediately to prevent flickering
      } else {
        setIsLoadingMore(true);
      }

      // Build query params using ref to get latest filters
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
        ...filtersRef.current,
      });

      const response = await fetch(`/api/auctions?${params}`, {
        cache: 'no-store', // Prevent service worker from serving stale cache
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch auctions');
      }

      const data = await response.json();
      
      if (reset) {
        setAuctions(data.auctions || []);
      } else {
        setAuctions(prev => [...prev, ...(data.auctions || [])]);
      }
      
      setHasMore(data.hasMore || false);
    } catch (error) {
      console.error('Error fetching auctions:', error);
      // Use mock data for development
      if (reset) {
        setAuctions([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsPullRefreshing(false);
    }
  }, []); // No dependencies - stable function

  // Check for expired auctions on mount and periodically
  useEffect(() => {
    const checkExpiredAuctions = async () => {
      try {
        // Only check if we have active auctions
        const hasActiveAuctions = auctions.some(a => a.status === 'active');
        if (!hasActiveAuctions) return;

        const response = await fetch('/api/auctions/check-expired', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkAll: true }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.successful > 0) {
            console.log(`✅ Closed ${data.successful} expired auctions`);
            // Refresh the auction list
            fetchAuctions(1, true);
          }
        }
      } catch (error) {
        console.error('Error checking expired auctions:', error);
      }
    };

    // Check immediately on mount
    checkExpiredAuctions();

    // Check every 30 seconds
    expiryCheckIntervalRef.current = setInterval(checkExpiredAuctions, 30000);

    return () => {
      if (expiryCheckIntervalRef.current) {
        clearInterval(expiryCheckIntervalRef.current);
      }
    };
  }, [auctions, fetchAuctions]);

  // Initial load and filter changes
  useEffect(() => {
    setPage(1);
    fetchAuctions(1, true);
  }, [activeTab, assetTypeFilter, priceMin, priceMax, sortBy, locationFilter, searchQuery, fetchAuctions]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchAuctions(nextPage, false);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoadingMore, isLoading, page, fetchAuctions]);

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY.current > 0) {
      pullDistance.current = e.touches[0].clientY - pullStartY.current;
      if (pullDistance.current > 80 && !isPullRefreshing) {
        setIsPullRefreshing(true);
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance.current > 80 && !isPullRefreshing) {
      setPage(1);
      fetchAuctions(1, true);
    }
    pullStartY.current = 0;
    pullDistance.current = 0;
  };

  // Filter handlers - removed, now using direct state setters

  // Search handler
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // The useEffect will handle the fetch when search changes
  };

  // Asset type filter options
  const assetTypeOptions: FilterOption[] = [
    { value: 'vehicle', label: 'Vehicle' },
    { value: 'property', label: 'Property' },
    { value: 'electronics', label: 'Electronics' },
  ];

  // Sort options
  const sortOptions: FilterOption[] = [
    { value: 'ending_soon', label: 'Ending Soon' },
    { value: 'newest', label: 'Newest First' },
    { value: 'price_low', label: 'Price: Low to High' },
    { value: 'price_high', label: 'Price: High to Low' },
  ];

  return (
    <div 
      className="min-h-screen bg-gray-50"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {isPullRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md p-4 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#800020]"></div>
          <span className="ml-2 text-sm text-gray-600">Refreshing...</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Auctions</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'active'
                  ? 'bg-[#800020] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Circle size={16} className="fill-current" aria-hidden="true" />
              <span>Active</span>
            </button>
            <button
              onClick={() => setActiveTab('my_bids')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'my_bids'
                  ? 'bg-[#800020] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <DollarSign size={16} aria-hidden="true" />
              <span>My Bids</span>
            </button>
            <button
              onClick={() => setActiveTab('won')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'won'
                  ? 'bg-[#800020] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Trophy size={16} aria-hidden="true" />
              <span>Won</span>
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'completed'
                  ? 'bg-[#800020] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <ClipboardList size={16} aria-hidden="true" />
              <span>Completed</span>
            </button>
          </div>

          {/* Search Bar */}
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by asset name or claim reference..."
            className="w-full mb-4"
          />

          {/* Filter Bar */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
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

            {/* Active Filter Chips */}
            {assetTypeFilter.map(type => (
              <FilterChip
                key={type}
                label={`Type: ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                onRemove={() => setAssetTypeFilter(assetTypeFilter.filter(t => t !== type))}
              />
            ))}
            {priceMin && (
              <FilterChip
                label={`Min: ₦${Number(priceMin).toLocaleString()}`}
                onRemove={() => setPriceMin('')}
              />
            )}
            {priceMax && (
              <FilterChip
                label={`Max: ₦${Number(priceMax).toLocaleString()}`}
                onRemove={() => setPriceMax('')}
              />
            )}
            {locationFilter && (
              <FilterChip
                label={`Location: ${locationFilter}`}
                onRemove={() => setLocationFilter('')}
              />
            )}
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

          {/* Results Count */}
          {hasActiveFilters && (
            <div className="text-sm text-gray-600 mb-2">
              Showing <span className="font-semibold text-gray-900">{auctions.length}</span> auctions
            </div>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            <div className="max-w-7xl mx-auto space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Filter Options</h3>
              </div>

              <div className="flex flex-wrap gap-3">
                {/* Asset Type Faceted Filter */}
                <FacetedFilter
                  title="Asset Type"
                  options={assetTypeOptions}
                  selected={assetTypeFilter}
                  onChange={setAssetTypeFilter}
                />

                {/* Sort By Faceted Filter */}
                <FacetedFilter
                  title="Sort By"
                  options={sortOptions}
                  selected={[sortBy]}
                  onChange={(selected) => setSortBy((selected[0] as Filters['sortBy']) || 'ending_soon')}
                />
              </div>

              {/* Price Range Filter */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Price (₦)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Price (₦)</label>
                  <input
                    type="number"
                    placeholder="No limit"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]"
                  />
                </div>
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  placeholder="Enter location..."
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto mb-4"></div>
              <p className="text-gray-600">Loading auctions...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && auctions.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No auctions found</h3>
            <p className="text-gray-600 mb-4">
              {hasActiveFilters ? 'Try adjusting your filters' : 'Check back later for new auctions'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-6 py-2 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Auction Grid */}
        {!isLoading && auctions.length > 0 && (
          <>
            {/* Use virtualization only when count > 50 */}
            {auctions.length > 50 ? (
              <div className="h-[calc(100vh-400px)] min-h-[600px]">
                <VirtualizedList
                  items={auctions}
                  renderItem={(auction) => (
                    <div className="px-2 pb-4">
                      <AuctionCard 
                        auction={auction} 
                        onClick={() => router.push(`/vendor/auctions/${auction.id}`)} 
                      />
                    </div>
                  )}
                  estimateSize={400}
                  overscan={3}
                  onLoadMore={() => {
                    if (hasMore && !isLoadingMore) {
                      const nextPage = page + 1;
                      setPage(nextPage);
                      fetchAuctions(nextPage, false);
                    }
                  }}
                  hasMore={hasMore}
                  isLoading={isLoadingMore}
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {auctions.map((auction) => (
                    <AuctionCard key={auction.id} auction={auction} onClick={() => router.push(`/vendor/auctions/${auction.id}`)} />
                  ))}
                </div>

                {/* Loading More Indicator */}
                {isLoadingMore && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#800020]"></div>
                    <span className="ml-2 text-gray-600">Loading more...</span>
                  </div>
                )}

                {/* Infinite Scroll Trigger */}
                <div ref={observerTarget} className="h-4" />

                {/* End of Results */}
                {!hasMore && (
                  <div className="text-center py-8 text-gray-600">
                    <p>You've reached the end of the list</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Compact Auction Card Component with max 5 fields
interface AuctionCardProps {
  auction: Auction;
  onClick: () => void;
}

function AuctionCard({ auction, onClick }: AuctionCardProps) {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [timerColor, setTimerColor] = useState('text-green-600');

  // Calculate time remaining
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(auction.endTime).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeRemaining('Ended');
        setTimerColor('text-gray-600');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      // Compact format
      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h`);
        setTimerColor('text-green-600');
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
        setTimerColor(hours >= 1 ? 'text-yellow-600' : 'text-red-600');
      } else {
        setTimeRemaining(`${minutes}m`);
        setTimerColor('text-red-600');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [auction.endTime]);

  // Format asset name
  const getAssetName = () => {
    const details = auction.case.assetDetails;
    switch (auction.case.assetType) {
      case 'vehicle':
        return `${details.year || ''} ${details.make || ''} ${details.model || ''}`.trim() || 'Vehicle';
      case 'property':
        return `${details.propertyType || 'Property'}`;
      case 'electronics':
        return `${details.brand || ''} Electronics`.trim();
      default:
        return 'Salvage Item';
    }
  };

  // Get main photo
  const mainPhoto = auction.case.photos[0] || '/placeholder-auction.jpg';

  // Get current bid or reserve price
  const displayPrice = auction.currentBid 
    ? Number(auction.currentBid)
    : Number(auction.case.reservePrice);

  const priceLabel = auction.currentBid ? 'Current Bid' : 'Reserve';

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer overflow-hidden group"
    >
      {/* Image */}
      <div className="relative h-40 bg-gray-200">
        <Image
          src={mainPhoto}
          alt={getAssetName()}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        
        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          {auction.isWinner && auction.status === 'closed' ? (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yellow-500 text-white">
              <Trophy size={12} aria-label="Won auction" />
              <span>Won</span>
            </span>
          ) : (
            <span
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                auction.status === 'active'
                  ? 'bg-green-500 text-white'
                  : auction.status === 'extended'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-500 text-white'
              }`}
            >
              <Circle size={8} className="fill-current" aria-hidden="true" />
              <span>
                {auction.status === 'active' && 'Active'}
                {auction.status === 'extended' && 'Extended'}
                {auction.status === 'closed' && 'Closed'}
              </span>
            </span>
          )}
        </div>

        {/* Asset Type Badge */}
        <div className="absolute top-2 left-2">
          <span className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-gray-700">
            {auction.case.assetType.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Content - Max 5 fields */}
      <div className="p-3">
        {/* Asset Name */}
        <h3 className="text-base font-bold text-gray-900 mb-2 line-clamp-1">
          {getAssetName()}
        </h3>

        {/* Core Fields (Max 5) */}
        <div className="space-y-2">
          {/* Field 1: Location */}
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" aria-label="Location" />
            <span className="text-gray-600 truncate">{auction.case.locationName}</span>
          </div>

          {/* Field 2: Price with compact format */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400 flex-shrink-0" aria-label={priceLabel} />
              <span className="text-xs text-gray-500">{priceLabel}</span>
            </div>
            <span className="text-lg font-bold text-[#800020]">
              {formatCompactCurrency(displayPrice)}
            </span>
          </div>

          {/* Field 3: Time Remaining */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" aria-label="Time remaining" />
              <span className="text-xs text-gray-500">
                {auction.status === 'closed' ? 'Ended' : 'Remaining'}
              </span>
            </div>
            <span className={`text-sm font-semibold ${timerColor}`}>
              {timeRemaining}
            </span>
          </div>

          {/* Field 4: Watching Count */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Eye className="w-4 h-4" aria-label="Watching count" />
              <span>{auction.watchingCount} watching</span>
            </div>

            {/* High Demand Badge */}
            {auction.watchingCount > 5 && (
              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-semibold">
                High Demand
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
