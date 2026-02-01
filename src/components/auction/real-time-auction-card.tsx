/**
 * Real-Time Auction Card Component
 * 
 * Example component demonstrating Socket.io integration for real-time auction updates.
 * Shows watching count, latest bids, and auction status updates in real-time.
 * 
 * Requirements: 16-21, NFR1.1
 */

'use client';

import { useAuctionWatch, useAuctionUpdates } from '@/hooks/use-socket';
import { useState, useEffect } from 'react';
import { BidForm } from './bid-form';

interface RealTimeAuctionCardProps {
  auctionId: string;
  initialData?: {
    currentBid?: number;
    endTime?: Date;
    status?: string;
  };
}

export function RealTimeAuctionCard({ auctionId, initialData }: RealTimeAuctionCardProps) {
  const { watchingCount } = useAuctionWatch(auctionId);
  const { auction, latestBid, isExtended, isClosed } = useAuctionUpdates(auctionId);
  
  const [currentBid, setCurrentBid] = useState(initialData?.currentBid || 0);
  const [status, setStatus] = useState(initialData?.status || 'active');
  const [showBidForm, setShowBidForm] = useState(false);

  // Update current bid when new bid is received
  useEffect(() => {
    if (latestBid) {
      setCurrentBid(latestBid.amount);
    }
  }, [latestBid]);

  // Update status when auction is closed
  useEffect(() => {
    if (isClosed) {
      setStatus('closed');
    }
  }, [isClosed]);

  // Update auction data when received
  useEffect(() => {
    if (auction) {
      setCurrentBid(auction.currentBid || 0);
      setStatus(auction.status);
    }
  }, [auction]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200 hover:border-burgundy-500 transition-all">
      {/* Extension Alert */}
      {isExtended && (
        <div className="mb-4 p-3 bg-orange-100 border border-orange-400 rounded-md animate-pulse">
          <p className="text-orange-800 font-semibold">
            ⏰ Auction extended by 2 minutes!
          </p>
        </div>
      )}

      {/* Closed Alert */}
      {isClosed && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 rounded-md">
          <p className="text-red-800 font-semibold">
            🔒 Auction closed
          </p>
        </div>
      )}

      {/* Auction Details */}
      <div className="space-y-4">
        {/* Current Bid */}
        <div>
          <p className="text-sm text-gray-600">Current Bid</p>
          <p className="text-2xl font-bold text-burgundy-900">
            ₦{currentBid.toLocaleString()}
          </p>
          {latestBid && (
            <p className="text-xs text-green-600 animate-pulse">
              ✓ New bid just placed!
            </p>
          )}
        </div>

        {/* Watching Count */}
        <div className="flex items-center gap-2">
          <span className="text-gray-600">👁️</span>
          <span className="text-sm text-gray-700">
            {watchingCount} {watchingCount === 1 ? 'vendor' : 'vendors'} watching
          </span>
          {watchingCount > 5 && (
            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
              High demand!
            </span>
          )}
        </div>

        {/* Status */}
        <div>
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
              status === 'active'
                ? 'bg-green-100 text-green-800'
                : status === 'extended'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {status === 'active' && '🟢 Active'}
            {status === 'extended' && '🟠 Extended'}
            {status === 'closed' && '⚫ Closed'}
          </span>
        </div>

        {/* Action Button */}
        {status === 'active' || status === 'extended' ? (
          <button 
            onClick={() => setShowBidForm(true)}
            className="w-full bg-burgundy-900 text-white py-3 rounded-lg font-semibold hover:bg-burgundy-800 transition-colors"
          >
            Place Bid
          </button>
        ) : (
          <button
            disabled
            className="w-full bg-gray-300 text-gray-600 py-3 rounded-lg font-semibold cursor-not-allowed"
          >
            Auction Closed
          </button>
        )}
      </div>

      {/* Bid Form Modal */}
      <BidForm
        auctionId={auctionId}
        currentBid={currentBid}
        minimumIncrement={10000}
        assetName="Asset Name"
        isOpen={showBidForm}
        onClose={() => setShowBidForm(false)}
        onSuccess={() => {
          // Refresh auction data
          console.log('Bid placed successfully!');
        }}
      />
    </div>
  );
}
