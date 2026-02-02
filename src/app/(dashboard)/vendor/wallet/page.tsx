'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Wallet, Plus, TrendingUp, TrendingDown, Lock, Unlock, CreditCard } from 'lucide-react';

interface WalletBalance {
  balance: number;
  availableBalance: number;
  frozenAmount: number;
}

interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit' | 'freeze' | 'unfreeze';
  amount: number;
  balanceAfter: number;
  reference: string;
  description: string;
  createdAt: string;
}

export default function WalletPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fundingAmount, setFundingAmount] = useState<string>('');
  const [isFunding, setIsFunding] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Fetch wallet balance and transactions
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      fetchWalletData();
    }
  }, [status, session]);

  // Check for payment success callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('status');
    
    if (paymentStatus === 'success') {
      // Refresh wallet data after successful payment
      setTimeout(() => {
        fetchWalletData();
      }, 2000); // Wait 2 seconds for webhook to process
      
      // Clear URL parameters
      window.history.replaceState({}, '', '/vendor/wallet');
    }
  }, []);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch balance
      const balanceResponse = await fetch('/api/payments/wallet/balance');
      if (!balanceResponse.ok) {
        throw new Error('Failed to fetch wallet balance');
      }
      const balanceData = await balanceResponse.json();
      setBalance(balanceData);

      // Fetch transactions
      const transactionsResponse = await fetch('/api/payments/wallet/transactions');
      if (!transactionsResponse.ok) {
        throw new Error('Failed to fetch transactions');
      }
      const transactionsData = await transactionsResponse.json();
      setTransactions(transactionsData);
    } catch (err) {
      console.error('Error fetching wallet data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async () => {
    const amount = parseFloat(fundingAmount);
    
    // Validate amount
    if (isNaN(amount) || amount < 50000 || amount > 5000000) {
      alert('Please enter an amount between ₦50,000 and ₦5,000,000');
      return;
    }

    try {
      setIsFunding(true);
      setError(null);

      const response = await fetch('/api/payments/wallet/fund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate funding');
      }

      const data = await response.json();
      
      // Redirect to Paystack payment page
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (err) {
      console.error('Error funding wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to initiate funding');
      setIsFunding(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'credit':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'debit':
        return <TrendingDown className="w-5 h-5 text-red-600" />;
      case 'freeze':
        return <Lock className="w-5 h-5 text-yellow-600" />;
      case 'unfreeze':
        return <Unlock className="w-5 h-5 text-blue-600" />;
      default:
        return <Wallet className="w-5 h-5 text-gray-600" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'credit':
        return 'text-green-600';
      case 'debit':
        return 'text-red-600';
      case 'freeze':
        return 'text-yellow-600';
      case 'unfreeze':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Wallet className="w-8 h-8 text-[#800020]" />
            Escrow Wallet
          </h1>
          <p className="mt-2 text-gray-600">
            Pre-fund your wallet for instant bidding and faster payments
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Balance */}
          <div className="bg-gradient-to-br from-[#800020] to-[#600018] rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium opacity-90">Total Balance</h3>
              <Wallet className="w-6 h-6 opacity-80" />
            </div>
            <p className="text-3xl font-bold">
              {balance ? formatCurrency(balance.balance) : '₦0.00'}
            </p>
            <p className="text-xs opacity-75 mt-2">
              Available + Frozen funds
            </p>
          </div>

          {/* Available Balance */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Available Balance</h3>
              <Unlock className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-600">
              {balance ? formatCurrency(balance.availableBalance) : '₦0.00'}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Ready for bidding
            </p>
          </div>

          {/* Frozen Amount */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-yellow-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Frozen Amount</h3>
              <Lock className="w-6 h-6 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-yellow-600">
              {balance ? formatCurrency(balance.frozenAmount) : '₦0.00'}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Reserved for active bids
            </p>
          </div>
        </div>

        {/* Add Funds Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="w-6 h-6 text-[#800020]" />
            Add Funds
          </h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount (₦50,000 - ₦5,000,000)
              </label>
              <input
                type="number"
                id="amount"
                value={fundingAmount}
                onChange={(e) => setFundingAmount(e.target.value)}
                placeholder="Enter amount"
                min="50000"
                max="5000000"
                step="1000"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                disabled={isFunding}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddFunds}
                disabled={isFunding || !fundingAmount}
                className="w-full sm:w-auto px-8 py-3 bg-[#FFD700] text-[#800020] font-bold rounded-lg hover:bg-[#FFC700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isFunding ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#800020]"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Add Funds via Paystack
                  </>
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Funds will be credited immediately after successful payment via Paystack
          </p>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>
          </div>
          
          {transactions.length === 0 ? (
            <div className="p-12 text-center">
              <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No transactions yet</p>
              <p className="text-sm text-gray-400 mt-2">
                Add funds to your wallet to get started
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance After
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(transaction.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(transaction.type)}
                          <span className={`text-sm font-medium capitalize ${getTransactionColor(transaction.type)}`}>
                            {transaction.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="max-w-md">
                          <p className="truncate">{transaction.description}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Ref: {transaction.reference}
                          </p>
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${getTransactionColor(transaction.type)}`}>
                        {transaction.type === 'credit' || transaction.type === 'unfreeze' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(transaction.balanceAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">How Escrow Wallet Works</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Pre-fund your wallet to speed up future payments and enable instant bidding</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>When you win an auction, the bid amount is automatically frozen from your available balance</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>After pickup confirmation, frozen funds are released to NEM Insurance</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Your remaining balance stays available for your next bid</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>All transactions are secured and processed via Paystack</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
