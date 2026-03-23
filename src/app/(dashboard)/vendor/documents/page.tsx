/**
 * Vendor Documents Page
 * 
 * Shows all documents from all auctions the vendor has won
 * Grouped by auction with status indicators
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/components/ui/toast';
import { VirtualizedList } from '@/components/ui/virtualized-list';

interface Document {
  id: string;
  auctionId: string;
  documentType: 'bill_of_sale' | 'liability_waiver' | 'pickup_authorization' | 'salvage_certificate';
  title: string;
  status: 'pending' | 'signed' | 'voided';
  signedAt: Date | null;
  createdAt: Date;
  pdfUrl: string;
}

interface AuctionDocuments {
  auctionId: string;
  assetName: string;
  winningBid: number;
  closedAt: Date;
  status: 'scheduled' | 'active' | 'extended' | 'closed' | 'cancelled';
  documents: Document[];
}

export default function VendorDocumentsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [auctionDocuments, setAuctionDocuments] = useState<AuctionDocuments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track which auctions have been processed to prevent duplicate calls
  const processedAuctionsRef = useRef<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch all won auctions and notifications in parallel
        const [auctionsResponse, notificationsResponse] = await Promise.all([
          fetch('/api/vendor/won-auctions'),
          fetch('/api/notifications?unreadOnly=false&limit=50'),
        ]);
        
        if (!auctionsResponse.ok) {
          throw new Error('Failed to fetch documents');
        }

        const data = await auctionsResponse.json();
        
        // Store notifications for retroactive processing check
        if (notificationsResponse.ok) {
          const notifData = await notificationsResponse.json();
          setNotifications(notifData.data?.notifications || []);
        }
        
        if (data.status === 'success' && data.data.auctions) {
          // Fetch documents for each auction
          const auctionsWithDocs = await Promise.all(
            data.data.auctions.map(async (auction: any) => {
              const docsResponse = await fetch(`/api/auctions/${auction.id}/documents`);
              const docsData = await docsResponse.json();
              
              return {
                auctionId: auction.id,
                assetName: auction.assetName || 'Salvage Item',
                winningBid: parseFloat(auction.currentBid || '0'),
                closedAt: new Date(auction.closedAt),
                status: auction.status,
                documents: docsData.status === 'success' ? docsData.data.documents : [],
              };
            })
          );

          setAuctionDocuments(auctionsWithDocs.filter(a => a.documents.length > 0));
        }
      } catch (err) {
        console.error('Error fetching documents:', err);
        setError(err instanceof Error ? err.message : 'Failed to load documents');
      } finally {
        setIsLoading(false);
      }
    };

    if (session?.user?.vendorId) {
      fetchDocuments();
    }
  }, [session]);

  // Automatic retroactive payment processing trigger
  useEffect(() => {
    const processRetroactivePayments = async () => {
      if (!auctionDocuments || auctionDocuments.length === 0) return;

      console.log(`🔍 Checking ${auctionDocuments.length} auctions for retroactive payment processing...`);

      for (const auction of auctionDocuments) {
        // Skip if already processed in this session
        if (processedAuctionsRef.current.has(auction.auctionId)) {
          console.log(`⏸️  Auction ${auction.auctionId} already processed in this session. Skipping.`);
          continue;
        }

        // Only process closed auctions
        if (auction.status !== 'closed') {
          console.log(`⏸️  Auction ${auction.auctionId} not closed (status: ${auction.status}). Skipping.`);
          continue;
        }

        // Check if all documents signed
        const docs = auction.documents || [];
        const allSigned = docs.length === 3 && docs.every(d => d.status === 'signed');
        if (!allSigned) {
          console.log(`⏸️  Not all documents signed for auction ${auction.auctionId}. Skipping.`);
          continue;
        }

        // Check if PAYMENT_UNLOCKED notification exists
        const hasNotification = notifications?.some(
          n => n.type === 'PAYMENT_UNLOCKED' && n.data?.auctionId === auction.auctionId
        );
        if (hasNotification) {
          console.log(`⏸️  PAYMENT_UNLOCKED notification already exists for auction ${auction.auctionId}. Skipping.`);
          continue;
        }

        // Mark as processed to prevent duplicate calls
        processedAuctionsRef.current.add(auction.auctionId);

        // Trigger retroactive payment processing
        try {
          console.log(`🔄 Triggering retroactive payment processing for auction ${auction.auctionId}...`);
          const response = await fetch(`/api/auctions/${auction.auctionId}/process-payment`, {
            method: 'POST',
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && !data.alreadyProcessed) {
              toast.success(
                'Payment Processed',
                `Payment for ${auction.assetName} has been processed. Check your notifications.`
              );
              console.log(`✅ Retroactive payment processing completed for auction ${auction.auctionId}`);
            } else if (data.alreadyProcessed) {
              console.log(`⏸️  Payment already processed for auction ${auction.auctionId}`);
            }
          } else {
            const errorData = await response.json();
            console.error(`❌ Failed to process payment for auction ${auction.auctionId}:`, errorData.error);
          }
        } catch (error) {
          console.error(`❌ Failed to process payment for auction ${auction.auctionId}:`, error);
        }
      }
    };

    processRetroactivePayments();
  }, [auctionDocuments, notifications, toast]);

  const handleDownload = async (documentId: string, title: string) => {
    try {
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
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Documents</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (auctionDocuments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">My Documents</h1>
          
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg className="w-24 h-24 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Documents Yet</h2>
            <p className="text-gray-600 mb-6">
              Documents will appear here after you win an auction
            </p>
            <button
              onClick={() => router.push('/vendor/auctions')}
              className="px-6 py-3 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors"
            >
              Browse Auctions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Documents</h1>
          <p className="text-gray-600">
            View and download documents from your won auctions
          </p>
        </div>

        {/* Use virtualization only when count > 50 */}
        {auctionDocuments.length > 50 ? (
          <div className="h-[calc(100vh-250px)] min-h-[600px]">
            <VirtualizedList
              items={auctionDocuments}
              renderItem={(auction) => (
                <div className="pb-6">
                  <AuctionDocumentCard
                    auction={auction}
                    onViewAuction={() => router.push(`/vendor/auctions/${auction.auctionId}`)}
                    onDownload={handleDownload}
                  />
                </div>
              )}
              estimateSize={350}
              overscan={2}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {auctionDocuments.map((auction) => (
              <AuctionDocumentCard
                key={auction.auctionId}
                auction={auction}
                onViewAuction={() => router.push(`/vendor/auctions/${auction.auctionId}`)}
                onDownload={handleDownload}
              />
            ))}
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
}

function AuctionDocumentCard({ auction, onViewAuction, onDownload }: AuctionDocumentCardProps) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Auction Header */}
      <div className="bg-gradient-to-r from-[#800020] to-[#a00028] text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">{auction.assetName}</h2>
            <p className="text-white/90">
              Won for ₦{auction.winningBid.toLocaleString()} • {new Date(auction.closedAt).toLocaleDateString('en-NG')}
            </p>
          </div>
          <button
            onClick={onViewAuction}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors"
          >
            View Auction
          </button>
        </div>
      </div>

      {/* Documents List */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {auction.documents.map((doc) => (
            <div
              key={doc.id}
              className={`border-2 rounded-lg p-4 ${
                doc.status === 'signed'
                  ? 'border-green-300 bg-green-50'
                  : doc.status === 'voided'
                  ? 'border-red-300 bg-red-50'
                  : 'border-yellow-300 bg-yellow-50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {doc.status === 'signed' ? (
                    <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : doc.status === 'voided' ? (
                    <svg className="w-6 h-6 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    doc.status === 'signed'
                      ? 'bg-green-600 text-white'
                      : doc.status === 'voided'
                      ? 'bg-red-600 text-white'
                      : 'bg-yellow-600 text-white'
                  }`}
                >
                  {doc.status.toUpperCase()}
                </span>
              </div>

              <h3 className="font-semibold text-gray-900 mb-2">
                {auction.assetName} - {doc.title}
              </h3>
              
              {doc.signedAt && (
                <p className="text-sm text-gray-600 mb-3">
                  Signed: {new Date(doc.signedAt).toLocaleDateString('en-NG')}
                </p>
              )}

              {doc.status === 'signed' && (
                <button
                  onClick={() => onDownload(doc.id, doc.title)}
                  className="w-full px-4 py-2 bg-[#800020] hover:bg-[#600018] text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </button>
              )}

              {doc.status === 'pending' && (
                <button
                  onClick={() => router.push(`/vendor/auctions/${auction.auctionId}`)}
                  className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md font-medium transition-colors"
                >
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
