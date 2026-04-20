'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Crown, Shield, Trophy, Headphones, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface RegistrationFeeModalProps {
  onClose: () => void;
  showCloseButton?: boolean;
}

export function RegistrationFeeModal({ onClose, showCloseButton = true }: RegistrationFeeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [feeAmount, setFeeAmount] = useState<number>(12500); // Default fallback
  const [loadingFee, setLoadingFee] = useState(true);

  useEffect(() => {
    setMounted(true);
    
    // Fetch current registration fee from config
    fetchRegistrationFee();
  }, []);

  const fetchRegistrationFee = async () => {
    try {
      setLoadingFee(true);
      const response = await fetch('/api/vendors/registration-fee/status');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.feeAmount) {
          setFeeAmount(data.data.feeAmount);
        }
      }
    } catch (error) {
      console.error('Failed to fetch registration fee:', error);
      // Keep default fallback value
    } finally {
      setLoadingFee(false);
    }
  };

  const handlePayNow = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/vendors/registration-fee/initialize', {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Failed to initialize payment');
      }

      // Redirect to Paystack
      window.location.href = result.data.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment initialization failed');
      setIsLoading(false);
    }
  };

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  const content = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={showCloseButton ? onClose : undefined} />
      <div style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: '28rem',
        pointerEvents: 'none'
      }}>
        <div style={{ pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#800020] to-[#FFD700] p-6 text-white relative">
              {showCloseButton && (
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Complete Your Registration</h2>
                </div>
              </div>
              <p className="text-white/90 text-sm">One-time fee to unlock full platform access</p>
            </div>

            <div className="p-6">
              {/* Progress Steps */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="text-gray-700 font-medium">BVN Verified</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-yellow-600 font-bold">2</span>
                  </div>
                  <span className="text-gray-700 font-medium">
                    Registration Fee: {loadingFee ? '...' : `₦${feeAmount.toLocaleString()}`}
                  </span>
                </div>
              </div>

              {/* Amount Display */}
              <div className="bg-gradient-to-br from-[#800020] to-[#600018] rounded-xl p-6 text-white mb-6 text-center">
                <p className="text-sm opacity-90 mb-1">One-Time Registration Fee</p>
                <p className="text-4xl font-bold mb-1">
                  {loadingFee ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </span>
                  ) : (
                    `₦${feeAmount.toLocaleString()}`
                  )}
                </p>
                <p className="text-xs opacity-75">Secure payment via Paystack</p>
              </div>

              {/* Benefits */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  What You'll Unlock:
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-blue-800">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Access Tier 2 KYC</strong> - Complete full verification</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-blue-800">
                    <Trophy className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Unlimited Bidding</strong> - No restrictions on high-value items</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-blue-800">
                    <Crown className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Leaderboard Eligibility</strong> - Compete for top rankings</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-blue-800">
                    <Headphones className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Priority Support</strong> - Faster assistance from our team</span>
                  </li>
                </ul>
              </div>

              {/* Error message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Later
                  </button>
                )}
                <button
                  onClick={handlePayNow}
                  disabled={isLoading || loadingFee}
                  className={`${showCloseButton ? 'flex-1' : 'w-full'} px-4 py-3 bg-gradient-to-r from-[#FFD700] to-[#FFC700] text-[#800020] font-bold rounded-lg hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : loadingFee ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5" />
                      Pay Now
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-4">
                Secure payment powered by Paystack. Your data is encrypted and protected.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
