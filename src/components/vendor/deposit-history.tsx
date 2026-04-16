'use client';

import { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, Lock, AlertCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface DepositEvent {
  id: string;
  auctionId: string;
  eventType: 'freeze' | 'unfreeze' | 'forfeit';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  availableBefore: number;
  availableAfter: number;
  frozenBefore: number;
  frozenAfter: number;
  createdAt: string;
  auction?: {
    id: string;
    assetName: string;
    status: string;
  };
}

interface WalletBalance {
  balance: number;
  availableBalance: number;
  frozenAmount: number;
  forfeitedAmount: number;
}

interface ActiveDeposit {
  auctionId: string;
  assetName: string;
  depositAmount: number;
  status: string;
  createdAt: string;
}

interface DepositHistoryProps {
  vendorId: string;
  className?: string;
}

export function DepositHistory({ vendorId, className = '' }: DepositHistoryProps) {
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [depositEvents, setDepositEvents] = useState<DepositEvent[]>([]);
  const [activeDeposits, setActiveDeposits] = useState<ActiveDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  useEffect(() => {
    fetchWalletBalance();
    fetchDepositHistory();
  }, [vendorId, page]);

  const fetchWalletBalance = async () => {
    try {
      const response = await fetch(`/api/vendors/${vendorId}/wallet`);
      if (response.ok) {
        const data = await response.json();
        setWalletBalance(data.wallet);
        setActiveDeposits(data.activeDeposits || []);
      }
    } catch (error) {
      console.error('Failed to fetch wallet balance:', error);
    }
  };

  const fetchDepositHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/vendors/${vendorId}/wallet/deposit-history?page=${page}&limit=${limit}`
      );
      if (response.ok) {
        const data = await response.json();
        setDepositEvents(data.events);
        setTotalPages(Math.ceil(data.total / limit));
      }
    } catch (error) {
      console.error('Failed to fetch deposit history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'freeze':
        return <Lock className="w-4 h-4 text-orange-600" />;
      case 'unfreeze':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'forfeit':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'freeze':
        return 'Deposit Frozen';
      case 'unfreeze':
        return 'Deposit Unfrozen';
      case 'forfeit':
        return 'Deposit Forfeited';
      default:
        return eventType;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'freeze':
        return 'text-orange-600 bg-orange-50';
      case 'unfreeze':
        return 'text-green-600 bg-green-50';
      case 'forfeit':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading && page === 1) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      {/* Wallet Balance Summary */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-[#800020] rounded-full flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Wallet & Deposits</h2>
        </div>

        {walletBalance && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Total Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                ₦{walletBalance.balance.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-xs text-green-700 mb-1">Available</p>
              <p className="text-2xl font-bold text-green-600">
                ₦{walletBalance.availableBalance.toLocaleString()}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-xs text-orange-700 mb-1">Frozen (Deposits)</p>
              <p className="text-2xl font-bold text-orange-600">
                ₦{walletBalance.frozenAmount.toLocaleString()}
              </p>
            </div>
            {walletBalance.forfeitedAmount > 0 && (
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-xs text-red-700 mb-1">Forfeited</p>
                <p className="text-2xl font-bold text-red-600">
                  ₦{walletBalance.forfeitedAmount.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Deposits */}
      {activeDeposits.length > 0 && (
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Deposits</h3>
          <div className="space-y-3">
            {activeDeposits.map((deposit) => (
              <Link
                key={deposit.auctionId}
                href={`/vendor/auctions/${deposit.auctionId}`}
                className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors group"
              >
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 group-hover:text-[#800020] transition-colors">
                    {deposit.assetName}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Status: <span className="font-medium">{deposit.status}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-orange-600">
                    ₦{deposit.depositAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(deposit.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 ml-3 group-hover:text-[#800020] transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Deposit History */}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Deposit History</h3>

        {depositEvents.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No deposit history yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Your deposit transactions will appear here
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                      Event
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                      Auction
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                      Amount
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                      Available
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                      Frozen
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {depositEvents.map((event) => (
                    <tr key={event.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {getEventIcon(event.eventType)}
                          <span className={`text-sm font-medium px-2 py-1 rounded ${getEventColor(event.eventType)}`}>
                            {getEventLabel(event.eventType)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {event.auction ? (
                          <Link
                            href={`/vendor/auctions/${event.auctionId}`}
                            className="text-sm text-[#800020] hover:underline font-medium"
                          >
                            {event.auction.assetName}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          ₦{event.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="text-sm">
                          <span className="text-gray-400">
                            ₦{event.availableBefore.toLocaleString()}
                          </span>
                          <span className="mx-1 text-gray-300">→</span>
                          <span className="font-medium text-gray-900">
                            ₦{event.availableAfter.toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="text-sm">
                          <span className="text-gray-400">
                            ₦{event.frozenBefore.toLocaleString()}
                          </span>
                          <span className="mx-1 text-gray-300">→</span>
                          <span className="font-medium text-gray-900">
                            ₦{event.frozenAfter.toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-sm text-gray-600">
                          {new Date(event.createdAt).toLocaleDateString()}
                        </span>
                        <br />
                        <span className="text-xs text-gray-400">
                          {new Date(event.createdAt).toLocaleTimeString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
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
    </div>
  );
}
