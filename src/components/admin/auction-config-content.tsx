'use client';

import { useEffect, useState } from 'react';
import { History, Settings } from 'lucide-react';
import { ConfigForm } from './config-form';
import { ConfigHistory } from './config-history';
import { BID_OTP_MODE_LABELS } from '@/features/business-policy/bid-otp-decisions';
import type { BidOtpMode } from '@/features/business-policy/types';

type Tab = 'config' | 'history';

export function AuctionConfigContent() {
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [bidOtpMode, setBidOtpMode] = useState<BidOtpMode | null>(null);

  useEffect(() => {
    let active = true;

    const fetchBidOtpPolicy = async () => {
      try {
        const response = await fetch('/api/admin/business-policy');
        if (!response.ok) return;
        const data = await response.json();
        const mode = data.policy?.auctions?.bidOtpMode;
        if (active && (mode === 'none' || mode === 'tier1_only' || mode === 'all')) {
          setBidOtpMode(mode);
        }
      } catch (error) {
        console.error('Failed to fetch bid OTP policy:', error);
      }
    };

    void fetchBidOtpPolicy();
    return () => {
      active = false;
    };
  }, []);

  const tabs = [
    { id: 'config' as const, label: 'Configuration', icon: Settings },
    { id: 'history' as const, label: 'Change History', icon: History },
  ];

  return (
    <div>
      <div className="mb-6 rounded-lg bg-white shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {activeTab === 'config' ? (
        <>
          {bidOtpMode ? (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-sm font-semibold text-blue-900">Bid OTP policy</h3>
              <p className="mt-1 text-sm text-blue-800">{BID_OTP_MODE_LABELS[bidOtpMode]}</p>
              <p className="mt-2 text-xs text-blue-700">
                Change this in Enterprise Setup under Auction Rules, then publish the policy.
              </p>
            </div>
          ) : null}
          <ConfigForm onSaveSuccess={() => setActiveTab('history')} />
        </>
      ) : (
        <ConfigHistory />
      )}
    </div>
  );
}
