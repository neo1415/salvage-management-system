/**
 * RecommendationsFeed Component
 * Tasks 10.2.1, 10.2.4
 * 
 * "For You" tab displaying personalized auction recommendations with infinite scroll
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RecommendationCard, type RecommendationAuctionDetails } from './recommendation-card';
import { Loader2, Sparkles } from 'lucide-react';

interface Recommendation {
  auctionId: string;
  matchScore: number;
  reasonCodes: string[];
  auctionDetails: RecommendationAuctionDetails;
}

interface FallbackAuction {
  id: string;
  currentBid?: string | number | null;
  watchingCount?: string | number | null;
  endTime: string;
  case?: {
    assetType?: string;
    assetDetails?: Record<string, unknown>;
    marketValue?: string | number | null;
    reservePrice?: string | number | null;
  };
}

interface RecommendationsFeedProps {
  vendorId: string;
  initialRecommendations?: Recommendation[];
}

/**
 * Task 10.2.1: Create "For You" tab on vendor auctions page
 * Task 10.2.4: Implement infinite scroll/pagination
 */
export function RecommendationsFeed({
  vendorId,
  initialRecommendations = [],
}: RecommendationsFeedProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>(initialRecommendations);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);

  const fetchFallbackAuctions = useCallback(async () => {
    const response = await fetch('/api/auctions?tab=active&sortBy=newest&limit=10');

    if (!response.ok) {
      throw new Error('Failed to fetch active auctions');
    }

    const data = await response.json();
    const auctions = data.auctions || [];

    return auctions.map((auction: FallbackAuction) => ({
      auctionId: auction.id,
      matchScore: 50,
      reasonCodes: ['Available now', 'Recently listed'],
      auctionDetails: {
        assetType: auction.case?.assetType || 'asset',
        assetDetails: auction.case?.assetDetails || {},
        marketValue: Number(auction.case?.marketValue || 0),
        reservePrice: Number(auction.case?.reservePrice || 0),
        currentBid: auction.currentBid ? Number(auction.currentBid) : null,
        watchingCount: Number(auction.watchingCount || 0),
        endTime: auction.endTime,
      },
    }));
  }, []);

  // Fetch recommendations
  const loadingRef = useRef(false);

  const fetchRecommendations = useCallback(async (pageNum: number) => {
    if (!vendorId || loadingRef.current) return;

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/vendors/${vendorId}/recommendations?limit=10`
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          data.message || data.error || `Recommendations API returned ${response.status}`;
        throw new Error(message);
      }

      const newRecommendations = data.data?.recommendations || [];

      if (newRecommendations.length === 0) {
        const fallbackRecommendations =
          pageNum === 1 ? await fetchFallbackAuctions() : [];
        setRecommendations((prev) =>
          pageNum === 1 ? fallbackRecommendations : prev
        );
        setHasMore(false);
      } else {
        setRecommendations((prev) =>
          pageNum === 1 ? newRecommendations : [...prev, ...newRecommendations]
        );
        setHasMore(newRecommendations.length >= 10);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Recommendations API unavailable, using fallback:', err);
      }
      try {
        const fallbackRecommendations =
          pageNum === 1 ? await fetchFallbackAuctions() : [];
        setRecommendations((prev) =>
          pageNum === 1 ? fallbackRecommendations : prev
        );
        setHasMore(false);
        setError(
          fallbackRecommendations.length === 0
            ? 'Failed to load recommendations. Please try again.'
            : null
        );
      } catch (fallbackError) {
        console.error('Error fetching fallback auctions:', fallbackError);
        setError('Failed to load recommendations. Please try again.');
      }
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [vendorId, fetchFallbackAuctions]);

  useEffect(() => {
    if (vendorId && recommendations.length === 0) {
      fetchRecommendations(1);
    }
  }, [vendorId, recommendations.length, fetchRecommendations]);

  // Task 10.2.4: Infinite scroll with Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setPage(prev => prev + 1);
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
  }, [hasMore, isLoading]);

  // Fetch when page changes
  useEffect(() => {
    if (page > 1) {
      fetchRecommendations(page);
    }
  }, [page, fetchRecommendations]);

  // Handle "Not Interested" feedback
  const handleNotInterested = useCallback((auctionId: string) => {
    setRecommendations(prev => 
      prev.filter(rec => rec.auctionId !== auctionId)
    );
  }, []);

  // Refresh recommendations
  const handleRefresh = useCallback(() => {
    setPage(1);
    setHasMore(true);
    setRecommendations([]);
    fetchRecommendations(1);
  }, [fetchRecommendations]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">For You</h2>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600">
        Personalized auction recommendations based on your bidding history and preferences
      </p>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {/* Recommendations grid */}
      {recommendations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendations.map(recommendation => (
            <RecommendationCard
              key={recommendation.auctionId}
              {...recommendation}
              onNotInterested={handleNotInterested}
            />
          ))}
        </div>
      ) : !isLoading && !error ? (
        <div className="text-center py-12">
          <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No active auctions available
          </h3>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Check back when new auctions are approved and opened for bidding.
          </p>
        </div>
      ) : null}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}

      {/* Intersection observer target for infinite scroll */}
      {hasMore && !isLoading && recommendations.length > 0 && (
        <div ref={observerTarget} className="h-4" />
      )}

      {/* End of recommendations */}
      {!hasMore && recommendations.length > 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-600">
            You've seen all recommendations. Check back later for more!
          </p>
        </div>
      )}
    </div>
  );
}
