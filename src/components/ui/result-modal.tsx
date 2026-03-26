/**
 * Result Modal Component
 * 
 * Professional modal for displaying success/error messages
 * Replaces browser alert() with a clean UI
 * Uses React Portal to render outside layout hierarchy
 */

'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, X } from 'lucide-react';
import { lockScroll } from '@/lib/utils/modal-scroll-lock';

export type ResultType = 'success' | 'error';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ResultType;
  title: string;
  message: string;
  details?: string[];
}

export function ResultModal({
  isOpen,
  onClose,
  type,
  title,
  message,
  details,
}: ResultModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const unlock = lockScroll();
      return unlock;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-600" />;
      case 'error':
        return <XCircle className="w-16 h-16 text-red-600" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-900',
          button: 'bg-green-600 hover:bg-green-700',
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-900',
          button: 'bg-red-600 hover:bg-red-700',
        };
    }
  };

  const colors = getColors();

  const modalContent = (
    <div className="fixed inset-0" style={{ zIndex: 999999 }}>
      {/* Backdrop - covers EVERYTHING including sidebar */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      />
      
      {/* Modal Container - properly centered, always visible */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div 
          className="relative w-full max-w-md bg-white rounded-xl shadow-2xl transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
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
          <p className="text-gray-600 mb-4 whitespace-pre-line">
            {message}
          </p>

          {/* Details */}
          {details && details.length > 0 && (
            <div className={`p-4 ${colors.bg} border ${colors.border} rounded-lg mb-4 text-left`}>
              <ul className={`text-sm ${colors.text} space-y-1`}>
                {details.map((detail, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className={`w-full px-6 py-3 text-white font-semibold rounded-lg transition-colors ${colors.button}`}
          >
            Close
          </button>
        </div>
        </div>
      </div>
    </div>
  );

  // Render modal using Portal to break out of layout hierarchy
  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null;
}
