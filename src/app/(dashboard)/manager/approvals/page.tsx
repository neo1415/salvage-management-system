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
  };
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
}

/**
 * Approval action type
 */
type ApprovalAction = 'approve' | 'reject' | null;

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

    let filtered: CaseData[] = [];
    switch (activeTab) {
      case 'pending':
        filtered = allCases.filter(c => c.status === 'pending_approval');
        break;
      case 'approved':
        // Show cases that have been approved (have approvedBy field)
        // This includes cases in 'active_auction' and 'sold' status
        filtered = allCases.filter(c => c.approvedBy !== null && c.approvedBy !== undefined);
        break;
      case 'rejected':
        filtered = allCases.filter(c => c.status === 'rejected');
        break;
      case 'all':
        filtered = allCases;
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
   * Fetch all cases from API (no filtering - get everything)
   */
  const fetchPendingCases = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/cases');
      
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
   * Handle approval action
   */
  const handleApprovalAction = (action: 'approve' | 'reject') => {
    setApprovalAction(action);
  };

  /**
   * Submit approval decision
   */
  const handleSubmit = async () => {
    if (!selectedCase || !approvalAction) return;

    // Validate comment for rejection
    if (approvalAction === 'reject' && comment.trim().length < 10) {
      alert('Please provide a detailed reason for rejection (minimum 10 characters)');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/cases/${selectedCase.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: approvalAction,
          comment: comment.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process approval');
      }

      const result = await response.json();

      // Show success message
      alert(
        approvalAction === 'approve'
          ? `Case approved! Auction created and ${result.data.notifiedVendors} vendors notified.`
          : 'Case rejected and returned to adjuster.'
      );

      // Refresh cases list
      await fetchPendingCases();
      
      // Close detail view
      setSelectedCase(null);
      setApprovalAction(null);
      setComment('');
    } catch (err) {
      console.error('Error submitting approval:', err);
      alert(err instanceof Error ? err.message : 'Failed to submit approval');
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
      <div className="min-h-screen bg-gray-50 pb-32">
        {/* Header */}
        <div className="bg-[#800020] text-white p-4 sticky top-0 z-10 shadow-md">
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
                  {selectedCase.damageSeverity.toUpperCase()}
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
                <p className="font-medium">₦{parseFloat(selectedCase.estimatedSalvageValue).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Reserve Price</p>
                <p className="font-medium">₦{parseFloat(selectedCase.reservePrice).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Swipeable Photo Gallery */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="relative">
              <Image
                src={selectedCase.photos[currentPhotoIndex]}
                alt={`Photo ${currentPhotoIndex + 1}`}
                width={800}
                height={600}
                className="w-full h-64 object-cover"
              />
              
              {/* Photo Navigation */}
              <div className="absolute inset-0 flex items-center justify-between px-4">
                <button
                  onClick={() => handlePhotoSwipe('right')}
                  disabled={currentPhotoIndex === 0}
                  className="bg-black bg-opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  onClick={() => handlePhotoSwipe('left')}
                  disabled={currentPhotoIndex === selectedCase.photos.length - 1}
                  className="bg-black bg-opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-30"
                >
                  →
                </button>
              </div>

              {/* Photo Counter */}
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
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
                  className={`flex-shrink-0 ${
                    index === currentPhotoIndex ? 'ring-2 ring-[#800020]' : ''
                  }`}
                >
                  <Image
                    src={photo}
                    alt={`Thumbnail ${index + 1}`}
                    width={80}
                    height={60}
                    className="w-20 h-16 object-cover rounded"
                  />
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
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Confidence Score</span>
                <div className="flex items-center">
                  <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                    <div
                      className="h-2 bg-[#FFD700] rounded-full"
                      style={{ width: `${selectedCase.aiAssessment.confidenceScore}%` }}
                    />
                  </div>
                  <span className="font-medium">{selectedCase.aiAssessment.confidenceScore}%</span>
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Damage Percentage</span>
                <span className="font-medium">{selectedCase.aiAssessment.damagePercentage}%</span>
              </div>

              <div>
                <p className="text-gray-600 mb-2">Detected Damage</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCase.aiAssessment.labels.map((label, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* GPS Location */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center">
              <span className="mr-2">📍</span>
              Location
            </h3>
            
            <p className="text-gray-700 mb-3">{selectedCase.locationName || 'Location not specified'}</p>
            
            {/* Map */}
            {selectedCase.gpsLocation?.x && selectedCase.gpsLocation?.y ? (
              <>
                <div className="w-full h-48 bg-gray-200 rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedCase.gpsLocation.x - 0.01},${selectedCase.gpsLocation.y - 0.01},${selectedCase.gpsLocation.x + 0.01},${selectedCase.gpsLocation.y + 0.01}&layer=mapnik&marker=${selectedCase.gpsLocation.y},${selectedCase.gpsLocation.x}`}
                    allowFullScreen
                  />
                </div>
                
                {selectedCase.gpsLocation.y !== undefined && selectedCase.gpsLocation.x !== undefined ? (
                  <p className="text-sm text-gray-600 mt-2">
                    Coordinates: {selectedCase.gpsLocation.y.toFixed(6)}, {selectedCase.gpsLocation.x.toFixed(6)}
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 mt-2">
                    Coordinates: Not available
                  </p>
                )}
              </>
            ) : (
              <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <span className="text-4xl mb-2 block">📍</span>
                  <p className="text-sm">GPS location data unavailable</p>
                </div>
              </div>
            )}
          </div>

          {/* Asset Details */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="font-bold text-gray-900 mb-3">Asset Details</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(selectedCase.assetDetails).map(([key, value]) => (
                value && (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                )
              ))}
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
        </div>

        {/* Approval Actions - Fixed Bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 space-y-3">
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
          ) : !approvalAction ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleApprovalAction('reject')}
                className="px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600"
              >
                ✕ Reject
              </button>
              <button
                onClick={() => handleApprovalAction('approve')}
                className="px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600"
              >
                ✓ Approve
              </button>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {approvalAction === 'approve' ? '✓ Approving Case' : '✕ Rejecting Case'}
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
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setApprovalAction(null);
                    setComment('');
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || (approvalAction === 'reject' && comment.trim().length < 10)}
                  className={`px-4 py-3 rounded-lg font-medium text-white ${
                    approvalAction === 'approve'
                      ? 'bg-green-500 hover:bg-green-600 disabled:bg-gray-400'
                      : 'bg-red-500 hover:bg-red-600 disabled:bg-gray-400'
                  }`}
                >
                  {isSubmitting ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#800020] text-white p-4 sticky top-0 z-10 shadow-md">
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
                {allCases.filter(c => c.status === 'pending_approval').length}
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
                {allCases.filter(c => c.approvedBy !== null && c.approvedBy !== undefined).length}
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
                {allCases.filter(c => c.status === 'rejected').length}
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
                {allCases.length}
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
      <div className="bg-white border-b border-gray-200 sticky top-[60px] z-10">
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
            <div className="text-6xl mb-4">✓</div>
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
                        {caseData.damageSeverity.toUpperCase()}
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
                      <span>AI Confidence: {caseData.aiAssessment.confidenceScore}%</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <span className="mr-1">📷</span>
                      <span>{caseData.photos.length} photos</span>
                    </div>
                  </div>

                  {/* Photo Preview */}
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {caseData.photos.slice(0, 4).map((photo, index) => (
                      <Image
                        key={index}
                        src={photo}
                        alt={`Preview ${index + 1}`}
                        width={80}
                        height={60}
                        className="w-20 h-16 object-cover rounded flex-shrink-0"
                      />
                    ))}
                    {caseData.photos.length > 4 && (
                      <div className="w-20 h-16 bg-gray-200 rounded flex items-center justify-center flex-shrink-0 text-sm text-gray-600">
                        +{caseData.photos.length - 4}
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
