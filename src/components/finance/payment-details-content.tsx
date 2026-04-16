'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, User, DollarSign, FileText, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Lock } from 'lucide-react';
import Link from 'next/link';

interface TimelineEvent {
  id: string;
  type: 'bid' | 'deposit_freeze' | 'deposit_unfreeze' | 'winner_selected' | 'document_generated' | 'document_signed' | 'extension_granted' | 'forfeiture' | 'payment' | 'fallback';
  timestamp: string;
  actor?: {
    id: string;
    name: string;
    role: string;
  };
  details: Record<string, any>;
}

interface AuctionDetails {
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
  timeline: TimelineEvent[];
}

interface PaymentDetailsContentProps {
  auctionId: string;
}

export function PaymentDetailsContent({ auctionId }: PaymentDetailsContentProps) {
  const router = useRouter();
  const [auction, setAuction] = useState<AuctionDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuctionDetails();
  }, [auctionId]);

  const fetchAuctionDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/auctions/${auctionId}/timeline`);
      if (response.ok) {
        const data = await response.json();
        setAuction(data.auction);
      }
    } catch (error) {
      console.error('Failed to fetch auction details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      bid: <TrendingUp className="w-4 h-4 text-blue-600" />,
      deposit_freeze: <Lock className="w-4 h-4 text-orange-600" />,
      deposit_unfreeze: <TrendingDown className="w-4 h-4 text-green-600" />,
      winner_selected: <CheckCircle2 className="w-4 h-4 text-green-600" />,
      document_generated: <FileText className="w-4 h-4 text-blue-600" />,
      document_signed: <CheckCircle2 className="w-4 h-4 text-green-600" />,
      extension_granted: <Clock className="w-4 h-4 text-yellow-600" />,
      forfeiture: <AlertTriangle className="w-4 h-4 text-red-600" />,
      payment: <DollarSign className="w-4 h-4 text-green-600" />,
      fallback: <User className="w-4 h-4 text-orange-600" />,
    };
    return icons[type] || <Clock className="w-4 h-4 text-gray-600" />;
  };

  const getEventTitle = (event: TimelineEvent) => {
    const titles: Record<string, string> = {
      bid: 'Bid Placed',
      deposit_freeze: 'Deposit Frozen',
      deposit_unfreeze: 'Deposit Unfrozen',
      winner_selected: 'Winner Selected',
      document_generated: 'Documents Generated',
      document_signed: 'Document Signed',
      extension_granted: 'Extension Granted',
      forfeiture: 'Deposit Forfeited',
      payment: 'Payment Received',
      fallback: 'Fallback Triggered',
    };
    return titles[event.type] || event.type;
  };

  const getEventDescription = (event: TimelineEvent) => {
    switch (event.type) {
      case 'bid':
        return `Bid amount: ₦${event.details.amount?.toLocaleString() || 0}`;
      case 'deposit_freeze':
      case 'deposit_unfreeze':
        return `Amount: ₦${event.details.amount?.toLocaleString() || 0}`;
      case 'extension_granted':
        return `Reason: ${event.details.reason || 'N/A'}`;
      case 'document_signed':
        return `Document: ${event.details.documentType || 'N/A'}`;
      case 'payment':
        return `Method: ${event.details.paymentMethod || 'N/A'} | Amount: ₦${event.details.amount?.toLocaleString() || 0}`;
      case 'fallback':
        return `Previous winner: ${event.details.previousWinner || 'N/A'} | New winner: ${event.details.newWinner || 'N/A'}`;
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6" />
          <div className="space-y-4">
            <div className="h-24 bg-gray-200 rounded" />
            <div className="h-24 bg-gray-200 rounded" />
            <div className="h-24 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-gray-600 text-lg">Auction not found</p>
        <Link
          href="/finance/payment-transactions"
          className="inline-block mt-4 text-[#800020] hover:underline"
        >
          Back to Payment Transactions
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{auction.assetName}</h1>
          <p className="text-gray-600 mt-1">Auction ID: {auction.id}</p>
        </div>
      </div>

      {/* Auction Details */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Auction Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">Winner</p>
            <p className="font-semibold text-gray-900">{auction.winner.name}</p>
            <p className="text-sm text-gray-600">{auction.winner.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Status</p>
            <p className="font-semibold text-gray-900">{auction.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Final Bid</p>
            <p className="text-2xl font-bold text-gray-900">
              ₦{auction.finalBid.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Deposit Amount</p>
            <p className="text-2xl font-bold text-orange-600">
              ₦{auction.depositAmount.toLocaleString()}
            </p>
          </div>
          {auction.documentDeadline && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Document Deadline</p>
              <p className="font-semibold text-gray-900">
                {new Date(auction.documentDeadline).toLocaleString()}
              </p>
            </div>
          )}
          {auction.paymentDeadline && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Payment Deadline</p>
              <p className="font-semibold text-gray-900">
                {new Date(auction.paymentDeadline).toLocaleString()}
              </p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-500 mb-1">Extensions Used</p>
            <p className="font-semibold text-gray-900">
              {auction.extensionCount} / {auction.maxExtensions}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Event Timeline</h2>
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

          {/* Timeline Events */}
          <div className="space-y-6">
            {auction.timeline.map((event, index) => (
              <div key={event.id} className="relative flex gap-4">
                {/* Icon */}
                <div className="relative z-10 flex-shrink-0 w-12 h-12 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center">
                  {getEventIcon(event.type)}
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {getEventTitle(event)}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {event.actor && (
                      <p className="text-sm text-gray-600 mb-2">
                        By: {event.actor.name} ({event.actor.role})
                      </p>
                    )}
                    {getEventDescription(event) && (
                      <p className="text-sm text-gray-700">
                        {getEventDescription(event)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
