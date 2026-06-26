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

export type PickupEvidenceResolutionStatus =
  | 'confirmed_no_adjustment'
  | 'external_reimbursement_required'
  | 'external_reimbursement_completed'
  | 'price_adjustment_recorded';

export interface PickupConfirmationSubmitInput {
  notes: string;
  resolutionStatus?: PickupEvidenceResolutionStatus;
  adjustmentAmount?: number;
  reimbursementMethod?: string;
}

interface AdminPickupConfirmationProps {
  auctionId: string;
  adminId: string;
  vendorPickupStatus: {
    confirmed: boolean;
    confirmedAt: string | null;
  };
  evidenceNeedsReview?: boolean;
  onConfirm: (input: PickupConfirmationSubmitInput) => Promise<void>;
}

export function AdminPickupConfirmation({
  auctionId,
  adminId,
  vendorPickupStatus,
  evidenceNeedsReview = false,
  onConfirm,
}: AdminPickupConfirmationProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState<PickupEvidenceResolutionStatus>('confirmed_no_adjustment');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [reimbursementMethod, setReimbursementMethod] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleConfirm = async () => {
    try {
      setError(null);
      setIsConfirming(true);
      const parsedAdjustmentAmount = adjustmentAmount.trim() ? Number(adjustmentAmount) : undefined;
      await onConfirm({
        notes: notes.trim(),
        resolutionStatus: evidenceNeedsReview ? resolutionStatus : undefined,
        adjustmentAmount: Number.isFinite(parsedAdjustmentAmount) ? parsedAdjustmentAmount : undefined,
        reimbursementMethod: evidenceNeedsReview ? reimbursementMethod.trim() || undefined : undefined,
      });
      setSuccess(true);
      setIsModalOpen(false);
      setNotes('');
      setAdjustmentAmount('');
      setReimbursementMethod('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm pickup');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleOpenModal = () => {
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
      {!success && (
        <div
          className={`rounded-lg border p-3 sm:p-4 mb-4 ${
            evidenceNeedsReview ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
          }`}
          role="status"
          aria-live="polite"
        >
          <p className={`font-semibold text-sm sm:text-base ${evidenceNeedsReview ? 'text-amber-800' : 'text-blue-800'}`}>
            {evidenceNeedsReview ? 'Evidence Review Required' : 'Verify Pickup'}
          </p>
          <p className={`text-xs sm:text-sm mt-1 ${evidenceNeedsReview ? 'text-amber-700' : 'text-blue-700'}`}>
            {evidenceNeedsReview
              ? 'Review the pickup evidence comparison and add notes before completing this transaction.'
              : "Confirm the vendor's pickup code and handoff details before completing the transaction."}
          </p>
        </div>
      )}

      {/* Notes Field */}
      <div className="mb-6">
        <label htmlFor="admin-notes" className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
          Admin Notes {evidenceNeedsReview ? '(optional for evidence review)' : '(Optional)'}
        </label>
        <textarea
          id="admin-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isConfirming || success}
          placeholder={
            evidenceNeedsReview
              ? 'Record how you reviewed the evidence and why pickup should be confirmed.'
              : 'Add any observations about the pickup (e.g., item condition, vendor behavior)'
          }
          rows={4}
          className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          aria-label="Admin notes"
          data-testid="admin-notes-input"
        />
        <p className="text-xs text-gray-500 mt-1">
          {notes.length}/500 characters
        </p>
      </div>

      {evidenceNeedsReview && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:p-4">
          <p className="text-sm font-semibold text-amber-900">Discrepancy Resolution</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="resolution-status" className="block text-sm font-medium text-amber-900">
                Outcome
              </label>
              <select
                id="resolution-status"
                value={resolutionStatus}
                onChange={(event) => setResolutionStatus(event.target.value as PickupEvidenceResolutionStatus)}
                disabled={isConfirming || success}
                className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
              >
                <option value="confirmed_no_adjustment">Reviewed - no adjustment</option>
                <option value="external_reimbursement_required">External reimbursement required</option>
                <option value="external_reimbursement_completed">External reimbursement completed</option>
                <option value="price_adjustment_recorded">Price adjustment recorded</option>
              </select>
            </div>
            <div>
              <label htmlFor="adjustment-amount" className="block text-sm font-medium text-amber-900">
                Adjustment Amount
              </label>
              <input
                id="adjustment-amount"
                type="number"
                min="0"
                step="0.01"
                value={adjustmentAmount}
                onChange={(event) => setAdjustmentAmount(event.target.value)}
                disabled={isConfirming || success || resolutionStatus === 'confirmed_no_adjustment'}
                placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)] disabled:opacity-60"
              />
            </div>
          </div>
          <label htmlFor="reimbursement-method" className="mt-3 block text-sm font-medium text-amber-900">
            Reimbursement / Adjustment Method
          </label>
          <input
            id="reimbursement-method"
            value={reimbursementMethod}
            onChange={(event) => setReimbursementMethod(event.target.value)}
            disabled={isConfirming || success || resolutionStatus === 'confirmed_no_adjustment'}
            placeholder="e.g., bank transfer outside app, wallet credit, credit note"
            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)] disabled:opacity-60"
          />
        </div>
      )}

      {/* Confirm Button */}
      <button
        type="button"
        onClick={handleOpenModal}
        disabled={isConfirming || success}
        className="w-full bg-[var(--brand-primary)] text-white py-3 sm:py-4 px-4 sm:px-6 rounded-lg font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
        aria-label="Confirm pickup"
        data-testid="confirm-button"
      >
        {isConfirming ? 'Confirming...' : success ? 'Pickup Confirmed' : 'Confirm Pickup'}
      </button>

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
        message={`Confirm that the vendor has collected the item? This will mark the transaction as complete${evidenceNeedsReview ? ' after saving your evidence review and resolution details' : notes.trim() ? ' and save your notes' : ''}.`}
        confirmText="Confirm"
        cancelText="Cancel"
        type="warning"
        isLoading={isConfirming}
      />
    </div>
  );
}
