'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface PaymentDetails {
  id: string;
  auctionId: string;
  amount: string;
  status: 'pending' | 'verified' | 'rejected' | 'overdue';
  paymentDeadline: string;
  paymentMethod: string;
  paymentReference: string | null;
  paymentProofUrl: string | null;
  createdAt: string;
  auction: {
    id: string;
    caseId: string;
    currentBid: string;
    case: {
      claimReference: string;
      assetType: string;
      assetDetails: Record<string, unknown>;
      marketValue: string;
      estimatedSalvageValue: string;
      locationName: string;
      photos: string[];
    };
  };
}

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const { data: _session } = useSession(); // Prefixed with _ to indicate intentionally unused for now
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  const paymentId = params.id as string;

  // Fetch payment details
  useEffect(() => {
    async function fetchPayment() {
      try {
        const response = await fetch(`/api/payments/${paymentId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch payment details');
        }
        const data = await response.json();
        setPayment(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (paymentId) {
      fetchPayment();
    }
  }, [paymentId]);

  // Countdown timer
  useEffect(() => {
    if (!payment) return;

    const updateCountdown = () => {
      const deadline = new Date(payment.paymentDeadline);
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        setTimeRemaining(`${days}d ${remainingHours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [payment]);

  // Handle Paystack payment
  const handlePayWithPaystack = async () => {
    try {
      const response = await fetch(`/api/payments/${paymentId}/initiate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to initiate payment');
      }

      const data = await response.json();
      
      // Validate Paystack URL before redirect (security measure)
      const allowedDomains = ['paystack.co', 'paystack.com'];
      try {
        const url = new URL(data.paymentUrl);
        if (!allowedDomains.includes(url.hostname)) {
          throw new Error('Invalid payment URL domain');
        }
      } catch (urlError) {
        throw new Error('Invalid payment URL format');
      }
      
      // Redirect to Paystack payment page
      window.location.href = data.paymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate payment');
    }
  };

  // Handle bank transfer proof upload
  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPG, PNG, and PDF files are allowed');
      return;
    }

    setUploadingProof(true);
    setError(null);

    try {
      // Upload via secure server endpoint (server-side validation)
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/payments/${paymentId}/upload-proof`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload payment proof');
      }

      // Refresh payment details
      const updatedPayment = await response.json();
      setPayment(updatedPayment);
      
      alert('Payment proof uploaded successfully! Finance team will verify within 4 hours.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload payment proof');
    } finally {
      setUploadingProof(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-burgundy-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (error && !payment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-burgundy-900 text-white rounded-lg hover:bg-burgundy-800"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!payment) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'verified':
        return 'Verified ✓';
      case 'pending':
        return 'Pending Verification';
      case 'rejected':
        return 'Rejected';
      case 'overdue':
        return 'Overdue';
      default:
        return status;
    }
  };

  const getCountdownColor = () => {
    if (timeRemaining === 'Expired') return 'text-red-600';
    
    const deadline = new Date(payment.paymentDeadline);
    const now = new Date();
    const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursRemaining < 1) return 'text-red-600 animate-pulse';
    if (hoursRemaining < 6) return 'text-yellow-600';
    return 'text-green-600';
  };

  const assetDetails = payment.auction.case.assetDetails as Record<string, string>;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-burgundy-900 hover:text-burgundy-700 flex items-center gap-2 mb-4"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Payment Details</h1>
        </div>

        {/* Payment Status Banner */}
        <div className={`rounded-lg p-4 mb-6 ${getStatusColor(payment.status)}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-lg">{getStatusText(payment.status)}</p>
              {payment.status === 'pending' && payment.paymentProofUrl && (
                <p className="text-sm mt-1">
                  Payment proof uploaded. Awaiting verification from Finance team.
                </p>
              )}
              {payment.status === 'verified' && (
                <p className="text-sm mt-1">
                  Payment confirmed! Check your email for pickup authorization code.
                </p>
              )}
              {payment.status === 'overdue' && (
                <p className="text-sm mt-1">
                  Payment deadline has passed. Please contact support.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Payment Deadline Countdown */}
        {payment.status === 'pending' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Deadline</h2>
            <div className="text-center">
              <p className="text-gray-600 mb-2">Time Remaining</p>
              <p className={`text-4xl font-bold ${getCountdownColor()}`}>
                {timeRemaining}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Deadline: {new Date(payment.paymentDeadline).toLocaleString('en-NG', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>
          </div>
        )}

        {/* Item Details */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Item Details</h2>
          
          {/* Photos */}
          {payment.auction.case.photos.length > 0 && (
            <div className="mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {payment.auction.case.photos.slice(0, 3).map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`Item photo ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Claim Reference</p>
              <p className="font-semibold text-gray-900">{payment.auction.case.claimReference}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Asset Type</p>
              <p className="font-semibold text-gray-900 capitalize">
                {payment.auction.case.assetType}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Location</p>
              <p className="font-semibold text-gray-900">{payment.auction.case.locationName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Market Value</p>
              <p className="font-semibold text-gray-900">
                ₦{parseFloat(payment.auction.case.marketValue).toLocaleString()}
              </p>
            </div>
            
            {/* Asset-specific details */}
            {payment.auction.case.assetType === 'vehicle' && (
              <>
                {assetDetails.make && (
                  <div>
                    <p className="text-sm text-gray-600">Make</p>
                    <p className="font-semibold text-gray-900">{assetDetails.make}</p>
                  </div>
                )}
                {assetDetails.model && (
                  <div>
                    <p className="text-sm text-gray-600">Model</p>
                    <p className="font-semibold text-gray-900">{assetDetails.model}</p>
                  </div>
                )}
                {assetDetails.year && (
                  <div>
                    <p className="text-sm text-gray-600">Year</p>
                    <p className="font-semibold text-gray-900">{assetDetails.year}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Payment Amount */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Amount</h2>
          <div className="bg-burgundy-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Winning Bid Amount</p>
            <p className="text-3xl font-bold text-burgundy-900">
              ₦{parseFloat(payment.amount).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Payment Options */}
        {payment.status === 'pending' && !payment.paymentProofUrl && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Options</h2>

            {/* Paystack Payment */}
            <div className="mb-6">
              <button
                onClick={handlePayWithPaystack}
                className="w-full bg-burgundy-900 text-white py-4 px-6 rounded-lg font-semibold hover:bg-burgundy-800 transition-colors flex items-center justify-center gap-2"
              >
                <span>💳</span>
                Pay Now with Paystack
              </button>
              <p className="text-sm text-gray-600 mt-2 text-center">
                Instant verification • Card, Bank Transfer, USSD
              </p>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>

            {/* Bank Transfer */}
            <div className="border border-gray-300 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Pay via Bank Transfer</h3>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2">Transfer to:</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500">Bank Name</p>
                    <p className="font-semibold text-gray-900">Access Bank</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Account Number</p>
                    <p className="font-semibold text-gray-900">0123456789</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Account Name</p>
                    <p className="font-semibold text-gray-900">NEM Insurance Plc - Salvage</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Reference</p>
                    <p className="font-semibold text-gray-900">{payment.id.substring(0, 8)}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Payment Proof (Receipt/Screenshot)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  onChange={handleProofUpload}
                  disabled={uploadingProof}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-burgundy-50 file:text-burgundy-900
                    hover:file:bg-burgundy-100
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  JPG, PNG, or PDF • Max 5MB • Verification within 4 hours
                </p>
                {uploadingProof && (
                  <p className="text-sm text-burgundy-900 mt-2">Uploading...</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payment Proof Uploaded */}
        {payment.status === 'pending' && payment.paymentProofUrl && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Proof</h2>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-green-800 font-semibold">✓ Payment proof uploaded</p>
              <p className="text-sm text-green-700 mt-1">
                Our Finance team will verify your payment within 4 hours.
              </p>
            </div>
            <a
              href={payment.paymentProofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-burgundy-900 hover:text-burgundy-700 underline"
            >
              View uploaded proof →
            </a>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
