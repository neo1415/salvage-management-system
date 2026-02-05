/**
 * Cases List Page
 * 
 * Display all cases created by the adjuster with filtering and status badges
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  gpsLocation: { latitude: number; longitude: number };
  locationName: string;
  photos: string[];
  status: 'draft' | 'pending_approval' | 'approved' | 'active_auction' | 'sold' | 'cancelled';
  createdAt: string;
  adjusterName: string | null;
}

type StatusFilter = 'all' | 'pending_approval' | 'approved' | 'draft';

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Fetch cases on mount
  useEffect(() => {
    fetchCases();
  }, []);

  // Filter cases when status filter changes
  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredCases(cases);
    } else {
      setFilteredCases(cases.filter(c => c.status === statusFilter));
    }
  }, [statusFilter, cases]);

  const fetchCases = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/cases');
      
      if (!response.ok) {
        throw new Error('Failed to fetch cases');
      }

      const result = await response.json();
      
      if (result.success) {
        setCases(result.data);
        setFilteredCases(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch cases');
      }
    } catch (err) {
      console.error('Error fetching cases:', err);
      setError(err instanceof Error ? err.message : 'Failed to load cases');
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#800020] text-white p-4 sticky top-0 z-10 shadow-md">
        <h1 className="text-xl font-bold">My Cases</h1>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Create New Case Button */}
        <button
          onClick={() => router.push('/adjuster/cases/new')}
          className="w-full px-4 py-3 bg-[#800020] text-white rounded-lg font-medium hover:bg-[#600018] transition-colors"
        >
          + Create New Case
        </button>

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['all', 'pending_approval', 'approved', 'draft'] as StatusFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                statusFilter === filter
                  ? 'bg-[#800020] text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {filter === 'all' ? 'All' : filter.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#800020]"></div>
            <p className="mt-4 text-gray-600">Loading cases...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Error loading cases</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={fetchCases}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredCases.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 text-gray-600 font-medium">
              {statusFilter === 'all' ? 'No cases yet' : `No ${statusFilter.replace('_', ' ')} cases`}
            </p>
            <p className="mt-2 text-gray-500 text-sm">
              {statusFilter === 'all' ? 'Create your first case to get started' : 'Try a different filter'}
            </p>
          </div>
        )}

        {/* Cases List */}
        {!isLoading && !error && filteredCases.length > 0 && (
          <div className="space-y-4">
            {filteredCases.map((caseItem) => (
              <div
                key={caseItem.id}
                onClick={() => router.push(`/adjuster/cases/${caseItem.id}`)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{caseItem.claimReference}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {caseItem.assetType.charAt(0).toUpperCase() + caseItem.assetType.slice(1)}
                    </p>
                  </div>
                  {getStatusBadge(caseItem.status)}
                </div>

                {/* Photo Preview */}
                {caseItem.photos && caseItem.photos.length > 0 && (
                  <div className="mb-3">
                    <Image
                      src={caseItem.photos[0]}
                      alt="Case preview"
                      width={400}
                      height={200}
                      unoptimized
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  </div>
                )}

                {/* AI Assessment Results */}
                {caseItem.damageSeverity && (
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-700">AI Assessment</span>
                      {getSeverityBadge(caseItem.damageSeverity)}
                    </div>
                    {caseItem.estimatedSalvageValue && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Est. Value:</span>
                        <span className="font-bold text-green-600">
                          ₦{caseItem.estimatedSalvageValue.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Location */}
                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="truncate">{caseItem.locationName}</span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                  <span>
                    {new Date(caseItem.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-[#800020] font-medium">View Details →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
