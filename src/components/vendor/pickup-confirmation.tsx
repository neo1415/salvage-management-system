/**
 * Pickup Confirmation Component
 * 
 * Allows vendor to confirm item pickup by entering the pickup authorization code.
 * 
 * Requirements: Escrow Wallet Payment Completion - Requirement 5
 * 
 * Features:
 * - Pickup authorization code input field
 * - "Confirm Pickup" button with loading state
 * - Code validation (format and correctness)
 * - Success message after confirmation
 * - Error handling and display
 * - Responsive design (mobile-first)
 * - Accessibility support (ARIA labels, keyboard navigation)
 */

'use client';

import { useState } from 'react';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';

interface PickupConfirmationProps {
  auctionId: string;
  vendorId: string;
  onConfirm: (pickupAuthCode: string) => Promise<void>;
}

export function PickupConfirmation({
  auctionId,
  vendorId,
  onConfirm,
}: PickupConfirmationProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pickupCode, setPickupCode] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const validateCode = (code: string): boolean => {
    // Pickup authorization codes are typically 6-8 alphanumeric characters
    const trimmedCode = code.trim();
    
    if (trimmedCode.length === 0) {
      setCodeError('Pickup code is required');
      return false;
    }
    
    if (trimmedCode.length < 6) {
      setCodeError('Pickup code must be at least 6 characters');
      return false;
    }
    
    if (!/^[A-Z0-9]+$/i.test(trimmedCode)) {
      setCodeError('Pickup code must contain only letters and numbers');
      return false;
    }
    
    setCodeError(null);
    return true;
  };

  const handleCodeChange = (value: string) => {
    setPickupCode(value.toUpperCase());
    setCodeError(null);
    setError(null);
  };

  const handleOpenModal = () => {
    if (!validateCode(pickupCode)) {
      return;
    }
    setIsModalOpen(true);
  };

  const handleConfirm = async () => {
    try {
      setError(null);
      setIsConfirming(true);
      await onConfirm(pickupCode.trim());
      setSuccess(true);
      setIsModalOpen(false);
      setPickupCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm pickup');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6" role="region" aria-label="Pickup confirmation">
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Confirm Pickup</h2>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4" role="status" aria-live="polite">
        <p className="text-blue-800 font-semibold text-sm sm:text-base">Ready to collect your item?</p>
        <p className="text-xs sm:text-sm text-blue-700 mt-1">
          Enter the pickup authorization code you received via SMS/email to confirm collection.
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3" role="alert" aria-live="assertive">
          <p className="text-sm text-green-800 font-semibold">
            ✓ Pickup confirmed successfully! Admin will verify shortly.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3" role="alert" aria-live="assertive">
          <p className="text-sm text-red-800" data-testid="error-message">{error}</p>
        </div>
      )}

      {/* Pickup Code Input */}
      <div className="mb-6">
        <label htmlFor="pickup-code" className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
          Pickup Authorization Code
        </label>
        <input
          id="pickup-code"
          type="text"
          value={pickupCode}
          onChange={(e) => handleCodeChange(e.target.value)}
          disabled={isConfirming || success}
          placeholder="Enter code (e.g., ABC123XYZ)"
          className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg text-sm sm:text-base font-mono uppercase focus:outline-none focus:ring-2 focus:ring-burgundy-900 disabled:opacity-50 disabled:cursor-not-allowed ${
            codeError ? 'border-red-500' : 'border-gray-300'
          }`}
          aria-label="Pickup authorization code"
          aria-invalid={!!codeError}
          aria-describedby={codeError ? 'code-error' : undefined}
          data-testid="pickup-code-input"
        />
        {codeError && (
          <p id="code-error" className="text-xs sm:text-sm text-red-600 mt-1" data-testid="code-error">
            {codeError}
          </p>
        )}
      </div>

      {/* Confirm Button */}
      <button
        type="button"
        onClick={handleOpenModal}
        disabled={isConfirming || success || !pickupCode.trim()}
        className="w-full bg-burgundy-900 text-white py-3 sm:py-4 px-4 sm:px-6 rounded-lg font-semibold hover:bg-burgundy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
        aria-label="Confirm pickup"
        data-testid="confirm-button"
      >
        {isConfirming ? 'Confirming...' : success ? 'Pickup Confirmed' : 'Confirm Pickup'}
      </button>

      {/* Helper Text */}
      <p className="text-xs sm:text-sm text-gray-600 mt-4 text-center">
        The pickup code was sent to you via SMS and email after payment verification
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
        title="Confirm Pickup"
        message={`Have you collected the item? Enter code ${pickupCode} to confirm pickup.`}
        confirmText="Confirm"
        cancelText="Cancel"
        type="warning"
        isLoading={isConfirming}
      />
    </div>
  );
}
