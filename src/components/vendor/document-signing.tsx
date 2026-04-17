/**
 * Document Signing Workflow Component
 * 
 * RELATIONSHIP TO EXISTING COMPONENTS:
 * - This component provides the FULL document signing workflow with deadline management
 * - It is distinct from `src/components/documents/document-signing-progress.tsx` which is a read-only progress indicator
 * - This component includes: real-time countdown, urgent warnings, preview/download/sign actions
 * - The progress component only shows: progress bar, status badges, success banner
 * 
 * WHY SEPARATE COMPONENT:
 * - Requirements 8.1, 8.2, 8.3 need interactive signing workflow with deadline tracking
 * - Existing progress component is read-only and used in escrow payment flow
 * - Deposit system requires vendor-facing workflow with time-sensitive actions
 * 
 * FUTURE REFACTORING:
 * - Consider using document-signing-progress.tsx internally for progress display
 * - Extract countdown timer to shared utility
 */

'use client';

import { useState, useEffect } from 'react';
import { FileText, Clock, CheckCircle2, AlertTriangle, Download, Eye } from 'lucide-react';

interface Document {
  id: string;
  type: 'bill_of_sale' | 'liability_waiver';
  status: 'pending' | 'signed';
  signedAt?: string;
  url: string;
}

interface DocumentSigningProps {
  auctionId: string;
  validityDeadline: string;
  onAllSigned?: () => void;
  onDocumentSigned?: () => void; // NEW: Callback after each document is signed
  className?: string;
}

export function DocumentSigning({
  auctionId,
  validityDeadline,
  onAllSigned,
  onDocumentSigned, // NEW: Callback after each document is signed
  className = '',
}: DocumentSigningProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [auctionId]);

  useEffect(() => {
    const updateCountdown = () => {
      const deadline = new Date(validityDeadline);
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Expired');
        setIsExpired(true);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeRemaining(`${days}d ${hours % 24}h remaining`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m remaining`);
      } else {
        setTimeRemaining(`${minutes}m ${seconds}s remaining`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [validityDeadline]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/auctions/${auctionId}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async (documentId: string) => {
    try {
      setSigning(documentId);
      const response = await fetch(`/api/auctions/${auctionId}/documents/${documentId}/sign`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchDocuments();
        
        // NEW: Trigger parent refresh after signing
        if (onDocumentSigned) {
          onDocumentSigned();
        }
        
        // Check if all documents are signed
        const updatedDocs = await response.json();
        const allSigned = updatedDocs.documents.every((doc: Document) => doc.status === 'signed');
        if (allSigned && onAllSigned) {
          onAllSigned();
        }
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to sign document');
      }
    } catch (error) {
      console.error('Failed to sign document:', error);
      alert('Failed to sign document. Please try again.');
    } finally {
      setSigning(null);
    }
  };

  const handlePreview = (documentUrl: string) => {
    window.open(documentUrl, '_blank');
  };

  const handleDownload = async (documentId: string, documentType: string) => {
    try {
      const response = await fetch(`/api/auctions/${auctionId}/documents/${documentId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${documentType}_${auctionId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download document:', error);
    }
  };

  const getDocumentTitle = (type: string) => {
    switch (type) {
      case 'bill_of_sale':
        return 'Bill of Sale';
      case 'liability_waiver':
        return 'Liability Waiver';
      default:
        return type;
    }
  };

  const getDocumentDescription = (type: string) => {
    switch (type) {
      case 'bill_of_sale':
        return 'Legal document transferring asset ownership from platform to you';
      case 'liability_waiver':
        return 'Document releasing platform from post-sale liability';
      default:
        return '';
    }
  };

  const allSigned = documents.every((doc) => doc.status === 'signed');
  const urgentDeadline = !isExpired && timeRemaining.includes('h') && parseInt(timeRemaining) <= 6;

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      {/* Header with Countdown - RESPONSIVE */}
      <div className={`p-4 sm:p-6 border-b ${isExpired ? 'bg-red-50 border-red-200' : urgentDeadline ? 'bg-orange-50 border-orange-200' : 'border-gray-200'}`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isExpired ? 'bg-red-100' : urgentDeadline ? 'bg-orange-100' : 'bg-[#800020]'}`}>
              {isExpired ? (
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
              ) : (
                <FileText className={`w-4 h-4 sm:w-5 sm:h-5 ${urgentDeadline ? 'text-orange-600' : 'text-white'}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Document Signing</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Sign all required documents to proceed to payment
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg self-start ${isExpired ? 'bg-red-100' : urgentDeadline ? 'bg-orange-100' : 'bg-gray-100'}`}>
            <Clock className={`w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 ${isExpired ? 'text-red-600' : urgentDeadline ? 'text-orange-600' : 'text-gray-600'}`} />
            <span className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${isExpired ? 'text-red-600' : urgentDeadline ? 'text-orange-600' : 'text-gray-900'}`}>
              {timeRemaining}
            </span>
          </div>
        </div>

        {isExpired && (
          <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-red-100 border border-red-200 rounded-lg">
            <p className="text-xs sm:text-sm text-red-800 font-medium">
              ⚠️ Document signing deadline has expired. Please contact support for assistance.
            </p>
          </div>
        )}

        {urgentDeadline && !isExpired && (
          <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-orange-100 border border-orange-200 rounded-lg">
            <p className="text-xs sm:text-sm text-orange-800 font-medium">
              ⚠️ Urgent: Less than 6 hours remaining to sign documents!
            </p>
          </div>
        )}
      </div>

      {/* Documents List - RESPONSIVE */}
      <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
        {documents.map((document) => (
          <div
            key={document.id}
            className={`border rounded-lg p-3 sm:p-4 ${document.status === 'signed' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}
          >
            <div className="flex flex-col gap-3">
              {/* Document Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex-1">
                    {getDocumentTitle(document.type)}
                  </h3>
                  {document.status === 'signed' && (
                    <span className="inline-flex items-center gap-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="hidden xs:inline">Signed</span>
                      <span className="xs:hidden">✓</span>
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mb-2">
                  {getDocumentDescription(document.type)}
                </p>
                {document.signedAt && (
                  <p className="text-xs text-green-700">
                    Signed on {new Date(document.signedAt).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Action Buttons - RESPONSIVE GRID */}
              <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
                <button
                  onClick={() => handlePreview(document.url)}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => handleDownload(document.id, document.type)}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Download</span>
                </button>
                {document.status === 'pending' && !isExpired && (
                  <button
                    onClick={() => handleSign(document.id)}
                    disabled={signing === document.id}
                    className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#800020] rounded-lg hover:bg-[#600018] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {signing === document.id ? (
                      <>
                        <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Signing...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>Sign Now</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer - RESPONSIVE */}
      <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
        {allSigned ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="text-sm sm:text-base font-semibold">All documents signed successfully!</span>
            </div>
            <button
              onClick={onAllSigned}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors text-sm sm:text-base"
            >
              Proceed to Payment
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-gray-600">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
            <span className="text-xs sm:text-sm">
              Please sign all documents to proceed to payment
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
