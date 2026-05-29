'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ChevronDown, CreditCard, Download, Gavel, Loader2, Wallet } from 'lucide-react';
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

const tabs = [
  { id: 'wallet' as const, label: 'Wallet Transactions', Icon: Wallet },
  { id: 'bids' as const, label: 'Bid History', Icon: Gavel },
  { id: 'payments' as const, label: 'Payment History', Icon: CreditCard },
];

export default function SettingsTransactionsPage() {
  const { data: session, status } = useSession();
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'vendor') {
      router.push('/settings/profile');
    }
  }, [router, session?.user?.role, status]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
          <p className="text-gray-600 mt-1">View and export your transaction history</p>
        </div>
        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={exporting}
            className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
                <ChevronDown className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
          {showExportMenu && !exporting && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
              <button
                type="button"
                onClick={() => {
                  setShowExportMenu(false);
                  handleExport('csv');
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center"
              >
                Export as CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExportMenu(false);
                  handleExport('pdf');
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center border-t border-gray-100"
              >
                Export as PDF
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === id
                    ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 border-b border-gray-200">
          <TransactionFilters
            filters={filters}
            onFiltersChange={setFilters}
            transactionType={activeTab}
          />
        </div>

        <div className="p-6">
          <TransactionHistory transactionType={activeTab} filters={filters} />
        </div>
      </div>
    </div>
  );
}
