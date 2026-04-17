/**
 * Mobile Case Approval Page for Salvage Manager
 * 
 * Mobile-optimized interface for reviewing and approving/rejecting salvage cases.
 * Features:
 * - Mobile-optimized card layout for approval queue
 * - Swipeable photo gallery
 * - AI assessment results display
 * - GPS location on map
 * - Approve/reject with comment field
 * - Push notifications for new cases
 * 
 * Requirements: 15, NFR5.3, Enterprise Standards Section 9.1
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { PriceField } from '@/components/manager/price-field';
import { validatePriceOverrides as validatePrices, type PriceOverrides } from '@/lib/validation/price-validation';
import { formatConditionForDisplay } from '@/features/valuations/services/condition-mapping.service';
import { AuctionScheduleSelector, type AuctionScheduleValue } from '@/components/ui/auction-schedule-selector';
import { LocationMap } from '@/components/ui/location-map';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { ResultModal } from '@/components/ui/result-modal';
import { Star, Check, X, CheckCircle, Banknote } from 'lucide-react';
import { OfflineAwareButton } from '@/components/ui/offline-aware-button';
import { GeminiDamageDisplay } from '@/components/ai-assessment/gemini-damage-display';

/**
 * Case data structure
 */
interface CaseData {
  id: string;
  claimReference: string;
  assetType: 'vehicle' | 'property' | 'electronics';
  assetDetails: Record<string, string | number | undefined>;
  marketValue: string;
  estimatedSalvageValue: string;
  reservePrice: string;
  damageSeverity: 'minor' | 'moderate' | 'severe';
  aiAssessment: {
    labels: string[];
    confidenceScore: number;
    damagePercentage: number;
    processedAt: string;
    warnings?: string[];
    confidence?: {
      overall: number;
      vehicleDetection: number;
      damageDetection: number;
      valuationAccuracy: number;
      photoQuality: number;
      reasons: string[];
    };
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
  } | null;
  gpsLocation?: {
    x: number; // longitude
    y: number; // latitude
  };
  locationName?: string;
  photos: string[];
  voiceNotes: string[];
  status: string;
  createdBy: string;
  createdAt: string;
  adjusterName?: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  vehicleMileage?: number;
  vehicleCondition?: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Approval action type
 */
type ApprovalAction = 'approve' | 'reject' | null;

/**
 * Check if a photo URL is valid
 */
const isValidPhotoUrl = (url: any): url is string => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  // Check if it starts with http:// or https:// or /
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/');
};

