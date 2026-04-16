/**
 * RecommendationCard Component
 * Tasks 10.2.2, 10.2.3, 10.2.5
 * 
 * Displays personalized auction recommendations for vendors
 */

'use client';

import { useState } from 'react';
import { Heart, Clock, Eye, TrendingUp, X } from 'lucide-react';
import Link from 'next/link';

interface RecommendationCardProps {
  auctionId: string;
  matchScore: number;
  reasonCodes: string[];
  auctionDetails: {
    assetType: string;
    assetDetails: any;
    marketValue: number;
    reservePrice: number;
    currentBid: number | null;
    watchingCount: number;
    endTime: Date;
  };
  onNotInterested?: (auctionId: string) => void;
}

/**
 * Task 10.2.2: Create RecommendationCard component with matchScore display
 * Task 10.2.3: Implement reasonCodes as colored tags
 * Task 10.2.5: Implement "Not Interested" button with feedback tracking
 */
export function RecommendationCard({
  auctionId,
  matchScore,
  reasonCodes,
  auctionDetails,
  onNotInterested,
}: RecommendationCardProps) {
  const [isHidden, setIsHidden] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTimeRemaining = (endTime: Date) => {
    const now = new Date();
    const diff = endTime.getTime() - now.getTime();
    
    if (diff < 0) return 'Ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  // Task 10.2.3: Color-coded reason tags
  const getReasonTagColor = (reason: string) => {
    if (reason.includes('win rate') || reason.includes('High win')) {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    if (reason.includes('Similar') || reason.includes('previous')) {
      return 'bg-blue-100 text-blue-800 border-blue-300';
    }
    if (reason.includes('Trending') || reason.includes('Popular')) {
      return 'bg-purple-100 text-purple-800 border-purple-300';
    }
    if (reason.includes('preferred') || reason.includes('Matches')) {
      return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    }
    if (reason.includes('Best time') || reason.includes('optimal')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
    if (reason.includes('Local') || reason.includes('region')) {
      return 'bg-teal-100 text-teal-800 border-teal-300';
    }
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  // Match score color
  const getMatchScoreColor = () => {
    if (matchScore >= 80) return 'text-green-600';
    if (matchScore >= 60) return 'text-blue-600';
    if (matchScore >= 40) return 'text-yellow-600';
    return 'text-gray-600';
  };

  // Task 10.2.5: Handle "Not Interested" click
  const handleNotInterested = async () => {
    setIsHidden(true);
    
    if (onNotInterested) {
      onNotInterested(auctionId);
    }

    // Track feedback
    try {
      await fetch('/api/intelligence/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'recommendation_dismissed',
          auctionId,
          metadata: { matchScore, reasonCodes },
        }),
      });
    } catch (error) {
      console.error('Error tracking feedback:', error);
    }
  };

  if (isHidden) return null;

  // Get asset display name
  const getAssetName = () => {
    const details = auctionDetails.assetDetails;
    if (auctionDetails.assetType === 'vehicle') {
      return `${details.year || ''} ${details.make || ''} ${details.model || ''}`.trim();
    }
    if (auctionDetails.assetType === 'electronics') {
      return `${details.brand || ''} ${details.model || ''}`.trim();
    }
    if (auctionDetails.assetType === 'machinery') {
      return `${details.manufacturer || ''} ${details.model || ''}`.trim();
    }
    return 'Asset';
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
      {/* Header with match score */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <Link 
              href={`/vendor/auctions/${auctionId}`}
              className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
            >
              {getAssetName()}
            </Link>
            <p className="text-sm text-gray-600 capitalize mt-1">
              {auctionDetails.assetType}
            </p>
          </div>
          
          {/* Task 10.2.2: Match score badge */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              <TrendingUp className={`w-4 h-4 ${getMatchScoreColor()}`} />
              <span className={`text-lg font-bold ${getMatchScoreColor()}`}>
                {matchScore.toFixed(0)}%
              </span>
            </div>
            <span className="text-xs text-gray-500">Match</span>
          </div>
        </div>

        {/* Task 10.2.3: Reason codes as colored tags */}
        <div className="flex flex-wrap gap-2 mt-3">
          {reasonCodes.slice(0, 3).map((reason, index) => (
            <span
              key={index}
              className={`px-2 py-1 rounded-full text-xs font-medium border ${getReasonTagColor(reason)}`}
            >
              {reason}
            </span>
          ))}
          {reasonCodes.length > 3 && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              +{reasonCodes.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Auction details */}
      <div className="p-4 space-y-3">
        {/* Price information */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Current Bid</p>
            <p className="text-lg font-semibold text-gray-900">
              {auctionDetails.currentBid 
                ? formatCurrency(auctionDetails.currentBid)
                : 'No bids yet'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Market Value</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(auctionDetails.marketValue)}
            </p>
          </div>
        </div>

        {/* Auction stats */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            <span>{auctionDetails.watchingCount} watching</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{formatTimeRemaining(auctionDetails.endTime)} left</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-2">
        <Link
          href={`/vendor/auctions/${auctionId}`}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-center"
        >
          View Auction
        </Link>
        
        {/* Task 10.2.5: "Not Interested" button */}
        <button
          onClick={handleNotInterested}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          aria-label="Not interested"
          title="Not interested"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
