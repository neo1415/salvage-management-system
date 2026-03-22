'use client';

/**
 * Document List Component
 * 
 * Lists documents with status badges and download buttons.
 * Groups documents by status.
 */

import { type ReleaseForm } from '@/lib/db/schema/release-forms';

interface DocumentListProps {
  documents: ReleaseForm[];
  auctionId: string;
  onDocumentClick?: (document: ReleaseForm) => void;
}

export function DocumentList({
  documents,
  auctionId,
  onDocumentClick,
}: DocumentListProps) {
  const getStatusBadge = (status: string) => {
    const badges = {
      pending: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        label: 'Pending Signature',
        icon: '⚠️',
      },
      signed: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        label: 'Signed',
        icon: '✅',
      },
      voided: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        label: 'Voided',
        icon: '❌',
      },
      expired: {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        label: 'Expired',
        icon: '⏰',
      },
    };

    const badge = badges[status as keyof typeof badges] || badges.pending;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <span className="mr-1">{badge.icon}</span>
        {badge.label}
      </span>
    );
  };

  const getDocumentIcon = (type: string) => {
    const icons = {
      bill_of_sale: '📄',
      liability_waiver: '⚖️',
      pickup_authorization: '🎫',
      salvage_certificate: '🚗',
    };

    return icons[type as keyof typeof icons] || '📄';
  };

  const handleDownload = async (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/auctions/${auctionId}/documents/${documentId}/download`);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      window.open(response.url, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download document');
    }
  };

  // Group documents by status
  const grouped = {
    pending: documents.filter((doc) => doc.status === 'pending'),
    signed: documents.filter((doc) => doc.status === 'signed'),
    voided: documents.filter((doc) => doc.status === 'voided'),
    expired: documents.filter((doc) => doc.status === 'expired'),
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
        <p className="mt-1 text-sm text-gray-500">
          Documents will appear here once generated.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Signature */}
      {grouped.pending.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <span className="mr-2">⚠️</span>
            Pending Signature ({grouped.pending.length})
          </h3>
          <div className="space-y-2">
            {grouped.pending.map((doc) => (
              <div
                key={doc.id}
                onClick={() => onDocumentClick?.(doc)}
                className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 hover:bg-yellow-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getDocumentIcon(doc.documentType)}</span>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{doc.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">
                        Generated {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {getStatusBadge(doc.status)}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDocumentClick?.(doc);
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-[#800020] rounded-md hover:bg-[#a00028] transition-colors"
                    >
                      Sign Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signed Documents */}
      {grouped.signed.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <span className="mr-2">✅</span>
            Signed Documents ({grouped.signed.length})
          </h3>
          <div className="space-y-2">
            {grouped.signed.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getDocumentIcon(doc.documentType)}</span>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{doc.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">
                        Signed {doc.signedAt ? new Date(doc.signedAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {getStatusBadge(doc.status)}
                    <button
                      onClick={(e) => handleDownload(doc.id, e)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voided Documents */}
      {grouped.voided.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
            <span className="mr-2">❌</span>
            Voided Documents ({grouped.voided.length})
          </h3>
          <div className="space-y-2">
            {grouped.voided.map((doc) => (
              <div
                key={doc.id}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 opacity-60"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getDocumentIcon(doc.documentType)}</span>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{doc.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">
                        Voided {doc.voidedAt ? new Date(doc.voidedAt).toLocaleDateString() : 'N/A'}
                      </p>
                      {doc.voidedReason && (
                        <p className="text-xs text-red-600 mt-1">
                          Reason: {doc.voidedReason}
                        </p>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(doc.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
