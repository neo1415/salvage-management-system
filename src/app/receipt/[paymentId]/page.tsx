'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

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
  vendor?: {
    id: string;
    businessName: string;
    tier: string;
  };
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

export default function PublicReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paymentId = params.paymentId as string;

  // Fetch payment details (public route)
  useEffect(() => {
    async function fetchPayment() {
      try {
        const response = await fetch(`/api/payments/${paymentId}`);
        
        if (response.status === 401) {
          // Not authenticated - redirect to login with return URL
          const returnUrl = encodeURIComponent(window.location.pathname);
          router.push(`/auth/signin?callbackUrl=${returnUrl}`);
          return;
        }
        
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
  }, [paymentId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-burgundy-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payment receipt...</p>
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
              onClick={() => router.push('/auth/signin')}
              className="px-4 py-2 bg-burgundy-900 text-white rounded-lg hover:bg-burgundy-800"
            >
              Sign In to View Receipt
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

  const assetDetails = payment.auction.case.assetDetails as Record<string, string>;

  return (
    <>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .bg-gray-50 {
            background-color: white !important;
          }
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto print-area">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Receipt</h1>
            <p className="text-gray-600">NEM Insurance Salvage Management System</p>
          </div>

          {/* Payment Status Banner */}
          <div className={`rounded-lg p-4 mb-6 ${getStatusColor(payment.status)}`}>
            <div className="flex items-center justify-center">
              <p className="font-semibold text-lg">{getStatusText(payment.status)}</p>
            </div>
          </div>

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
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Total Amount Paid</p>
              <p className="text-3xl font-bold text-green-700">
                ₦{parseFloat(payment.amount).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Receipt Details */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Receipt Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Payment ID</p>
                <p className="font-semibold text-gray-900 font-mono text-sm">{payment.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Date</p>
                <p className="font-semibold text-gray-900">
                  {new Date(payment.createdAt).toLocaleString('en-NG', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="font-semibold text-gray-900 capitalize">
                  {payment.paymentMethod === 'escrow_wallet' ? 'Escrow Wallet' :
                   payment.paymentMethod === 'paystack' ? 'Paystack' :
                   payment.paymentMethod === 'flutterwave' ? 'Flutterwave' :
                   payment.paymentMethod === 'bank_transfer' ? 'Bank Transfer' :
                   payment.paymentMethod}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Reference</p>
                <p className="font-semibold text-gray-900 font-mono text-sm">
                  {payment.paymentReference || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Auction ID</p>
                <p className="font-semibold text-gray-900 font-mono text-sm">{payment.auctionId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Status</p>
                <p className={`font-semibold inline-block px-3 py-1 rounded-full text-sm ${getStatusColor(payment.status)}`}>
                  {getStatusText(payment.status)}
                </p>
              </div>
            </div>

            {/* Vendor Information */}
            {payment.vendor && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Business Name</p>
                    <p className="font-semibold text-gray-900">{payment.vendor.businessName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Vendor Tier</p>
                    <p className="font-semibold text-gray-900 capitalize">{payment.vendor.tier}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Print Button */}
            <div className="mt-6 pt-6 border-t border-gray-200 no-print">
              <button
                onClick={() => window.print()}
                className="w-full bg-burgundy-900 text-white py-3 px-6 rounded-lg font-semibold hover:bg-burgundy-800 transition-colors flex items-center justify-center gap-2"
              >
                <span>📄</span>
                Print/Download Receipt
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Use your browser's print function to save as PDF
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-gray-600 text-sm mt-8">
            <p>© {new Date().getFullYear()} NEM Insurance Plc. All rights reserved.</p>
            <p className="mt-2">For inquiries, contact: support@nemsalvage.com</p>
          </div>
        </div>
      </div>
    </>
  );
}
