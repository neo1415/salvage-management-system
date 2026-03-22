/**
 * Escrow Payment Details Component
 * 
 * Displays escrow wallet payment details for Finance Officers with manual release functionality.
 * 
 * Requirements: Escrow Wallet Payment Completion - Requirement 4
 * 
 * Features:
 * - Display payment amount and escrow status (Frozen/Released/Failed)
 * - Show document signing progress (X/3)
 * - Display wallet balance and frozen amount
 * - Manual release funds button (when all documents signed)
 * - Error handling and display
 * - Responsive design (mobile-first)
 * - Accessibility support (ARIA labels, keyboard navigation)
 */

'use client';

import { useState } from 'react';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';

interface EscrowPaymentDetailsProps {
  payment: {
    id: string;
    amount: number;
    escrowStatus: 'frozen' | 'released' | 'failed';
    status: 'pending' | 'verified' | 'rejected' | 'overdue';
  };
  documentProgress: {
    signedDocuments: number;
    totalDocuments: number;
  };
  walletBalance: {
    balance: number;
    frozenAmount: number;
  };
  onManualRelease: () => Promise<void>;
}

export function EscrowPaymentDetails({
  payment,
  documentProgress,
  walletBalance,
  onManualRelease,
}: EscrowPaymentDetailsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleManualRelease = async () => {
    try {
      setError(null);
      setIsReleasing(true);
      await onManualRelease();
      setSuccess(true);
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to release funds');
    } finally {
      setIsReleasing(false);
    }
  };

  const canManualRelease =
    payment.escrowStatus === 'frozen' &&
    payment.status === 'pending' &&
    documentProgress.signedDocuments === documentProgress.totalDocuments;

  const getEscrowStatusClasses = (status: string) => {
    switch (status) {
      case 'released':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'frozen':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getEscrowStatusLabel = (status: string) => {
    switch (status) {
      case 'released':
        return 'Released';
      case 'failed':
        return 'Failed';
      case 'frozen':
      default:
        return 'Frozen';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6" role="region" aria-label="Escrow payment details">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Escrow Wallet Payment</h3>

      {/* Success Message */}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3" role="alert" aria-live="assertive">
          <p className="text-sm text-green-800 font-semibold">
            ✓ Funds released successfully!
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3" role="alert" aria-live="assertive">
          <p className="text-sm text-red-800" data-testid="error-message">{error}</p>
        </div>
      )}

      {/* Payment Details */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm sm:text-base text-gray-600">Payment Amount:</span>
          <span className="text-sm sm:text-base font-semibold text-gray-900" data-testid="payment-amount">
            ₦{payment.amount.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm sm:text-base text-gray-600">Escrow Status:</span>
          <span
            className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getEscrowStatusClasses(payment.escrowStatus)}`}
            data-testid="escrow-status"
            role="status"
            aria-label={`Escrow status: ${getEscrowStatusLabel(payment.escrowStatus)}`}
          >
            {getEscrowStatusLabel(payment.escrowStatus)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm sm:text-base text-gray-600">Document Progress:</span>
          <span className="text-sm sm:text-base font-semibold text-gray-900" data-testid="document-progress">
            {documentProgress.signedDocuments}/{documentProgress.totalDocuments} Signed
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm sm:text-base text-gray-600">Wallet Balance:</span>
          <span className="text-sm sm:text-base font-semibold text-gray-900" data-testid="wallet-balance">
            ₦{walletBalance.balance.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm sm:text-base text-gray-600">Frozen Amount:</span>
          <span className="text-sm sm:text-base font-semibold text-green-600" data-testid="frozen-amount">
            ₦{walletBalance.frozenAmount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Manual Release Button */}
      {canManualRelease && (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          disabled={isReleasing || success}
          className="w-full mt-6 bg-burgundy-900 text-white py-3 px-4 rounded-lg font-semibold hover:bg-burgundy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          aria-label="Manual release funds"
          data-testid="manual-release-button"
        >
          {isReleasing ? 'Releasing...' : 'Manual Release Funds'}
        </button>
      )}

      {/* Failed Payment Alert */}
      {payment.escrowStatus === 'failed' && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4" role="alert" aria-live="polite">
          <p className="text-xs sm:text-sm text-red-800">
            Automatic fund release failed. Use manual release to retry.
          </p>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isReleasing) setIsModalOpen(false);
        }}
        onConfirm={() => {
          // ConfirmationModal expects sync handler; we wrap with async.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          void handleManualRelease();
        }}
        title="Manual Release Funds"
        message={`Manually release ₦${payment.amount.toLocaleString()} from vendor wallet?`}
        confirmText="Release Funds"
        cancelText="Cancel"
        type="warning"
        isLoading={isReleasing}
      />
    </div>
  );
}
