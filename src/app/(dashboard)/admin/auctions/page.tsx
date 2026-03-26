'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { useCachedAuctions } from '@/hooks/use-cached-auctions';
import { OfflineIndicator } from '@/components/pwa/offline-indicator';
import { RefreshCw, WifiOff } from 'lucide-react';
import { formatRelativeDate } from '@/utils/format-utils';

interface AuctionWithStatus {
  id: string;
  caseId: string;
  status: string;
  currentBid: string | null;
  currentBidder: string | null;
  endTime: string;
  createdAt: string;
  case: {
    claimReference: string;
    assetType: string;
    assetDetails: Record<string, unknown>;
  };
  vendor: {
    id: string;
    businessName: string;
    user: {
      fullName: string;
      email: string;
      phone: string;
    };
  } | null;
  payment: {
    id: string;
    status: string;
    amount: string;
  } | null;
  documents: {
    id: string;
    documentType: string;
    status: string;
    createdAt: string;
  }[];
  notificationSent: boolean;
  notificationFailed?: boolean;
  documentGenerationFailed?: boolean;
}

interface ModalConfig {
  isOpen: boolean;
  type: 'confirm' | 'result';
  title: string;
  message: string;
  confirmationType?: 'warning' | 'danger' | 'info' | 'success';
  onConfirm?: () => void;
}

