/**
 * Admin Fraud Alert Dashboard
 * Displays all flagged auctions with fraud detection patterns
 * 
 * Requirements:
 * - Requirement 35: Fraud Alert Review
 * - NFR5.3: User Experience
 * - Enterprise Standards Section 6.3: Security & Fraud Prevention
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface FraudPattern {
  pattern: string;
  evidence: string;
}

interface BidHistoryItem {
  id: string;
  vendorId: string;
  amount: string;
  ipAddress: string;
  deviceType: string;
  createdAt: string;
}

interface FraudAlert {
  id: string;
  auctionId: string;
  vendorId: string;
  bidAmount: string;
  patterns: string[];
  details: FraudPattern[];
  flaggedAt: string;
  auction: {
    id: string;
    status: string;
    currentBid: string;
    endTime: string;
    case: {
      id: string;
      assetType: string;
      marketValue: string;
      claimReference: string;
    } | null;
  } | null;
  vendor: {
    id: string;
    businessName: string | null;
    tier: string;
    status: string;
    performanceStats: {
      totalBids: number;
      totalWins: number;
      winRate: number;
      fraudFlags: number;
    };
    rating: number;
    user: {
      id: string;
      fullName: string;
      email: string;
      phone: string;
    } | null;
  } | null;
  bidHistory: BidHistoryItem[];
}

export default function FraudAlertDashboard() {
  const router = useRouter();
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal states
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [dismissComment, setDismissComment] = useState('');
  const [suspendDuration, setSuspendDuration] = useState<'7' | '30' | '90' | 'permanent'>('7');
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    fetchFraudAlerts();
  }, []);

  const fetchFraudAlerts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/fraud-alerts');
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch fraud alerts');
      }

      const data = await response.json();
      setFraudAlerts(data.fraudAlerts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDismissFlag = async () => {
    if (!selectedAlert || !dismissComment.trim() || dismissComment.trim().length < 10) {
      setActionError('Comment is required (minimum 10 characters)');
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const response = await fetch(`/api/admin/fraud-alerts/${selectedAlert.auctionId}/dismiss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: dismissComment.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to dismiss fraud flag');
      }

      // Refresh fraud alerts
      await fetchFraudAlerts();
      
      // Close modal and reset state
      setShowDismissModal(false);
      setDismissComment('');
      setSelectedAlert(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendVendor = async () => {
    if (!selectedAlert || !suspendReason.trim() || suspendReason.trim().length < 10) {
      setActionError('Reason is required (minimum 10 characters)');
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const response = await fetch(`/api/admin/fraud-alerts/${selectedAlert.auctionId}/suspend-vendor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendorId: selectedAlert.vendorId,
          duration: suspendDuration,
          reason: suspendReason.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to suspend vendor');
      }

      // Refresh fraud alerts
      await fetchFraudAlerts();
      
      // Close modal and reset state
      setShowSuspendModal(false);
      setSuspendReason('');
      setSuspendDuration('7');
      setSelectedAlert(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const openDismissModal = (alert: FraudAlert) => {
    setSelectedAlert(alert);
    setShowDismissModal(true);
    setActionError(null);
  };

  const openSuspendModal = (alert: FraudAlert) => {
    setSelectedAlert(alert);
    setShowSuspendModal(true);
    setActionError(null);
  };

  const closeDismissModal = () => {
    setShowDismissModal(false);
    setDismissComment('');
    setSelectedAlert(null);
    setActionError(null);
  };

  const closeSuspendModal = () => {
    setShowSuspendModal(false);
    setSuspendReason('');
    setSuspendDuration('7');
    setSelectedAlert(null);
    setActionError(null);
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
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

  const getPatternBadgeColor = (pattern: string) => {
    if (pattern.includes('Same IP')) return 'bg-red-100 text-red-800';
    if (pattern.includes('Unusual bid')) return 'bg-orange-100 text-orange-800';
    if (pattern.includes('Duplicate identity')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Fraud Alert Dashboard</h1>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-burgundy-900"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Fraud Alert Dashboard</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchFraudAlerts}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Fraud Alert Dashboard</h1>
          <p className="text-gray-600">
            Review and take action on flagged auctions with suspicious activity
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total Alerts</div>
            <div className="text-3xl font-bold text-gray-900">{fraudAlerts.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Active Auctions</div>
            <div className="text-3xl font-bold text-orange-600">
              {fraudAlerts.filter(a => a.auction?.status === 'active').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Unique Vendors</div>
            <div className="text-3xl font-bold text-purple-600">
              {new Set(fraudAlerts.map(a => a.vendorId)).size}
            </div>
          </div>
        </div>

        {/* Fraud Alerts List */}
        {fraudAlerts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Fraud Alerts</h2>
            <p className="text-gray-600">All auctions are running smoothly with no suspicious activity detected.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {fraudAlerts.map((alert) => (
              <div key={alert.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Alert Header */}
                <div className="bg-red-50 border-b border-red-200 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-red-900 mb-1">
                        🚨 Fraud Alert - Auction #{alert.auctionId.slice(0, 8)}
                      </h3>
                      <p className="text-sm text-red-700">
                        Flagged on {formatDate(alert.flaggedAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {alert.patterns.map((pattern, idx) => (
                        <span
                          key={idx}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getPatternBadgeColor(pattern)}`}
                        >
                          {pattern}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column: Auction & Vendor Details */}
                    <div className="space-y-6">
                      {/* Auction Details */}
                      {alert.auction && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3">Auction Details</h4>
                          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Claim Reference:</span>
                              <span className="text-sm font-medium text-gray-900">
                                {alert.auction.case?.claimReference || 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Asset Type:</span>
                              <span className="text-sm font-medium text-gray-900 capitalize">
                                {alert.auction.case?.assetType || 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Market Value:</span>
                              <span className="text-sm font-medium text-gray-900">
                                {alert.auction.case?.marketValue ? formatCurrency(alert.auction.case.marketValue) : 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Current Bid:</span>
                              <span className="text-sm font-medium text-gray-900">
                                {formatCurrency(alert.auction.currentBid)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Status:</span>
                              <span className={`text-sm font-medium ${
                                alert.auction.status === 'active' ? 'text-green-600' : 'text-gray-600'
                              }`}>
                                {alert.auction.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Vendor Details */}
                      {alert.vendor && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3">Vendor Details</h4>
                          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Name:</span>
                              <span className="text-sm font-medium text-gray-900">
                                {alert.vendor.user?.fullName || 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Business:</span>
                              <span className="text-sm font-medium text-gray-900">
                                {alert.vendor.businessName || 'Individual'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Email:</span>
                              <span className="text-sm font-medium text-gray-900">
                                {alert.vendor.user?.email || 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Phone:</span>
                              <span className="text-sm font-medium text-gray-900">
                                {alert.vendor.user?.phone || 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Tier:</span>
                              <span className="text-sm font-medium text-gray-900 uppercase">
                                {alert.vendor.tier}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Rating:</span>
                              <span className="text-sm font-medium text-gray-900">
                                ⭐ {alert.vendor.rating.toFixed(1)} / 5.0
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Total Bids:</span>
                              <span className="text-sm font-medium text-gray-900">
                                {alert.vendor.performanceStats.totalBids}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Win Rate:</span>
                              <span className="text-sm font-medium text-gray-900">
                                {alert.vendor.performanceStats.winRate.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Fraud Flags:</span>
                              <span className={`text-sm font-medium ${
                                alert.vendor.performanceStats.fraudFlags > 0 ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {alert.vendor.performanceStats.fraudFlags}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Evidence & Bid History */}
                    <div className="space-y-6">
                      {/* Evidence */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Evidence</h4>
                        <div className="space-y-3">
                          {alert.details.map((detail, idx) => (
                            <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-4">
                              <div className="font-medium text-red-900 mb-1">{detail.pattern}</div>
                              <div className="text-sm text-red-700">{detail.evidence}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bid History */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">
                          Bid History ({alert.bidHistory.length} bids)
                        </h4>
                        <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                          <div className="space-y-2">
                            {alert.bidHistory.map((bid) => (
                              <div
                                key={bid.id}
                                className={`p-3 rounded border ${
                                  bid.vendorId === alert.vendorId
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-white border-gray-200'
                                }`}
                              >
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-sm font-medium text-gray-900">
                                    {formatCurrency(bid.amount)}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {formatDate(bid.createdAt)}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600">
                                  IP: {bid.ipAddress} • {bid.deviceType}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => openDismissModal(alert)}
                        className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Dismiss Flag (False Positive)
                      </button>
                      <button
                        onClick={() => openSuspendModal(alert)}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Suspend Vendor
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dismiss Modal */}
      {showDismissModal && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Dismiss Fraud Flag
            </h3>
            <p className="text-gray-600 mb-4">
              You are about to dismiss this fraud flag as a false positive. Please provide a reason for your decision.
            </p>
            
            {actionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{actionError}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comment (minimum 10 characters)
              </label>
              <textarea
                value={dismissComment}
                onChange={(e) => setDismissComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
                rows={4}
                placeholder="Explain why this is a false positive..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeDismissModal}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDismissFlag}
                disabled={actionLoading || dismissComment.trim().length < 10}
                className="flex-1 px-4 py-2 bg-burgundy-900 text-white rounded-lg hover:bg-burgundy-800 disabled:opacity-50"
              >
                {actionLoading ? 'Dismissing...' : 'Dismiss Flag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Suspend Vendor
            </h3>
            <p className="text-gray-600 mb-4">
              You are about to suspend this vendor. All active bids will be cancelled.
            </p>
            
            {actionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{actionError}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suspension Duration
              </label>
              <select
                value={suspendDuration}
                onChange={(e) => setSuspendDuration(e.target.value as typeof suspendDuration)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
              >
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="permanent">Permanent</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (minimum 10 characters)
              </label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
                rows={4}
                placeholder="Explain the reason for suspension..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeSuspendModal}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspendVendor}
                disabled={actionLoading || suspendReason.trim().length < 10}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Suspending...' : 'Suspend Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
