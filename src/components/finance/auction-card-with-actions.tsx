'use client';

import { useState } from 'react';
import { Clock, User, Banknote, AlertTriangle, CheckCircle2, XCircle, FileText, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { createPortal } from 'react-dom';

interface AuctionCardData {
  id: string;
  assetName: string;
  status: string;
  winner: {
    id: string;
    name: string;
    email: string;
  };
  finalBid: number;
  depositAmount: number;
  documentDeadline?: string;
  paymentDeadline?: string;
  extensionCount: number;
  maxExtensions: number;
  createdAt: string;
}

interface AuctionCardWithActionsProps {
  auction: AuctionCardData;
  onExtensionGranted?: () => void;
  onForfeitureTransferred?: () => void;
  className?: string;
}

export function AuctionCardWithActions({
  auction,
  onExtensionGranted,
  onForfeitureTransferred,
  className = '',
}: AuctionCardWithActionsProps) {
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [extensionReason, setExtensionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      awaiting_documents: {
        color: 'bg-blue-100 text-blue-700',
        icon: <FileText className="w-3 h-3" />,
        label: 'Awaiting Documents',
      },
      awaiting_payment: {
        color: 'bg-yellow-100 text-yellow-700',
        icon: <Clock className="w-3 h-3" />,
        label: 'Awaiting Payment',
      },
      deposit_forfeited: {
        color: 'bg-red-100 text-red-700',
        icon: <XCircle className="w-3 h-3" />,
        label: 'Deposit Forfeited',
      },
      paid: {
        color: 'bg-green-100 text-green-700',
        icon: <CheckCircle2 className="w-3 h-3" />,
        label: 'Paid',
      },
      failed_all_fallbacks: {
        color: 'bg-gray-100 text-gray-700',
        icon: <AlertTriangle className="w-3 h-3" />,
        label: 'All Fallbacks Failed',
      },
    };

    const badge = badges[status] || {
      color: 'bg-gray-100 text-gray-700',
      icon: null,
      label: status,
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.icon}
        {badge.label}
      </span>
    );
  };

  const handleGrantExtension = async () => {
    if (!extensionReason.trim()) {
      alert('Please provide a reason for the extension');
      return;
    }

    try {
      setProcessing(true);
      const response = await fetch(`/api/auctions/${auction.id}/extensions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: extensionReason }),
      });

      if (response.ok) {
        alert('Extension granted successfully');
        setShowExtensionModal(false);
        setExtensionReason('');
        if (onExtensionGranted) onExtensionGranted();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to grant extension');
      }
    } catch (error) {
      console.error('Failed to grant extension:', error);
      alert('Failed to grant extension. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleTransferForfeiture = async () => {
    try {
      setProcessing(true);
      const response = await fetch(`/api/auctions/${auction.id}/forfeitures/transfer`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Forfeited funds transferred successfully');
        setShowTransferModal(false);
        if (onForfeitureTransferred) onForfeitureTransferred();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to transfer forfeited funds');
      }
    } catch (error) {
      console.error('Failed to transfer forfeiture:', error);
      alert('Failed to transfer forfeited funds. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const canGrantExtension = auction.status === 'awaiting_documents' && auction.extensionCount < auction.maxExtensions;
  const canTransferForfeiture = auction.status === 'deposit_forfeited';
  const requiresManualIntervention = auction.status === 'failed_all_fallbacks';

  return (
    <>
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow ${className}`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <Link
                href={`/finance/payment-transactions/${auction.id}`}
                className="text-lg font-semibold text-gray-900 hover:text-[#800020] transition-colors"
              >
                {auction.assetName}
              </Link>
              <p className="text-sm text-gray-500 mt-1">Auction ID: {auction.id}</p>
            </div>
            {getStatusBadge(auction.status)}
          </div>

          {/* Winner Info */}
          <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
            <User className="w-4 h-4 text-gray-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{auction.winner.name}</p>
              <p className="text-xs text-gray-500">{auction.winner.email}</p>
            </div>
          </div>

          {/* Financial Info */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Final Bid</p>
              <p className="text-lg font-bold text-gray-900">
                ₦{auction.finalBid.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Deposit Amount</p>
              <p className="text-lg font-bold text-orange-600">
                ₦{auction.depositAmount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Deadlines */}
          {(auction.documentDeadline || auction.paymentDeadline) && (
            <div className="space-y-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              {auction.documentDeadline && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700">Document Deadline:</span>
                  <span className="font-medium text-blue-900">
                    {new Date(auction.documentDeadline).toLocaleString()}
                  </span>
                </div>
              )}
              {auction.paymentDeadline && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700">Payment Deadline:</span>
                  <span className="font-medium text-blue-900">
                    {new Date(auction.paymentDeadline).toLocaleString()}
                  </span>
                </div>
              )}
              {auction.status === 'awaiting_documents' && (
                <div className="flex items-center justify-between text-xs pt-2 border-t border-blue-200">
                  <span className="text-blue-600">Extensions Used:</span>
                  <span className="font-medium text-blue-900">
                    {auction.extensionCount} / {auction.maxExtensions}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {canGrantExtension && (
              <button
                onClick={() => setShowExtensionModal(true)}
                className="flex-1 min-w-[140px] px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Grant Extension
              </button>
            )}

            {!canGrantExtension && auction.status === 'awaiting_documents' && (
              <div className="flex-1 min-w-[140px] px-4 py-2 bg-gray-100 text-gray-500 text-sm font-medium rounded-lg flex items-center justify-center gap-2 cursor-not-allowed">
                <XCircle className="w-4 h-4" />
                Max Extensions Reached
              </div>
            )}

            {canTransferForfeiture && (
              <button
                onClick={() => setShowTransferModal(true)}
                className="flex-1 min-w-[140px] px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <Banknote className="w-4 h-4" />
                Transfer Forfeited Funds
              </button>
            )}

            {requiresManualIntervention && (
              <div className="flex-1 min-w-[140px] px-4 py-2 bg-orange-100 text-orange-700 text-sm font-medium rounded-lg flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Manual Intervention Required
              </div>
            )}

            <Link
              href={`/finance/payment-transactions/${auction.id}`}
              className="flex-1 min-w-[140px] px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              View Details
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Extension Modal */}
      {showExtensionModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0" style={{ zIndex: 999999 }}>
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowExtensionModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Grant Extension</h3>
              <p className="text-sm text-gray-600 mb-4">
                Provide a reason for granting this extension. The vendor will be notified.
              </p>
              <textarea
                value={extensionReason}
                onChange={(e) => setExtensionReason(e.target.value)}
                placeholder="Enter reason for extension..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent resize-none"
                rows={4}
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowExtensionModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGrantExtension}
                  disabled={processing || !extensionReason.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {processing ? 'Granting...' : 'Grant Extension'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Transfer Forfeiture Modal */}
      {showTransferModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0" style={{ zIndex: 999999 }}>
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowTransferModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Transfer Forfeited Funds</h3>
              <p className="text-sm text-gray-600 mb-4">
                This will transfer the forfeited deposit amount (₦{auction.depositAmount.toLocaleString()}) from the vendor's frozen balance to the platform account.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-red-800 font-medium">
                  ⚠️ This action cannot be undone. Please confirm before proceeding.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransferForfeiture}
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {processing ? 'Transferring...' : 'Confirm Transfer'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
