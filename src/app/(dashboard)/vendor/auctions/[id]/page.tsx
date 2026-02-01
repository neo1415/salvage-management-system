/**
 * Auction Details Page
 * 
 * Requirements:
 * - Requirement 16-22: Mobile Auction Browsing, Countdown Timers, Bid Placement, etc.
 * - NFR5.3: User Experience
 * 
 * Features:
 * - Display full asset details and photos (swipeable gallery)
 * - Display AI assessment results
 * - Display GPS location on map
 * - Display current bid and time remaining
 * - Display bid history chart (Recharts line chart)
 * - Display watching count
 * - Add "Place Bid" button
 * - Add "Watch Auction" button
 * - Real-time updates via Socket.io
 */

'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CountdownTimer } from '@/components/ui/countdown-timer';
import { BidForm } from '@/components/auction/bid-form';
import { useAuctionWatch, useAuctionUpdates } from '@/hooks/use-socket';

// Types
interface AuctionDetails {
  id: string;
  caseId: string;
  startTime: string;
  endTime: string;
  originalEndTime: string;
  extensionCount: number;
  currentBid: string | null;
  currentBidder: string | null;
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
    aiAssessment: {
      labels: string[];
      confidenceScore: number;
      damagePercentage: number;
      processedAt: string;
    };
    gpsLocation: {
      x: number; // longitude
      y: number; // latitude
    };
    locationName: string;
    photos: string[];
    voiceNotes: string[];
  };
  bids: Array<{
    id: string;
    amount: string;
    createdAt: string;
    vendorId: string;
  }>;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AuctionDetailsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  
  // State
  const [auction, setAuction] = useState<AuctionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showBidForm, setShowBidForm] = useState(false);
  const [isWatching, setIsWatching] = useState(false);

  // Real-time updates via Socket.io
  const { watchingCount } = useAuctionWatch(resolvedParams.id);
  const { auction: realtimeAuction, latestBid } = useAuctionUpdates(resolvedParams.id);

  // Fetch auction details
  useEffect(() => {
    const fetchAuction = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/auctions/${resolvedParams.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch auction details');
        }

        const data = await response.json();
        setAuction(data.auction);
      } catch (err) {
        console.error('Error fetching auction:', err);
        setError(err instanceof Error ? err.message : 'Failed to load auction');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuction();
  }, [resolvedParams.id]);

  // Update auction with real-time data
  useEffect(() => {
    if (realtimeAuction && auction) {
      setAuction(prev => prev ? {
        ...prev,
        currentBid: realtimeAuction.currentBid || prev.currentBid,
        currentBidder: realtimeAuction.currentBidder || prev.currentBidder,
        status: realtimeAuction.status || prev.status,
        endTime: realtimeAuction.endTime || prev.endTime,
        extensionCount: realtimeAuction.extensionCount ?? prev.extensionCount,
      } : null);
    }
  }, [realtimeAuction, auction]);

  // Update watching count
  useEffect(() => {
    if (auction && watchingCount !== undefined) {
      setAuction(prev => prev ? { ...prev, watchingCount } : null);
    }
  }, [watchingCount, auction]);

  // Add new bid to history
  useEffect(() => {
    if (latestBid && auction) {
      setAuction(prev => {
        if (!prev) return null;
        
        // Check if bid already exists
        const bidExists = prev.bids.some(b => b.id === latestBid.id);
        if (bidExists) return prev;

        return {
          ...prev,
          bids: [...prev.bids, {
            id: latestBid.id,
            amount: latestBid.amount.toString(),
            createdAt: new Date().toISOString(),
            vendorId: latestBid.vendorId,
          }],
          currentBid: latestBid.amount.toString(),
        };
      });
    }
  }, [latestBid, auction]);

  // Handle watch/unwatch
  const handleToggleWatch = async () => {
    try {
      const response = await fetch(`/api/auctions/${resolvedParams.id}/watch`, {
        method: isWatching ? 'DELETE' : 'POST',
      });

      if (response.ok) {
        setIsWatching(!isWatching);
      }
    } catch (err) {
      console.error('Error toggling watch:', err);
    }
  };

  // Photo navigation
  const handlePrevPhoto = () => {
    if (!auction) return;
    setCurrentPhotoIndex(prev => 
      prev === 0 ? auction.case.photos.length - 1 : prev - 1
    );
  };

  const handleNextPhoto = () => {
    if (!auction) return;
    setCurrentPhotoIndex(prev => 
      prev === auction.case.photos.length - 1 ? 0 : prev + 1
    );
  };

  // Format asset name
  const getAssetName = () => {
    if (!auction) return '';
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

  // Prepare bid history chart data
  const getBidHistoryData = () => {
    if (!auction) return [];
    
    return auction.bids.map((bid, index) => ({
      index: index + 1,
      amount: Number(bid.amount),
      time: new Date(bid.createdAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading auction details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Auction Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The auction you are looking for does not exist.'}</p>
          <button
            onClick={() => router.push('/vendor/auctions')}
            className="px-6 py-3 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors"
          >
            Back to Auctions
          </button>
        </div>
      </div>
    );
  }

  const currentBid = auction.currentBid ? Number(auction.currentBid) : null;
  const minimumBid = (currentBid || Number(auction.case.reservePrice)) + Number(auction.minimumIncrement);
  const bidHistoryData = getBidHistoryData();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">Back</span>
            </button>

            {/* Status Badge */}
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
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
              {auction.status === 'cancelled' && '⚫ Cancelled'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Photos and Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo Gallery */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="relative h-96 bg-gray-200">
                <Image
                  src={auction.case.photos[currentPhotoIndex] || '/placeholder-auction.jpg'}
                  alt={`${getAssetName()} - Photo ${currentPhotoIndex + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  priority
                />

                {/* Photo Navigation */}
                {auction.case.photos.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevPhoto}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                      aria-label="Previous photo"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={handleNextPhoto}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                      aria-label="Next photo"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Photo Indicator */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
                      <span className="text-white text-sm font-medium">
                        {currentPhotoIndex + 1} / {auction.case.photos.length}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Photo Thumbnails */}
              {auction.case.photos.length > 1 && (
                <div className="p-4 flex gap-2 overflow-x-auto">
                  {auction.case.photos.map((photo, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentPhotoIndex(index)}
                      className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        index === currentPhotoIndex
                          ? 'border-[#800020] ring-2 ring-[#800020]/30'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Image
                        src={photo}
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Asset Details */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{getAssetName()}</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Asset Type</p>
                  <p className="text-lg font-semibold text-gray-900 capitalize">
                    {auction.case.assetType}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Claim Reference</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {auction.case.claimReference}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Market Value</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ₦{Number(auction.case.marketValue).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Estimated Salvage Value</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ₦{Number(auction.case.estimatedSalvageValue).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Asset-specific details */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Specifications</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(auction.case.assetDetails).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-sm text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </p>
                      <p className="text-sm font-medium text-gray-900">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Assessment */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">AI Damage Assessment</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Damage Severity</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                      auction.case.damageSeverity === 'minor'
                        ? 'bg-yellow-100 text-yellow-800'
                        : auction.case.damageSeverity === 'moderate'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {auction.case.damageSeverity.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Confidence Score</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {auction.case.aiAssessment.confidenceScore}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Damage Percentage</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {auction.case.aiAssessment.damagePercentage}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Assessed On</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(auction.case.aiAssessment.processedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Damage Labels */}
              <div>
                <p className="text-sm text-gray-600 mb-2">Detected Damage</p>
                <div className="flex flex-wrap gap-2">
                  {auction.case.aiAssessment.labels.map((label, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* GPS Location */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Location</h3>
              
              <div className="flex items-start gap-3 mb-4">
                <svg className="w-6 h-6 text-[#800020] flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-lg font-semibold text-gray-900">{auction.case.locationName}</p>
                  <p className="text-sm text-gray-600">
                    Coordinates: {auction.case.gpsLocation.y.toFixed(6)}, {auction.case.gpsLocation.x.toFixed(6)}
                  </p>
                </div>
              </div>

              {/* Google Maps Embed */}
              <div className="relative h-64 bg-gray-200 rounded-lg overflow-hidden">
                <iframe
                  src={`https://www.google.com/maps?q=${auction.case.gpsLocation.y},${auction.case.gpsLocation.x}&output=embed`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Asset location map"
                />
              </div>
            </div>

            {/* Bid History Chart */}
            {bidHistoryData.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Bid History</h3>
                
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bidHistoryData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Time', position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Bid Amount (₦)', angle: -90, position: 'insideLeft' }}
                        tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value: number | undefined) => value !== undefined ? [`₦${value.toLocaleString()}`, 'Bid Amount'] : ['N/A', 'Bid Amount']}
                        labelFormatter={(label) => `Time: ${label}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#800020" 
                        strokeWidth={2}
                        dot={{ fill: '#800020', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 text-sm text-gray-600">
                  <p>Total Bids: {bidHistoryData.length}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Bidding Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {/* Countdown Timer */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                  Time Remaining
                </h3>
                <div className="text-center">
                  <CountdownTimer
                    endTime={auction.endTime}
                    className="text-4xl"
                    onComplete={() => {
                      // Refresh auction data when countdown completes
                      window.location.reload();
                    }}
                  />
                </div>
                {auction.extensionCount > 0 && (
                  <p className="text-sm text-orange-600 text-center mt-2">
                    Extended {auction.extensionCount} time{auction.extensionCount > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Current Bid */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">
                    {currentBid ? 'Current Bid' : 'Reserve Price'}
                  </p>
                  <p className="text-3xl font-bold text-[#800020] mb-4">
                    ₦{(currentBid || Number(auction.case.reservePrice)).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Minimum Bid: ₦{minimumBid.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Watching Count */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="text-gray-700 font-medium">
                      {auction.watchingCount} watching
                    </span>
                  </div>
                  {auction.watchingCount > 5 && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-semibold">
                      🔥 High Demand
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Place Bid Button */}
                {(auction.status === 'active' || auction.status === 'extended') && (
                  <button
                    onClick={() => setShowBidForm(true)}
                    className="w-full bg-[#FFD700] text-[#800020] py-4 rounded-lg font-bold text-lg hover:bg-[#FFC700] transition-colors shadow-md hover:shadow-lg"
                  >
                    Place Bid
                  </button>
                )}

                {auction.status === 'closed' && (
                  <div className="bg-gray-100 text-gray-600 py-4 rounded-lg font-bold text-lg text-center">
                    Auction Closed
                  </div>
                )}

                {auction.status === 'cancelled' && (
                  <div className="bg-red-100 text-red-800 py-4 rounded-lg font-bold text-lg text-center">
                    Auction Cancelled
                  </div>
                )}

                {/* Watch Auction Button */}
                <button
                  onClick={handleToggleWatch}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors border-2 ${
                    isWatching
                      ? 'bg-[#800020] text-white border-[#800020] hover:bg-[#600018]'
                      : 'bg-white text-[#800020] border-[#800020] hover:bg-gray-50'
                  }`}
                >
                  {isWatching ? (
                    <>
                      <svg className="w-5 h-5 inline-block mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      Watching
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Watch Auction
                    </>
                  )}
                </button>
              </div>

              {/* Additional Info */}
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p className="mb-2">
                  <strong>Note:</strong> Bids placed in the last 5 minutes will extend the auction by 2 minutes.
                </p>
                <p>
                  Payment must be completed within 24 hours of winning the auction.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bid Form Modal */}
      <BidForm
        auctionId={auction.id}
        currentBid={currentBid}
        minimumIncrement={Number(auction.minimumIncrement)}
        assetName={getAssetName()}
        isOpen={showBidForm}
        onClose={() => setShowBidForm(false)}
        onSuccess={() => {
          setShowBidForm(false);
          // Auction will be updated via Socket.io
        }}
      />
    </div>
  );
}
