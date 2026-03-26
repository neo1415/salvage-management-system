'use client';

/**
 * Payment Unlocked Modal
 * 
 * Modal that appears when vendor logs in and has a PAYMENT_UNLOCKED notification.
 * Shows pickup details and authorization code.
 * 
 * Features:
 * - Shows asset details, winning bid, pickup code, location, deadline
 * - Primary button routes to payment page
 * - Secondary button dismisses modal
 * - Persists dismissal in localStorage
 * - Stops appearing after visiting payment page
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { lockScroll } from '@/lib/utils/modal-scroll-lock';

interface PaymentUnlockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentData: {
    paymentId: string;
    auctionId: string;
    assetDescription: string;
    winningBid: number;
    pickupAuthCode: string;
    pickupLocation: string;
    pickupDeadline: string;
  };
}

export default function PaymentUnlockedModal({
  isOpen,
  onClose,
  paymentData,
}: PaymentUnlockedModalProps) {
  const router = useRouter();

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const unlock = lockScroll();
      return unlock;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleViewPayment = () => {
    // Mark as visited in localStorage
    localStorage.setItem(`payment-visited-${paymentData.paymentId}`, 'true');
    
    // Navigate to payment page
    router.push(`/vendor/payments/${paymentData.paymentId}`);
    onClose();
  };

  const handleDismiss = () => {
    // Store dismissal with timestamp
    localStorage.setItem(
      `payment-unlocked-modal-${paymentData.paymentId}-dismissed`,
      new Date().toISOString()
    );
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0" style={{ zIndex: 999999 }}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleDismiss();
          }
        }}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <div 
          className="bg-white rounded-lg max-w-2xl w-full shadow-2xl my-8 transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">Payment Complete!</h2>
              <p className="text-sm text-green-100">Your item is ready for pickup</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white hover:text-green-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Success Message */}
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-medium text-center">
              🎉 Congratulations! Your payment has been verified and your item is ready for collection.
            </p>
          </div>

          {/* Asset Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 text-lg mb-3">Item Details</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Asset</p>
                <p className="font-semibold text-gray-900">{paymentData.assetDescription}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600 mb-1">Winning Bid</p>
                <p className="font-semibold text-gray-900 text-lg text-green-600">
                  ₦{paymentData.winningBid.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Pickup Authorization */}
          <div className="bg-burgundy-50 border-2 border-burgundy-200 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-burgundy-900 text-lg mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Pickup Authorization
            </h3>
            
            <div className="bg-white rounded-lg p-4 border-2 border-dashed border-burgundy-300">
              <p className="text-sm text-gray-600 mb-2">Authorization Code</p>
              <p className="text-2xl font-bold text-burgundy-900 tracking-wider font-mono">
                {paymentData.pickupAuthCode}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                ⚠️ Keep this code safe. You'll need it to collect your item.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Pickup Location
                </p>
                <p className="font-semibold text-gray-900">{paymentData.pickupLocation}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Pickup Deadline
                </p>
                <p className="font-semibold text-gray-900">{paymentData.pickupDeadline}</p>
              </div>
            </div>
          </div>

          {/* Important Notes */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Important Reminders
            </h4>
            <ul className="text-sm text-yellow-800 space-y-1 ml-7">
              <li>• Bring a valid government-issued ID</li>
              <li>• Bring your pickup authorization code</li>
              <li>• Arrange transportation for the item</li>
              <li>• Pickup must be completed before the deadline</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={handleViewPayment}
              className="flex-1 px-6 py-3 bg-burgundy-900 text-white font-semibold rounded-lg hover:bg-burgundy-800 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Payment Details
            </button>
            
            <button
              onClick={handleDismiss}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null;
}
