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
import { useAuctionWatch, useAuctionUpdates, useRealtimeNotifications } from '@/hooks/use-socket';
import { formatConditionForDisplay, type QualityTier } from '@/features/valuations/services/condition-mapping.service';
import { useToast } from '@/components/ui/toast';
import { GeminiDamageDisplay } from '@/components/ai-assessment/gemini-damage-display';
import { PredictionCard } from '@/components/intelligence/prediction-card';

const PaymentUnlockedModal = dynamic(
  () => import('@/components/modals/payment-unlocked-modal'),
  { ssr: false }
);

const PaymentOptions = dynamic(
  () => import('@/components/vendor/payment-options').then(mod => ({ default: mod.PaymentOptions })),
  { ssr: false }
);

const DocumentSigning = dynamic(
  () => import('@/components/vendor/document-signing').then(mod => ({ default: mod.DocumentSigning })),
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
  status: 'scheduled' | 'active' | 'extended' | 'closed' | 'awaiting_payment' | 'cancelled';
  watchingCount: number;
  case: {
    id: string;
    claimReference: string;
    assetType: 'vehicle' | 'property' | 'electronics' | 'machinery';
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
      itemDetails?: {
        detectedMake?: string;
        detectedModel?: string;
        detectedYear?: string;
        color?: string;
        trim?: string;
        bodyStyle?: string;
        storage?: string;
        overallCondition?: string;
        notes?: string;
      };
      damagedParts?: Array<{
        part: string;
        severity: 'minor' | 'moderate' | 'severe';
        confidence: number;
      }>;
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
  
  // Real-time UI feedback state
  const [showNewBidAnimation, setShowNewBidAnimation] = useState(false);
  const [showExtensionNotification, setShowExtensionNotification] = useState(false);
  
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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
  
  // Track document count to prevent infinite polling loop
  const documentCountRef = useRef(0);

  // Track if verified payment exists (to hide "Pay Now" button)
  const [hasVerifiedPayment, setHasVerifiedPayment] = useState(false);

  // Prediction state
  const [prediction, setPrediction] = useState<any>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);

  // Set hasVerifiedPayment from initial auction data (no separate API call needed)
  useEffect(() => {
    if (auction && 'hasVerifiedPayment' in auction) {
      setHasVerifiedPayment((auction as any).hasVerifiedPayment || false);
    }
  }, [auction]);

  // Real-time updates via Socket.io
  const { watchingCount } = useAuctionWatch(resolvedParams.id);
  const { 
    auction: realtimeAuction, 
    latestBid, 
    usingPolling,
    isClosing,
    documentsGenerating,
    generatedDocuments,
  } = useAuctionUpdates(resolvedParams.id);
  
  // Real-time notification listener for PAYMENT_UNLOCKED
  const { newNotification } = useRealtimeNotifications();

  // Handle PAYMENT_UNLOCKED notification in real-time
  useEffect(() => {
    if (!newNotification || !auction) return;
    
    // Check if this is a PAYMENT_UNLOCKED notification for this auction
    if (
      newNotification.type === 'PAYMENT_UNLOCKED' && 
      newNotification.data?.auctionId === auction.id &&
      session?.user?.vendorId &&
      auction.currentBidder === session.user.vendorId
    ) {
      console.log('📬 PAYMENT_UNLOCKED notification received in real-time!');
      console.log('   - Auction ID:', newNotification.data.auctionId);
      console.log('   - Payment ID:', newNotification.data.paymentId);
      console.log('   - Pickup Code:', newNotification.data.pickupAuthCode);
      
      // Check if payment page has been visited
      const paymentId = newNotification.data.paymentId;
      if (paymentId) {
        const hasVisited = localStorage.getItem(`payment-visited-${paymentId}`);
        if (hasVisited) {
          console.log('⏸️  Payment page already visited. Skipping modal.');
          return;
        }
      }
      
      // Get asset description
      const assetDetails = auction.case.assetDetails as { make?: string; model?: string; year?: number };
      const assetDescription = `${assetDetails.make || ''} ${assetDetails.model || ''} ${assetDetails.year || ''}`.trim() || auction.case.assetType;
      
      // Show modal immediately
      setPaymentUnlockedData({
        paymentId: newNotification.data.paymentId,
        auctionId: auction.id,
        assetDescription,
        winningBid: parseFloat(auction.currentBid || '0'),
        pickupAuthCode: newNotification.data.pickupAuthCode || 'N/A',
        pickupLocation: newNotification.data.pickupLocation || 'NEM Insurance Salvage Yard',
        pickupDeadline: newNotification.data.pickupDeadline || 'TBD',
      });
      setShowPaymentUnlockedModal(true);
      console.log('✅ Payment unlocked modal triggered from real-time notification!');
    }
  }, [newNotification, auction?.id, auction?.currentBidder, auction?.currentBid, session?.user?.vendorId]);

  // Client-side timer to close auction when it expires (replaces useAuctionExpiryCheck)
  useEffect(() => {
    // CRITICAL FIX: Timer should work for BOTH 'active' AND 'extended' statuses
    if (!auction || (auction.status !== 'active' && auction.status !== 'extended')) return;
    
    const endTime = new Date(auction.endTime);
    const now = new Date();
    const timeUntilEnd = endTime.getTime() - now.getTime();
    
    console.log(`⏰ Setting up auction close timer:`, {
      auctionId: auction.id,
      status: auction.status,
      endTime: endTime.toISOString(),
      now: now.toISOString(),
      timeUntilEnd: `${Math.round(timeUntilEnd / 1000)}s`,
    });
    
    if (timeUntilEnd <= 0) {
      // Already expired - close immediately
      console.log(`🎯 Auction already expired, closing now`);
      handleAuctionClose();
    } else {
      // Set timer to close when expires
      const timer = setTimeout(() => {
        console.log(`⏰ Timer fired! Closing auction ${auction.id}`);
        handleAuctionClose();
      }, timeUntilEnd);
      
      return () => {
        console.log(`🧹 Clearing timer for auction ${auction.id}`);
        clearTimeout(timer);
      };
    }
  }, [auction?.id, auction?.endTime, auction?.status]);

  const handleAuctionClose = async () => {
    if (!auction) return;
    
    try {
      console.log(`🎯 Closing auction ${auction.id}...`);
      toast.info('Closing Auction', 'Auction time has expired');
      
      const response = await fetch(`/api/auctions/${auction.id}/close`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Auction closure initiated:`, data);
        // Socket.io will handle real-time updates
      } else {
        const error = await response.json();
        console.error(`❌ Failed to close auction:`, error);
        toast.error('Closure Failed', error.error || 'Please refresh the page');
      }
    } catch (error) {
      console.error('Error closing auction:', error);
      toast.error('Closure Failed', 'Please refresh the page');
    }
  };

  // Use ref to track if we've already shown notification for this bid
  const lastNotifiedBidRef = useRef<string | null>(null);

  // Show outbid notification and visual feedback - use useCallback to prevent recreation
  useEffect(() => {
    if (latestBid && auction && latestBid.id !== lastNotifiedBidRef.current) {
      // Mark this bid as notified
      lastNotifiedBidRef.current = latestBid.id;
      
      // Trigger visual animation for new bid
      setShowNewBidAnimation(true);
      setTimeout(() => setShowNewBidAnimation(false), 2000);
      
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
  
  // Show extension notification
  const lastExtensionCountRef = useRef<number>(0);
  const lastAuctionStatusRef = useRef<string>('');
  
  useEffect(() => {
    // Hide extension notification if auction is closed or awaiting payment
    if (auction && (auction.status === 'closed' || auction.status === 'awaiting_payment')) {
      setShowExtensionNotification(false);
      lastAuctionStatusRef.current = auction.status;
      return;
    }

    if (auction && auction.extensionCount > lastExtensionCountRef.current) {
      lastExtensionCountRef.current = auction.extensionCount;
      setShowExtensionNotification(true);
      setTimeout(() => setShowExtensionNotification(false), 5000);
      
      toast.info(
        '⏰ Auction Extended',
        'Auction extended by 2 minutes due to last-minute bid'
      );
    }
    
    if (auction) {
      lastAuctionStatusRef.current = auction.status;
    }
  }, [auction?.extensionCount, toast]);

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
          
          // Update ref with count of expected documents (bill_of_sale and liability_waiver)
          const expectedDocs = docs.filter((d: any) => 
            d.documentType === 'bill_of_sale' || d.documentType === 'liability_waiver'
          );
          documentCountRef.current = expectedDocs.length;
          
          console.log(`✅ Loaded ${docs.length} documents (${expectedDocs.length} expected)`);
        } else {
          console.log(`⚠️  No documents found in response`);
          setDocuments([]);
          documentCountRef.current = 0;
        }
      } else {
        console.error(`❌ Failed to fetch documents: ${response.status}`);
        setDocuments([]);
        documentCountRef.current = 0;
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocuments([]);
      documentCountRef.current = 0;
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
  // CHANGED: Poll for documents every 3 seconds until they appear
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
      console.log(`🔄 Starting document polling for closed auction ${auction.id}`);
      
      // Fetch immediately
      fetchDocuments(auction.id, session.user.vendorId);
      
      // Then poll every 3 seconds until documents appear
      const pollInterval = setInterval(() => {
        // Stop polling if we have documents
        if (documents.length > 0) {
          console.log(`✅ Documents loaded, stopping poll`);
          clearInterval(pollInterval);
          return;
        }
        
        console.log(`📄 Polling for documents...`);
        fetchDocuments(auction.id, session.user.vendorId);
      }, 3000);
      
      return () => {
        console.log(`🛑 Stopping document polling`);
        clearInterval(pollInterval);
      };
    }
  }, [auction?.id, auction?.status, auction?.currentBidder, session?.user?.vendorId, documents.length, fetchDocuments]);

  // Fetch prediction for active/extended auctions
  useEffect(() => {
    const fetchPrediction = async () => {
      if (!auction || (auction.status !== 'active' && auction.status !== 'extended')) {
        setPrediction(null);
        return;
      }
      
      try {
        setPredictionLoading(true);
        const response = await fetch(`/api/auctions/${auction.id}/prediction`);
        if (response.ok) {
          const data = await response.json();
          // FIXED: API now returns flat structure (not nested data.data)
          setPrediction(data);
        } else {
          console.error('Failed to fetch prediction');
          setPrediction(null);
        }
      } catch (error) {
        console.error('Error fetching prediction:', error);
        setPrediction(null);
      } finally {
        setPredictionLoading(false);
      }
    };

    fetchPrediction();
  }, [auction?.id, auction?.status]);

  // Show payment unlocked modal if notification exists (for page refreshes)
  // CHANGED: Use polling to check for notification every 5 seconds
  useEffect(() => {
    const checkForExistingPaymentNotification = async () => {
      // Only check if:
      // 1. Auction is in awaiting_payment status (payment unlocked)
      // 2. User is authenticated with vendor ID
      // 3. User is the winner
      if (
        !auction ||
        auction.status !== 'awaiting_payment' ||
        !session?.user?.vendorId ||
        !session?.user?.id ||
        auction.currentBidder !== session.user.vendorId
      ) {
        return;
      }

      console.log(`🔍 Checking for existing payment unlocked notification...`);

      try {
        // Check if PAYMENT_UNLOCKED notification exists
        const notificationsResponse = await fetch('/api/notifications?unreadOnly=false&limit=50');
        if (!notificationsResponse.ok) {
          console.error('Failed to fetch notifications');
          return;
        }

        const notificationsData = await notificationsResponse.json();
        const notifications = notificationsData.data?.notifications || [];

        // Check if PAYMENT_UNLOCKED notification exists for this auction
        const paymentUnlockedNotification = notifications.find(
          (n: any) => n.type === 'PAYMENT_UNLOCKED' && n.data?.auctionId === auction.id
        );

        if (paymentUnlockedNotification) {
          console.log(`✅ Payment unlocked notification found`);
          
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
        }
      } catch (error) {
        console.error('Error checking for payment notification:', error);
      }
    };

    // Check immediately
    checkForExistingPaymentNotification();

    // Then poll every 5 seconds while in awaiting_payment status
    const pollInterval = setInterval(checkForExistingPaymentNotification, 5000);

    return () => clearInterval(pollInterval);
  }, [auction?.id, auction?.status, auction?.currentBidder, auction?.currentBid, session?.user?.vendorId, session?.user?.id]); // Removed auction?.case from dependencies


  // Update auction with real-time data - CRITICAL FIX for real-time UI updates
  useEffect(() => {
    if (!realtimeAuction) return;
    
    console.log(`📡 Real-time auction update received:`, {
      currentBid: realtimeAuction.currentBid,
      currentBidder: realtimeAuction.currentBidder,
      status: realtimeAuction.status,
      endTime: realtimeAuction.endTime,
      extensionCount: realtimeAuction.extensionCount,
    });
    
    setAuction(prev => {
      if (!prev) {
        console.log(`⚠️  No previous auction state, skipping update`);
        return null;
      }
      
      // Merge realtime updates into existing auction object
      // This ensures we don't lose any fields and always update when Socket.IO sends data
      const updated = {
        ...prev,
        ...(realtimeAuction.currentBid !== undefined && { currentBid: realtimeAuction.currentBid }),
        ...(realtimeAuction.currentBidder !== undefined && { currentBidder: realtimeAuction.currentBidder }),
        ...(realtimeAuction.status !== undefined && { status: realtimeAuction.status }),
        ...(realtimeAuction.endTime !== undefined && { endTime: realtimeAuction.endTime }),
        ...(realtimeAuction.extensionCount !== undefined && { extensionCount: realtimeAuction.extensionCount }),
      };
      
      console.log(`✅ Auction state updated:`, {
        oldStatus: prev.status,
        newStatus: updated.status,
        oldBid: prev.currentBid,
        newBid: updated.currentBid,
      });
      
      return updated;
    });
  }, [realtimeAuction]); // Depend on the entire object, not individual fields

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

            <div className="flex items-center gap-3">
              {/* Connection Status Indicator (dev mode only) */}
              {process.env.NODE_ENV === 'development' && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  {usingPolling ? (
                    <>
                      <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                      <span>Polling ⚠️</span>
                    </>
                  ) : (
                    <>
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                      <span>WebSocket ✅</span>
                    </>
                  )}
                </div>
              )}

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
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Extension Notification Banner */}
        {showExtensionNotification && (
          <div className="bg-gradient-to-r from-orange-500 to-yellow-500 border-2 border-orange-600 rounded-lg shadow-lg p-4 mb-6 animate-pulse">
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white">
                  ⏰ Auction Extended by 2 Minutes!
                </h3>
                <p className="text-white/90 text-sm">
                  A bid was placed in the last 5 minutes. The auction will continue for 2 more minutes.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Document Generation Loading State */}
        {isClosing && (
          <div className="bg-blue-50 border-2 border-blue-400 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-blue-900 mb-2">
                  Closing Auction...
                </h3>
                {documentsGenerating && (
                  <>
                    <p className="text-blue-700 mb-3">
                      Generating your documents: {generatedDocuments.length}/2
                    </p>
                    <div className="space-y-2">
                      {['bill_of_sale', 'liability_waiver'].map(docType => {
                        const isGenerated = generatedDocuments.includes(docType);
                        return (
                          <div key={docType} className="flex items-center gap-2">
                            {isGenerated ? (
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                            )}
                            <span className={isGenerated ? 'text-green-700 font-medium' : 'text-blue-700'}>
                              {docType === 'bill_of_sale' ? 'Bill of Sale' : 'Liability Waiver'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {!documentsGenerating && generatedDocuments.length === 2 && (
                  <p className="text-green-700 font-semibold">
                    ✅ All documents ready! Finalizing closure...
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Document Signing Section (if won but not all signed) - RESPONSIVE */}
        {auction.status === 'closed' && 
         session?.user?.vendorId && 
         auction.currentBidder === session.user.vendorId && (
          <div className="bg-white border-2 border-yellow-400 rounded-lg shadow-lg p-4 sm:p-6 mb-6" id={`auction-${auction.id}-documents`}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0 self-start">
                <svg className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                    🎉 Congratulations! You Won This Auction
                  </h3>
                  <a
                    href={`/vendor/documents#auction-${auction.id}`}
                    className="text-xs sm:text-sm text-[#800020] hover:text-[#600018] font-medium flex items-center gap-1 self-start"
                  >
                    <span className="whitespace-nowrap">View All Documents</span>
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
                
                {/* Show loading state while documents are being fetched */}
                {isLoadingDocuments && documents.length === 0 && (
                  <div className="flex items-center gap-3 py-4">
                    <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-[#800020]"></div>
                    <p className="text-sm sm:text-base text-gray-600">Loading your documents...</p>
                  </div>
                )}
                
                {/* Show message if no documents found with refresh button */}
                {!isLoadingDocuments && documents.length === 0 && (
                  <div className="py-4">
                    <p className="text-sm sm:text-base text-gray-700 mb-4">
                      Your documents are being generated. This usually takes a few moments.
                    </p>
                    <button
                      onClick={() => {
                        if (session?.user?.vendorId) {
                          fetchDocuments(auction.id, session.user.vendorId);
                        }
                      }}
                      className="px-4 py-2 bg-[#800020] text-white rounded-lg hover:bg-[#600018] transition-colors flex items-center gap-2 text-sm sm:text-base"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Documents
                    </button>
                  </div>
                )}
                
                {/* Show documents if available */}
                {documents.length > 0 && (
                  <>
                    <p className="text-xs sm:text-sm text-gray-700 mb-4">
                      Before payment can be processed, you must sign all required documents. 
                      Progress: <strong>{documents.filter(d => d.status === 'signed' && d.documentType !== 'pickup_authorization').length}/{documents.filter(d => d.documentType !== 'pickup_authorization').length} documents signed</strong>
                    </p>
                
                {/* RESPONSIVE: Document Cards - Stack on mobile, 2 cols on tablet, 3 cols on desktop */}
                {/* Filter out pending pickup_authorization - it's generated AFTER payment, never shown as pending */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                  {documents
                    .filter(doc => !(doc.documentType === 'pickup_authorization' && doc.status === 'pending'))
                    .map((doc) => (
                    <div 
                      key={doc.id}
                      className={`flex flex-col p-3 sm:p-4 rounded-lg border-2 transition-all ${
                        doc.status === 'signed' 
                          ? 'bg-green-50 border-green-300 shadow-sm' 
                          : 'bg-yellow-50 border-yellow-300 shadow-md hover:shadow-lg'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start gap-2 sm:gap-3 mb-3">
                        {doc.status === 'signed' ? (
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-xs sm:text-sm leading-tight break-words">{doc.title}</p>
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
                            className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md font-medium transition-colors text-xs sm:text-sm"
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
                            className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm"
                          >
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-1">
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

                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payment Verified Banner (show when payment is verified) - RESPONSIVE */}
        {auction.status === 'awaiting_payment' && 
         session?.user?.vendorId && 
         auction.currentBidder === session.user.vendorId &&
         hasVerifiedPayment && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 border-2 border-green-700 rounded-lg shadow-lg p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
                    ✅ Payment Verified!
                  </h3>
                  <p className="text-white/90 text-xs sm:text-sm">
                    Your payment has been confirmed. You can now access your pickup authorization and all documents.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end sm:justify-start">
                <a
                  href={`/vendor/documents#auction-${auction.id}`}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-green-700 font-bold rounded-lg hover:bg-gray-100 transition-colors shadow-md flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="whitespace-nowrap">View Documents</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Payment Method Selection Section (after documents signed) - RESPONSIVE */}
        {auction.status === 'awaiting_payment' && 
         session?.user?.vendorId && 
         auction.currentBidder === session.user.vendorId &&
         !hasVerifiedPayment && (
          <div className="mb-6" id={`auction-${auction.id}-payment`}>
            {/* Prominent Pay Now Banner */}
            <div className="bg-gradient-to-r from-[#800020] to-[#600018] border-2 border-[#800020] rounded-lg shadow-lg p-4 sm:p-6 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
                      🎉 Payment Required
                    </h3>
                    <p className="text-white/90 text-xs sm:text-sm">
                      All documents signed! Complete your payment to unlock pickup authorization.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                  <a
                    href={`/vendor/documents#auction-${auction.id}`}
                    className="text-xs sm:text-sm text-white/90 hover:text-white font-medium flex items-center justify-center gap-1 py-2 sm:py-0"
                  >
                    <span>View Documents</span>
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-[#800020] font-bold rounded-lg hover:bg-gray-100 transition-colors shadow-md flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="whitespace-nowrap">Pay Now</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Options Modal */}
        {showPaymentModal && auction && (
          <PaymentOptions
            auctionId={auction.id}
            asModal={true}
            onClose={() => setShowPaymentModal(false)}
            onPaymentSuccess={() => {
              setShowPaymentModal(false);
              // Refresh the page to show updated status
              window.location.reload();
            }}
          />
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
              <GeminiDamageDisplay
                itemDetails={auction.case.aiAssessment.itemDetails}
                damagedParts={auction.case.aiAssessment.damagedParts}
                summary={(auction.case.aiAssessment as any).recommendation}
                showTitle={true}
                assetType={auction.case.assetType}
              />
              
              {/* Fallback: Damage Labels (for Vision API or old data) */}
              {(!auction.case.aiAssessment.damagedParts || auction.case.aiAssessment.damagedParts.length === 0) && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Detected Damage</h3>
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
              )}
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

            {/* Price Prediction Card */}
            {(auction.status === 'active' || auction.status === 'extended') && prediction && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <PredictionCard
                  auctionId={auction.id}
                  predictedPrice={prediction.predictedPrice}
                  lowerBound={prediction.lowerBound}
                  upperBound={prediction.upperBound}
                  confidenceScore={prediction.confidenceScore}
                  confidenceLevel={prediction.confidenceLevel}
                  method={prediction.method}
                  sampleSize={prediction.sampleSize}
                  metadata={prediction.metadata}
                />
              </div>
            )}

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
            {/* Sticky sidebar that stays visible while scrolling main content */}
            <div className="lg:sticky lg:top-24 lg:self-start space-y-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <style jsx>{`
                /* Hide scrollbar completely */
                div {
                  -ms-overflow-style: none;  /* IE and Edge */
                  scrollbar-width: none;  /* Firefox */
                }
                div::-webkit-scrollbar {
                  display: none;  /* Chrome, Safari, Opera */
                }
              `}</style>
              {/* Countdown Timer */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                  Time Remaining
                </h3>
                <div className="text-center">
                  {(auction.status === 'closed' || auction.status === 'awaiting_payment' || auction.status === 'cancelled') ? (
                    <div className="text-2xl font-bold text-gray-500">
                      Expired
                    </div>
                  ) : (
                    <CountdownTimer
                      endTime={auction.endTime}
                      className="text-xl md:text-2xl lg:text-xl font-mono"
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
                  )}
                </div>
                {auction.extensionCount > 0 && auction.status !== 'closed' && auction.status !== 'cancelled' && (
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
                  <div className={`transition-all duration-500 ${showNewBidAnimation ? 'scale-110 bg-yellow-100 rounded-lg p-2' : ''}`}>
                    <p className="text-3xl font-bold text-[#800020] mb-4">
                      ₦{(currentBid || reservePrice).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    Minimum Bid: ₦{minimumBid.toLocaleString()}
                  </p>
                  
                  {/* Show vendor's own current bid if they have one */}
                  {session?.user?.vendorId && auction.bids.length > 0 && (() => {
                    const vendorBids = auction.bids.filter(b => b.vendorId === session.user.vendorId);
                    if (vendorBids.length > 0) {
                      const highestVendorBid = Math.max(...vendorBids.map(b => Number(b.amount)));
                      const isWinning = auction.currentBidder === session.user.vendorId;
                      return (
                        <div className={`mt-3 p-3 rounded-lg ${isWinning ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                          <p className="text-xs text-gray-600 mb-1">Your Current Bid</p>
                          <p className={`text-lg font-bold ${isWinning ? 'text-green-700' : 'text-blue-700'}`}>
                            ₦{highestVendorBid.toLocaleString()}
                          </p>
                          {isWinning && (
                            <p className="text-xs text-green-600 font-semibold mt-1 flex items-center justify-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              You're winning!
                            </p>
                          )}
                          {!isWinning && (
                            <p className="text-xs text-orange-600 font-semibold mt-1">
                              You've been outbid
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {showNewBidAnimation && (
                    <div className="mt-2 flex items-center justify-center gap-2 text-green-600 animate-bounce">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span className="text-sm font-semibold">New Bid!</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Watching Count */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="text-gray-700 font-medium">
                      {auction.watchingCount} watching
                    </span>
                  </div>
                  {auction.watchingCount > 5 && (auction.status === 'active' || auction.status === 'extended') && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-semibold">
                      🔥 High Demand
                    </span>
                  )}
                </div>
                
                {/* Real-time Updates Indicator - Only show for active/extended auctions */}
                {(auction.status === 'active' || auction.status === 'extended') && !usingPolling && (
                  <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="font-medium">Live updates active</span>
                  </div>
                )}
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

                {auction.status === 'closed' && 
                 !(session?.user?.vendorId && auction.currentBidder === session.user.vendorId) && (
                  <div className="bg-gray-100 text-gray-600 py-4 rounded-lg font-bold text-lg text-center">
                    Auction Closed
                  </div>
                )}

                {auction.status === 'awaiting_payment' && 
                 session?.user?.vendorId && 
                 auction.currentBidder === session.user.vendorId && (
                  <a
                    href={`/vendor/documents#auction-${auction.id}`}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-lg font-bold text-lg transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    View Documents
                  </a>
                )}

                {auction.status === 'cancelled' && (
                  <div className="bg-red-100 text-red-800 py-4 rounded-lg font-bold text-lg text-center">
                    Auction Cancelled
                  </div>
                )}

                {/* Watch Auction Button / Payment Complete */}
                {hasVerifiedPayment ? (
                  <div className="w-full py-3 rounded-lg font-semibold bg-green-100 text-green-800 border-2 border-green-600 text-center">
                    <svg className="w-5 h-5 inline-block mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Payment Complete
                  </div>
                ) : (
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
                )}
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
            
            // CRITICAL FIX: Refresh auction data to get updated status (awaiting_payment)
            try {
              const response = await fetch(`/api/auctions/${auction.id}`);
              if (response.ok) {
                const data = await response.json();
                setAuction(data.auction);
                console.log(`✅ Auction data refreshed. New status: ${data.auction.status}`);
              }
            } catch (error) {
              console.error('Failed to refresh auction data:', error);
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
