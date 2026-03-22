/**
 * Wallet Payment Confirmation Component
 * 
 * Displays wallet payment details and allows vendor to confirm payment from frozen funds.
 * 
 * Requirements: Escrow Wallet Payment Completion - Requirement 1
 * 
 * Features:
 * - Display payment source indicator (Escrow Wallet)
 * - Show frozen amount and payment details
 * - Confirmation modal with loading state
 * - Error handling and display
 * - Responsive design
 * - Accessibility support (ARIA labels, keyboard navigation)
 */

'use client';

import { useState } from 'react';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';

interface WalletPaymentConfirmationProps {
  payment: {
    id: string;
    amount: number;
    escrowStatus?: string;
  };
  walletBalance: {
    frozenAmount: number;
    availableBalance?: number;
  };
  onConfirm: () => Promise<void>;
}

export function WalletPaymentConfirmation({
  payment,
  walletBalance,
  onConfirm,
}: WalletPaymentConfirmationProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleConfirm = async () => {
    try {
      setError(null);
      setIsConfirming(true);
      await onConfirm();
      setSuccess(true);
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm payment');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6" role="region" aria-label="Wallet payment confirmation">
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Payment from Wallet</h2>

      {/* Payment Source Indicator */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4" role="status" aria-live="polite">
        <p className="text-blue-800 font-semibold text-sm sm:text-base">Payment Source: Escrow Wallet</p>
        <p className="text-xs sm:text-sm text-blue-700 mt-1">
          ₦{payment.amount.toLocaleString()} frozen in your wallet
        </p>
      </div>

      {/* Payment Details */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-sm sm:text-base text-gray-600">Amount to Pay:</span>
          <span className="text-sm sm:text-base font-semibold text-gray-900" data-testid="amount-to-pay">
            ₦{payment.amount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm sm:text-base text-gray-600">Frozen in Wallet:</span>
          <span className="text-sm sm:text-base font-semibold text-green-600" data-testid="frozen-amount">
            ₦{walletBalance.frozenAmount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3" role="alert" aria-live="assertive">
          <p className="text-sm text-green-800 font-semibold">
            Payment confirmed! Sign all documents to complete the process
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3" role="alert" aria-live="assertive">
          <p className="text-sm text-red-800" data-testid="error-message">{error}</p>
        </div>
      )}

      {/* Confirm Button */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        disabled={isConfirming || success}
        className="w-full bg-burgundy-900 text-white py-3 sm:py-4 px-4 sm:px-6 rounded-lg font-semibold hover:bg-burgundy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
        aria-label="Confirm payment from wallet"
        data-testid="confirm-button"
      >
        {isConfirming ? 'Confirming...' : success ? 'Payment Confirmed' : 'Confirm Payment from Wallet'}
      </button>

      {/* Helper Text */}
      <p className="text-xs sm:text-sm text-gray-600 mt-4 text-center">
        After confirmation, sign all documents to complete the process
      </p>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isConfirming) setIsModalOpen(false);
        }}
        onConfirm={() => {
          // ConfirmationModal expects sync handler; we wrap with async.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          void handleConfirm();
        }}
        title="Confirm Wallet Payment"
        message={`Confirm you want to pay ₦${payment.amount.toLocaleString()} from your wallet balance?`}
        confirmText="Confirm"
        cancelText="Cancel"
        type="warning"
        isLoading={isConfirming}
      />
    </div>
  );
}

