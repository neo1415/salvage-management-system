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
}

/**
 * Approval action type
 */
type ApprovalAction = 'approve' | 'reject' | null;

export default function ApprovalsPage() {
  const router = useRouter();
  const { status } = useSession();
  
  // State
  const [cases, setCases] = useState<CaseData[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [approvalAction, setApprovalAction] = useState<ApprovalAction>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Fetch pending cases on mount
   */
  useEffect(() => {
    if (status === 'authenticated') {
      fetchPendingCases();
    }
  }, [status]);

  /**
   * Request notification permission on mount
   */
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  /**
   * Fetch pending cases from API
   */
  const fetchPendingCases = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/cases?status=pending_approval');
      
      if (!response.ok) {
        throw new Error('Failed to fetch cases');
      }

      const data = await response.json();
      setCases(data.data || []);
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

  // Loading state
  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading cases...</p>
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
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(selectedCase.damageSeverity)}`}>
                {selectedCase.damageSeverity.toUpperCase()}
              </span>
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
          {!approvalAction ? (
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

      {/* Cases List */}
      <div className="p-4">
        {cases.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✓</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">All Caught Up!</h2>
            <p className="text-gray-600">No cases pending approval</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              {cases.length} case{cases.length !== 1 ? 's' : ''} pending approval
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
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(caseData.damageSeverity)}`}>
                      {caseData.damageSeverity.toUpperCase()}
                    </span>
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