export default function ApprovalsPage() {
  const router = useRouter();
  const { status } = useSession();
  
  // State
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [allCases, setAllCases] = useState<CaseData[]>([]); // Store all cases
  const [cases, setCases] = useState<CaseData[]>([]); // Filtered cases for display
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [approvalAction, setApprovalAction] = useState<ApprovalAction>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Price override state
  const [isEditMode, setIsEditMode] = useState(false);
  const [priceOverrides, setPriceOverrides] = useState<PriceOverrides>({});
  const [overrideComment, setOverrideComment] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  
  // Auction schedule state
  const [auctionSchedule, setAuctionSchedule] = useState<AuctionScheduleValue>({ 
    mode: 'now',
    durationHours: 120, // Default 5 days
  });
  
  // Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultModalData, setResultModalData] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    details?: string[];
  }>({
    type: 'success',
    title: '',
    message: '',
  });

  /**
   * Fetch all cases on mount only
   */
  useEffect(() => {
    if (status === 'authenticated') {
      fetchPendingCases();
    }
  }, [status]);

  /**
   * Filter cases based on active tab (client-side filtering)
   */
  useEffect(() => {
    if (allCases.length === 0) {
      setCases([]);
      return;
    }

    // Deduplicate cases by ID (in case of duplicate rows from joins)
    const uniqueCases = Array.from(
      new Map(allCases.map(c => [c.id, c])).values()
    );

    let filtered: CaseData[] = [];
    switch (activeTab) {
      case 'pending':
        filtered = uniqueCases.filter(c => c.status === 'pending_approval');
        break;
      case 'approved':
        // Show cases that have been approved (have approvedBy field)
        // This includes cases in 'active_auction' and 'sold' status
        filtered = uniqueCases.filter(c => c.approvedBy !== null && c.approvedBy !== undefined);
        break;
      case 'rejected':
        filtered = uniqueCases.filter(c => c.status === 'rejected');
        break;
      case 'all':
        filtered = uniqueCases;
        break;
    }
    setCases(filtered);
  }, [activeTab, allCases]);

  /**
   * Request notification permission on mount
   */
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  /**
   * Validate whenever price overrides change
   */
  useEffect(() => {
    if (isEditMode && selectedCase) {
      validatePriceOverridesLocal();
    }
  }, [priceOverrides, isEditMode, selectedCase]);

  /**
   * Fetch all cases from API (no filtering - get everything)
   * Add cache-busting timestamp to force fresh data
   */
  const fetchPendingCases = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Add timestamp to bust cache
      const timestamp = Date.now();
      const response = await fetch(`/api/cases?_t=${timestamp}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch cases');
      }

      const data = await response.json();
      setAllCases(data.data || []);
    } catch (err) {
      console.error('Error fetching cases:', err);
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle case selection
   */
  const handleCaseSelect = (caseData: CaseData) => {
    setSelectedCase(caseData);
    setCurrentPhotoIndex(0);
    setApprovalAction(null);
    setComment('');
    // Reset price override state
    setIsEditMode(false);
    setPriceOverrides({});
    setOverrideComment('');
    setValidationErrors([]);
    setValidationWarnings([]);
    // Reset auction schedule to default
    setAuctionSchedule({ 
      mode: 'now',
      durationHours: 120, // Default 5 days
    });
    // Reset modal state
    setShowConfirmModal(false);
    setShowResultModal(false);
  };

  /**
   * Handle photo swipe
   */
  const handlePhotoSwipe = (direction: 'left' | 'right') => {
    if (!selectedCase) return;

    if (direction === 'left' && currentPhotoIndex < selectedCase.photos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    } else if (direction === 'right' && currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  /**
   * Handle approval action - Show confirmation modal
   */
  const handleApprovalAction = (action: 'approve' | 'reject') => {
    setApprovalAction(action);
    
    // For approval, show confirmation modal immediately
    if (action === 'approve') {
      setShowConfirmModal(true);
    }
  };

  /**
   * Validate price overrides using extracted utility
   */
  const validatePriceOverridesLocal = (): void => {
    if (!selectedCase) {
      setValidationErrors([]);
      setValidationWarnings([]);
      return;
    }
    
    const result = validatePrices(
      priceOverrides,
      {
        marketValue: parseFloat(selectedCase.marketValue),
        salvageValue: parseFloat(selectedCase.estimatedSalvageValue),
        reservePrice: parseFloat(selectedCase.reservePrice),
      }
    );
    
    // Separate errors and warnings
    setValidationErrors(result.errors);
    setValidationWarnings(result.warnings);
  };

  /**
   * Handle price change
   */
  const handlePriceChange = (field: keyof PriceOverrides, value: number) => {
    setPriceOverrides(prev => ({
      ...prev,
      [field]: value,
    }));
    // Validation will be triggered by useEffect
  };

  /**
   * Handle edit mode toggle
   */
  const handleEditModeToggle = () => {
    if (isEditMode) {
      // Exiting edit mode - reset overrides
      setPriceOverrides({});
      setOverrideComment('');
      setValidationErrors([]);
      setValidationWarnings([]);
    }
    setIsEditMode(!isEditMode);
  };

  /**
   * Check if there are any overrides
   */
  const hasOverrides = Object.keys(priceOverrides).length > 0;

  /**
   * Check if can approve with changes
   */
  const canApproveWithChanges = (() => {
    if (!hasOverrides || overrideComment.trim().length < 10 || !selectedCase) {
      return false;
    }
    
    // Only check for errors, not warnings
    const result = validatePrices(
      priceOverrides,
      {
        marketValue: parseFloat(selectedCase.marketValue),
        salvageValue: parseFloat(selectedCase.estimatedSalvageValue),
        reservePrice: parseFloat(selectedCase.reservePrice),
      }
    );
    
    return result.isValid;
  })();

  /**
   * Handle result modal close
   */
  const handleResultModalClose = () => {
    setShowResultModal(false);
    
    // If it was a success, close the detail view
    if (resultModalData.type === 'success') {
      setSelectedCase(null);
      setApprovalAction(null);
      setComment('');
      setIsEditMode(false);
      setPriceOverrides({});
      setOverrideComment('');
      setValidationErrors([]);
      setValidationWarnings([]);
      setAuctionSchedule({ 
        mode: 'now',
        durationHours: 120, // Default 5 days
      });
    }
  };

  /**
   * Get confirmation modal content
   */
  const getConfirmationContent = () => {
    if (!selectedCase) return { title: '', message: '' };
    
    if (approvalAction === 'approve') {
      const hasChanges = hasOverrides;
      return {
        title: hasChanges ? 'Approve with Price Changes?' : 'Approve Case?',
        message: hasChanges
          ? `You are about to approve case ${selectedCase.claimReference} with price adjustments.\n\nThis will:\n• Apply your price changes\n• Create an auction\n• Notify matching vendors\n\nAre you sure you want to proceed?`
          : `You are about to approve case ${selectedCase.claimReference}.\n\nThis will:\n• Create an auction with AI-estimated prices\n• Notify matching vendors\n\nAre you sure you want to proceed?`,
      };
    } else if (approvalAction === 'reject') {
      return {
        title: 'Reject Case?',
        message: `You are about to reject case ${selectedCase.claimReference}.\n\nThis will:\n• Return the case to the adjuster\n• Notify the adjuster of rejection\n• Include your rejection reason\n\nAre you sure you want to proceed?`,
      };
    }
    
    return { title: '', message: '' };
  };

  /**
   * Submit approval decision
   */
  const handleSubmit = async () => {
    if (!selectedCase || !approvalAction) return;

    // Validate comment for rejection
    if (approvalAction === 'reject' && comment.trim().length < 10) {
      setResultModalData({
        type: 'error',
        title: 'Validation Error',
        message: 'Please provide a detailed reason for rejection (minimum 10 characters)',
      });
      setShowResultModal(true);
      return;
    }

    // Validate price overrides if in edit mode
    if (isEditMode && hasOverrides) {
      const result = validatePrices(
        priceOverrides,
        {
          marketValue: parseFloat(selectedCase.marketValue),
          salvageValue: parseFloat(selectedCase.estimatedSalvageValue),
          reservePrice: parseFloat(selectedCase.reservePrice),
        }
      );
      
      if (!result.isValid) {
        setValidationErrors(result.errors);
        setValidationWarnings(result.warnings);
        setResultModalData({
          type: 'error',
          title: 'Validation Error',
          message: 'Please fix validation errors before submitting',
          details: result.errors,
        });
        setShowResultModal(true);
        return;
      }
      
      if (overrideComment.trim().length < 10) {
        setResultModalData({
          type: 'error',
          title: 'Validation Error',
          message: 'Please provide a reason for price changes (minimum 10 characters)',
        });
        setShowResultModal(true);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setShowConfirmModal(false); // Close confirmation modal

      const response = await fetch(`/api/cases/${selectedCase.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: approvalAction,
          comment: comment.trim() || overrideComment.trim() || undefined,
          priceOverrides: hasOverrides ? priceOverrides : undefined,
          scheduleData: approvalAction === 'approve' ? auctionSchedule : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process approval');
      }

      const result = await response.json();

      // Show success message in modal
      if (approvalAction === 'approve') {
        setResultModalData({
          type: 'success',
          title: 'Case Approved',
          message: hasOverrides
            ? `Case approved with price adjustments! Auction created and ${result.data.notifiedVendors} vendors notified.`
            : `Case approved! Auction created and ${result.data.notifiedVendors} vendors notified.`,
          details: hasOverrides ? [
            'Price adjustments have been applied',
            `${result.data.notifiedVendors} vendors have been notified`,
            'Auction is now live',
          ] : [
            `${result.data.notifiedVendors} vendors have been notified`,
            'Auction is now live',
          ],
        });
      } else {
        setResultModalData({
          type: 'success',
          title: 'Case Rejected',
          message: 'Case rejected and returned to adjuster.',
          details: [
            'The adjuster has been notified',
            'Case status updated to draft',
          ],
        });
      }
      setShowResultModal(true);

      // Refresh cases list
      await fetchPendingCases();
      
      // Reset state (will be done when modal closes)
    } catch (err) {
      console.error('Error submitting approval:', err);
      setResultModalData({
        type: 'error',
        title: 'Submission Failed',
        message: err instanceof Error ? err.message : 'Failed to submit approval',
      });
      setShowResultModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Format date
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  /**
   * Get severity color
   */
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor':
        return 'bg-green-100 text-green-800';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'severe':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * Get status badge with smart label mapping
   * Maps 'active_auction' to 'Payment Pending' when auction is closed
   */
  const getStatusBadge = (caseData: CaseData) => {
    const badges = {
      draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
      pending_approval: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800' },
      approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
      active_auction: { label: 'Active Auction', color: 'bg-blue-100 text-blue-800' },
      sold: { label: 'Sold', color: 'bg-purple-100 text-purple-800' },
      cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
      rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
    };

    // Default badge based on status
    const badge = badges[caseData.status as keyof typeof badges] || badges.draft;

    // Smart label mapping: Show "Payment Pending" for closed auctions awaiting payment
    // This happens when status is 'active_auction' but the auction has closed
    // and payment is still pending verification
    if (caseData.status === 'active_auction') {
      // In this context, if a case is in 'active_auction' status but appears in the
      // approved tab (has approvedBy), it likely means the auction has closed
      // and we're waiting for payment. Show a more accurate label.
      return {
        label: 'Payment Pending',
        color: 'bg-orange-100 text-orange-800'
      };
    }

    return badge;
  };

  // Loading state
  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading cases...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated state
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-bold mb-2">Unauthorized</h2>
          <p className="text-red-600 mb-4">Please log in to access this page.</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-bold mb-2">Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchPendingCases}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Detail view
  if (selectedCase) {
    return (
      <div className="min-h-screen bg-gray-50 pb-32 overflow-y-auto">
        {/* Header */}
        <div className="bg-[#800020] text-white p-4 sticky top-0 z-40 shadow-md">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedCase(null)}
              className="text-white hover:text-gray-200"
            >
              ← Back
            </button>
            <h1 className="text-lg font-bold">Case Details</h1>
            <div className="w-16" />
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Case Info Card */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedCase.claimReference}</h2>
                <p className="text-sm text-gray-600">Submitted {formatDate(selectedCase.createdAt)}</p>
              </div>
              <div className="flex flex-col gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(selectedCase.damageSeverity)}`}>
                  {selectedCase.damageSeverity ? selectedCase.damageSeverity.toUpperCase() : 'UNKNOWN'}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(selectedCase).color}`}>
                  {getStatusBadge(selectedCase).label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-600">Asset Type</p>
                <p className="font-medium capitalize">{selectedCase.assetType}</p>
              </div>
              <div>
                <p className="text-gray-600">Market Value</p>
                <p className="font-medium">₦{parseFloat(selectedCase.marketValue).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Estimated Value</p>
                <p className="font-medium">
                  {selectedCase.estimatedSalvageValue 
                    ? `₦${parseFloat(selectedCase.estimatedSalvageValue).toLocaleString()}`
                    : 'Pending Analysis'}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Reserve Price</p>
                <p className="font-medium">
                  {selectedCase.reservePrice 
                    ? `₦${parseFloat(selectedCase.reservePrice).toLocaleString()}`
                    : 'Pending Analysis'}
                </p>
              </div>
            </div>
          </div>

          {/* Swipeable Photo Gallery */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="relative w-full aspect-[4/3] bg-gray-200">
              {isValidPhotoUrl(selectedCase.photos[currentPhotoIndex]) ? (
                <Image
                  src={selectedCase.photos[currentPhotoIndex]}
                  alt={`Photo ${currentPhotoIndex + 1}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 800px"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p>Photo not available</p>
                </div>
              )}
              
              {/* Photo Navigation */}
              <div className="absolute inset-0 flex items-center justify-between px-4">
                <button
                  onClick={() => handlePhotoSwipe('right')}
                  disabled={currentPhotoIndex === 0}
                  className="bg-black bg-opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-30 hover:bg-opacity-70 transition-all"
                >
                  ←
                </button>
                <button
                  onClick={() => handlePhotoSwipe('left')}
                  disabled={currentPhotoIndex === selectedCase.photos.length - 1}
                  className="bg-black bg-opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-30 hover:bg-opacity-70 transition-all"
                >
                  →
                </button>
              </div>

              {/* Photo Counter */}
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                  {currentPhotoIndex + 1} / {selectedCase.photos.length}
                </span>
              </div>
            </div>

            {/* Photo Thumbnails */}
            <div className="p-3 flex gap-2 overflow-x-auto">
              {selectedCase.photos.map((photo, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPhotoIndex(index)}
                  className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                    index === currentPhotoIndex ? 'ring-2 ring-[#800020] border-[#800020]' : 'border-gray-300'
                  }`}
                >
                  {isValidPhotoUrl(photo) ? (
                    <Image
                      src={photo}
                      alt={`Thumbnail ${index + 1}`}
                      width={80}
                      height={60}
                      className="w-20 h-16 object-cover"
                    />
                  ) : (
                    <div className="w-20 h-16 bg-gray-200 flex items-center justify-center text-xs text-gray-400">
                      N/A
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* AI Assessment */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center">
              <span className="mr-2">🤖</span>
              AI Damage Assessment
            </h3>
            
            {!selectedCase.aiAssessment ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <span className="font-medium">⚠️ No AI Assessment Available</span>
                  <br />
                  AI assessment data is not available for this case. Manual review required.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Overall Confidence Score - Prominent Display */}
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700 font-medium">Overall Confidence</span>
                  <div className="flex items-center">
                    <div className="w-32 h-3 bg-gray-200 rounded-full mr-3">
                      <div
                        className={`h-3 rounded-full ${
                          selectedCase.aiAssessment.confidenceScore >= 80 ? 'bg-green-500' :
                          selectedCase.aiAssessment.confidenceScore >= 70 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${selectedCase.aiAssessment.confidenceScore}%` }}
                      />
                    </div>
                    <span className={`font-bold text-lg ${
                      selectedCase.aiAssessment.confidenceScore >= 80 ? 'text-green-600' :
                      selectedCase.aiAssessment.confidenceScore >= 70 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {selectedCase.aiAssessment.confidenceScore}%
                    </span>
                  </div>
                </div>

                {/* Low Confidence Warning */}
                {selectedCase.aiAssessment.confidenceScore < 70 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                    <svg className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-medium text-red-800">Low Confidence Score</p>
                      <p className="text-sm text-red-700 mt-1">Manual review strongly recommended. The AI assessment may be less accurate.</p>
                    </div>
                  </div>
                )}

                {/* Mileage and Condition Info */}
                {selectedCase.assetType === 'vehicle' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600 font-medium mb-1">📊 Mileage</p>
                      <p className="text-sm font-bold text-blue-900">
                        {selectedCase.vehicleMileage 
                          ? `${selectedCase.vehicleMileage.toLocaleString()} km`
                          : 'Not provided'}
                      </p>
                      {!selectedCase.vehicleMileage && (
                        <p className="text-xs text-blue-700 mt-1">Estimated from vehicle age</p>
                      )}
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs text-purple-600 font-medium mb-1 flex items-center gap-1">
                        <Star className="w-4 h-4" aria-hidden="true" />
                        <span>Condition</span>
                      </p>
                      <p className="text-sm font-bold text-purple-900">
                        {selectedCase.vehicleCondition 
                          ? formatConditionForDisplay(selectedCase.vehicleCondition).label
                          : 'Good (Foreign Used) (default)'}
                      </p>
                      {!selectedCase.vehicleCondition && (
                        <p className="text-xs text-purple-700 mt-1">Default assumption</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Missing Data Notices */}
                {selectedCase.assetType === 'vehicle' && (!selectedCase.vehicleMileage || !selectedCase.vehicleCondition) && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <span className="font-medium">ℹ️ Note:</span> {' '}
                      {!selectedCase.vehicleMileage && !selectedCase.vehicleCondition 
                        ? 'Mileage and condition data not provided. Estimates may be less accurate.'
                        : !selectedCase.vehicleMileage
                        ? 'Mileage data not provided. Using estimated mileage based on vehicle age.'
                        : 'Condition data not provided. Assuming "good" condition.'}
                    </p>
                  </div>
                )}

                {/* AI Warnings */}
                {selectedCase.aiAssessment.warnings && selectedCase.aiAssessment.warnings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">⚠️ AI Warnings:</p>
                    {selectedCase.aiAssessment.warnings.map((warning, index) => (
                      <div key={index} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-sm text-orange-800">{warning}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Damage Percentage */}
                <div className="flex justify-between">
                  <span className="text-gray-600">Damage Percentage</span>
                  <span className="font-medium">{selectedCase.aiAssessment.damagePercentage}%</span>
                </div>

                {/* Gemini Damage Display Component */}
                <GeminiDamageDisplay
                  itemDetails={selectedCase.aiAssessment.itemDetails}
                  damagedParts={selectedCase.aiAssessment.damagedParts}
                  summary={(selectedCase.aiAssessment as any).recommendation}
                  showTitle={false}
                  assetType={selectedCase.assetType}
                />

                {/* Fallback: Detected Damage (for Vision API or old data) */}
                {(!selectedCase.aiAssessment.damagedParts || selectedCase.aiAssessment.damagedParts.length === 0) && (
                  <div>
                    <p className="text-gray-600 mb-2">Detected Damage</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedCase.aiAssessment.labels.map((label, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-xl text-sm font-medium break-words"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Price Override Section */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Banknote className="w-5 h-5" aria-hidden="true" />
                <span>Valuation</span>
              </h3>
              {!isEditMode && !selectedCase.approvedBy && (
                <button
                  onClick={handleEditModeToggle}
                  className="text-sm text-[#800020] font-medium hover:text-[#600018]"
                >
                  ✏️ Edit Prices
                </button>
              )}
              {isEditMode && (
                <button
                  onClick={handleEditModeToggle}
                  className="text-sm text-gray-600 font-medium hover:text-gray-800"
                >
                  ✕ Cancel
                </button>
              )}
            </div>
            
            {/* Price Fields */}
            <div className="space-y-3">
              <PriceField
                label="Market Value"
                aiValue={parseFloat(selectedCase.marketValue)}
                overrideValue={priceOverrides.marketValue}
                isEditMode={isEditMode}
                onChange={(value) => handlePriceChange('marketValue', value)}
                confidence={selectedCase.aiAssessment?.confidenceScore ?? 0}
              />
              
              <PriceField
                label="Estimated Salvage Value"
                aiValue={parseFloat(selectedCase.estimatedSalvageValue)}
                overrideValue={priceOverrides.salvageValue}
                isEditMode={isEditMode}
                onChange={(value) => handlePriceChange('salvageValue', value)}
              />
              
              <PriceField
                label="Reserve Price"
                aiValue={parseFloat(selectedCase.reservePrice)}
                overrideValue={priceOverrides.reservePrice}
                isEditMode={isEditMode}
                onChange={(value) => handlePriceChange('reservePrice', value)}
              />
            </div>
            
            {/* Comment Field (shown in edit mode with overrides) */}
            {isEditMode && hasOverrides && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Changes <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={overrideComment}
                  onChange={(e) => setOverrideComment(e.target.value)}
                  placeholder="Explain why you're adjusting these prices (minimum 10 characters)..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                />
                {overrideComment.trim().length > 0 && overrideComment.trim().length < 10 && (
                  <p className="text-xs text-red-600 mt-1">
                    Comment must be at least 10 characters (currently {overrideComment.trim().length})
                  </p>
                )}
              </div>
            )}
            
            {/* Validation Errors and Warnings */}
            {(validationErrors.length > 0 || validationWarnings.length > 0) && (
              <div className="mt-4 space-y-2">
                {/* Errors */}
                {validationErrors.map((error, i) => (
                  <div key={`error-${i}`} className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-start">
                    <svg className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                ))}
                
                {/* Warnings */}
                {validationWarnings.map((warning, i) => (
                  <div key={`warning-${i}`} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700 flex items-start">
                    <svg className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GPS Location */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center">
              <span className="mr-2">📍</span>
              Location
            </h3>
            
            <p className="text-gray-700 mb-3">{selectedCase.locationName || 'Location not specified'}</p>
            
            {/* Coordinates */}
            {selectedCase.gpsLocation?.y !== undefined && selectedCase.gpsLocation?.x !== undefined && (
              <p className="text-sm text-gray-600 mb-3">
                Coordinates: {selectedCase.gpsLocation.y.toFixed(6)}, {selectedCase.gpsLocation.x.toFixed(6)}
              </p>
            )}
            
            {/* Embedded Google Map */}
            <LocationMap
              latitude={selectedCase.gpsLocation?.y}
              longitude={selectedCase.gpsLocation?.x}
              address={selectedCase.locationName}
              height="192px"
            />
          </div>

          {/* Asset Details */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="font-bold text-gray-900 mb-3">Asset Details</h3>
            <div className="space-y-2 text-sm">
              {selectedCase.assetDetails && typeof selectedCase.assetDetails === 'object' && Object.entries(selectedCase.assetDetails).map(([key, value]) => {
                if (!value) return null;
                
                // Format the value based on type
                let displayValue = value;
                if (typeof value === 'number') {
                  // Check if it's a currency value (large numbers)
                  if (value >= 1000) {
                    displayValue = `₦${value.toLocaleString()}`;
                  } else {
                    displayValue = value.toLocaleString();
                  }
                }
                
                return (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="font-medium">{displayValue}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Voice Notes */}
          {selectedCase.voiceNotes && selectedCase.voiceNotes.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <span className="mr-2">🎤</span>
                Voice Notes
              </h3>
              <div className="space-y-2">
                {selectedCase.voiceNotes.map((note, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auction Schedule Settings - Only show for pending approval cases */}
          {selectedCase.status === 'pending_approval' && !selectedCase.approvedBy && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <span className="mr-2">⏰</span>
                Auction Schedule
              </h3>
              <AuctionScheduleSelector
                value={auctionSchedule}
                onChange={setAuctionSchedule}
              />
            </div>
          )}
        </div>

        {/* Approval Actions - Fixed Bottom with proper z-index and centering */}
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent backdrop-blur-lg border-t border-gray-200/50 p-4 space-y-3 z-50">
          <div className="w-full max-w-2xl mx-auto">
          {/* Check if case has already been approved */}
          {selectedCase.approvedBy ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-center text-green-800">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium">Case Already Approved</p>
                  <p className="text-sm text-green-700">
                    Approved on {selectedCase.approvedAt ? new Date(selectedCase.approvedAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          ) : selectedCase.status === 'rejected' ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-center text-red-800">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <div>
                  <p className="font-medium">Case Rejected</p>
                  <p className="text-sm text-red-700">This case has been rejected</p>
                </div>
              </div>
            </div>
          ) : isEditMode ? (
            // Edit Mode Actions - Show "Approve with Changes" and "Cancel Edits"
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleEditModeToggle}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all duration-200 border-2 border-gray-300 min-w-[200px] max-w-xs"
              >
                Cancel Edits
              </button>
              <button
                onClick={() => {
                  setApprovalAction('approve');
                  setShowConfirmModal(true);
                }}
                disabled={!canApproveWithChanges || isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 min-w-[200px] max-w-xs"
              >
                <CheckCircle className="w-5 h-5" aria-hidden="true" />
                <span>{isSubmitting ? 'Processing...' : 'Approve with Changes'}</span>
              </button>
            </div>
          ) : !approvalAction ? (
            // Normal Mode Actions - Show "Approve" and "Reject"
            <div className="flex justify-center gap-4">
              <OfflineAwareButton
                onClick={() => handleApprovalAction('reject')}
                disabled={isSubmitting}
                requiresOnline={true}
                offlineTooltip="Rejection requires internet connection"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 min-w-[140px] max-w-[200px]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
                <span>Reject</span>
              </OfflineAwareButton>
              <OfflineAwareButton
                onClick={() => handleApprovalAction('approve')}
                disabled={isSubmitting}
                requiresOnline={true}
                offlineTooltip="Approval requires internet connection"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 min-w-[140px] max-w-[200px]"
              >
                <CheckCircle className="w-5 h-5" aria-hidden="true" />
                <span>Approve</span>
              </OfflineAwareButton>
            </div>
          ) : (
            // Approval/Rejection Confirmation - Show comment field and confirm/cancel
            <>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  {approvalAction === 'approve' ? (
                    <>
                      <Check className="w-5 h-5 text-green-600" aria-hidden="true" />
                      <span>Approving Case</span>
                    </>
                  ) : (
                    <>
                      <X className="w-5 h-5 text-red-600" aria-hidden="true" />
                      <span>Rejecting Case</span>
                    </>
                  )}
                </p>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    approvalAction === 'reject'
                      ? 'Reason for rejection (required, min 10 characters)'
                      : 'Optional comment'
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent text-sm"
                />
              </div>
              
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => {
                    setApprovalAction(null);
                    setComment('');
                  }}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all duration-200 border-2 border-gray-300 min-w-[120px] max-w-[180px]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isSubmitting || (approvalAction === 'reject' && comment.trim().length < 10)}
                  className={`inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-semibold text-white disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 min-w-[120px] max-w-[180px] ${
                    approvalAction === 'approve'
                      ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-400'
                      : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-400'
                  }`}
                >
                  {approvalAction === 'approve' ? (
                    <CheckCircle className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <X className="w-5 h-5" aria-hidden="true" />
                  )}
                  <span>{isSubmitting ? 'Processing...' : 'Confirm'}</span>
                </button>
              </div>
            </>
          )}
          </div>
        </div>

        {/* Confirmation Modal */}
        <ConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleSubmit}
          title={getConfirmationContent().title}
          message={getConfirmationContent().message}
          confirmText={approvalAction === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
          cancelText="Cancel"
          type={approvalAction === 'approve' ? 'warning' : 'danger'}
          isLoading={isSubmitting}
        />

        {/* Result Modal */}
        <ResultModal
          isOpen={showResultModal}
          onClose={handleResultModalClose}
          type={resultModalData.type}
          title={resultModalData.title}
          message={resultModalData.message}
          details={resultModalData.details}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-gray-50 overflow-y-auto">
      {/* Header */}
      <div className="bg-[#800020] text-white p-4 sticky top-0 z-40 shadow-md">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-white hover:text-gray-200"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold">Case Approvals</h1>
          <button
            onClick={fetchPendingCases}
            className="text-white hover:text-gray-200"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">
                {Array.from(new Map(allCases.map(c => [c.id, c])).values()).filter(c => c.status === 'pending_approval').length}
              </p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-full">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {Array.from(new Map(allCases.map(c => [c.id, c])).values()).filter(c => c.approvedBy !== null && c.approvedBy !== undefined).length}
              </p>
            </div>
            <div className="p-2 bg-green-100 rounded-full">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {Array.from(new Map(allCases.map(c => [c.id, c])).values()).filter(c => c.status === 'rejected').length}
              </p>
            </div>
            <div className="p-2 bg-red-100 rounded-full">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {Array.from(new Map(allCases.map(c => [c.id, c])).values()).length}
              </p>
            </div>
            <div className="p-2 bg-blue-100 rounded-full">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-[60px] z-30">
        <div className="flex overflow-x-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-[#800020] text-[#800020]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'approved'
                ? 'border-[#800020] text-[#800020]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'rejected'
                ? 'border-[#800020] text-[#800020]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Rejected
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-[#800020] text-[#800020]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Cases List */}
      <div className="p-4">
        {cases.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" aria-label="All caught up" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">All Caught Up!</h2>
            <p className="text-gray-600">
              {activeTab === 'pending' && 'No cases pending approval'}
              {activeTab === 'approved' && 'No approved cases'}
              {activeTab === 'rejected' && 'No rejected cases'}
              {activeTab === 'all' && 'No cases found'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              {cases.length} case{cases.length !== 1 ? 's' : ''} {activeTab === 'all' ? 'total' : activeTab}
            </p>
            
            <div className="space-y-4">
              {cases.map((caseData) => (
                <button
                  key={caseData.id}
                  onClick={() => handleCaseSelect(caseData)}
                  className="w-full bg-white rounded-lg shadow-md p-4 text-left hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900">{caseData.claimReference}</h3>
                      <p className="text-sm text-gray-600">{formatDate(caseData.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(caseData.damageSeverity)}`}>
                        {caseData.damageSeverity ? caseData.damageSeverity.toUpperCase() : 'UNKNOWN'}
                      </span>
                      {caseData.status !== 'pending_approval' && (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(caseData).color}`}>
                          {getStatusBadge(caseData).label}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-gray-600">Asset Type</p>
                      <p className="font-medium capitalize">{caseData.assetType}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Estimated Value</p>
                      <p className="font-medium">₦{parseFloat(caseData.estimatedSalvageValue).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-gray-600">
                      <span className="mr-1">🤖</span>
                      <span>AI Confidence: {caseData.aiAssessment?.confidenceScore ?? 'N/A'}%</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <span className="mr-1">📷</span>
                      <span>{caseData.photos.length} photos</span>
                    </div>
                  </div>

                  {/* Photo Preview */}
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {caseData.photos.filter(isValidPhotoUrl).slice(0, 4).map((photo, index) => (
                      <Image
                        key={index}
                        src={photo}
                        alt={`Preview ${index + 1}`}
                        width={80}
                        height={60}
                        className="w-20 h-16 object-cover rounded flex-shrink-0"
                      />
                    ))}
                    {caseData.photos.filter(isValidPhotoUrl).length === 0 && (
                      <div className="w-20 h-16 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center text-xs text-gray-400">
                        No photos
                      </div>
                    )}
                    {caseData.photos.filter(isValidPhotoUrl).length > 4 && (
                      <div className="w-20 h-16 bg-gray-200 rounded flex items-center justify-center flex-shrink-0 text-sm text-gray-600">
                        +{caseData.photos.filter(isValidPhotoUrl).length - 4}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
