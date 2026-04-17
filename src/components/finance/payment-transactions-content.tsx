'use client';

import { useState, useEffect } from 'react';
import { AuctionCardWithActions } from './auction-card-with-actions';
import { Filter } from 'lucide-react';

interface AuctionData {
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

interface GroupedAuctions {
  awaiting_documents: AuctionData[];
  awaiting_payment: AuctionData[];
  deposit_forfeited: AuctionData[];
  paid: AuctionData[];
  failed_all_fallbacks: AuctionData[];
}

export function PaymentTransactionsContent() {
  const [auctions, setAuctions] = useState<GroupedAuctions>({
    awaiting_documents: [],
    awaiting_payment: [],
    deposit_forfeited: [],
    paid: [],
    failed_all_fallbacks: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchAuctions();
  }, [page, selectedStatus]);

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(selectedStatus !== 'all' && { status: selectedStatus }),
      });

      const response = await fetch(`/api/finance/payment-transactions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAuctions(data.auctions);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchAuctions();
  };

  const statusOptions = [
    { value: 'all', label: 'All Statuses', count: Object.values(auctions).flat().length },
    { value: 'awaiting_documents', label: 'Awaiting Documents', count: auctions.awaiting_documents.length },
    { value: 'awaiting_payment', label: 'Awaiting Payment', count: auctions.awaiting_payment.length },
    { value: 'deposit_forfeited', label: 'Deposit Forfeited', count: auctions.deposit_forfeited.length },
    { value: 'failed_all_fallbacks', label: 'Failed Fallbacks', count: auctions.failed_all_fallbacks.length },
    { value: 'paid', label: 'Paid', count: auctions.paid.length },
  ];

  const renderAuctionGroup = (title: string, auctionList: AuctionData[], color: string) => {
    if (auctionList.length === 0) return null;

    return (
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${color}`}>
            {auctionList.length}
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {auctionList.map((auction) => (
            <AuctionCardWithActions
              key={auction.id}
              auction={auction}
              onExtensionGranted={handleRefresh}
              onForfeitureTransferred={handleRefresh}
            />
          ))}
        </div>
      </div>
    );
  };

  if (loading && page === 1) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
            <div className="space-y-3">
              <div className="h-32 bg-gray-200 rounded" />
              <div className="h-32 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const allAuctions = Object.values(auctions).flat();

  return (
    <div>
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filter by Status:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setSelectedStatus(option.value);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedStatus === option.value
                    ? 'bg-[#800020] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
                {option.count > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                    {option.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Auctions */}
      {allAuctions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <p className="text-gray-500 text-lg">No auctions found</p>
          <p className="text-gray-400 text-sm mt-2">
            {selectedStatus !== 'all'
              ? 'Try selecting a different status filter'
              : 'Payment transactions will appear here'}
          </p>
        </div>
      ) : (
        <>
          {selectedStatus === 'all' ? (
            <>
              {renderAuctionGroup(
                'Awaiting Documents',
                auctions.awaiting_documents,
                'bg-blue-100 text-blue-700'
              )}
              {renderAuctionGroup(
                'Awaiting Payment',
                auctions.awaiting_payment,
                'bg-yellow-100 text-yellow-700'
              )}
              {renderAuctionGroup(
                'Deposit Forfeited',
                auctions.deposit_forfeited,
                'bg-red-100 text-red-700'
              )}
              {renderAuctionGroup(
                'Failed All Fallbacks',
                auctions.failed_all_fallbacks,
                'bg-gray-100 text-gray-700'
              )}
              {renderAuctionGroup(
                'Paid',
                auctions.paid,
                'bg-green-100 text-green-700'
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {allAuctions.map((auction) => (
                <AuctionCardWithActions
                  key={auction.id}
                  auction={auction}
                  onExtensionGranted={handleRefresh}
                  onForfeitureTransferred={handleRefresh}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8 p-4 bg-white rounded-lg shadow-sm">
              <p className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#800020] rounded-lg hover:bg-[#600018] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
