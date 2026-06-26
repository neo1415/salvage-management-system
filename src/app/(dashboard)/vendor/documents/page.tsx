/**
 * Vendor Documents Page
 * 
 * Shows all documents from all auctions the vendor has won
 * Grouped by auction with status indicators
 */

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useAppRouter } from '@/hooks/use-app-router';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { useCachedDocuments } from '@/hooks/use-cached-documents';
import { OfflineAwareButton } from '@/components/ui/offline-aware-button';

interface Document {
  id: string;
  auctionId: string;
  documentType: 'bill_of_sale' | 'liability_waiver' | 'pickup_authorization' | 'salvage_certificate' | 'payment_receipt';
  title: string;
  status: 'pending' | 'signed' | 'voided';
  signedAt: Date | null;
  createdAt: Date;
  pdfUrl: string;
  isReceipt?: boolean;
  receiptUrl?: string;
}

interface AuctionDocuments extends Record<string, unknown> {
  auctionId: string;
  assetName: string;
  winningBid: number;
  closedAt: Date;
  status: 'scheduled' | 'active' | 'extended' | 'closed' | 'cancelled';
  documents: Document[];
}

interface WonAuctionDocumentPayload {
  id: string;
  assetName?: string;
  currentBid?: string | number | null;
  closedAt?: string;
  status?: AuctionDocuments['status'];
  payment?: {
    id?: string;
    createdAt?: string;
  } | null;
}

interface ApiDocumentPayload {
  id: string;
  auctionId: string;
  documentType: Document['documentType'];
  title: string;
  status: Document['status'];
  pdfUrl: string;
  createdAt: string;
  signedAt: string | null;
  documentData?: {
    assetDescription?: string;
    salePrice?: number;
  };
}

const DOCUMENTS_PAGE_SIZE = 15;

function isVisibleDocument(doc: Document) {
  return !(doc.documentType === 'pickup_authorization' && doc.status === 'pending');
}

function createReceiptDocument(
  auction: WonAuctionDocumentPayload,
  payment: NonNullable<WonAuctionDocumentPayload['payment']>
): Document | null {
  if (!payment?.id) return null;

  return {
    id: payment.id,
    auctionId: auction.id,
    documentType: 'payment_receipt',
    title: 'Payment Receipt',
    status: 'signed',
    signedAt: payment.createdAt ? new Date(payment.createdAt) : null,
    createdAt: payment.createdAt
      ? new Date(payment.createdAt)
      : auction.closedAt
        ? new Date(auction.closedAt)
        : new Date(),
    pdfUrl: '',
    isReceipt: true,
    receiptUrl: `/receipt/${payment.id}`,
  };
}

function mapApiDocument(doc: ApiDocumentPayload): Document {
  return {
    id: doc.id,
    auctionId: doc.auctionId,
    documentType: doc.documentType,
    title: doc.title,
    status: doc.status,
    signedAt: doc.signedAt ? new Date(doc.signedAt) : null,
    createdAt: new Date(doc.createdAt),
    pdfUrl: doc.pdfUrl,
  };
}

