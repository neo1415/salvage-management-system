'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { lockScroll } from '@/lib/utils/modal-scroll-lock';
import { AuctionScheduleSelector, type AuctionScheduleValue } from '@/components/ui/auction-schedule-selector';

interface RestartAuctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  restartSchedule: AuctionScheduleValue;
  onScheduleChange: (schedule: AuctionScheduleValue) => void;
  onConfirm: () => void;
  isRestarting: boolean;
}

export function RestartAuctionModal({
  isOpen,
  onClose,
  restartSchedule,
  onScheduleChange,
  onConfirm,
  isRestarting,
}: RestartAuctionModalProps) {
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
      if (e.key === 'Escape' && isOpen && !isRestarting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, isRestarting]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0" style={{ zIndex: 999999 }}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isRestarting) {
            onClose();
          }
        }}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div 
          className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl transform transition-all max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-[#800020]/10 rounded-full flex items-center justify-center">
              <svg
                className="w-10 h-10 text-[#800020]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
            Restart Auction
          </h3>

          {/* Message */}
          <p className="text-gray-600 text-center mb-6">
            Configure the restart schedule for this auction. All previous bids will be cleared and vendors will be notified.
          </p>
          
          {/* Schedule Selector */}
          <div className="mb-6">
            <AuctionScheduleSelector
              value={restartSchedule}
              onChange={onScheduleChange}
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isRestarting}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isRestarting}
              className="flex-1 px-4 py-3 bg-[#800020] text-white rounded-lg font-medium hover:bg-[#600018] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRestarting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Restarting...
                </span>
              ) : (
                'Confirm Restart'
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