export default function AdminAuctionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [auctions, setAuctions] = useState<AuctionWithStatus[]>([]);
  const [isGeneratingDocs, setIsGeneratingDocs] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false,
    type: 'confirm',
    title: '',
    message: '',
    confirmationType: 'warning',
  });

  // Cached auctions hook with fetch function
  const fetchAuctionsFn = useCallback(async () => {
    const response = await fetch('/api/admin/auctions?status=closed');
    if (!response.ok) {
      throw new Error('Failed to fetch auctions');
    }
    const data = await response.json();
    return data.auctions || [];
  }, []);

  const {
    auctions: cachedAuctions,
    isLoading,
    isOffline,
    lastUpdated,
    refresh: refreshCache,
    error: cacheError,
  } = useCachedAuctions(fetchAuctionsFn);

  // Update local auctions state when cached auctions change
  useEffect(() => {
    setAuctions(cachedAuctions as unknown as AuctionWithStatus[]);
  }, [cachedAuctions]);

  // Manual refresh handler
  const handleRefresh = async () => {
    if (isOffline) return;
    
    setIsRefreshing(true);
    try {
      await refreshCache();
    } catch (error) {
      console.error('Failed to refresh auctions:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Redirect if not admin or finance
  useEffect(() => {
    if (session && session.user.role !== 'admin' && session.user.role !== 'finance_officer') {
      router.push('/dashboard');
    }
  }, [session, router]);

  // Generate documents manually
  const handleGenerateDocuments = async (auctionId: string) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Generate Documents',
      message: 'Generate all required documents for this auction?',
      confirmationType: 'warning',
      onConfirm: () => executeGenerateDocuments(auctionId),
    });
  };

  const executeGenerateDocuments = async (auctionId: string) => {
    setModalConfig({ ...modalConfig, isOpen: false });
    setIsGeneratingDocs(auctionId);

    try {
      const response = await fetch(`/api/admin/auctions/${auctionId}/generate-documents`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate documents');
      }

      const result = await response.json();
      
      setModalConfig({
        isOpen: true,
        type: 'result',
        title: 'Success',
        message: `Documents generated successfully!\n\n${result.message}`,
        confirmationType: 'success',
      });

      // Refresh auctions list after a short delay
      setTimeout(() => {
        handleRefresh();
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate documents';
      
      setModalConfig({
        isOpen: true,
        type: 'result',
        title: 'Error',
        message: errorMessage,
        confirmationType: 'danger',
      });
    } finally {
      setIsGeneratingDocs(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-burgundy-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading auctions...</p>
        </div>
      </div>
    );
  }

  const getDocumentStatus = (auction: AuctionWithStatus) => {
    // Only require bill_of_sale and liability_waiver initially
    // pickup_authorization is generated AFTER payment verification
    const requiredDocs = ['bill_of_sale', 'liability_waiver'];
    const existingDocs = auction.documents.map((d) => d.documentType);
    const missingDocs = requiredDocs.filter((doc) => !existingDocs.includes(doc));

    // Check if pickup_authorization exists (generated after payment)
    const hasPickupAuth = existingDocs.includes('pickup_authorization');

    if (missingDocs.length === 0) {
      if (hasPickupAuth) {
        return { status: 'complete', color: 'text-green-600', text: '✓ All documents generated (including pickup authorization)' };
      }
      return { status: 'complete', color: 'text-green-600', text: '✓ Initial documents generated' };
    } else if (missingDocs.length === requiredDocs.length) {
      return { status: 'missing', color: 'text-red-600', text: '✗ No documents generated' };
    } else {
      return {
        status: 'partial',
        color: 'text-yellow-600',
        text: `⚠ Missing: ${missingDocs.join(', ')}`,
      };
    }
  };

  const formatAssetName = (auction: AuctionWithStatus) => {
    const details = auction.case.assetDetails as Record<string, string>;
    if (auction.case.assetType === 'vehicle') {
      return `${details.year || ''} ${details.make || ''} ${details.model || ''}`.trim();
    }
    return auction.case.assetType;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      {/* Offline Indicator */}
      <OfflineIndicator />

      <div className="max-w-7xl mx-auto">
        {/* Offline Data Banner */}
        {isOffline && lastUpdated && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <WifiOff size={16} className="flex-shrink-0" />
              <span>
                Viewing cached data. Last updated: {formatRelativeDate(lastUpdated)}
              </span>
            </div>
          </div>
        )}

        {/* Cache Miss Error */}
        {isOffline && !isLoading && auctions.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-6">
            <div className="flex items-center gap-2 text-sm text-yellow-800">
              <WifiOff size={16} className="flex-shrink-0" />
              <span>
                No cached data available. Please connect to the internet to view auctions.
              </span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Auction Management</h1>
            <p className="mt-2 text-gray-600">
              Manage closed auctions and generate documents
            </p>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isOffline || isRefreshing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isOffline
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-burgundy-900 text-white hover:bg-burgundy-800'
            }`}
            title={isOffline ? 'Cannot refresh while offline' : 'Refresh auctions'}
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Auctions List */}
        {auctions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            {isOffline ? (
              <>
                <WifiOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No cached auction data available</p>
                <p className="text-sm text-gray-500 mt-2">Connect to the internet to view auctions</p>
              </>
            ) : (
              <p className="text-gray-600">No closed auctions found</p>
            )}
          </div>
        ) : (
          <>
            {/* Use virtualization only when count > 50 */}
            {auctions.length > 50 ? (
              <div className="h-[calc(100vh-300px)] min-h-[600px]">
                <VirtualizedList
                  items={auctions}
                  renderItem={(auction) => (
                    <div className="pb-4">
                      <AuctionManagementCard
                        auction={auction}
                        isGenerating={isGeneratingDocs === auction.id}
                        onGenerateDocuments={handleGenerateDocuments}
                      />
                    </div>
                  )}
                  estimateSize={250}
                  overscan={3}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {auctions.map((auction) => (
                  <AuctionManagementCard
                    key={auction.id}
                    auction={auction}
                    isGenerating={isGeneratingDocs === auction.id}
                    onGenerateDocuments={handleGenerateDocuments}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Confirmation Modal */}
        <ConfirmationModal
          isOpen={modalConfig.isOpen}
          onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
          onConfirm={modalConfig.onConfirm || (() => {})}
          title={modalConfig.title}
          message={modalConfig.message}
          type={modalConfig.confirmationType}
          confirmText={modalConfig.type === 'result' ? 'OK' : 'Confirm'}
          cancelText="Cancel"
          isLoading={false}
        />
      </div>
    </div>
  );
}

// Auction Management Card Component
interface AuctionManagementCardProps {
  auction: AuctionWithStatus;
  isGenerating: boolean;
  onGenerateDocuments: (auctionId: string) => void;
}

function AuctionManagementCard({
  auction,
  isGenerating,
  onGenerateDocuments,
}: AuctionManagementCardProps) {
  const getDocumentStatus = (auction: AuctionWithStatus) => {
    // Only require bill_of_sale and liability_waiver initially
    // pickup_authorization is generated AFTER payment verification
    const requiredDocs = ['bill_of_sale', 'liability_waiver'];
    const existingDocs = auction.documents.map((d) => d.documentType);
    const missingDocs = requiredDocs.filter((doc) => !existingDocs.includes(doc));

    // Check if pickup_authorization exists (generated after payment)
    const hasPickupAuth = existingDocs.includes('pickup_authorization');

    if (missingDocs.length === 0) {
      if (hasPickupAuth) {
        return { status: 'complete', color: 'text-green-600', text: '✓ All documents generated (including pickup authorization)' };
      }
      return { status: 'complete', color: 'text-green-600', text: '✓ Initial documents generated' };
    } else if (missingDocs.length === requiredDocs.length) {
      return { status: 'missing', color: 'text-red-600', text: '✗ No documents generated' };
    } else {
      return {
        status: 'partial',
        color: 'text-yellow-600',
        text: `⚠ Missing: ${missingDocs.join(', ')}`,
      };
    }
  };

  const formatAssetName = (auction: AuctionWithStatus) => {
    const details = auction.case.assetDetails as Record<string, string>;
    if (auction.case.assetType === 'vehicle') {
      return `${details.year || ''} ${details.make || ''} ${details.model || ''}`.trim();
    }
    return auction.case.assetType;
  };

  const docStatus = getDocumentStatus(auction);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Auction Details */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Auction Details</h3>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-gray-600">Claim:</span>{' '}
              <span className="font-medium">{auction.case.claimReference}</span>
            </p>
            <p>
              <span className="text-gray-600">Asset:</span>{' '}
              <span className="font-medium">{formatAssetName(auction)}</span>
            </p>
            <p>
              <span className="text-gray-600">Winning Bid:</span>{' '}
              <span className="font-medium">
                ₦{parseFloat(auction.currentBid || '0').toLocaleString()}
              </span>
            </p>
            <p>
              <span className="text-gray-600">Closed:</span>{' '}
              <span className="font-medium">
                {new Date(auction.endTime).toLocaleDateString()}
              </span>
            </p>
          </div>
        </div>

        {/* Winner Details */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Winner</h3>
          {auction.currentBidder ? (
            auction.vendor ? (
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-gray-600">Name:</span>{' '}
                  <span className="font-medium">{auction.vendor.user.fullName}</span>
                </p>
                <p>
                  <span className="text-gray-600">Business:</span>{' '}
                  <span className="font-medium">{auction.vendor.businessName || 'Not provided'}</span>
                </p>
                <p>
                  <span className="text-gray-600">Email:</span>{' '}
                  <span className="font-medium">{auction.vendor.user.email}</span>
                </p>
                <p>
                  <span className="text-gray-600">Phone:</span>{' '}
                  <span className="font-medium">{auction.vendor.user.phone}</span>
                </p>
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <p className="text-yellow-600 font-medium">⚠️ Winner data incomplete</p>
                <p className="text-xs text-gray-500">Vendor ID: {auction.currentBidder}</p>
                <p className="text-xs text-gray-500">Vendor profile may be suspended or incomplete</p>
              </div>
            )
          ) : (
            <p className="text-sm text-gray-500">No winner</p>
          )}
        </div>

        {/* Status & Actions */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Status & Actions</h3>
          <div className="space-y-3">
            {/* Document Status */}
            <div>
              <p className={`text-sm font-medium ${docStatus.color}`}>
                {docStatus.text}
              </p>
              {auction.documentGenerationFailed && (
                <p className="text-xs text-red-600 font-semibold mt-1">
                  ⚠️ FAILED - Retry needed
                </p>
              )}
              {auction.documents.length > 0 && (
                <ul className="mt-1 text-xs text-gray-600">
                  {auction.documents.map((doc) => (
                    <li key={doc.id}>
                      • {doc.documentType.replace(/_/g, ' ')} ({doc.status})
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Payment Status */}
            {auction.payment && (
              <div>
                <p className="text-sm">
                  <span className="text-gray-600">Payment:</span>{' '}
                  <span
                    className={`font-medium ${
                      auction.payment.status === 'verified'
                        ? 'text-green-600'
                        : auction.payment.status === 'pending'
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {auction.payment.status.toUpperCase()}
                  </span>
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {auction.currentBidder && (
              <div className="space-y-2 pt-2">
                {(docStatus.status !== 'complete' || auction.documentGenerationFailed) && (
                  <button
                    onClick={() => onGenerateDocuments(auction.id)}
                    disabled={isGenerating}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium ${
                      auction.documentGenerationFailed
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-burgundy-900 hover:bg-burgundy-800 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isGenerating ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Generating...</span>
                      </div>
                    ) : auction.documentGenerationFailed ? (
                      '🔄 Retry Documents'
                    ) : (
                      '📄 Generate Documents'
                    )}
                  </button>
                )}

                {/* Notification Status Indicator - Show when documents are complete */}
                {docStatus.status === 'complete' && !auction.notificationFailed && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div className="text-sm text-green-700 font-medium">
                      ✓ Notifications Sent
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      Winner notified automatically after auction closure
                    </div>
                  </div>
                )}
                
                {/* Retry Notification Button - Only shown if notification explicitly failed */}
                {auction.notificationFailed && (
                  <div className="space-y-2">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                      <div className="text-sm text-red-700 font-medium">
                        ⚠️ Notification Failed
                      </div>
                      <div className="text-xs text-red-600 mt-1">
                        Automatic notification delivery failed
                      </div>
                    </div>
                    <button
                      onClick={() => window.alert('Please contact technical support to investigate and retry notifications for this auction.')}
                      className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      🔄 Retry Notification
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
