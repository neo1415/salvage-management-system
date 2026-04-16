'use client';

import { useState } from 'react';
import { ConfigForm } from './config-form';
import { ConfigHistory } from './config-history';
import { Settings, History, ToggleLeft, ToggleRight } from 'lucide-react';

type Tab = 'config' | 'history' | 'feature-flags';

export function AuctionConfigContent() {
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [depositSystemEnabled, setDepositSystemEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleToggleFeatureFlag = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/feature-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: !depositSystemEnabled,
          reason: 'Manual toggle from admin panel',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setDepositSystemEnabled(data.depositSystemEnabled);
        alert(`Deposit system ${data.depositSystemEnabled ? 'enabled' : 'disabled'} successfully`);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to toggle feature flag');
      }
    } catch (error) {
      console.error('Failed to toggle feature flag:', error);
      alert('Failed to toggle feature flag');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'config' as Tab, label: 'Configuration', icon: Settings },
    { id: 'history' as Tab, label: 'Change History', icon: History },
    { id: 'feature-flags' as Tab, label: 'Feature Flags', icon: depositSystemEnabled ? ToggleRight : ToggleLeft },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-[#800020] text-[#800020]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'config' && (
        <ConfigForm onSaveSuccess={() => setActiveTab('history')} />
      )}

      {activeTab === 'history' && (
        <ConfigHistory />
      )}

      {activeTab === 'feature-flags' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#800020] rounded-full flex items-center justify-center">
              {depositSystemEnabled ? (
                <ToggleRight className="w-5 h-5 text-white" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Feature Flags</h2>
              <p className="text-sm text-gray-600 mt-1">
                Enable or disable system features globally
              </p>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Deposit System
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Enable or disable the deposit-based bidding system. When disabled, the system will use legacy full-amount freeze logic for new auctions. Auctions already in progress will continue using deposit logic.
                </p>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                  depositSystemEnabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {depositSystemEnabled ? (
                    <>
                      <ToggleRight className="w-5 h-5" />
                      <span className="font-medium">Enabled</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-5 h-5" />
                      <span className="font-medium">Disabled</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={handleToggleFeatureFlag}
                disabled={loading}
                className={`px-6 py-3 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  depositSystemEnabled
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {loading ? 'Toggling...' : depositSystemEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>

            {!depositSystemEnabled && (
              <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800 font-medium">
                  ⚠️ Warning: Deposit system is currently disabled. New auctions will use legacy full-amount freeze logic.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Feature flag changes are logged in the configuration history for audit purposes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
