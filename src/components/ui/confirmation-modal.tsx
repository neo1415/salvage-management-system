/**
 * Confirmation Modal Component
 * 
 * Enterprise-grade confirmation dialog for critical actions
 * Replaces browser window.confirm() with a professional UI
 */

'use client';

import { X, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

export type ConfirmationType = 'warning' | 'danger' | 'info' | 'success' | 'error';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmationType;
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
      case 'error':
        return <XCircle className="w-12 h-12 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-12 h-12 text-orange-600" />;
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-600" />;
      case 'info':
        return <Info className="w-12 h-12 text-blue-600" />;
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'danger':
      case 'error':
        return 'bg-red-600 hover:bg-red-700';
      case 'warning':
        return 'bg-orange-600 hover:bg-orange-700';
      case 'success':
        return 'bg-green-600 hover:bg-green-700';
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  const handleConfirm = () => {
    if (!isLoading) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Close modal"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Content */}
        <div className="p-6 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            {getIcon()}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {title}
          </h2>

          {/* Message */}
          <p className="text-gray-600 mb-6 whitespace-pre-line">
            {message}
          </p>

          {/* Action buttons */}
          <div className="flex gap-3">
            {cancelText && (
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className={`${cancelText ? 'flex-1' : 'w-full'} px-6 py-3 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getButtonColor()}`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
