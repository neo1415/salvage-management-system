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

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CountdownTimer } from '@/components/ui/countdown-timer';
import { BidForm } from '@/components/auction/bid-form';
import { ReleaseFormModal } from '@/components/documents/release-form-modal';
import { useAuctionWatch, useAuctionUpdates } from '@/hooks/use-socket';
import { formatConditionForDisplay, type QualityTier } from '@/features/valuations/services/condition-mapping.service';
import { useToast } from '@/components/ui/toast';
import { useAuctionExpiryCheck } from '@/hooks/use-auction-expiry-check';

const PaymentUnlockedModal = dynamic(
  () => import('@/components/modals/payment-unlocked-modal'),
  { ssr: false }
);

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
    vehicleCondition?: QualityTier;
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
  const toast = useToast();
  
  // State
  const [auction, setAuction] = useState<AuctionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showBidForm, setShowBidForm] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [isWatchLoading, setIsWatchLoading] = useState(false);
  
  // Document state
  const [documents, setDocuments] = useState<Array<{
    id: string;
    documentType: 'bill_of_sale' | 'liability_waiver' | 'pickup_authorization';
    title: string;
    status: 'pending' | 'signed' | 'voided';
    signedAt: Date | null;
  }>>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<'bill_of_sale' | 'liability_waiver' | 'pickup_authorization' | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  // Payment unlocked modal state
  const [showPaymentUnlockedModal, setShowPaymentUnlockedModal] = useState(false);
  const [paymentUnlockedData, setPaymentUnlockedData] = useState<{
    paymentId: string;
    auctionId: string;
    assetDescription: string;
    winningBid: number;
    pickupAuthCode: string;
    pickupLocation: string;
    pickupDeadline: string;
  } | null>(null);
  
  // Track if payment processing has been attempted to prevent duplicate calls
  const paymentProcessingAttemptedRef = useRef(false);

  // Real-time updates via Socket.io
  const { watchingCount } = useAuctionWatch(resolvedParams.id);
  const { auction: realtimeAuction, latestBid } = useAuctionUpdates(resolvedParams.id);

  // Real-time auction expiry check - closes auction immediately when timer expires
  // CRITICAL FIX: Hook must run when auction is loaded, regardless of status
  // This ensures expired auctions are closed immediately on page refresh
  useAuctionExpiryCheck({
    auctionId: resolvedParams.id,
    endTime: auction?.endTime || new Date().toISOString(),
    status: auction?.status || 'closed',
    enabled: !!auction, // Run whenever auction data is loaded
    onAuctionClosed: async () => {
      console.log('🎯 Auction expired and closed! Refreshing data...');
      // Refresh auction data to show closed status and documents
      try {
        const response = await fetch(`/api/auctions/${resolvedParams.id}`);
        if (response.ok) {
          const data = await response.json();
          setAuction(data.auction);
          toast.info('Auction Closed', 'This auction has ended');
          
          // CRITICAL FIX: Fetch documents immediately after auction closes
          // This ensures documents show up without requiring a page reload
          if (session?.user?.vendorId && data.auction.currentBidder === session.user.vendorId) {
            console.log('🔄 Fetching documents after auction closure...');
            await fetchDocuments(resolvedParams.id, session.user.vendorId);
          }
        }
      } catch (error) {
        console.error('Failed to refresh auction after closure:', error);
      }
    },
  });

  // Use ref to track if we've already shown notification for this bid
  const lastNotifiedBidRef = useRef<string | null>(null);

  // Show outbid notification - use useCallback to prevent recreation
  useEffect(() => {
    if (latestBid && auction && latestBid.id !== lastNotifiedBidRef.current) {
      // Mark this bid as notified
      lastNotifiedBidRef.current = latestBid.id;
      
      // Check if the current user was the previous highest bidder
      const wasHighestBidder = auction.currentBidder && latestBid.vendorId !== auction.currentBidder;
      
      if (wasHighestBidder) {
        // Show outbid notification
        toast.warning(
          'You\'ve been outbid!',
          `New bid: ₦${Number(latestBid.amount).toLocaleString()}. Place a higher bid to stay in the lead.`
        );
      } else if (latestBid.vendorId !== auction.currentBidder) {
        // Show general bid notification
        toast.info(
          'New bid placed',
          `Current bid: ₦${Number(latestBid.amount).toLocaleString()}`
        );
      }
    }
  }, [latestBid?.id, auction?.currentBidder, toast]); // Add stable dependencies

  // Fetch documents for closed auction
  const fetchDocuments = useCallback(async (auctionId: string, vendorId: string) => {
    try {
      setIsLoadingDocuments(true);
      console.log(`📄 Fetching documents for auction ${auctionId}, vendor ${vendorId}`);
      
      const response = await fetch(`/api/auctions/${auctionId}/documents`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data.documents) {
          const docs = data.data.documents.map((doc: any) => ({
            id: doc.id,
            documentType: doc.documentType,
            title: doc.title,
            status: doc.status,
            signedAt: doc.signedAt ? new Date(doc.signedAt) : null,
          }));
          
          setDocuments(docs);
          console.log(`✅ Loaded ${docs.length} documents`);
        } else {
          console.log(`⚠️  No documents found in response`);
          setDocuments([]);
        }
      } else {
        console.error(`❌ Failed to fetch documents: ${response.status}`);
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, []); // No dependencies - stable function

  // Fetch auction details
  useEffect(() => {
    const fetchAuction = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch all data in parallel to reduce loading time
        const [auctionResponse, watchingResponse, watchStatusResponse] = await Promise.allSettled([
          fetch(`/api/auctions/${resolvedParams.id}`),
          fetch(`/api/auctions/${resolvedParams.id}/watching-count`),
          fetch(`/api/auctions/${resolvedParams.id}/watch/status`),
        ]);

        // Handle auction data
        if (auctionResponse.status === 'fulfilled' && auctionResponse.value.ok) {
          const data = await auctionResponse.value.json();
          setAuction(data.auction);
          
          // Handle watching count
          if (watchingResponse.status === 'fulfilled' && watchingResponse.value.ok) {
            const watchingData = await watchingResponse.value.json();
            if (watchingData.success && data.auction) {
              setAuction(prev => prev ? { ...prev, watchingCount: watchingData.watchingCount } : null);
            }
          }
          
          // Handle watch status
          if (watchStatusResponse.status === 'fulfilled' && watchStatusResponse.value.ok) {
            const watchData = await watchStatusResponse.value.json();
            setIsWatching(watchData.isWatching || false);
          }
        } else {
          throw new Error('Failed to fetch auction details');
        }
      } catch (err) {
        console.error('Error fetching auction:', err);
        setError(err instanceof Error ? err.message : 'Failed to load auction');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuction();
  }, [resolvedParams.id]); // Only depend on auction ID

  // FIXED: Separate useEffect for document fetching to prevent disappearing on reload
  // ENHANCED: Add polling for documents after auction closes to handle async generation
  useEffect(() => {
    // Only fetch documents if:
    // 1. Auction is loaded
    // 2. Auction is closed
    // 3. User is authenticated
    // 4. User has a vendor ID
    // 5. User is the winner
    if (
      auction && 
      auction.status === 'closed' && 
      session?.user?.vendorId && 
      auction.currentBidder === session.user.vendorId
    ) {
      console.log(`🔄 Fetching documents for closed auction ${auction.id}`);
      fetchDocuments(auction.id, session.user.vendorId);
      
      // CRITICAL FIX: Poll for documents every 5 seconds if we don't have all documents yet
      // This handles the case where documents are still being generated
      const pollInterval = setInterval(async () => {
        // Stop polling if we have all expected documents (2: bill_of_sale, liability_waiver)
        if (documents.length >= 2) {
          console.log(`✅ All documents loaded (${documents.length}/2). Stopping poll.`);
          clearInterval(pollInterval);
          return;
        }
        
        console.log(`🔄 Polling for documents... (current: ${documents.length}/2)`);
        await fetchDocuments(auction.id, session.user.vendorId);
      }, 5000); // Poll every 5 seconds
      
      // Stop polling after 60 seconds (12 attempts)
      const stopPollingTimeout = setTimeout(() => {
        console.log(`⏱️  Stopping document polling after 60 seconds`);
        clearInterval(pollInterval);
      }, 60000);
      
      // Cleanup
      return () => {
        clearInterval(pollInterval);
        clearTimeout(stopPollingTimeout);
      };
    }
  }, [auction?.id, auction?.status, auction?.currentBidder, session?.user?.vendorId, fetchDocuments, documents.length]);

  // FIXED: Backward compatibility check - trigger payment unlocked modal for existing auctions
  useEffect(() => {
    const checkPaymentUnlockedBackwardCompatibility = async () => {
      // Prevent multiple attempts
      if (paymentProcessingAttemptedRef.current) return;

      // Only check if:
      // 1. Auction is loaded and closed
      // 2. User is authenticated with vendor ID
      // 3. User is the winner
      // 4. Documents are loaded
      if (
        !auction ||
        auction.status !== 'closed' ||
        !session?.user?.vendorId ||
        !session?.user?.id ||
        auction.currentBidder !== session.user.vendorId ||
        documents.length === 0
      ) {
        return;
      }

      // Check if all documents are signed
      const allDocumentsSigned = documents.every(doc => doc.status === 'signed');
      if (!allDocumentsSigned) {
        console.log(`⏸️  Not all documents signed yet. Skipping payment unlocked check.`);
        return;
      }

      // Mark as attempted to prevent duplicate calls
      paymentProcessingAttemptedRef.current = true;

      console.log(`🔍 Checking for payment unlocked notification (backward compatibility)...`);

      try {
        // Check if PAYMENT_UNLOCKED notification exists
        const notificationsResponse = await fetch('/api/notifications?unreadOnly=false&limit=50');
        if (!notificationsResponse.ok) {
          console.error('Failed to fetch notifications for backward compatibility check');
          return;
        }

        const notificationsData = await notificationsResponse.json();
        const notifications = notificationsData.data?.notifications || [];

        // Check if PAYMENT_UNLOCKED notification exists for this auction
        const paymentUnlockedNotification = notifications.find(
          (n: any) => n.type === 'PAYMENT_UNLOCKED' && n.data?.auctionId === auction.id
        );

        if (paymentUnlockedNotification) {
          console.log(`✅ Payment unlocked notification already exists. Checking if modal should be shown...`);
          
          // Check if payment page has been visited
          const paymentId = paymentUnlockedNotification.data?.paymentId;
          if (paymentId) {
            const hasVisited = localStorage.getItem(`payment-visited-${paymentId}`);
            if (hasVisited) {
              console.log(`⏸️  Payment page already visited. Skipping modal.`);
              return;
            }

            // Show modal with existing notification data
            const assetDetails = auction.case.assetDetails as { make?: string; model?: string; year?: number };
            const assetDescription = `${assetDetails.make || ''} ${assetDetails.model || ''} ${assetDetails.year || ''}`.trim() || auction.case.assetType;

            setPaymentUnlockedData({
              paymentId,
              auctionId: auction.id,
              assetDescription,
              winningBid: parseFloat(auction.currentBid || '0'),
              pickupAuthCode: paymentUnlockedNotification.data?.pickupAuthCode || 'N/A',
              pickupLocation: paymentUnlockedNotification.data?.pickupLocation || 'NEM Insurance Salvage Yard',
              pickupDeadline: paymentUnlockedNotification.data?.pickupDeadline || 'TBD',
            });
            setShowPaymentUnlockedModal(true);
            console.log(`✅ Payment unlocked modal triggered from existing notification`);
          }
          return;
        }

        console.log(`⚠️  No payment unlocked notification found. Triggering retroactive payment processing...`);

        // Call process-payment endpoint to trigger retroactive processing
        const response = await fetch(`/api/auctions/${auction.id}/process-payment`, {
          method: 'POST',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && !data.alreadyProcessed) {
            console.log(`✅ Retroactive payment processing completed. Refreshing page to show modal...`);
            // Refresh page to trigger modal with new notification
            window.location.reload();
          } else if (data.alreadyProcessed) {
            console.log(`⏸️  Payment already processed`);
          }
        } else {
          const errorData = await response.json();
          console.error('Failed to process retroactive payment:', errorData.error);
        }
      } catch (error) {
        console.error('Error in backward compatibility check:', error);
      }
    };

    checkPaymentUnlockedBackwardCompatibility();
  }, [auction?.id, auction?.status, auction?.currentBidder, auction?.currentBid, auction?.case, session?.user?.vendorId, session?.user?.id, documents]);

  // Update auction with real-time data - use useCallback to memoize the update function
  useEffect(() => {
    if (realtimeAuction) {
      setAuction(prev => {
        if (!prev) return null;
        
        // Only update if values actually changed
        const hasChanges = 
          (realtimeAuction.currentBid && realtimeAuction.currentBid !== prev.currentBid) ||
          (realtimeAuction.currentBidder && realtimeAuction.currentBidder !== prev.currentBidder) ||
          (realtimeAuction.status && realtimeAuction.status !== prev.status) ||
          (realtimeAuction.endTime && realtimeAuction.endTime !== prev.endTime) ||
          (realtimeAuction.extensionCount !== undefined && realtimeAuction.extensionCount !== prev.extensionCount);
        
        if (!hasChanges) return prev;
        
        return {
          ...prev,
          currentBid: realtimeAuction.currentBid || prev.currentBid,
          currentBidder: realtimeAuction.currentBidder || prev.currentBidder,
          status: realtimeAuction.status || prev.status,
          endTime: realtimeAuction.endTime || prev.endTime,
          extensionCount: realtimeAuction.extensionCount ?? prev.extensionCount,
        };
      });
    }
  }, [realtimeAuction?.currentBid, realtimeAuction?.currentBidder, realtimeAuction?.status, realtimeAuction?.endTime, realtimeAuction?.extensionCount]); // Only depend on specific fields

  // Update watching count - only when it actually changes
  useEffect(() => {
    if (watchingCount !== undefined) {
      setAuction(prev => {
        if (!prev || prev.watchingCount === watchingCount) return prev;
        return { ...prev, watchingCount };
      });
    }
  }, [watchingCount]); // Only depend on watchingCount

  // Add new bid to history - only when bid ID changes
  useEffect(() => {
    if (latestBid) {
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
  }, [latestBid?.id]); // Only depend on bid ID

  // Handle watch/unwatch - wrapped in useCallback to prevent recreation
  const handleToggleWatch = useCallback(async () => {
    if (isWatchLoading) return;
    
    try {
      setIsWatchLoading(true);
      const response = await fetch(`/api/auctions/${resolvedParams.id}/watch`, {
        method: isWatching ? 'DELETE' : 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setIsWatching(!isWatching);
        
        // Update watching count immediately for better UX
        if (data.watchingCount !== undefined) {
          setAuction(prev => prev ? { ...prev, watchingCount: data.watchingCount } : null);
        }
        
        // Show success toast
        toast.success(
          isWatching ? 'Stopped watching' : 'Now watching',
          isWatching 
            ? 'You will no longer receive updates for this auction' 
            : 'You will receive real-time updates for this auction'
        );
        
        console.log(`✅ Watch toggled: ${!isWatching ? 'watching' : 'not watching'} auction ${resolvedParams.id}`);
      } else {
        const errorData = await response.json();
        console.error('Watch toggle failed:', errorData.error);
        
        // Show error toast instead of alert
        toast.error(
          'Failed to update watch status',
          errorData.error || 'Please try again'
        );
      }
    } catch (err) {
      console.error('Error toggling watch:', err);
      
      // Show error toast instead of alert
      toast.error(
        'Failed to update watch status',
        'Please check your connection and try again'
      );
    } finally {
      setIsWatchLoading(false);
    }
  }, [isWatchLoading, isWatching, resolvedParams.id, toast]);

  // Photo navigation - wrapped in useCallback
  const handlePrevPhoto = useCallback(() => {
    if (!auction) return;
    setCurrentPhotoIndex(prev => 
      prev === 0 ? auction.case.photos.length - 1 : prev - 1
    );
  }, [auction?.case.photos.length]);

  const handleNextPhoto = useCallback(() => {
    if (!auction) return;
    setCurrentPhotoIndex(prev => 
      prev === auction.case.photos.length - 1 ? 0 : prev + 1
    );
  }, [auction?.case.photos.length]);

  // Format asset name - wrapped in useCallback
  const getAssetName = useCallback(() => {
    if (!auction) return '';
    const details = auction.case.assetDetails;
    switch (auction.case.assetType) {
      case 'vehicle':
        return `${details.year || ''} ${details.make || ''} ${details.model || ''}`.trim() || 'Vehicle';
      case 'property':
        return `${details.propertyType || 'Property'}`;
      case 'electronics':
        return `${details.brand || ''} Electronics`.trim();
      case 'machinery':
        const machineryName = `${details.brand || ''} ${details.model || ''} ${details.machineryType || ''}`.trim();
        return machineryName || (details.machineryType ? String(details.machineryType) : 'Machinery');
      default:
        return 'Salvage Item';
    }
  }, [auction?.case.assetType, auction?.case.assetDetails]);

  // Prepare bid history chart data - wrapped in useCallback
  const getBidHistoryData = useCallback(() => {
    if (!auction) return [];
    
    return auction.bids.map((bid, index) => ({
      index: index + 1,
      amount: Number(bid.amount),
      time: new Date(bid.createdAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));
  }, [auction?.bids]);

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
  const reservePrice = Number(auction.case.reservePrice);
  const minimumIncrement = 20000; // Fixed ₦20,000 minimum increment
  
  // Calculate minimum bid: use realtime data if available, otherwise calculate from current bid
  const minimumBid = latestBid?.minimumBid 
    ? latestBid.minimumBid 
    : (currentBid ? currentBid + minimumIncrement : reservePrice);
  
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
        {/* Document Signing Section (if won but not all signed) */}
        {auction.status === 'closed' && 
         session?.user?.vendorId && 
         auction.currentBidder === session.user.vendorId && 
         documents.length > 0 && (
          <div className="bg-white border-2 border-yellow-400 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  🎉 Congratulations! You Won This Auction
                </h3>
                <p className="text-gray-700 mb-4">
                  Before payment can be processed, you must sign all required documents. 
                  Progress: <strong>{documents.filter(d => d.status === 'signed' && !(d.documentType === 'pickup_authorization' && d.status === 'pending')).length}/{documents.filter(d => !(d.documentType === 'pickup_authorization' && d.status === 'pending')).length} documents signed</strong>
                </p>
                
                {/* FIXED: Document Cards in Row Layout */}
                {/* Filter out pending pickup_authorization - it's generated AFTER payment, never shown as pending */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  {documents
                    .filter(doc => !(doc.documentType === 'pickup_authorization' && doc.status === 'pending'))
                    .map((doc) => (
                    <div 
                      key={doc.id}
                      className={`flex flex-col p-4 rounded-lg border-2 transition-all ${
                        doc.status === 'signed' 
                          ? 'bg-green-50 border-green-300 shadow-sm' 
                          : 'bg-yellow-50 border-yellow-300 shadow-md hover:shadow-lg'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start gap-3 mb-3">
                        {doc.status === 'signed' ? (
                          <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm leading-tight">{doc.title}</p>
                          {doc.status === 'signed' && doc.signedAt && (
                            <p className="text-xs text-gray-600 mt-1">
                              Signed {new Date(doc.signedAt).toLocaleDateString('en-NG')}
                            </p>
                          )}
                          {doc.status === 'pending' && (
                            <p className="text-xs text-yellow-700 mt-1 font-medium">
                              Signature required
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Card Action Button */}
                      <div className="mt-auto">
                        {doc.status === 'pending' && (
                          <button
                            onClick={() => {
                              setSelectedDocumentType(doc.documentType);
                              setShowDocumentModal(true);
                            }}
                            className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md font-medium transition-colors text-sm"
                          >
                            Sign Now
                          </button>
                        )}
                        {doc.status === 'signed' && (
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/documents/${doc.id}/download`);
                                if (!response.ok) throw new Error('Download failed');
                                
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${doc.title}.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                                
                                toast.success('Download Started', 'Your document is downloading');
                              } catch (error) {
                                console.error('Download error:', error);
                                toast.error('Download Failed', 'Please try again');
                              }
                            }}
                            className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Document Signing Progress</span>
                    <span>{Math.round((documents.filter(d => d.status === 'signed').length / documents.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-green-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${(documents.filter(d => d.status === 'signed').length / documents.length) * 100}%` }}
                    />
                  </div>
                </div>

                {documents.every(d => d.status === 'signed') && (
                  <div className="mt-4 p-4 bg-green-100 border border-green-300 rounded-lg">
                    <p className="text-green-800 font-semibold">
                      ✅ All documents signed! Payment is being processed automatically. 
                      You will receive your pickup code shortly.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Loading Documents State */}
        {auction.status === 'closed' && 
         session?.user?.vendorId && 
         auction.currentBidder === session.user.vendorId && 
         isLoadingDocuments && (
          <div className="bg-white border border-gray-300 rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#800020]"></div>
              <p className="text-gray-600">Loading documents...</p>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Photos and Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo Gallery */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="relative w-full aspect-[4/3] bg-gray-200">
                <Image
                  src={auction.case.photos[currentPhotoIndex] || '/placeholder-auction.jpg'}
                  alt={`${getAssetName()} - Photo ${currentPhotoIndex + 1}`}
                  fill
                  className="object-contain"
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
                {auction.case.assetType === 'vehicle' && auction.case.vehicleCondition && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Condition</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatConditionForDisplay(auction.case.vehicleCondition).label}
                    </p>
                  </div>
                )}
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
              {auction.case.assetDetails && typeof auction.case.assetDetails === 'object' && Object.keys(auction.case.assetDetails).length > 0 && (
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
              )}
            </div>

            {/* Detected Damage */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Detected Damage</h3>
              
              {/* Damage Labels */}
              <div>
                <p className="text-sm text-gray-600 mb-2">Damage Components</p>
                <div className="flex flex-wrap gap-2">
                  {auction.case.aiAssessment.labels.map((label, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium break-words"
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
                  {auction.case.gpsLocation?.y !== undefined && auction.case.gpsLocation?.x !== undefined ? (
                    <p className="text-sm text-gray-600">
                      Coordinates: {auction.case.gpsLocation.y.toFixed(6)}, {auction.case.gpsLocation.x.toFixed(6)}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Coordinates: Not available
                    </p>
                  )}
                </div>
              </div>

              {/* Interactive Google Maps */}
              <div className="relative h-64 bg-gray-200 rounded-lg overflow-hidden">
                {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY !== 'your-google-maps-api-key' ? (
                  <>
                    {auction.case.gpsLocation?.y !== undefined && auction.case.gpsLocation?.x !== undefined ? (
                      // Use coordinates if available
                      <iframe
                        src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${auction.case.gpsLocation.y},${auction.case.gpsLocation.x}&zoom=15&maptype=roadmap`}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Asset location map"
                      />
                    ) : auction.case.locationName ? (
                      // Use address for geocoding if coordinates not available
                      <iframe
                        src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(auction.case.locationName)}&zoom=15&maptype=roadmap`}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Asset location map"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                        <div className="text-center">
                          <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <p className="text-gray-600">Location data not available</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-gray-600 mb-2">Interactive map unavailable</p>
                      {auction.case.gpsLocation?.y !== undefined && auction.case.gpsLocation?.x !== undefined ? (
                        <a
                          href={`https://www.google.com/maps?q=${auction.case.gpsLocation.y},${auction.case.gpsLocation.x}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#800020] hover:underline font-medium"
                        >
                          View on Google Maps
                        </a>
                      ) : auction.case.locationName ? (
                        <a
                          href={`https://www.google.com/maps/search/${encodeURIComponent(auction.case.locationName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#800020] hover:underline font-medium"
                        >
                          Search on Google Maps
                        </a>
                      ) : null}
                    </div>
                  </div>
                )}
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
                    className="text-xl md:text-2xl lg:text-xl font-mono" // Smaller font on desktop to prevent layout shifts
                    onComplete={async () => {
                      // Refresh auction data via API instead of full page reload
                      try {
                        const response = await fetch(`/api/auctions/${resolvedParams.id}`);
                        if (response.ok) {
                          const data = await response.json();
                          setAuction(data.auction);
                        }
                      } catch (error) {
                        console.error('Failed to refresh auction after countdown:', error);
                      }
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
                    {currentBid ? 'Current Bid' : 'Starting Bid (Reserve Price)'}
                  </p>
                  <p className="text-3xl font-bold text-[#800020] mb-4">
                    ₦{(currentBid || reservePrice).toLocaleString()}
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
                  disabled={isWatchLoading}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors border-2 group ${
                    isWatching
                      ? 'bg-[#800020] text-white border-[#800020] hover:bg-[#600018]'
                      : 'bg-white text-[#800020] border-[#800020] hover:bg-gray-50'
                  } ${isWatchLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isWatchLoading ? (
                    <>
                      <svg className="w-5 h-5 inline-block mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {isWatching ? 'Unwatching...' : 'Watching...'}
                    </>
                  ) : isWatching ? (
                    <>
                      <span className="group-hover:hidden">
                        <svg className="w-5 h-5 inline-block mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        Watching
                      </span>
                      <span className="hidden group-hover:inline">
                        <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Stop Watching
                      </span>
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
                <p className="mb-2">
                  Payment must be completed within 24 hours of winning the auction.
                </p>
                <p>
                  <strong>Watching:</strong> Get real-time notifications for new bids, auction extensions, and when the auction ends.
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
        minimumBid={minimumBid} // Pass the calculated minimum bid (reserve price or current bid + ₦20,000)
        assetName={getAssetName()}
        isOpen={showBidForm}
        onClose={() => setShowBidForm(false)}
        onSuccess={async () => {
          setShowBidForm(false);
          // Immediately fetch updated auction data
          try {
            const response = await fetch(`/api/auctions/${resolvedParams.id}`);
            if (response.ok) {
              const data = await response.json();
              setAuction(data.auction);
            }
          } catch (error) {
            console.error('Failed to refresh auction:', error);
          }
        }}
      />

      {/* Release Form Modal */}
      {showDocumentModal && selectedDocumentType && session?.user?.vendorId && (
        <ReleaseFormModal
          auctionId={auction.id}
          documentType={selectedDocumentType}
          onClose={() => {
            setShowDocumentModal(false);
            setSelectedDocumentType(null);
          }}
          onSigned={async () => {
            setShowDocumentModal(false);
            setSelectedDocumentType(null);
            // Refresh documents
            if (session?.user?.vendorId) {
              await fetchDocuments(auction.id, session.user.vendorId);
            }
            toast.success(
              'Document Signed Successfully',
              'Your signature has been recorded'
            );
          }}
        />
      )}

      {/* Payment Unlocked Modal */}
      {showPaymentUnlockedModal && paymentUnlockedData && (
        <PaymentUnlockedModal
          isOpen={showPaymentUnlockedModal}
          onClose={() => setShowPaymentUnlockedModal(false)}
          paymentData={paymentUnlockedData}
        />
      )}
    </div>
  );
}
