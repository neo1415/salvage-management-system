/**
 * Case Details Page
 * 
 * Display detailed information about a specific case
 * 
 * FIXED ISSUES:
 * 1. Removed duplicate AI Assessment sections (was appearing 3 times)
 * 2. Gemini prose summary displayed in purple box (recommendation field)
 * 3. Voice notes display added
 * 4. Currency formatting with thousand separators
 * 5. Analysis method properly formatted
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { formatNaira, formatAnalysisMethod } from '@/lib/utils/currency-formatter';
import { LocationMap } from '@/components/ui/location-map';

interface Case {
  id: string;
  claimReference: string;
  assetType: 'vehicle' | 'property' | 'electronics';
  assetDetails: Record<string, unknown>;
  marketValue: number;
  estimatedSalvageValue: number | null;
  reservePrice: number | null;
  damageSeverity: 'minor' | 'moderate' | 'severe' | null;
  aiAssessment: Record<string, unknown> | null;
  gpsLocation: { x: number; y: number } | null;
  locationName: string;
  photos: string[];
  voiceNotes?: string[];
  status: 'draft' | 'pending_approval' | 'approved' | 'active_auction' | 'sold' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  adjusterName: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

export default function CaseDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    if (caseId) {
      fetchCaseDetails();
    }
  }, [caseId]);

  const fetchCaseDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/cases/${caseId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Case not found');
        }
        throw new Error('Failed to fetch case details');
      }

      const result = await response.json();
      
      if (result.success) {
        setCaseData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch case details');
      }
    } catch (err) {
      console.error('Error fetching case details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load case details');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: Case['status']) => {
    const badges = {
      draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
      pending_approval: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800' },
      approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
      active_auction: { label: 'Payment Pending', color: 'bg-orange-100 text-orange-800' },
      sold: { label: 'Sold', color: 'bg-purple-100 text-purple-800' },
      cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
      rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
    };

    const badge = badges[status] || badges.draft;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const getSeverityBadge = (severity: Case['damageSeverity']) => {
    if (!severity) return null;

    const badges: Record<string, { label: string; color: string }> = {
      minor: { label: 'Minor', color: 'bg-green-100 text-green-800' },
      moderate: { label: 'Moderate', color: 'bg-yellow-100 text-yellow-800' },
      severe: { label: 'Severe', color: 'bg-red-100 text-red-800' },
    };

    const badge = badges[severity];
    if (!badge) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
          Unknown
        </span>
      );
    }
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-[#800020] text-white p-4 sticky top-0 z-10 shadow-md">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="mr-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold">Case Details</h1>
          </div>
        </div>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#800020]"></div>
          <p className="mt-4 text-gray-600">Loading case details...</p>
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-[#800020] text-white p-4 sticky top-0 z-10 shadow-md">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="mr-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold">Case Details</h1>
          </div>
        </div>
        <div className="p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Error loading case</p>
            <p className="text-red-600 text-sm mt-1">{error || 'Case not found'}</p>
            <button
              onClick={() => router.back()}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#800020] text-white p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Case Details</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Case Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{caseData.claimReference}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {caseData.assetType.charAt(0).toUpperCase() + caseData.assetType.slice(1)}
              </p>
            </div>
            {getStatusBadge(caseData.status)}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Created: {new Date(caseData.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Photo Gallery */}
        {caseData.photos && caseData.photos.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-bold text-gray-900 mb-3">Photos</h3>
            <div className="space-y-3">
              <Image
                src={caseData.photos[selectedPhotoIndex]}
                alt={`Case photo ${selectedPhotoIndex + 1}`}
                width={600}
                height={400}
                unoptimized
                className="w-full h-64 object-cover rounded-lg"
              />
              {caseData.photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {caseData.photos.map((photo, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedPhotoIndex(index)}
                      className={`flex-shrink-0 ${
                        selectedPhotoIndex === index ? 'ring-2 ring-[#800020]' : ''
                      }`}
                    >
                      <Image
                        src={photo}
                        alt={`Thumbnail ${index + 1}`}
                        width={80}
                        height={80}
                        unoptimized
                        className="w-20 h-20 object-cover rounded"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Gemini AI Damage Summary - PROSE FORMAT */}
        {caseData.aiAssessment && typeof caseData.aiAssessment === 'object' && (
          (caseData.aiAssessment as any).recommendation || 
          (caseData.aiAssessment as any).labels?.length > 0
        ) && (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-md border-2 border-purple-200 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-purple-900 mb-2">
                  AI Damage Summary
                </h3>
                
                {/* Damage Description - PROSE FORMAT from Gemini */}
                {(caseData.aiAssessment as any).recommendation && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-800 leading-relaxed">
                      {(caseData.aiAssessment as any).recommendation}
                    </p>
                  </div>
                )}
                
                {/* Damage Labels */}
                {(caseData.aiAssessment as any).labels?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Detected Issues:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(caseData.aiAssessment as any).labels.map((label: string, index: number) => (
                        <span 
                          key={index}
                          className="px-2 py-1 bg-white border border-purple-200 rounded-full text-xs text-gray-700"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Repairability Status - Fixed to show Total Loss when isTotalLoss=true */}
                {(caseData.aiAssessment as any).isTotalLoss !== undefined ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-1 rounded-full font-medium ${
                      (caseData.aiAssessment as any).isTotalLoss 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {(caseData.aiAssessment as any).isTotalLoss ? '✗ Total Loss' : '✓ Repairable'}
                    </span>
                    {(caseData.aiAssessment as any).estimatedRepairCost && (
                      <span className="text-gray-600">
                        Est. Repair: {formatNaira((caseData.aiAssessment as any).estimatedRepairCost)}
                      </span>
                    )}
                  </div>
                ) : (caseData.aiAssessment as any).isRepairable !== undefined ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-1 rounded-full font-medium ${
                      (caseData.aiAssessment as any).isRepairable 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {(caseData.aiAssessment as any).isRepairable ? '✓ Repairable' : '✗ Total Loss'}
                    </span>
                    {(caseData.aiAssessment as any).estimatedRepairCost && (
                      <span className="text-gray-600">
                        Est. Repair: {formatNaira((caseData.aiAssessment as any).estimatedRepairCost)}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* AI Assessment Details - SINGLE SECTION ONLY */}
        {caseData.damageSeverity && caseData.aiAssessment && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-bold text-gray-900 mb-3">AI Assessment Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Damage Severity</span>
                {getSeverityBadge(caseData.damageSeverity)}
              </div>
              
              {/* Damage Scores - Technical Breakdown */}
              {typeof caseData.aiAssessment === 'object' && 'damageScore' in caseData.aiAssessment && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Damage Breakdown</h4>
                  {Object.entries((caseData.aiAssessment as any).damageScore || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 capitalize">{key}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              (value as number) > 70 ? 'bg-red-500' : 
                              (value as number) > 40 ? 'bg-yellow-500' : 
                              'bg-green-500'
                            }`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-8 text-right">{String(value)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Confidence Metrics - REMOVED per user request */}
              
              {/* Valuation Details with Currency Formatting */}
              {caseData.estimatedSalvageValue && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Estimated Salvage Value</span>
                  <span className="font-bold text-green-600">
                    {formatNaira(caseData.estimatedSalvageValue)}
                  </span>
                </div>
              )}
              {caseData.reservePrice && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Reserve Price</span>
                  <span className="font-bold text-gray-900">
                    {formatNaira(caseData.reservePrice)}
                  </span>
                </div>
              )}
              
              {/* Analysis Method - Shows actual method used (gemini/vision/neutral) + price source */}
              {typeof caseData.aiAssessment === 'object' && 'analysisMethod' in caseData.aiAssessment && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Analysis Method</span>
                    <span className="font-medium text-gray-900">
                      {formatAnalysisMethod(
                        (caseData.aiAssessment as any).analysisMethod,
                        (caseData.aiAssessment as any).priceSource
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Voice Notes Display */}
        {caseData.voiceNotes && Array.isArray(caseData.voiceNotes) && caseData.voiceNotes.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2 text-[#800020]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              Voice Notes
            </h3>
            <div className="space-y-2">
              {caseData.voiceNotes.map((note: string, index: number) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-700">{note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Asset Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 mb-3">Asset Details</h3>
          <div className="space-y-2">
            {/* Market Value with Currency Formatting */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Market Value</span>
              <span className="font-medium text-gray-900">
                {formatNaira(caseData.marketValue)}
              </span>
            </div>
            {Object.entries(caseData.assetDetails).map(([key, value]) => {
              // Format the value based on type
              let displayValue = String(value);
              if (typeof value === 'number' && value >= 1000) {
                displayValue = value.toLocaleString();
              }
              
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className="font-medium text-gray-900">{displayValue}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 mb-3">Location</h3>
          <div className="flex items-start mb-3">
            <svg className="w-5 h-5 mr-2 text-gray-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <p className="text-sm text-gray-900">{caseData.locationName}</p>
              {caseData.gpsLocation && caseData.gpsLocation.x !== undefined && caseData.gpsLocation.y !== undefined && (
                <p className="text-xs text-gray-500 mt-1">
                  {caseData.gpsLocation.y.toFixed(6)}, {caseData.gpsLocation.x.toFixed(6)}
                </p>
              )}
            </div>
          </div>
          
          {/* Embedded Google Map */}
          <LocationMap
            latitude={caseData.gpsLocation?.y}
            longitude={caseData.gpsLocation?.x}
            address={caseData.locationName}
            height="300px"
          />
        </div>

        {/* Approval Info */}
        {caseData.approvedBy && caseData.approvedAt && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-bold text-green-900 mb-2">Approval Information</h3>
            <p className="text-sm text-green-800">
              Approved on {new Date(caseData.approvedAt).toLocaleString()}
            </p>
          </div>
        )}

        {/* Draft Actions */}
        {caseData.status === 'draft' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-bold text-blue-900 mb-2">📝 Draft Case</h3>
            <p className="text-sm text-blue-800 mb-4">
              This case is saved as a draft. Submit it for manager approval when ready.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/adjuster/cases/new?edit=${caseData.id}`)}
                className="flex-1 px-4 py-2 bg-white text-blue-700 border-2 border-blue-300 rounded-lg font-medium hover:bg-blue-50 transition-colors"
              >
                ✏️ Edit Draft
              </button>
              <button
                onClick={async () => {
                  if (confirm('Submit this case for manager approval?')) {
                    try {
                      const response = await fetch(`/api/cases/${caseData.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'pending_approval' })
                      });
                      
                      if (response.ok) {
                        alert('Case submitted for approval!');
                        router.push('/adjuster/cases');
                      } else {
                        const data = await response.json();
                        alert(data.error || 'Failed to submit case');
                      }
                    } catch (error) {
                      console.error('Error submitting case:', error);
                      alert('Error submitting case');
                    }
                  }
                }}
                className="flex-1 px-4 py-2 bg-[#800020] text-white rounded-lg font-medium hover:bg-[#600018] transition-colors"
              >
                ✓ Submit for Approval
              </button>
              <button
                onClick={async () => {
                  if (confirm('⚠️ Are you sure you want to delete this draft case? This action cannot be undone.')) {
                    try {
                      const response = await fetch(`/api/cases/${caseData.id}`, {
                        method: 'DELETE',
                      });
                      
                      if (response.ok) {
                        alert('Draft case deleted successfully');
                        router.push('/adjuster/cases');
                      } else {
                        const data = await response.json();
                        alert(data.error || 'Failed to delete case');
                      }
                    } catch (error) {
                      console.error('Error deleting case:', error);
                      alert('Error deleting case');
                    }
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                title="Delete draft case"
              >
                🗑️
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
