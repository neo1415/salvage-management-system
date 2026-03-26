'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { lockScroll } from '@/lib/utils/modal-scroll-lock';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  details?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorModal({
  isOpen,
  onClose,
  title,
  message,
  details,
  actionLabel = 'Close',
  onAction,
}: ErrorModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const unlock = lockScroll();
      return unlock;
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      onClose();
    }
  };

  const modalContent = (
    <div className="fixed inset-0" style={{ zIndex: 999999 }}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div 
          className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Error Icon */}
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
          {title}
        </h3>

        {/* Message */}
        <p className="text-gray-600 text-center mb-4">{message}</p>

        {/* Details (if provided) */}
        {details && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800 font-mono break-words">{details}</p>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={handleAction}
          className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          {actionLabel}
        </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null;
}
