'use client';

/**
 * Transactions Settings Page
 * Displays transaction history with filters and export functionality
 * 
 * Features:
 * - Tabs: Wallet Transactions, Bid History, Payment History
 * - Date range filters
 * - Transaction type and status filters
 * - Pagination
 * - Export to CSV
 */

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import TransactionHistory from '@/components/settings/transaction-history';
import TransactionFilters from '@/components/settings/transaction-filters';

type TransactionTab = 'wallet' | 'bids' | 'payments';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface Filters {
  dateRange: DateRange;
  status?: string;
}

export default function TransactionsPage() {
  const { data: _session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TransactionTab>('wallet');
  const [filters, setFilters] = useState<Filters>({
    dateRange: {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    },
  });
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setExporting(true);

      const params = new URLSearchParams({
        type: activeTab,
        format,
        startDate: filters.dateRange.startDate,
        endDate: filters.dateRange.endDate,
        ...(filters.status && { status: filters.status }),
      });

      const response = await fetch(`/api/vendor/settings/transactions/export?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to export transactions');
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().split('T')[0];
      a.download = `wallet-transactions-${date}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting transactions:', error);
      alert('Failed to export transactions. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const tabs = [
    { id: 'wallet' as TransactionTab, label: 'Wallet Transactions', icon: '💰' },
    { id: 'bids' as TransactionTab, label: 'Bid History', icon: '🔨' },
    { id: 'payments' as TransactionTab, label: 'Payment History', icon: '💳' },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
          <p className="text-gray-600 mt-1">View and export your transaction history</p>
        </div>
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={exporting}
            className="px-4 py-2 bg-[#800020] text-white rounded-lg hover:bg-[#600018] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {exporting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
          {showExportMenu && !exporting && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  handleExport('csv');
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export as CSV
              </button>
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  handleExport('pdf');
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center border-t border-gray-100"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Export as PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#800020] text-[#800020]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200">
          <TransactionFilters
            filters={filters}
            onFiltersChange={setFilters}
            transactionType={activeTab}
          />
        </div>

        {/* Transaction List */}
        <div className="p-6">
          <TransactionHistory
            transactionType={activeTab}
            filters={filters}
          />
        </div>
      </div>
    </div>
  );
}
