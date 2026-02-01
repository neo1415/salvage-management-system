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
 * - Filters: asset type, price range, time ending, location
 * - Search by asset name and claim reference
 * - Lazy loading (20 auctions initially)
 * - Infinite scroll
 * - Pull-to-refresh
 * - Real-time countdown timers
 * - Watching count display
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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
  };
}

interface Filters {
  assetType: string;
  priceMin: string;
  priceMax: string;
  sortBy: 'ending_soon' | 'newest' | 'price_low' | 'price_high';
  location: string;
  search: string;
}

export default function AuctionBrowsingPage() {
  const router = useRouter();
  
  // State
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState<Filters>({
    assetType: '',
    priceMin: '',
    priceMax: '',
    sortBy: 'ending_soon',
    location: '',
    search: '',
  });

  // Refs
  const observerTarget = useRef<HTMLDivElement>(null);
  const pullStartY = useRef(0);
  const pullDistance = useRef(0);

  // Fetch auctions
  const fetchAuctions = useCallback(async (pageNum: number, reset: boolean = false) => {
    try {
      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      // Build query params
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
        ...filters,
      });

      const response = await fetch(`/api/auctions?${params}`);
      
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
  }, [filters]);

  // Initial load
  useEffect(() => {
    fetchAuctions(1, true);
  }, [fetchAuctions]);

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

  // Filter handlers
  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setPage(1);
    fetchAuctions(1, true);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilters({
      assetType: '',
      priceMin: '',
      priceMax: '',
      sortBy: 'ending_soon',
      location: '',
      search: '',
    });
    setPage(1);
    fetchAuctions(1, true);
    setShowFilters(false);
  };

  // Search handler
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAuctions(1, true);
  };

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
            <h1 className="text-2xl font-bold text-gray-900">Browse Auctions</h1>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 rounded-lg border-2 border-gray-300 hover:bg-gray-50 transition-colors"
              aria-label="Toggle filters"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Search by asset name or claim reference..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full px-4 py-3 pl-12 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#800020] transition-colors"
            />
            <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </form>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            <div className="max-w-7xl mx-auto space-y-4">
              {/* Asset Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Asset Type</label>
                <select
                  value={filters.assetType}
                  onChange={(e) => handleFilterChange('assetType', e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#800020]"
                >
                  <option value="">All Types</option>
                  <option value="vehicle">Vehicle</option>
                  <option value="property">Property</option>
                  <option value="electronics">Electronics</option>
                </select>
              </div>

              {/* Price Range Filter */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Price (₦)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={filters.priceMin}
                    onChange={(e) => handleFilterChange('priceMin', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Price (₦)</label>
                  <input
                    type="number"
                    placeholder="No limit"
                    value={filters.priceMax}
                    onChange={(e) => handleFilterChange('priceMax', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>
              </div>

              {/* Sort By Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value as Filters['sortBy'])}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#800020]"
                >
                  <option value="ending_soon">Ending Soon</option>
                  <option value="newest">Newest First</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                </select>
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  placeholder="Enter location..."
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#800020]"
                />
              </div>

              {/* Filter Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={applyFilters}
                  className="flex-1 px-4 py-3 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  onClick={clearFilters}
                  className="px-4 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Clear
                </button>
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
            <p className="text-gray-600 mb-4">Try adjusting your filters or check back later</p>
            <button
              onClick={clearFilters}
              className="px-6 py-2 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Auction Grid */}
        {!isLoading && auctions.length > 0 && (
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
      </div>
    </div>
  );
}

// Auction Card Component
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
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Format based on time remaining
      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        setTimerColor('text-green-600');
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
        setTimerColor(hours >= 1 ? 'text-yellow-600' : 'text-red-600');
      } else {
        setTimeRemaining(`${minutes}m ${seconds}s`);
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
    ? Number(auction.currentBid).toLocaleString()
    : Number(auction.case.reservePrice).toLocaleString();

  const priceLabel = auction.currentBid ? 'Current Bid' : 'Reserve Price';

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer overflow-hidden group"
    >
      {/* Image */}
      <div className="relative h-48 bg-gray-200">
        <Image
          src={mainPhoto}
          alt={getAssetName()}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        
        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          <span
            className={`px-2 py-1 rounded-full text-xs font-semibold ${
              auction.status === 'active'
                ? 'bg-green-500 text-white'
                : auction.status === 'extended'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-500 text-white'
            }`}
          >
            {auction.status === 'active' && '🟢 Active'}
            {auction.status === 'extended' && '🟠 Extended'}
            {auction.status === 'closed' && '⚫ Closed'}
          </span>
        </div>

        {/* Asset Type Badge */}
        <div className="absolute top-2 left-2">
          <span className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-gray-700">
            {auction.case.assetType.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Asset Name */}
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1">
          {getAssetName()}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="line-clamp-1">{auction.case.locationName}</span>
        </div>

        {/* Price */}
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">{priceLabel}</p>
          <p className="text-xl font-bold text-[#800020]">
            ₦{displayPrice}
          </p>
        </div>

        {/* Time Remaining */}
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Time Remaining</p>
          <p className={`text-sm font-semibold ${timerColor} ${timeRemaining.includes('m') && !timeRemaining.includes('h') && !timeRemaining.includes('d') ? 'animate-pulse' : ''}`}>
            ⏰ {timeRemaining}
          </p>
        </div>

        {/* Watching Count */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>{auction.watchingCount} watching</span>
          </div>

          {/* High Demand Badge */}
          {auction.watchingCount > 5 && (
            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-semibold">
              🔥 High Demand
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
