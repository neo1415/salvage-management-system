'use client';

import { useState, useEffect } from 'react';
import { Wallet, CreditCard, Zap, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface PaymentBreakdown {
  finalBid: number;
  depositAmount: number;
  remainingAmount: number;
  walletBalance: number;
  canPayWithWallet: boolean;
  walletPortion?: number;
  paystackPortion?: number;
}

interface PaymentOptionsProps {
  auctionId: string;
  onPaymentSuccess?: () => void;
  onClose?: () => void;
  className?: string;
  asModal?: boolean;
}

type PaymentMethod = 'wallet' | 'paystack' | 'hybrid';

export function PaymentOptions({
  auctionId,
  onPaymentSuccess,
  onClose,
  className = '',
  asModal = false,
}: PaymentOptionsProps) {
  const [breakdown, setBreakdown] = useState<PaymentBreakdown | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showPaystackModal, setShowPaystackModal] = useState(false);
  const [paystackUrl, setPaystackUrl] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{
    totalPaid: number;
    paystackAmount: number;
    depositAmount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchPaymentBreakdown();
  }, [auctionId]);

  // Check for Paystack callback success
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    
    if (paymentStatus === 'success' && breakdown) {
      // Show success modal
      setSuccessData({
        totalPaid: breakdown.finalBid,
        paystackAmount: breakdown.remainingAmount,
        depositAmount: breakdown.depositAmount,
      });
      setShowSuccessModal(true);
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [breakdown]);

  const fetchPaymentBreakdown = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/auctions/${auctionId}/payment/calculate`);
      if (response.ok) {
        const data = await response.json();
        setBreakdown(data.breakdown);
      }
    } catch (error) {
      console.error('Failed to fetch payment breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWalletPayment = async () => {
    try {
      setProcessing(true);
      setError(null);
      
      const response = await fetch(`/api/auctions/${auctionId}/payment/wallet`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        // Show success modal with breakdown
        setSuccessData({
          totalPaid: breakdown?.finalBid || 0,
          paystackAmount: 0,
          depositAmount: breakdown?.depositAmount || 0,
        });
        setShowSuccessModal(true);
      } else {
        setError(data.error || data.message || 'Payment failed. Please try again.');
      }
    } catch (error) {
      console.error('Wallet payment failed:', error);
      setError('Payment failed. Please check your connection and try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePaystackPayment = async () => {
    try {
      setProcessing(true);
      setError(null);
      
      const response = await fetch(`/api/auctions/${auctionId}/payment/paystack`, {
        method: 'POST',
      });
      
      const data = await response.json();

      if (response.ok) {
        if (!data.authorization_url) {
          setError('Payment initialization failed: No authorization URL received');
          return;
        }
        
        // Check if payment already pending
        if (data.authorization_url === 'ALREADY_PENDING') {
          setError('A payment is already in progress. Please complete or cancel the existing payment first.');
          return;
        }
        
        // REDIRECT to Paystack - Paystack will redirect back after payment
        window.location.href = data.authorization_url;
      } else {
        setError(data.error || data.message || 'Failed to initialize payment. Please try again.');
      }
    } catch (error) {
      console.error('Paystack initialization failed:', error);
      setError('Failed to initialize payment. Please check your connection and try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleHybridPayment = async () => {
    try {
      setProcessing(true);
      setError(null);
      
      const response = await fetch(`/api/auctions/${auctionId}/payment/hybrid`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setPaystackUrl(data.authorization_url);
        setShowPaystackModal(true);
      } else {
        setError(data.error || data.message || 'Failed to initialize payment. Please try again.');
      }
    } catch (error) {
      console.error('Hybrid payment failed:', error);
      setError('Failed to initialize payment. Please check your connection and try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePayment = () => {
    if (!selectedMethod) return;

    switch (selectedMethod) {
      case 'wallet':
        handleWalletPayment();
        break;
      case 'paystack':
        handlePaystackPayment();
        break;
      case 'hybrid':
        handleHybridPayment();
        break;
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-200 rounded" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!breakdown) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-gray-600">Failed to load payment information</p>
        </div>
      </div>
    );
  }

  const content = (
    <>
      <div className={`bg-white rounded-lg shadow-xl ${asModal ? 'flex flex-col' : className}`} style={asModal ? { maxHeight: 'calc(100vh - 4rem)' } : {}}>
        {/* Modal Header (only when asModal) */}
        {asModal && onClose && (
          <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-xl font-bold text-gray-900">Complete Payment</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1">
          {/* Payment Breakdown */}
          <div className="p-4 border-b border-gray-200">
            {!asModal && <h2 className="text-xl font-bold text-gray-900 mb-3">Payment Breakdown</h2>}
            <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Final Bid</span>
                <span className="text-base font-semibold text-gray-900">
                  ₦{(breakdown.finalBid || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-green-600">
                <span className="text-sm">Deposit Paid</span>
                <span className="text-base font-semibold">
                  -₦{(breakdown.depositAmount || 0).toLocaleString()}
                </span>
              </div>
              <div className="border-t border-gray-300 pt-2 flex justify-between items-center">
                <span className="text-base font-semibold text-gray-900">Remaining</span>
                <span className="text-xl font-bold text-[#800020]">
                  ₦{(breakdown.remainingAmount || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-xs text-gray-600">Wallet Balance</span>
                <span className="text-sm font-semibold text-gray-900">
                  ₦{(breakdown.walletBalance || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="p-4">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Payment Method</h3>
            
            {/* Error Message */}
            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <div className="space-y-2">
            {/* Wallet Only */}
            <button
              onClick={() => setSelectedMethod('wallet')}
              disabled={!breakdown.canPayWithWallet}
              className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                selectedMethod === 'wallet'
                  ? 'border-[#800020] bg-[#800020]/5'
                  : 'border-gray-200 hover:border-gray-300'
              } ${!breakdown.canPayWithWallet ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  selectedMethod === 'wallet' ? 'bg-[#800020]' : 'bg-gray-100'
                }`}>
                  <Wallet className={`w-4 h-4 ${selectedMethod === 'wallet' ? 'text-white' : 'text-gray-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-sm font-semibold text-gray-900">Wallet</h4>
                    {breakdown.canPayWithWallet && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        Best
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    Pay from wallet balance
                  </p>
                  {!breakdown.canPayWithWallet && (
                    <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Insufficient balance
                    </p>
                  )}
                </div>
                {selectedMethod === 'wallet' && (
                  <CheckCircle2 className="w-5 h-5 text-[#800020] flex-shrink-0" />
                )}
              </div>
            </button>

            {/* Paystack Only */}
            <button
              onClick={() => setSelectedMethod('paystack')}
              className={`w-full p-3 border-2 rounded-lg text-left transition-all cursor-pointer ${
                selectedMethod === 'paystack'
                  ? 'border-[#800020] bg-[#800020]/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  selectedMethod === 'paystack' ? 'bg-[#800020]' : 'bg-gray-100'
                }`}>
                  <CreditCard className={`w-4 h-4 ${selectedMethod === 'paystack' ? 'text-white' : 'text-gray-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 mb-0.5">Paystack</h4>
                  <p className="text-xs text-gray-600">
                    Card or bank transfer
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ₦{(breakdown.remainingAmount || 0).toLocaleString()}
                  </p>
                </div>
                {selectedMethod === 'paystack' && (
                  <CheckCircle2 className="w-5 h-5 text-[#800020] flex-shrink-0" />
                )}
              </div>
            </button>

            {/* Hybrid Payment */}
            {breakdown.walletBalance > 0 && breakdown.walletBalance < breakdown.remainingAmount && (
              <button
                onClick={() => setSelectedMethod('hybrid')}
                className={`w-full p-3 border-2 rounded-lg text-left transition-all cursor-pointer ${
                  selectedMethod === 'hybrid'
                    ? 'border-[#800020] bg-[#800020]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    selectedMethod === 'hybrid' ? 'bg-[#800020]' : 'bg-gray-100'
                  }`}>
                    <Zap className={`w-4 h-4 ${selectedMethod === 'hybrid' ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-semibold text-gray-900">Hybrid</h4>
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        Smart
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1.5">
                      Wallet + Paystack
                    </p>
                    <div className="text-xs space-y-0.5 bg-white p-1.5 rounded border border-gray-200">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Wallet:</span>
                        <span className="font-medium text-gray-900">
                          ₦{(breakdown.walletBalance || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Paystack:</span>
                        <span className="font-medium text-gray-900">
                          ₦{((breakdown.remainingAmount || 0) - (breakdown.walletBalance || 0)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  {selectedMethod === 'hybrid' && (
                    <CheckCircle2 className="w-5 h-5 text-[#800020] flex-shrink-0" />
                  )}
                </div>
              </button>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <Info className="w-3 h-3 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              Deposit unfrozen after payment. Amounts are fixed.
            </p>
          </div>
        </div>
        </div>

        {/* Action Button */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={handlePayment}
            disabled={!selectedMethod || processing}
            className="w-full px-4 py-3 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {selectedMethod === 'wallet' && 'Pay with Wallet'}
                {selectedMethod === 'paystack' && 'Pay with Paystack'}
                {selectedMethod === 'hybrid' && 'Proceed to Hybrid'}
                {!selectedMethod && 'Select Payment Method'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Paystack Modal */}
      {showPaystackModal && paystackUrl && mounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0" style={{ zIndex: 999999 }}>
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowPaystackModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Complete Payment</h3>
                <button
                  onClick={() => setShowPaystackModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <iframe
                src={paystackUrl}
                className="flex-1 w-full"
                title="Paystack Payment"
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Success Modal */}
      {showSuccessModal && successData && mounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0" style={{ zIndex: 999999 }}>
          <div className="fixed inset-0 bg-black/50" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              {/* Success Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">
                Payment Successful!
              </h3>

              {/* Breakdown */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Paid:</span>
                  <span className="text-2xl font-bold text-green-600">
                    ₦{successData.totalPaid.toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-gray-300 pt-3 space-y-2">
                  {successData.paystackAmount > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Via Paystack:</span>
                      <span className="font-semibold text-gray-900">
                        ₦{successData.paystackAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">From Deposit:</span>
                    <span className="font-semibold text-gray-900">
                      ₦{successData.depositAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-blue-800 text-center">
                  Your deposit has been unfrozen. Pickup authorization will appear shortly.
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  // Refresh page to show pickup authorization modal
                  window.location.reload();
                }}
                className="w-full px-6 py-3 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );

  // Wrap in modal if asModal is true
  if (asModal && mounted && typeof document !== 'undefined') {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={onClose} />
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '600px',
          maxHeight: 'calc(100vh - 4rem)',
          pointerEvents: 'none'
        }}>
          <div style={{ pointerEvents: 'auto', maxHeight: 'calc(100vh - 4rem)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            {content}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return content;
}
