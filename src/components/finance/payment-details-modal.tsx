'use client';

import { createPortal } from 'react-dom';

interface Payment {
  id: string;
  amount: string;
  paymentMethod: string;
  escrowStatus?: string;
  status: string;
  case: {
    claimReference: string;
  };
  vendor: {
    businessName?: string;
    contactPersonName?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  getPaymentSourceLabel: (method: string) => string;
  getEscrowStatusBadge: (status: string) => React.ReactNode;
  getStatusBadge: (status: string) => React.ReactNode;
}

export function PaymentDetailsModal({
  isOpen,
  onClose,
  payment,
  getPaymentSourceLabel,
  getEscrowStatusBadge,
  getStatusBadge,
}: PaymentDetailsModalProps) {
  if (!isOpen || !payment) return null;

  const modalContent = (
    <div className="fixed inset-0" style={{ zIndex: 999999 }}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Payment Details</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* Payment Information */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-[#800020]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Payment Information
              </h4>
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Amount</p>
                  <p className="text-lg font-bold text-[#800020]">
                    ₦{parseFloat(payment.amount).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Payment Source</p>
                  <p className="font-medium text-gray-900">
                    {getPaymentSourceLabel(payment.paymentMethod)}
                  </p>
                  {payment.paymentMethod === 'escrow_wallet' && payment.escrowStatus && (
                    <div className="mt-1">
                      {getEscrowStatusBadge(payment.escrowStatus)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  {getStatusBadge(payment.status)}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Claim Reference</p>
                  <p className="font-medium text-gray-900">{payment.case.claimReference}</p>
                </div>
              </div>
            </div>

            {/* Vendor Information */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-[#800020]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Vendor Information
              </h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium text-gray-900">
                  {payment.vendor.businessName || payment.vendor.contactPersonName || 'Individual Vendor'}
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-[#800020]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Timeline
              </h4>
              <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Created</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(payment.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Last Updated</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(payment.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
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
