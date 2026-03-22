/**
 * Document Signing Progress Component
 * 
 * Displays document signing progress with status badges and success banner.
 * 
 * Requirements: Escrow Wallet Payment Completion - Requirement 2
 * 
 * Features:
 * - Progress bar showing X/3 documents signed with percentage
 * - Document list with status badges (Pending/Signed/Voided)
 * - Success banner when all documents are signed
 * - Responsive design (mobile-first)
 * - Accessibility support (ARIA labels, keyboard navigation)
 * - Color-coded status indicators
 */

'use client';

interface Document {
  id: string;
  type: 'bill_of_sale' | 'liability_waiver' | 'pickup_authorization';
  status: 'pending' | 'signed' | 'voided';
  title: string;
  signedAt?: string | null;
}

interface DocumentSigningProgressProps {
  progress: {
    totalDocuments: number;
    signedDocuments: number;
    progress: number; // 0-100
    allSigned: boolean;
  };
  documents: Document[];
}

export function DocumentSigningProgress({ progress, documents }: DocumentSigningProgressProps) {
  const { totalDocuments, signedDocuments, progress: pct, allSigned } = progress;

  const getStatusBadgeClasses = (status: Document['status']) => {
    switch (status) {
      case 'signed':
        return 'bg-green-100 text-green-800';
      case 'voided':
        return 'bg-red-100 text-red-800';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusIcon = (status: Document['status']) => {
    switch (status) {
      case 'signed':
        return '✓';
      case 'voided':
        return '✗';
      case 'pending':
      default:
        return '○';
    }
  };

  const getStatusIconClasses = (status: Document['status']) => {
    switch (status) {
      case 'signed':
        return 'bg-green-100 text-green-800';
      case 'voided':
        return 'bg-red-100 text-red-800';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusLabel = (status: Document['status']) => {
    switch (status) {
      case 'signed':
        return 'Signed';
      case 'voided':
        return 'Voided';
      case 'pending':
      default:
        return 'Pending';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6" role="region" aria-label="Document signing progress">
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Document Signing Progress</h2>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm sm:text-base font-medium text-gray-700" data-testid="progress-text">
            {signedDocuments}/{totalDocuments} Documents Signed
          </span>
          <span className="text-sm sm:text-base font-medium text-gray-700" data-testid="progress-percentage">
            {pct}%
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${signedDocuments} of ${totalDocuments} documents signed`}>
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              allSigned ? 'bg-green-500' : 'bg-burgundy-900'
            }`}
            style={{ width: `${pct}%` }}
            data-testid="progress-bar"
          />
        </div>
      </div>

      {/* Success Banner */}
      {allSigned && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mb-4" role="alert" aria-live="assertive" data-testid="success-banner">
          <p className="text-sm sm:text-base text-green-800 font-semibold">
            ✓ All documents signed! Payment is being processed.
          </p>
        </div>
      )}

      {/* Document List */}
      <div className="space-y-3" role="list" aria-label="Document list">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            role="listitem"
            data-testid={`document-${doc.type}`}
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getStatusIconClasses(doc.status)}`}
                aria-hidden="true"
              >
                <span className="text-sm font-semibold">{getStatusIcon(doc.status)}</span>
              </div>
              <span className="font-medium text-gray-900 text-sm sm:text-base truncate">{doc.title}</span>
            </div>
            <span 
              className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${getStatusBadgeClasses(doc.status)}`}
              data-testid={`status-badge-${doc.type}`}
              role="status"
              aria-label={`${doc.title} status: ${getStatusLabel(doc.status)}`}
            >
              {getStatusLabel(doc.status)}
            </span>
          </div>
        ))}
      </div>

      {/* Helper Text */}
      {!allSigned && (
        <p className="text-xs sm:text-sm text-gray-600 mt-4 text-center">
          Sign all documents to complete the payment process
        </p>
      )}
    </div>
  );
}

