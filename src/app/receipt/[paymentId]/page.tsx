'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAppRouter } from '@/hooks/use-app-router';
import { usePublicBranding } from '@/hooks/use-public-branding';
import { formatNgnAmount } from '@/lib/utils/format-ngn';

interface PaymentDetails {
  id: string;
  auctionId: string;
  amount: string;
  status: 'pending' | 'verified' | 'rejected' | 'overdue';
  paymentDeadline: string | null;
  escrowStatus?: 'none' | 'frozen' | 'released';
  paymentMethod: string;
  paymentReference: string | null;
  paymentProofUrl: string | null;
  createdAt: string | null;
  vendor?: {
    id: string;
    businessName: string;
    contactName?: string;
    email?: string;
    phone?: string;
    tier: string;
  };
  auction: {
    id: string;
    caseId: string;
    currentBid: string;
    case: {
      claimReference: string;
      assetType: string;
      assetName?: string;
      assetDetails: Record<string, unknown>;
      marketValue: string;
      estimatedSalvageValue: string;
      locationName: string;
      photos: string[];
    };
  } | null;
  nem?: {
    name: string;
    address: string;
    email: string;
    phone: string;
  };
  pickupAuthCode?: string | null;
}

export default function PublicReceiptPage() {
  const params = useParams();
  const router = useAppRouter();
  const { branding } = usePublicBranding();
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
          router.push(`/login?callbackUrl=${returnUrl}`);
          return;
        }
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error || errorData?.message || 'Failed to fetch payment details');
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)] mx-auto"></div>
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
              onClick={() => router.push('/login')}
              className="px-4 py-2 bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] rounded-lg hover:bg-[var(--brand-primary-hover)]"
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

  if (!payment.auction) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Receipt</h1>
            <p className="text-gray-600">{branding.brandName} Salvage Management System</p>
          </div>
          <div className={`rounded-lg p-4 mb-6 ${getStatusColor(payment.status)}`}>
            <p className="text-center font-semibold text-lg">{getStatusText(payment.status)}</p>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Payment Purpose</p>
              <p className="font-semibold text-gray-900">Vendor Registration Fee</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Amount Paid</p>
              <p className="text-3xl font-bold text-green-700">
                {formatNgnAmount(payment.amount)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment Reference</p>
              <p className="font-mono text-sm font-semibold text-gray-900">{payment.paymentReference || 'N/A'}</p>
            </div>
            {payment.vendor && (
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600">Vendor</p>
                <p className="font-semibold text-gray-900">
                  {payment.vendor.businessName || payment.vendor.contactName || 'Vendor'}
                </p>
                {payment.vendor.email && <p className="text-sm text-gray-600">{payment.vendor.email}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const assetDetails = (payment.auction?.case.assetDetails || {}) as Record<string, string>;
  const auctionCase = payment.auction?.case;
  const assetName = payment.auction ? payment.auction.case.assetName || [
    assetDetails.year,
    assetDetails.make || assetDetails.brand,
    assetDetails.model,
  ].filter(Boolean).join(' ') || payment.auction.case.assetType : 'Vendor Registration Fee';

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
            <p className="text-gray-600">{branding.brandName} Salvage Management System</p>
          </div>

          {/* Payment Status Banner */}
          <div className={`rounded-lg p-4 mb-6 ${getStatusColor(payment.status)}`}>
            <div className="flex items-center justify-center">
              <p className="font-semibold text-lg">{getStatusText(payment.status)}</p>
            </div>
          </div>

          {/* Item Details */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {payment.auction ? 'Item Details' : 'Registration Details'}
            </h2>
            
            {/* Photos */}
            {payment.auction && payment.auction.case.photos.length > 0 && (
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
                <p className="text-sm text-gray-600">Item</p>
                <p className="font-semibold text-gray-900">{assetName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Pickup Authorization Code</p>
                <p className="font-semibold text-gray-900 font-mono">
                  {payment.pickupAuthCode || 'Available after payment verification'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Asset Type</p>
                <p className="font-semibold text-gray-900 capitalize">
                  {auctionCase?.assetType || 'registration'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Location</p>
                <p className="font-semibold text-gray-900">{auctionCase?.locationName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Market Value</p>
                <p className="font-semibold text-gray-900">
                  {formatNgnAmount(payment.auction.case.marketValue, { decimals: 0 })}
                </p>
              </div>
              
              {/* Asset-specific details */}
              {auctionCase?.assetType === 'vehicle' && (
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
                {formatNgnAmount(payment.amount)}
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
                  {payment.createdAt ? new Date(payment.createdAt).toLocaleString('en-NG', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }) : 'N/A'}
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
                <p className="font-semibold text-gray-900 font-mono text-sm">{payment.auctionId || 'N/A'}</p>
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
                  {payment.vendor.contactName && (
                    <div>
                      <p className="text-sm text-gray-600">Contact Name</p>
                      <p className="font-semibold text-gray-900">{payment.vendor.contactName}</p>
                    </div>
                  )}
                  {payment.vendor.email && (
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-semibold text-gray-900">{payment.vendor.email}</p>
                    </div>
                  )}
                  {payment.vendor.phone && (
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-semibold text-gray-900">{payment.vendor.phone}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Vendor Tier</p>
                    <p className="font-semibold text-gray-900 capitalize">{payment.vendor.tier}</p>
                  </div>
                </div>
              </div>
            )}

            {payment.nem && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{branding.brandName} Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Company</p>
                    <p className="font-semibold text-gray-900">{payment.nem.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-semibold text-gray-900">{payment.nem.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-semibold text-gray-900">{payment.nem.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Address</p>
                    <p className="font-semibold text-gray-900">
                      {payment.nem.address || branding.supportAddress || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Print Button */}
            <div className="mt-6 pt-6 border-t border-gray-200 no-print">
              <button
                onClick={() => window.print()}
                className="w-full bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] py-3 px-6 rounded-lg font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors flex items-center justify-center gap-2"
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
            <p>© {new Date().getFullYear()} {branding.legalName || branding.brandName}. All rights reserved.</p>
            <p className="mt-2">For inquiries, contact: {branding.supportEmail}</p>
          </div>
        </div>
      </div>
    </>
  );
}
