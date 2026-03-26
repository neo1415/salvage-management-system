/**
 * Bid Form Component
 * Modal for placing bids with OTP verification
 * 
 * Requirements:
 * - Requirement 18: Bid Placement with OTP
 * - NFR5.3: User Experience
 * 
 * Features:
 * - Display modal with bid amount input
 * - Show real-time validation (minimum bid amount)
 * - Request SMS OTP on "Confirm Bid"
 * - Display OTP input (6 digits, 3 minutes validity)
 * - Submit bid after OTP verification
 * - Display success message
 * - Target total time <1 minute from tap to confirmed bid
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { TierUpgradeModal } from '@/components/ui/tier-upgrade-modal';
import { useTierUpgrade, type VendorTier } from '@/hooks/use-tier-upgrade';
import { useToast } from '@/components/ui/toast';
import { lockScroll } from '@/lib/utils/modal-scroll-lock';

interface BidFormProps {
  auctionId: string;
  currentBid: number | null;
  minimumBid: number; // This is the actual minimum bid amount (reserve price or current bid + ₦20,000)
  assetName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  vendorTier?: VendorTier;
  auctionValue?: number; // For tier upgrade checks
}

export function BidForm({
  auctionId,
  currentBid,
  minimumBid, // This is the actual minimum bid amount (reserve price or current bid + ₦20,000)
  assetName,
  isOpen,
  onClose,
  onSuccess,
  vendorTier = 'tier1_bvn',
  auctionValue,
}: BidFormProps) {
  const { data: session } = useSession();
  const toast = useToast();
  const [step, setStep] = useState<'bid' | 'otp'>('bid');
  const [bidAmount, setBidAmount] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(180); // 3 minutes in seconds
  const [startTime, setStartTime] = useState<number | null>(null);

  // Tier upgrade functionality
  const {
    checkAuctionAccess,
    showUpgradeModal,
    closeUpgradeModal,
    blockedAuctionValue,
    getTierLimit,
  } = useTierUpgrade({
    currentTier: vendorTier,
    onUpgradeRequired: (value) => {
      console.log(`Tier upgrade required for auction value: ₦${value.toLocaleString()}`);
    },
  });

  // Calculate minimum bid (minimumBid is the actual minimum bid amount)
  const minimumBidAmount = minimumBid;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('bid');
      setBidAmount('');
      setOtp('');
      setError('');
      setOtpTimer(180);
      setStartTime(Date.now());
      
      // Prevent body scroll
      const unlock = lockScroll();
      return unlock;
    }
  }, [isOpen]);

  // OTP countdown timer
  useEffect(() => {
    if (step === 'otp' && otpTimer > 0) {
      const timer = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [step, otpTimer]);

  // Format timer display
  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Real-time bid validation
  const validateBidAmount = useCallback((amount: string): string | null => {
    if (!amount) {
      return 'Bid amount is required';
    }

    const numAmount = parseFloat(amount);

    if (isNaN(numAmount)) {
      return 'Invalid bid amount';
    }

    if (numAmount < minimumBidAmount) {
      return `Minimum bid: ₦${minimumBidAmount.toLocaleString()}`;
    }

    // Check tier limits
    const tierLimit = getTierLimit();
    if (tierLimit && numAmount > tierLimit) {
      return `Tier ${vendorTier === 'tier1_bvn' ? '1' : '2'} limit: ₦${tierLimit.toLocaleString()}. Upgrade to bid higher.`;
    }

    return null;
  }, [minimumBidAmount, getTierLimit, vendorTier]);

  // Handle bid amount change with real-time validation
  const handleBidAmountChange = (value: string) => {
    // Remove non-numeric characters except decimal point
    const cleanValue = value.replace(/[^\d.]/g, '');
    setBidAmount(cleanValue);

    // Clear error when user starts typing
    if (error) {
      setError('');
    }

    // Show real-time validation
    const validationError = validateBidAmount(cleanValue);
    if (validationError && cleanValue) {
      setError(validationError);
    }
  };

  // Handle confirm bid (send OTP)
  const handleConfirmBid = async () => {
    // Validate bid amount
    const validationError = validateBidAmount(bidAmount);
    if (validationError) {
      setError(validationError);
      return;
    }

    const numAmount = parseFloat(bidAmount);

    // Check tier access before proceeding
    if (!checkAuctionAccess(numAmount)) {
      // Tier upgrade modal will be shown automatically
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Send OTP with bidding context
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: session?.user?.phone,
          context: 'bidding',
          auctionId: auctionId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to send OTP');
      }

      // Move to OTP step
      setStep('otp');
      setOtpTimer(180); // Reset timer
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP input change
  const handleOtpChange = (value: string) => {
    // Only allow digits and max 6 characters
    const cleanValue = value.replace(/\D/g, '').slice(0, 6);
    setOtp(cleanValue);

    // Clear error when user starts typing
    if (error) {
      setError('');
    }

    // Auto-submit when 6 digits entered
    if (cleanValue.length === 6) {
      handleSubmitBid(cleanValue);
    }
  };

  // Handle bid submission
  const handleSubmitBid = async (otpCode?: string) => {
    const otpToVerify = otpCode || otp;

    if (otpToVerify.length !== 6) {
      setError('Please enter a 6-digit OTP');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Submit bid with OTP
      const response = await fetch(`/api/auctions/${auctionId}/bids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(bidAmount),
          otp: otpToVerify,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Show error toast for bid placement failures
        toast.error(
          'Bid placement failed',
          data.error || 'Please try again'
        );
        throw new Error(data.error || 'Failed to place bid');
      }

      // Calculate total time
      const totalTime = startTime ? (Date.now() - startTime) / 1000 : 0;
      console.log(`✅ Bid placed in ${totalTime.toFixed(1)} seconds`);

      // Show success toast
      toast.success(
        'Bid placed successfully!',
        `Your bid of ₦${parseFloat(bidAmount).toLocaleString()} has been placed`
      );

      // Show success message and trigger refresh
      setStep('bid');
      
      // Call onSuccess to trigger parent component refresh
      if (onSuccess) {
        onSuccess();
      }
      
      // Close modal
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bid');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOtp = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: session?.user?.phone,
          context: 'bidding',
          auctionId: auctionId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to resend OTP');
      }

      setOtpTimer(180); // Reset timer
      setOtp(''); // Clear OTP input
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle back to bid step
  const handleBackToBid = () => {
    setStep('bid');
    setOtp('');
    setError('');
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0" style={{ zIndex: 999999 }}>
      {/* Modal Overlay */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-lg shadow-xl max-w-md w-full transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              {step === 'bid' ? 'Place Your Bid' : 'Verify OTP'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isLoading}
            >
              <svg
                className="w-6 h-6"
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
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            {/* Asset Name */}
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-1">Bidding on:</p>
              <p className="text-lg font-semibold text-gray-900">{assetName}</p>
            </div>

            {/* Current Bid Info */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Current Bid:</span>
                <span className="text-lg font-bold text-gray-900">
                  ₦{(currentBid || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Minimum Bid:</span>
                <span className="text-lg font-bold text-burgundy-900">
                  ₦{minimumBidAmount.toLocaleString()}
                </span>
              </div>
              {/* Tier Limit Display */}
              {getTierLimit() && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Your Bid Limit:</span>
                  <span className="text-sm font-bold text-orange-600">
                    ₦{getTierLimit()!.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Bid Amount Step */}
            {step === 'bid' && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="bidAmount"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Your Bid Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                      ₦
                    </span>
                    <input
                      id="bidAmount"
                      type="text"
                      inputMode="numeric"
                      value={bidAmount}
                      onChange={(e) => handleBidAmountChange(e.target.value)}
                      placeholder={minimumBidAmount.toLocaleString()}
                      className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        error
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-burgundy-500'
                      }`}
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-red-600 animate-pulse">
                      {error}
                    </p>
                  )}
                  
                  {/* Tier upgrade prompt for errors */}
                  {error && error.includes('Upgrade to bid higher') && (
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-800 mb-2">
                        💡 Want to bid higher? Upgrade to Tier 2 for unlimited bidding!
                      </p>
                      <button
                        onClick={() => {
                          const numAmount = parseFloat(bidAmount);
                          if (!isNaN(numAmount)) {
                            checkAuctionAccess(numAmount);
                          }
                        }}
                        className="text-sm text-[#800020] font-medium hover:text-[#600018] underline"
                      >
                        Learn More About Tier 2
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleConfirmBid}
                  disabled={isLoading || !!error || !bidAmount}
                  className="w-full bg-burgundy-900 text-white py-3 rounded-lg font-semibold hover:bg-burgundy-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Sending OTP...' : 'Confirm Bid'}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  You'll receive an OTP via SMS to verify your bid
                </p>
              </div>
            )}

            {/* OTP Verification Step */}
            {step === 'otp' && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Enter the 6-digit code sent to your phone
                  </p>
                  <p className="text-xs text-gray-500">
                    {session?.user?.phone}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="otp"
                    className="block text-sm font-medium text-gray-700 mb-2 text-center"
                  >
                    Verification Code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => handleOtpChange(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    className={`w-full px-4 py-3 border rounded-lg text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 transition-colors ${
                      error
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-burgundy-500'
                    }`}
                    disabled={isLoading}
                    autoFocus
                  />
                  {error && (
                    <p className="mt-2 text-sm text-red-600 text-center animate-pulse">
                      {error}
                    </p>
                  )}
                </div>

                {/* Timer */}
                <div className="text-center">
                  <p
                    className={`text-sm font-semibold ${
                      otpTimer < 60 ? 'text-red-600' : 'text-gray-600'
                    }`}
                  >
                    {otpTimer > 0 ? (
                      <>Time remaining: {formatTimer(otpTimer)}</>
                    ) : (
                      <>OTP expired</>
                    )}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <button
                    onClick={() => handleSubmitBid()}
                    disabled={isLoading || otp.length !== 6 || otpTimer === 0}
                    className="w-full bg-burgundy-900 text-white py-3 rounded-lg font-semibold hover:bg-burgundy-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Verifying...' : 'Submit Bid'}
                  </button>

                  <button
                    onClick={handleResendOtp}
                    disabled={isLoading || otpTimer > 0}
                    className="w-full bg-white text-burgundy-900 py-3 rounded-lg font-semibold border-2 border-burgundy-900 hover:bg-burgundy-50 transition-colors disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    Resend OTP
                  </button>

                  <button
                    onClick={handleBackToBid}
                    disabled={isLoading}
                    className="w-full bg-white text-gray-700 py-3 rounded-lg font-semibold border border-gray-300 hover:bg-gray-50 transition-colors disabled:cursor-not-allowed"
                  >
                    Back to Bid Amount
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tier Upgrade Modal */}
      <TierUpgradeModal
        isOpen={showUpgradeModal}
        onClose={closeUpgradeModal}
        auctionValue={blockedAuctionValue}
      />
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
