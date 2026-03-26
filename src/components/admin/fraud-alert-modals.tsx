'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

interface FraudAlert {
  id: string;
  vendorId: string;
  alertType: string;
  severity: string;
  description: string;
  vendor: {
    businessName?: string;
    contactPersonName?: string;
  };
}

interface DismissModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: FraudAlert | null;
  onDismiss: (reason: string) => Promise<void>;
}

export function FraudAlertDismissModal({
  isOpen,
  onClose,
  alert,
  onDismiss,
}: DismissModalProps) {
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !alert) return null;

  const handleDismiss = async () => {
    if (reason.trim().length < 10) {
      setError('Dismissal reason must be at least 10 characters');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      await onDismiss(reason);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss alert');
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
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Dismiss Fraud Alert
          </h3>

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Vendor: <span className="font-medium text-gray-900">
                {alert.vendor.businessName || alert.vendor.contactPersonName || 'Unknown'}
              </span>
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Alert Type: <span className="font-medium text-gray-900">{alert.alertType}</span>
            </p>
          </div>

          <div className="mb-6">
            <label htmlFor="dismissReason" className="block text-sm font-medium text-gray-700 mb-2">
              Dismissal Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              id="dismissReason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this alert is being dismissed (minimum 10 characters)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              {reason.length}/10 characters minimum
            </p>
          </div>

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
              onClick={handleDismiss}
              disabled={processing || reason.trim().length < 10}
              className="flex-1 px-4 py-2 bg-[#800020] text-white rounded-lg hover:bg-[#600018] transition-colors disabled:opacity-50"
            >
              {processing ? 'Dismissing...' : 'Dismiss Alert'}
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

interface SuspendModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: FraudAlert | null;
  onSuspend: (reason: string) => Promise<void>;
}

export function FraudAlertSuspendModal({
  isOpen,
  onClose,
  alert,
  onSuspend,
}: SuspendModalProps) {
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !alert) return null;

  const handleSuspend = async () => {
    if (reason.trim().length < 10) {
      setError('Suspension reason must be at least 10 characters');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      await onSuspend(reason);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suspend vendor');
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
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Suspend Vendor
          </h3>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-800">
              <strong>⚠️ Warning:</strong> This will suspend the vendor and prevent them from accessing the platform.
            </p>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Vendor: <span className="font-medium text-gray-900">
                {alert.vendor.businessName || alert.vendor.contactPersonName || 'Unknown'}
              </span>
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Alert Type: <span className="font-medium text-gray-900">{alert.alertType}</span>
            </p>
          </div>

          <div className="mb-6">
            <label htmlFor="suspendReason" className="block text-sm font-medium text-gray-700 mb-2">
              Suspension Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              id="suspendReason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this vendor is being suspended (minimum 10 characters)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              {reason.length}/10 characters minimum
            </p>
          </div>

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
              onClick={handleSuspend}
              disabled={processing || reason.trim().length < 10}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {processing ? 'Suspending...' : 'Suspend Vendor'}
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
