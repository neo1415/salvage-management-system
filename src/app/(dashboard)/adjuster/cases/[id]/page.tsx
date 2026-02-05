/**
 * Case Details Page
 * 
 * Display detailed information about a specific case
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';

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
      active_auction: { label: 'Active Auction', color: 'bg-blue-100 text-blue-800' },
      sold: { label: 'Sold', color: 'bg-purple-100 text-purple-800' },
      cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
    };

    const badge = badges[status];
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const getSeverityBadge = (severity: Case['damageSeverity']) => {
    if (!severity) return null;

    const badges = {
      minor: { label: 'Minor', color: 'bg-green-100 text-green-800' },
      moderate: { label: 'Moderate', color: 'bg-yellow-100 text-yellow-800' },
      severe: { label: 'Severe', color: 'bg-red-100 text-red-800' },
    };

    const badge = badges[severity];
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

        {/* AI Assessment */}
        {caseData.damageSeverity && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-bold text-gray-900 mb-3">AI Assessment</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Damage Severity</span>
                {getSeverityBadge(caseData.damageSeverity)}
              </div>
              {caseData.estimatedSalvageValue && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Estimated Salvage Value</span>
                  <span className="font-bold text-green-600">
                    ₦{caseData.estimatedSalvageValue.toLocaleString()}
                  </span>
                </div>
              )}
              {caseData.reservePrice && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Reserve Price</span>
                  <span className="font-bold text-gray-900">
                    ₦{caseData.reservePrice.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Asset Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 mb-3">Asset Details</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Market Value</span>
              <span className="font-medium text-gray-900">
                ₦{caseData.marketValue.toLocaleString()}
              </span>
            </div>
            {Object.entries(caseData.assetDetails).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="font-medium text-gray-900">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 mb-3">Location</h3>
          <div className="flex items-start">
            <svg className="w-5 h-5 mr-2 text-gray-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <p className="text-sm text-gray-900">{caseData.locationName}</p>
              {caseData.gpsLocation && caseData.gpsLocation.x !== undefined && caseData.gpsLocation.y !== undefined && (
                <p className="text-xs text-gray-500 mt-1">
                  {caseData.gpsLocation.x.toFixed(6)}, {caseData.gpsLocation.y.toFixed(6)}
                </p>
              )}
            </div>
          </div>
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
      </div>
    </div>
  );
}
