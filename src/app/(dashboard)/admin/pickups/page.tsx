/**
 * Admin Pickup Confirmations List Page
 * 
 * Displays list of auctions where vendors have confirmed pickup
 * but admin has not yet confirmed. Allows admin to confirm pickups.
 * 
 * Requirements: Requirement 5 - Pickup Confirmation Workflow
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminPickupConfirmation } from '@/components/admin/admin-pickup-confirmation';

interface PickupConfirmation {
  auctionId: string;
  claimReference: string;
  assetType: string;
  assetDetails: Record<string, unknown>;
  amount: string;
  vendor: {
    id: string;
    businessName: string;
    fullName: string;
    email: string;
    phone: string;
  };
  vendorConfirmation: {
    confirmed: boolean;
    confirmedAt: string | null;
  };
  adminConfirmation: {
    confirmed: boolean;
    confirmedAt: string | null;
    confirmedBy: string | null;
  };
  payment: {
    id: string;
    amount: string;
    status: string;
    paymentMethod: string;
  } | null;
  auctionStatus: string;
  caseStatus: string;
  auctionEndTime: string;
}

export default function AdminPickupsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [pickups, setPickups] = useState<PickupConfirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPickup, setSelectedPickup] = useState<PickupConfirmation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all'>('pending');
  const [sortBy, setSortBy] = useState<'confirmedAt' | 'amount' | 'claimRef'>('confirmedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Redirect if not admin or manager
  useEffect(() => {
    if (session && !['admin', 'salvage_manager', 'system_admin'].includes(session.user.role)) {
      router.push('/dashboard');
    }
  }, [session, router]);

  // Fetch pickup confirmations
  const fetchPickups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        status: statusFilter,
        sortBy,
        sortOrder,
      });

      const response = await fetch(`/api/admin/pickups?${params.toString()}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch pickup confirmations');
      }

      const data = await response.json();
      setPickups(data.pickups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pickup confirmations');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchPickups();
  }, [fetchPickups]);

  // Handle admin confirmation
  const handleConfirmPickup = async (notes: string) => {
    if (!selectedPickup) return;

    try {
      const response = await fetch(
        `/api/admin/auctions/${selectedPickup.auctionId}/confirm-pickup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            adminId: session?.user.id,
            notes,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to confirm pickup');
      }

      // Refresh list
      await fetchPickups();
      setIsModalOpen(false);
      setSelectedPickup(null);
    } catch (err) {
      throw err; // Let the component handle the error
    }
  };

  // Format asset name
  const formatAssetName = (pickup: PickupConfirmation) => {
    const details = pickup.assetDetails as Record<string, string>;
    if (pickup.assetType === 'vehicle') {
      return `${details.year || ''} ${details.make || ''} ${details.model || ''}`.trim();
    }
    return pickup.assetType;
  };

  // Filter pickups by search query
  const filteredPickups = pickups.filter((pickup) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      pickup.claimReference.toLowerCase().includes(query) ||
      pickup.vendor.businessName.toLowerCase().includes(query) ||
      pickup.vendor.fullName.toLowerCase().includes(query) ||
      formatAssetName(pickup).toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-burgundy-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading pickup confirmations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pickup Confirmations</h1>
          <p className="mt-2 text-gray-600">
            Confirm vendor pickups and complete transactions
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                id="search"
                placeholder="Search by claim ref, vendor, or asset..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'pending' | 'all')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
              >
                <option value="pending">Pending Only</option>
                <option value="all">All Pickups</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'confirmedAt' | 'amount' | 'claimRef')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
              >
                <option value="confirmedAt">Confirmation Date</option>
                <option value="amount">Amount</option>
                <option value="claimRef">Claim Reference</option>
              </select>
            </div>
          </div>

          {/* Sort Order Toggle */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Pickups List */}
        {filteredPickups.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No pending pickups</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery
                ? 'No pickups match your search'
                : 'All pickups have been confirmed'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPickups.map((pickup) => (
              <div key={pickup.auctionId} className="bg-white rounded-lg shadow-md p-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Auction Details */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Auction Details</h3>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-gray-600">Claim:</span>{' '}
                        <span className="font-medium">{pickup.claimReference}</span>
                      </p>
                      <p>
                        <span className="text-gray-600">Asset:</span>{' '}
                        <span className="font-medium">{formatAssetName(pickup)}</span>
                      </p>
                      <p>
                        <span className="text-gray-600">Amount:</span>{' '}
                        <span className="font-medium">
                          ₦{parseFloat(pickup.amount || '0').toLocaleString()}
                        </span>
                      </p>
                      <p>
                        <span className="text-gray-600">Closed:</span>{' '}
                        <span className="font-medium">
                          {new Date(pickup.auctionEndTime).toLocaleDateString()}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Vendor Details */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Vendor</h3>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-gray-600">Name:</span>{' '}
                        <span className="font-medium">{pickup.vendor.fullName}</span>
                      </p>
                      <p>
                        <span className="text-gray-600">Business:</span>{' '}
                        <span className="font-medium">{pickup.vendor.businessName}</span>
                      </p>
                      <p>
                        <span className="text-gray-600">Email:</span>{' '}
                        <span className="font-medium">{pickup.vendor.email}</span>
                      </p>
                      <p>
                        <span className="text-gray-600">Phone:</span>{' '}
                        <span className="font-medium">{pickup.vendor.phone}</span>
                      </p>
                    </div>
                  </div>

                  {/* Confirmation Status */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Status</h3>
                    <div className="space-y-2">
                      <div className={`p-2 rounded-lg ${
                        pickup.vendorConfirmation.confirmed
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-yellow-50 border border-yellow-200'
                      }`}>
                        <p className={`text-xs font-medium ${
                          pickup.vendorConfirmation.confirmed
                            ? 'text-green-800'
                            : 'text-yellow-800'
                        }`}>
                          Vendor: {pickup.vendorConfirmation.confirmed ? '✓ Confirmed' : 'Pending'}
                        </p>
                        {pickup.vendorConfirmation.confirmedAt && (
                          <p className="text-xs text-gray-600 mt-1">
                            {new Date(pickup.vendorConfirmation.confirmedAt).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className={`p-2 rounded-lg ${
                        pickup.adminConfirmation.confirmed
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-yellow-50 border border-yellow-200'
                      }`}>
                        <p className={`text-xs font-medium ${
                          pickup.adminConfirmation.confirmed
                            ? 'text-green-800'
                            : 'text-yellow-800'
                        }`}>
                          Admin: {pickup.adminConfirmation.confirmed ? '✓ Confirmed' : 'Pending'}
                        </p>
                        {pickup.adminConfirmation.confirmedAt && (
                          <p className="text-xs text-gray-600 mt-1">
                            {new Date(pickup.adminConfirmation.confirmedAt).toLocaleString()}
                          </p>
                        )}
                      </div>

                      {pickup.payment && (
                        <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                          <p className="text-xs font-medium text-blue-800">
                            Payment: {pickup.payment.status.toUpperCase()}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {pickup.payment.paymentMethod.replace('_', ' ')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Actions</h3>
                    {!pickup.adminConfirmation.confirmed && pickup.vendorConfirmation.confirmed ? (
                      <button
                        onClick={() => {
                          setSelectedPickup(pickup);
                          setIsModalOpen(true);
                        }}
                        className="w-full px-4 py-2 bg-burgundy-900 text-white rounded-lg font-semibold hover:bg-burgundy-800 transition-colors text-sm"
                      >
                        Confirm Pickup
                      </button>
                    ) : pickup.adminConfirmation.confirmed ? (
                      <div className="text-center p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium text-green-800">✓ Completed</p>
                      </div>
                    ) : (
                      <div className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-xs text-yellow-800">
                          Waiting for vendor confirmation
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pickup Confirmation Modal */}
        {isModalOpen && selectedPickup && session?.user && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Confirm Pickup</h2>
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      setSelectedPickup(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Pickup Details */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Claim:</span> {selectedPickup.claimReference}
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Asset:</span> {formatAssetName(selectedPickup)}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Vendor:</span> {selectedPickup.vendor.fullName} ({selectedPickup.vendor.businessName})
                  </p>
                </div>

                {/* AdminPickupConfirmation Component */}
                <AdminPickupConfirmation
                  auctionId={selectedPickup.auctionId}
                  adminId={session.user.id}
                  vendorPickupStatus={{
                    confirmed: selectedPickup.vendorConfirmation.confirmed,
                    confirmedAt: selectedPickup.vendorConfirmation.confirmedAt,
                  }}
                  onConfirm={handleConfirmPickup}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