export default function VendorDocumentsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useAppRouter();
  const [auctionDocuments, setAuctionDocuments] = useState<AuctionDocuments[]>([]);
  
  // Track if we need to scroll to a specific auction
  const [scrollToAuctionId, setScrollToAuctionId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(DOCUMENTS_PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);

  // CRITICAL: Wrap fetchFn in useCallback to prevent infinite loop
  // Without this, fetchFn is recreated on every render, causing the hook to re-fetch infinitely
  const fetchDocuments = useCallback(async () => {
    if (!session?.user?.vendorId) {
      return [];
    }

    const [auctionsResponse, documentsResponse] = await Promise.all([
      fetch('/api/vendor/won-auctions'),
      fetch('/api/vendor/documents'),
    ]);

    if (!auctionsResponse.ok) {
      throw new Error('Failed to fetch documents');
    }

    const auctionsPayload = await auctionsResponse.json();
    const documentsPayload = documentsResponse.ok
      ? await documentsResponse.json()
      : { documents: [] };

    const wonAuctions = (auctionsPayload.data?.auctions ?? []) as WonAuctionDocumentPayload[];
    const rawDocuments = (documentsPayload.documents ?? []) as ApiDocumentPayload[];

    const docsByAuction = new Map<string, Document[]>();
    for (const raw of rawDocuments) {
      const doc = mapApiDocument(raw);
      const existing = docsByAuction.get(doc.auctionId) ?? [];
      existing.push(doc);
      docsByAuction.set(doc.auctionId, existing);
    }

    const auctionMeta = new Map(wonAuctions.map((auction) => [auction.id, auction]));
    const auctionIds = new Set([
      ...wonAuctions.map((a) => a.id),
      ...docsByAuction.keys(),
    ]);

    const grouped: AuctionDocuments[] = [];

    for (const auctionId of auctionIds) {
      const auction = auctionMeta.get(auctionId);
      const receipt = auction?.payment?.id
        ? createReceiptDocument(auction, auction.payment)
        : null;

      const documents = [
        ...(docsByAuction.get(auctionId) ?? []),
        ...(receipt ? [receipt] : []),
      ];

      if (documents.length === 0) continue;

      const saleFromDoc = rawDocuments.find(
        (d) => d.auctionId === auctionId
      );

      grouped.push({
        auctionId,
        assetName:
          auction?.assetName ||
          saleFromDoc?.documentData?.assetDescription ||
          'Auction item',
        winningBid: auction
          ? Number(auction.currentBid ?? 0)
          : saleFromDoc?.documentData?.salePrice ?? 0,
        closedAt: auction?.closedAt ? new Date(auction.closedAt) : documents[0].createdAt,
        status: auction?.status ?? 'closed',
        documents,
      });
    }

    grouped.sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime());
    return grouped;
  }, [session?.user?.vendorId]);

  // Use cached documents hook - pass null for auctionId since we're fetching all auctions
  // CRITICAL: Only pass fetchDocuments when session is ready to prevent premature fetches
  const { 
    documents: cachedDocs, 
    isLoading, 
    isOffline, 
    lastUpdated, 
    refresh,
    error: cacheError 
  } = useCachedDocuments<AuctionDocuments>(null, session?.user?.vendorId ? fetchDocuments : undefined);

  // Update local state when cached docs change
  useEffect(() => {
    console.log('🔄 [DOCUMENTS PAGE] State update triggered:', {
      cachedDocsLength: cachedDocs?.length || 0,
      isLoading,
      timestamp: new Date().toISOString()
    });
    
    if (cachedDocs && cachedDocs.length > 0) {
      console.log('✅ [DOCUMENTS PAGE] Setting auction documents:', cachedDocs.length, 'auctions');
      setAuctionDocuments(cachedDocs as unknown as AuctionDocuments[]);
    } else if (!isLoading && session?.user?.vendorId) {
      console.log('⚠️  [DOCUMENTS PAGE] Clearing auction documents (no cached docs and not loading)');
      setAuctionDocuments([]);
    }
  }, [cachedDocs, isLoading, session?.user?.vendorId]);

  const scrollTargetIndex = useMemo(() => {
    if (!scrollToAuctionId) return -1;
    return auctionDocuments.findIndex((a) => a.auctionId === scrollToAuctionId);
  }, [auctionDocuments, scrollToAuctionId]);

  useEffect(() => {
    setVisibleCount(DOCUMENTS_PAGE_SIZE);
  }, [auctionDocuments.length]);

  useEffect(() => {
    if (scrollTargetIndex >= 0) {
      setVisibleCount((prev) =>
        Math.max(prev, scrollTargetIndex + 1, DOCUMENTS_PAGE_SIZE)
      );
    }
  }, [scrollTargetIndex]);

  const visibleAuctions = useMemo(
    () => auctionDocuments.slice(0, visibleCount),
    [auctionDocuments, visibleCount]
  );

  const hasMoreAuctions = visibleCount < auctionDocuments.length;

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMoreAuctions || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) =>
            Math.min(prev + DOCUMENTS_PAGE_SIZE, auctionDocuments.length)
          );
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreAuctions, isLoading, auctionDocuments.length]);

  // Handle anchor navigation from auction detail page
  useEffect(() => {
    console.log('🔗 [DOCUMENTS PAGE] Hash navigation check:', {
      hasHash: !!window.location.hash,
      hash: window.location.hash,
      timestamp: new Date().toISOString()
    });
    
    // Check if there's a hash in the URL (e.g., #auction-123)
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.substring(1); // Remove the #
      if (hash.startsWith('auction-')) {
        const auctionId = hash.replace('auction-', '');
        console.log('🎯 [DOCUMENTS PAGE] Hash navigation detected for auction:', auctionId);
        setScrollToAuctionId(auctionId);
        
        // FIXED: Removed forced refresh to prevent race condition
        // The useCachedDocuments hook already handles caching intelligently
        // Forcing a refresh here causes two simultaneous fetches which can result in
        // "no documents" being shown due to timing issues
        console.log('✅ [DOCUMENTS PAGE] Scroll target set, no forced refresh');
      }
    } else {
      console.log('ℹ️  [DOCUMENTS PAGE] Normal navigation (no hash)');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to auction after documents are loaded
  useEffect(() => {
    if (scrollToAuctionId && auctionDocuments.length > 0 && !isLoading) {
      console.log('📜 [DOCUMENTS PAGE] Attempting to scroll to auction:', scrollToAuctionId);
      console.log('   Documents loaded:', auctionDocuments.length);
      console.log('   Is loading:', isLoading);
      
      // Wait longer for the DOM to fully render
      setTimeout(() => {
        const element = document.getElementById(`auction-${scrollToAuctionId}`);
        if (element) {
          console.log('✅ [DOCUMENTS PAGE] Scrolling to auction:', scrollToAuctionId);
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Clear the scroll target
          setScrollToAuctionId(null);
        } else {
          console.warn(`❌ [DOCUMENTS PAGE] Element auction-${scrollToAuctionId} not found in DOM`);
          console.log('   Available auction IDs:', auctionDocuments.map(a => a.auctionId));
        }
      }, 300); // Increased from 100ms to 300ms
    }
  }, [scrollToAuctionId, auctionDocuments, isLoading]);

  const handleDownload = async (documentId: string, title: string) => {
    try {
      setDownloadingDocumentId(documentId);
      const response = await fetch(`/api/documents/${documentId}/download`);

      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  const handleDownloadReceipt = (receiptUrl: string) => {
    const printWindow = window.open(receiptUrl, '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      router.push(receiptUrl);
      return;
    }
    printWindow.addEventListener('load', () => {
      printWindow.focus();
      printWindow.print();
    });
  };

  const handleViewReceipt = (receiptUrl: string) => {
    router.push(receiptUrl);
  };

  if (isLoading || sessionStatus === 'loading') {
    console.log('⏳ [DOCUMENTS PAGE] Showing loading state');
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-[var(--brand-primary)] border-t-transparent animate-spin"></div>
          </div>
          <p className="text-lg font-medium text-gray-700">Loading documents...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait</p>
        </div>
      </div>
    );
  }

  if (cacheError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Unable to Load Documents</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">{cacheError.message}</p>
          <button
            onClick={() => refresh()}
            className="px-8 py-3.5 bg-[var(--brand-primary)] text-white font-semibold rounded-xl hover:bg-[var(--brand-primary-hover)] transition-all duration-200 shadow-lg shadow-[var(--brand-shadow-color)] hover:shadow-xl hover:shadow-[var(--brand-shadow-color)] hover:-translate-y-0.5"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (auctionDocuments.length === 0) {
    console.log('📭 [DOCUMENTS PAGE] Showing empty state');
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 tracking-tight">My Documents</h1>
          
          {/* Offline indicator when viewing cached empty state */}
          {isOffline && (
            <div className="mb-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900">
                    Offline Mode
                  </p>
                  {lastUpdated && (
                    <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Last updated: {new Date(lastUpdated).toLocaleString('en-NG')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 sm:p-16 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">No Documents Yet</h2>
            <p className="text-gray-600 mb-8 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
              Documents will appear here after you win an auction
            </p>
            <button
              onClick={() => router.push('/vendor/auctions')}
              className="px-8 py-3.5 bg-[var(--brand-primary)] text-white font-semibold rounded-xl hover:bg-[var(--brand-primary-hover)] transition-all duration-200 shadow-lg shadow-[var(--brand-shadow-color)] hover:shadow-xl hover:shadow-[var(--brand-shadow-color)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              disabled={isOffline}
            >
              Browse Auctions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Modern Header with Stats */}
        <div className="mb-8 sm:mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 tracking-tight">
                My Documents
              </h1>
              <p className="text-base sm:text-lg text-gray-600">
                Manage and download your auction documents
              </p>
            </div>
            
            {/* Document Stats */}
            {auctionDocuments.length > 0 && (
              <div className="flex gap-3 sm:gap-4">
                <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                  <div className="text-2xl font-bold text-[var(--brand-primary)]">{auctionDocuments.length}</div>
                  <div className="text-xs text-gray-600 mt-0.5">Auctions</div>
                </div>
                <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                  <div className="text-2xl font-bold text-[var(--brand-primary)]">
                    {auctionDocuments.reduce((sum, a) => sum + a.documents.filter(isVisibleDocument).length, 0)}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">Documents</div>
                </div>
              </div>
            )}
          </div>

          {/* Offline indicator banner - Modern design */}
          {isOffline && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-900">
                    Offline Mode
                  </p>
                  <p className="text-sm text-amber-800 mt-1">
                    Showing cached documents. Downloads are disabled until you're back online.
                  </p>
                  {lastUpdated && (
                    <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Last updated: {new Date(lastUpdated).toLocaleString('en-NG', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Use virtualization only when count > 50 */}
        {auctionDocuments.length > 50 ? (
          <div className="h-[calc(100vh-280px)] min-h-[600px]">
            <VirtualizedList
              items={auctionDocuments}
              renderItem={(auction) => (
                <div className="pb-5">
                  <AuctionDocumentCard
                    auction={auction}
                    onViewAuction={() => router.push(`/vendor/auctions/${auction.auctionId}`)}
                    onDownload={handleDownload}
                    onViewReceipt={handleViewReceipt}
                    onDownloadReceipt={handleDownloadReceipt}
                    downloadingDocumentId={downloadingDocumentId}
                    isOffline={isOffline}
                  />
                </div>
              )}
              estimateSize={350}
              overscan={2}
            />
          </div>
        ) : (
          <div className="grid gap-5 sm:gap-6">
            {visibleAuctions.map((auction) => (
              <AuctionDocumentCard
                key={auction.auctionId}
                auction={auction}
                onViewAuction={() => router.push(`/vendor/auctions/${auction.auctionId}`)}
                onDownload={handleDownload}
                onViewReceipt={handleViewReceipt}
                onDownloadReceipt={handleDownloadReceipt}
                downloadingDocumentId={downloadingDocumentId}
                isOffline={isOffline}
              />
            ))}
            {hasMoreAuctions && (
              <div
                ref={loadMoreRef}
                className="py-6 text-center text-sm text-gray-500"
                aria-hidden
              >
                Loading more auctions…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// Auction Document Card Component
interface AuctionDocumentCardProps {
  auction: AuctionDocuments;
  onViewAuction: () => void;
  onDownload: (docId: string, title: string) => void;
  onViewReceipt: (receiptUrl: string) => void;
  onDownloadReceipt: (receiptUrl: string) => void;
  downloadingDocumentId: string | null;
  isOffline: boolean;
}

function AuctionDocumentCard({
  auction,
  onViewAuction,
  onDownload,
  onViewReceipt,
  onDownloadReceipt,
  downloadingDocumentId,
  isOffline,
}: AuctionDocumentCardProps) {
  const router = useAppRouter();

  const visibleDocuments = auction.documents.filter(isVisibleDocument);
  const signedCount = visibleDocuments.filter(d => d.status === 'signed').length;
  const pendingCount = visibleDocuments.filter(d => d.status === 'pending').length;
  const totalCount = visibleDocuments.length;

  return (
    <div 
      id={`auction-${auction.auctionId}`} 
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden scroll-mt-24 hover:shadow-md transition-shadow duration-300"
    >
      {/* Modern Auction Header with Gradient */}
      <div className="relative bg-gradient-to-br from-[var(--brand-primary)] via-[var(--brand-primary-hover)] to-[var(--brand-primary-active)] text-white p-6 sm:p-8">
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        </div>
        
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold truncate">{auction.assetName}</h2>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 text-white/90">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <span className="font-semibold">₦{auction.winningBid.toLocaleString()}</span>
                </div>
                <span className="text-white/60">•</span>
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{new Date(auction.closedAt).toLocaleDateString('en-NG', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={onViewAuction}
              className="px-5 py-2.5 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl font-medium transition-all duration-200 border border-white/30 hover:border-white/50 flex items-center gap-2 group"
            >
              <span>View Auction</span>
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1 bg-white/20 rounded-full h-2 overflow-hidden backdrop-blur-sm">
              <div 
                className="bg-white h-full rounded-full transition-all duration-500"
                style={{ width: `${totalCount > 0 ? (signedCount / totalCount) * 100 : 0}%` }}
              ></div>
            </div>
            <span className="text-sm font-medium text-white/90 whitespace-nowrap">
              {signedCount}/{totalCount} signed
            </span>
          </div>
        </div>
      </div>

      {/* Documents Grid - Modern Card Design */}
      <div className="p-6 sm:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {visibleDocuments.map((doc) => (
            <div
              key={doc.id}
              className={`group relative rounded-xl p-5 transition-all duration-300 border-2 ${
                doc.status === 'signed'
                  ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 hover:shadow-lg hover:shadow-emerald-100'
                  : doc.status === 'voided'
                  ? 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50 hover:shadow-lg hover:shadow-red-100'
                  : 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 hover:shadow-lg hover:shadow-amber-100'
              }`}
            >
              {/* Status Badge - Top Right */}
              <div className="absolute top-3 right-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-sm ${
                    doc.status === 'signed'
                      ? 'bg-emerald-600 text-white'
                      : doc.status === 'voided'
                      ? 'bg-red-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {doc.status.toUpperCase()}
                </span>
              </div>

              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                doc.status === 'signed'
                  ? 'bg-emerald-100'
                  : doc.status === 'voided'
                  ? 'bg-red-100'
                  : 'bg-amber-100'
              }`}>
                {doc.status === 'signed' ? (
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : doc.status === 'voided' ? (
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>

              {/* Document Title */}
              <h3 className="font-bold text-gray-900 mb-2 pr-16 leading-snug">
                {doc.title}
              </h3>
              
              {/* Signed Date */}
              {doc.signedAt && (
                <p className="text-sm text-gray-600 mb-4 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Signed {new Date(doc.signedAt).toLocaleDateString('en-NG', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              )}

              {/* Action Buttons */}
              {doc.status === 'signed' && doc.isReceipt && doc.receiptUrl && (
                <div className="flex flex-col gap-2">
                  <OfflineAwareButton
                    onClick={() => onDownloadReceipt(doc.receiptUrl!)}
                    className="w-full px-4 py-3 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-[var(--brand-shadow-color)] hover:shadow-lg hover:shadow-[var(--brand-shadow-color)] hover:-translate-y-0.5"
                    requiresOnline={true}
                    offlineTooltip="Receipt download requires an internet connection"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Receipt
                  </OfflineAwareButton>
                  <button
                    type="button"
                    onClick={() => onViewReceipt(doc.receiptUrl!)}
                    className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    View Receipt
                  </button>
                </div>
              )}

              {doc.status === 'signed' && !doc.isReceipt && (
                <OfflineAwareButton
                  onClick={() => onDownload(doc.id, doc.title)}
                  disabled={downloadingDocumentId === doc.id}
                  className="w-full px-4 py-3 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-[var(--brand-shadow-color)] hover:shadow-lg hover:shadow-[var(--brand-shadow-color)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-wait"
                  requiresOnline={true}
                  offlineTooltip="Document downloads require an internet connection"
                >
                  {downloadingDocumentId === doc.id ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Downloading…
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download PDF
                    </>
                  )}
                </OfflineAwareButton>
              )}

              {doc.status === 'pending' && (
                <button
                  onClick={() => router.push(`/vendor/auctions/${auction.auctionId}`)}
                  className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md shadow-amber-600/20 hover:shadow-lg hover:shadow-amber-600/30 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Sign Document
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
