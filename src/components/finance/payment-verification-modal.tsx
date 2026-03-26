'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

interface Payment {
  id: string;
  amount: string;
  case: {
    claimReference: string;
  };
  vendor: {
    businessName?: string;
    contactPersonName?: string;
  };
}

interface PaymentVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  action: 'approve' | 'reject';
  onVerify: (comment?: string) => Promise<void>;
}

export function PaymentVerificationModal({
  isOpen,
  onClose,
  payment,
  action,
  onVerify,
}: PaymentVerificationModalProps) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  if (!isOpen || !payment) return null;

  const handleVerify = async () => {
    if (action === 'reject' && comment.trim().length < 10) {
      setError('Rejection reason must be at least 10 characters');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      await onVerify(action === 'reject' ? comment : undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0" style={{ zIndex: 999999 }}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {action === 'approve' ? 'Approve Payment' : 'Reject Payment'}
          </h3>

          <div className="space-y-3 mb-6">
            <div>
              <p className="text-sm text-gray-500">Claim Reference</p>
              <p className="font-medium text-gray-900">{payment.case.claimReference}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="font-medium text-gray-900">
                ₦{parseFloat(payment.amount).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Vendor</p>
              <p className="font-medium text-gray-900">
                {payment.vendor.businessName || payment.vendor.contactPersonName || 'Individual Vendor'}
              </p>
            </div>
          </div>

          {action === 'reject' && (
            <div className="mb-6">
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                id="comment"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Explain why this payment is being rejected (minimum 10 characters)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                {comment.length}/10 characters minimum
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={processing}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVerify}
              disabled={processing || (action === 'reject' && comment.trim().length < 10)}
              className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 ${
                action === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {processing ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
