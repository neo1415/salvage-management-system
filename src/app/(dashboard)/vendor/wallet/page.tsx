'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Wallet, Plus, TrendingUp, TrendingDown, Lock, Unlock, CreditCard, WifiOff, Clock } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useCachedWallet } from '@/hooks/use-cached-wallet';

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

interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function WalletPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [currentPage, setCurrentPage] = useState(1);
  const [fundingAmount, setFundingAmount] = useState<string>('');
  const [isFunding, setIsFunding] = useState(false);
  
  // Export states
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Fetch function for useCachedWallet hook
  const fetchWalletData = useCallback(async () => {
    // Fetch balance
    const balanceResponse = await fetch('/api/payments/wallet/balance');
    if (!balanceResponse.ok) {
      throw new Error('Failed to fetch wallet balance');
    }
    const balanceData = await balanceResponse.json();

    // Fetch transactions (get more for caching)
    const transactionsResponse = await fetch('/api/payments/wallet/transactions?page=1&limit=20');
    if (!transactionsResponse.ok) {
      throw new Error('Failed to fetch transactions');
    }
    const transactionsData = await transactionsResponse.json();

    return {
      balance: balanceData.balance,
      availableBalance: balanceData.availableBalance,
      frozenAmount: balanceData.frozenAmount,
      transactions: transactionsData.transactions || [],
    };
  }, []);

  // Use cached wallet hook
  const { 
    wallet, 
    isLoading: loading, 
    isOffline, 
    lastSynced, 
    refresh,
    error: walletError 
  } = useCachedWallet(session?.user?.id || null, fetchWalletData);

  // Extract balance and transactions from wallet data
  const balance = wallet ? {
    balance: wallet.balance,
    availableBalance: (wallet as any).availableBalance || 0,
    frozenAmount: (wallet as any).frozenAmount || 0,
  } : null;

  const allTransactions = (wallet?.transactions || []) as unknown as WalletTransaction[];
  
  // Paginate transactions locally
  const itemsPerPage = 10;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const transactions = allTransactions.slice(startIndex, endIndex);
  
  const pagination: PaginationMeta = {
    total: allTransactions.length,
    limit: itemsPerPage,
    offset: startIndex,
    page: currentPage,
    totalPages: Math.ceil(allTransactions.length / itemsPerPage),
    hasNextPage: endIndex < allTransactions.length,
    hasPrevPage: currentPage > 1,
  };

  const [error, setError] = useState<string | null>(null);

  // Sync error with wallet error
  useEffect(() => {
    if (walletError) {
      setError(walletError.message);
    }
  }, [walletError]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Check for payment success callback - FIXED: Run only once on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('status');
    
    if (paymentStatus === 'success') {
      // Refresh wallet data after successful payment
      setTimeout(() => {
        refresh();
      }, 2000); // Wait 2 seconds for webhook to process
      
      // Clear URL parameters
      window.history.replaceState({}, '', '/vendor/wallet');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // FIXED: Wrap handleAddFunds in useCallback to prevent recreation
  const handleAddFunds = useCallback(async () => {
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
  }, [fundingAmount]); // Depend on fundingAmount

  // FIXED: Memoize helper functions to prevent recreation
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(amount);
  }, []); // No dependencies - stable function

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []); // No dependencies - stable function

  const getTransactionIcon = useCallback((type: string) => {
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
  }, []); // No dependencies - stable function

  const getTransactionColor = useCallback((type: string) => {
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
  }, []); // No dependencies - stable function

  // Export functions
  const handleExportCSV = useCallback(async () => {
    try {
      setExporting(true);
      
      // Use all cached transactions for export
      const allTransactions = (wallet?.transactions || []) as unknown as WalletTransaction[];
      
      // Prepare CSV data
      const headers = ['Transaction ID', 'Type', 'Amount', 'Balance After', 'Description', 'Date', 'Reference'];
      const csvRows = [headers.join(',')];
      
      allTransactions.forEach((transaction: WalletTransaction) => {
        const values = [
          escapeCSVField(transaction.id),
          escapeCSVField(transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)),
          escapeCSVField(formatCurrency(transaction.amount)),
          escapeCSVField(formatCurrency(transaction.balanceAfter)),
          escapeCSVField(transaction.description),
          escapeCSVField(formatDate(transaction.createdAt)),
          escapeCSVField(transaction.reference)
        ];
        csvRows.push(values.join(','));
      });

      const csvContent = csvRows.join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().split('T')[0];
      
      link.setAttribute('href', url);
      link.setAttribute('download', `wallet-transactions-${date}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert(`Successfully exported ${allTransactions.length} transactions to CSV`);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  }, [wallet, formatCurrency, formatDate]);

  const handleExportPDF = useCallback(async () => {
    try {
      setExporting(true);
      
      // Use all cached transactions for export
      const allTransactions = (wallet?.transactions || []) as unknown as WalletTransaction[];
      
      // Dynamically import jsPDF and services
      const { jsPDF } = await import('jspdf');
      const { PDFTemplateService } = await import('@/features/documents/services/pdf-template.service');
      
      const doc = new jsPDF();
      
      // Add letterhead
      await PDFTemplateService.addLetterhead(doc, 'WALLET TRANSACTIONS REPORT');
      
      // Add table data
      let y = 65; // Start below letterhead
      const maxY = PDFTemplateService.getMaxContentY(doc);
      
      // Add headers
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Date', 15, y);
      doc.text('Type', 50, y);
      doc.text('Amount', 80, y);
      doc.text('Balance', 115, y);
      doc.text('Description', 150, y);
      
      y += 5;
      doc.setFont('helvetica', 'normal');
      
      // Add data rows
      for (const transaction of allTransactions) {
        if (y > maxY) {
          // Add footer to current page
          PDFTemplateService.addFooter(doc);
          // Start new page
          doc.addPage();
          await PDFTemplateService.addLetterhead(doc, 'WALLET TRANSACTIONS REPORT');
          y = 65;
          
          // Re-add headers on new page
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text('Date', 15, y);
          doc.text('Type', 50, y);
          doc.text('Amount', 80, y);
          doc.text('Balance', 115, y);
          doc.text('Description', 150, y);
          y += 5;
          doc.setFont('helvetica', 'normal');
        }
        
        const date = new Date(transaction.createdAt).toLocaleDateString('en-NG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        
        doc.text(date, 15, y);
        doc.text(transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1), 50, y);
        doc.text(formatCurrency(transaction.amount), 80, y);
        doc.text(formatCurrency(transaction.balanceAfter), 115, y);
        doc.text(transaction.description.substring(0, 30), 150, y);
        y += 5;
      }
      
      // Add footer to last page
      PDFTemplateService.addFooter(doc, `Total Transactions: ${allTransactions.length}`);
      
      // Download PDF
      const date = new Date().toISOString().split('T')[0];
      doc.save(`wallet-transactions-${date}.pdf`);
      
      alert(`Successfully exported ${allTransactions.length} transactions to PDF`);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  }, [wallet, formatCurrency]);

  const escapeCSVField = (field: string | number): string => {
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Pagination handlers
  const handleNextPage = () => {
    if (pagination && pagination.hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (pagination && pagination.hasPrevPage) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Wallet className="w-8 h-8 text-[#800020]" />
                Escrow Wallet
              </h1>
              <p className="mt-2 text-gray-600">
                Pre-fund your wallet for instant bidding and faster payments
              </p>
            </div>
            
            {/* Last Synced Timestamp */}
            {lastSynced && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>
                  Last synced: {new Date(lastSynced).toLocaleString('en-NG', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Offline Warning Banner */}
        {isOffline && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <div className="flex items-center">
              <WifiOff className="w-5 h-5 text-yellow-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  You are viewing cached wallet data
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Transaction actions are disabled while offline. Your data will sync automatically when you're back online.
                  {lastSynced && (
                    <span className="block mt-1">
                      Last updated: {new Date(lastSynced).toLocaleString('en-NG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

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
                disabled={isFunding || !fundingAmount || !isOnline}
                className="w-full sm:w-auto px-8 py-3 bg-[#FFD700] text-[#800020] font-bold rounded-lg hover:bg-[#FFC700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title={!isOnline ? 'Adding funds is not available offline' : 'Add funds via Paystack'}
              >
                {isFunding ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#800020]"></div>
                    Processing...
                  </>
                ) : !isOnline ? (
                  <>
                    <WifiOff className="w-5 h-5" />
                    Offline
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
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>
            
            {/* Export Dropdown */}
            {transactions.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={exporting || !isOnline}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title={!isOnline ? 'Export is not available offline' : 'Export transactions'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export
                  {!isOnline && <WifiOff className="w-4 h-4 text-gray-400" />}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    <button
                      onClick={handleExportCSV}
                      disabled={exporting}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 disabled:opacity-50"
                    >
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Export as CSV</span>
                    </button>
                    <button
                      onClick={handleExportPDF}
                      disabled={exporting}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 border-t border-gray-100 disabled:opacity-50"
                    >
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Export as PDF</span>
                    </button>
                  </div>
                )}
              </div>
            )}
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
          
          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} transactions
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={!pagination.hasPrevPage}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                
                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageClick(pageNum)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          pagination.page === pageNum
                            ? 'bg-[#800020] text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={handleNextPage}
                  disabled={!pagination.hasNextPage}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
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
              <span>When you win an auction, the bid amount is frozen, then you must sign all necessary documents</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>After all documents are signed, the frozen funds are paid and you receive your authorization code to collect your item</span>
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
