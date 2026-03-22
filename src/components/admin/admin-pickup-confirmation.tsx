/**
 * Admin Pickup Confirmation Component
 * 
 * Allows Admin/Manager to confirm that vendor has collected the salvage item.
 * 
 * Requirements: Escrow Wallet Payment Completion - Requirement 5
 * 
 * Features:
 * - Display vendor pickup confirmation status
 * - Notes field for admin observations
 * - "Confirm Pickup" button with loading state
 * - Success message after confirmation
 * - Error handling and display
 * - Responsive design (mobile-first)
 * - Accessibility support (ARIA labels, keyboard navigation)
 */

'use client';

import { useState } from 'react';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';

interface AdminPickupConfirmationProps {
  auctionId: string;
  adminId: string;
  vendorPickupStatus: {
    confirmed: boolean;
    confirmedAt: string | null;
  };
  onConfirm: (notes: string) => Promise<void>;
}

export function AdminPickupConfirmation({
  auctionId,
  adminId,
  vendorPickupStatus,
  onConfirm,
}: AdminPickupConfirmationProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleConfirm = async () => {
    try {
      setError(null);
      setIsConfirming(true);
      await onConfirm(notes.trim());
      setSuccess(true);
      setIsModalOpen(false);
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm pickup');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleOpenModal = () => {
    if (!vendorPickupStatus.confirmed) {
      setError('Vendor must confirm pickup before admin confirmation');
      return;
    }
    setIsModalOpen(true);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6" role="region" aria-label="Admin pickup confirmation">
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Confirm Vendor Pickup</h2>

      {/* Vendor Pickup Status */}
      <div className={`border rounded-lg p-3 sm:p-4 mb-4 ${
        vendorPickupStatus.confirmed 
          ? 'bg-green-50 border-green-200' 
          : 'bg-yellow-50 border-yellow-200'
      }`} role="status" aria-live="polite">
        <div className="flex items-center justify-between">
          <div>
            <p className={`font-semibold text-sm sm:text-base ${
              vendorPickupStatus.confirmed ? 'text-green-800' : 'text-yellow-800'
            }`}>
              Vendor Pickup Status
            </p>
            <p className={`text-xs sm:text-sm mt-1 ${
              vendorPickupStatus.confirmed ? 'text-green-700' : 'text-yellow-700'
            }`}>
              {vendorPickupStatus.confirmed 
                ? `Confirmed on ${new Date(vendorPickupStatus.confirmedAt!).toLocaleDateString()}`
                : 'Not confirmed yet'}
            </p>
          </div>
          <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
            vendorPickupStatus.confirmed 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`} data-testid="vendor-status-badge">
            {vendorPickupStatus.confirmed ? '✓ Confirmed' : 'Pending'}
          </span>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3" role="alert" aria-live="assertive">
          <p className="text-sm text-green-800 font-semibold">
            ✓ Pickup confirmed successfully! Transaction is now complete.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3" role="alert" aria-live="assertive">
          <p className="text-sm text-red-800" data-testid="error-message">{error}</p>
        </div>
      )}

      {/* Instructions */}
      {!success && vendorPickupStatus.confirmed && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4" role="status" aria-live="polite">
          <p className="text-blue-800 font-semibold text-sm sm:text-base">Verify Pickup</p>
          <p className="text-xs sm:text-sm text-blue-700 mt-1">
            Vendor has confirmed pickup. Add any observations and confirm to complete the transaction.
          </p>
        </div>
      )}

      {/* Notes Field */}
      <div className="mb-6">
        <label htmlFor="admin-notes" className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
          Admin Notes (Optional)
        </label>
        <textarea
          id="admin-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isConfirming || success || !vendorPickupStatus.confirmed}
          placeholder="Add any observations about the pickup (e.g., item condition, vendor behavior)"
          rows={4}
          className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-burgundy-900 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          aria-label="Admin notes"
          data-testid="admin-notes-input"
        />
        <p className="text-xs text-gray-500 mt-1">
          {notes.length}/500 characters
        </p>
      </div>

      {/* Confirm Button */}
      <button
        type="button"
        onClick={handleOpenModal}
        disabled={isConfirming || success || !vendorPickupStatus.confirmed}
        className="w-full bg-burgundy-900 text-white py-3 sm:py-4 px-4 sm:px-6 rounded-lg font-semibold hover:bg-burgundy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
        aria-label="Confirm pickup"
        data-testid="confirm-button"
      >
        {isConfirming ? 'Confirming...' : success ? 'Pickup Confirmed' : 'Confirm Pickup'}
      </button>

      {/* Helper Text */}
      {!vendorPickupStatus.confirmed && (
        <p className="text-xs sm:text-sm text-gray-600 mt-4 text-center">
          Waiting for vendor to confirm pickup first
        </p>
      )}

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
        title="Confirm Pickup"
        message={`Confirm that the vendor has collected the item? This will mark the transaction as complete${notes.trim() ? ' and save your notes' : ''}.`}
        confirmText="Confirm"
        cancelText="Cancel"
        type="warning"
        isLoading={isConfirming}
      />
    </div>
  );
}
