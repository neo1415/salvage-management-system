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
import { createPortal } from 'react-dom';
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
  status?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  riskScore?: number;
  entityType?: string;
  entityId?: string;
  auctionId: string;
  vendorId: string;
  bidAmount: string;
  patterns: string[];
  reasonCodes?: string[];
  details: FraudPattern[];
  evidenceSummary?: {
    source?: string;
    providerReference?: string;
    workflowReference?: string;
    verificationType?: string;
    riskLevel?: string;
    checksCompleted?: string[];
    failedChecks?: string[];
    ipAddress?: string;
  };
  providerVerification?: {
    id: string;
    provider: string;
    providerReference: string | null;
    workflowReference: string | null;
    verificationType: string;
    status: string;
    riskLevel: string;
    checksCompleted: string[];
    pendingChecks: string[];
    failedChecks: string[];
    reasonCodes: string[];
    displayMessage: string | null;
    updatedAt: string;
  } | null;
  relatedLinks?: {
    kycReview?: string | null;
    vendor?: string | null;
  };
  timeline?: Array<{
    id: string;
    actionType: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    afterState?: Record<string, unknown> | null;
  }>;
  reviewHistory?: Array<{
    action: string;
    reason?: string;
    actorName?: string;
    createdAt: string;
  }>;
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
    rating: number | string;
    user: {
      id: string;
      fullName: string;
      email: string;
      phone: string;
    } | null;
  } | null;
  bidHistory: BidHistoryItem[];
  alertSource?: 'audit' | 'intelligence';
}

export default function FraudAlertDashboard() {
  const router = useRouter();
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ipFraudEnabled, setIpFraudEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Modal states
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'mark_under_review' | 'resolve' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [dismissComment, setDismissComment] = useState('');
  const [suspendDuration, setSuspendDuration] = useState<'7' | '30' | '90' | 'permanent'>('7');
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    fetchFraudAlerts();
    fetchFraudSettings();
  }, []);

  const fetchFraudSettings = async () => {
    try {
      const response = await fetch('/api/admin/fraud-settings');
      if (!response.ok) return;
      const data = await response.json();
      setIpFraudEnabled(Boolean(data.ipFraudDetectionEnabled));
    } catch (err) {
      console.error('Failed to fetch fraud settings:', err);
    }
  };

  const toggleIPFraudDetection = async () => {
    const nextValue = !ipFraudEnabled;
    setIpFraudEnabled(nextValue);
    setSettingsLoading(true);

    try {
      const response = await fetch('/api/admin/fraud-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipFraudDetectionEnabled: nextValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update fraud setting');
      }

      const data = await response.json();
      setIpFraudEnabled(Boolean(data.ipFraudDetectionEnabled));
    } catch (err) {
      setIpFraudEnabled(!nextValue);
      setError(err instanceof Error ? err.message : 'Failed to update fraud setting');
    } finally {
      setSettingsLoading(false);
    }
  };

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

      const response = await fetch(
        selectedAlert.alertSource === 'intelligence'
          ? `/api/admin/fraud-alerts/${selectedAlert.id}/action`
          : `/api/admin/fraud-alerts/${selectedAlert.auctionId}/dismiss`,
        {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
          body: JSON.stringify(
            selectedAlert.alertSource === 'intelligence'
              ? { action: 'dismiss_false_positive', reason: dismissComment.trim() }
              : { comment: dismissComment.trim() }
          ),
        }
      );

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

      const response = await fetch(
        selectedAlert.alertSource === 'intelligence'
          ? `/api/admin/fraud-alerts/${selectedAlert.id}/action`
          : `/api/admin/fraud-alerts/${selectedAlert.auctionId}/suspend-vendor`,
        {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
          body: JSON.stringify(
            selectedAlert.alertSource === 'intelligence'
              ? { action: 'suspend_vendor', reason: suspendReason.trim() }
              : {
                  vendorId: selectedAlert.vendorId,
                  duration: suspendDuration,
                  reason: suspendReason.trim(),
                }
          ),
        }
      );

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

  const openDetailModal = (alert: FraudAlert) => {
    setSelectedAlert(alert);
    setShowDetailModal(true);
    setActionError(null);
  };

  const openActionModal = (alert: FraudAlert, action: 'mark_under_review' | 'resolve') => {
    setSelectedAlert(alert);
    setPendingAction(action);
    setActionReason('');
    setShowActionModal(true);
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

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedAlert(null);
    setActionError(null);
  };

  const closeActionModal = () => {
    setShowActionModal(false);
    setPendingAction(null);
    setActionReason('');
    setActionError(null);
  };

  const handleIntelligenceAction = async () => {
    if (!selectedAlert || !pendingAction) return;
    if (pendingAction === 'resolve' && actionReason.trim().length < 10) {
      setActionError('Reason is required (minimum 10 characters)');
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const response = await fetch(`/api/admin/fraud-alerts/${selectedAlert.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: pendingAction,
          reason: actionReason.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update fraud alert');
      }

      await fetchFraudAlerts();
      closeActionModal();
      closeDetailModal();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
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

  const getSeverityBadgeColor = (severity?: FraudAlert['severity']) => {
    if (severity === 'critical') return 'bg-red-900 text-white';
    if (severity === 'high') return 'bg-red-100 text-red-800';
    if (severity === 'medium') return 'bg-orange-100 text-orange-800';
    return 'bg-blue-100 text-blue-800';
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

        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">IP-based fraud detection</h2>
            <p className="text-sm text-gray-600">
              Turn this off for one-device demos. Bidding still works; only same-IP fraud alerts pause.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleIPFraudDetection}
            disabled={settingsLoading}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-60 ${
              ipFraudEnabled ? 'bg-burgundy-900' : 'bg-gray-300'
            }`}
            aria-pressed={ipFraudEnabled}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                ipFraudEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
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
                        {alert.evidenceSummary?.source === 'dojah' ? 'Dojah vendor verification alert' : 'Flagged activity'} - {formatDate(alert.flaggedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {alert.status && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-white text-gray-700 border border-red-200">
                          {alert.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      )}
                      {alert.severity && (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityBadgeColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                      )}
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
                                {Number(alert.vendor.rating || 0).toFixed(1)} / 5.0
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
                        onClick={() => openDetailModal(alert)}
                        className="px-6 py-2 bg-burgundy-900 text-white rounded-lg hover:bg-burgundy-800 transition-colors"
                      >
                        View Details
                      </button>
                      {alert.alertSource === 'intelligence' && alert.status === 'pending' && (
                        <button
                          onClick={() => openActionModal(alert, 'mark_under_review')}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Mark Under Review
                        </button>
                      )}
                      {alert.alertSource === 'intelligence' && alert.status !== 'confirmed' && (
                        <button
                          onClick={() => openActionModal(alert, 'resolve')}
                          className="px-6 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
                        >
                          Resolve
                        </button>
                      )}
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

      {/* Detail Modal */}
      {showDetailModal && selectedAlert && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0" style={{ zIndex: 999999 }}>
          <div className="fixed inset-0 bg-black/50" onClick={closeDetailModal} />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Fraud Alert Detail</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedAlert.evidenceSummary?.source || selectedAlert.alertSource || 'system'} alert for {selectedAlert.entityType || 'entity'} {selectedAlert.entityId?.slice(0, 8) || selectedAlert.id.slice(0, 8)}
                  </p>
                </div>
                <button onClick={closeDetailModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Close
                </button>
              </div>

              <div className="p-5 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="text-xs uppercase text-gray-500 mb-1">Source</div>
                    <div className="font-semibold text-gray-900">{selectedAlert.evidenceSummary?.source || selectedAlert.alertSource || 'system'}</div>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="text-xs uppercase text-gray-500 mb-1">Severity</div>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getSeverityBadgeColor(selectedAlert.severity)}`}>
                      {(selectedAlert.severity || 'low').toUpperCase()}
                    </span>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="text-xs uppercase text-gray-500 mb-1">Status</div>
                    <div className="font-semibold text-gray-900">{(selectedAlert.status || 'pending').replace(/_/g, ' ')}</div>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="text-xs uppercase text-gray-500 mb-1">Risk Score</div>
                    <div className="font-semibold text-gray-900">{selectedAlert.riskScore ?? 'N/A'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <section className="border border-gray-200 rounded-lg p-5">
                    <h4 className="font-semibold text-gray-900 mb-4">Vendor / User</h4>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Name</dt><dd className="font-medium text-right">{selectedAlert.vendor?.user?.fullName || 'N/A'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Business</dt><dd className="font-medium text-right">{selectedAlert.vendor?.businessName || 'Individual'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Email</dt><dd className="font-medium text-right break-all">{selectedAlert.vendor?.user?.email || 'N/A'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Vendor status</dt><dd className="font-medium text-right">{selectedAlert.vendor?.status || 'N/A'}</dd></div>
                    </dl>
                    {selectedAlert.relatedLinks?.kycReview && (
                      <button
                        onClick={() => router.push(selectedAlert.relatedLinks?.kycReview || '/manager/kyc-approvals')}
                        className="mt-4 w-full px-4 py-2 bg-burgundy-900 text-white rounded-lg hover:bg-burgundy-800"
                      >
                        Open KYC Review
                      </button>
                    )}
                  </section>

                  <section className="border border-gray-200 rounded-lg p-5">
                    <h4 className="font-semibold text-gray-900 mb-4">Dojah / Provider Evidence</h4>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Provider ref</dt><dd className="font-medium text-right break-all">{selectedAlert.evidenceSummary?.providerReference || selectedAlert.providerVerification?.providerReference || 'N/A'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Workflow ref</dt><dd className="font-medium text-right break-all">{selectedAlert.evidenceSummary?.workflowReference || selectedAlert.providerVerification?.workflowReference || 'N/A'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Verification type</dt><dd className="font-medium text-right">{selectedAlert.evidenceSummary?.verificationType || selectedAlert.providerVerification?.verificationType || 'N/A'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Provider status</dt><dd className="font-medium text-right">{selectedAlert.providerVerification?.status || 'N/A'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Provider risk</dt><dd className="font-medium text-right">{selectedAlert.providerVerification?.riskLevel || selectedAlert.evidenceSummary?.riskLevel || 'N/A'}</dd></div>
                    </dl>
                  </section>
                </div>

                <section className="border border-gray-200 rounded-lg p-5">
                  <h4 className="font-semibold text-gray-900 mb-4">Reason Codes & Evidence</h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(selectedAlert.reasonCodes?.length ? selectedAlert.reasonCodes : selectedAlert.patterns).map((reason) => (
                      <span key={reason} className="px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                        {reason}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">Completed checks</div>
                      <div className="text-sm text-gray-600">{(selectedAlert.providerVerification?.checksCompleted || selectedAlert.evidenceSummary?.checksCompleted || []).join(', ') || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">Failed checks</div>
                      <div className="text-sm text-gray-600">{(selectedAlert.providerVerification?.failedChecks || selectedAlert.evidenceSummary?.failedChecks || []).join(', ') || 'None recorded'}</div>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <section className="border border-gray-200 rounded-lg p-5">
                    <h4 className="font-semibold text-gray-900 mb-4">Review Notes</h4>
                    {selectedAlert.reviewHistory?.length ? (
                      <div className="space-y-3">
                        {selectedAlert.reviewHistory.map((item, idx) => (
                          <div key={`${item.createdAt}-${idx}`} className="border-l-2 border-burgundy-900 pl-3">
                            <div className="text-sm font-medium text-gray-900">{item.action.replace(/_/g, ' ')}</div>
                            <div className="text-xs text-gray-500">{item.actorName || 'System'} - {formatDate(item.createdAt)}</div>
                            {item.reason && <div className="text-sm text-gray-700 mt-1">{item.reason}</div>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No review notes yet.</p>
                    )}
                  </section>

                  <section className="border border-gray-200 rounded-lg p-5">
                    <h4 className="font-semibold text-gray-900 mb-4">Audit Timeline</h4>
                    {selectedAlert.timeline?.length ? (
                      <div className="space-y-3">
                        {selectedAlert.timeline.map((item) => (
                          <div key={item.id} className="border-l-2 border-gray-300 pl-3">
                            <div className="text-sm font-medium text-gray-900">{item.actionType.replace(/_/g, ' ')}</div>
                            <div className="text-xs text-gray-500">{formatDate(item.createdAt)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No audit entries linked yet.</p>
                    )}
                  </section>
                </div>

                {selectedAlert.alertSource === 'intelligence' && (
                  <div className="border-t border-gray-200 pt-5 flex flex-wrap gap-3">
                    {selectedAlert.status === 'pending' && (
                      <button onClick={() => openActionModal(selectedAlert, 'mark_under_review')} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Mark Under Review
                      </button>
                    )}
                    {selectedAlert.status !== 'confirmed' && (
                      <button onClick={() => openActionModal(selectedAlert, 'resolve')} className="px-5 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800">
                        Resolve
                      </button>
                    )}
                    <button onClick={() => { setShowDetailModal(false); openDismissModal(selectedAlert); }} className="px-5 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                      Dismiss False Positive
                    </button>
                    {selectedAlert.vendorId && (
                      <button onClick={() => { setShowDetailModal(false); openSuspendModal(selectedAlert); }} className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                        Suspend Vendor
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Alert Action Modal */}
      {showActionModal && selectedAlert && pendingAction && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0" style={{ zIndex: 1000000 }}>
          <div className="fixed inset-0 bg-black/50" onClick={closeActionModal} />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {pendingAction === 'resolve' ? 'Resolve Fraud Alert' : 'Mark Under Review'}
              </h3>
              <p className="text-gray-600 mb-4">
                {pendingAction === 'resolve'
                  ? 'Record the final review decision for this alert.'
                  : 'Move this alert into review while the team investigates.'}
              </p>
              {actionError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{actionError}</div>}
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {pendingAction === 'resolve' ? 'Resolution reason (minimum 10 characters)' : 'Review note (optional)'}
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent"
                placeholder={pendingAction === 'resolve' ? 'Explain why this alert is resolved...' : 'Add a note for the investigation...'}
              />
              <div className="flex gap-3 mt-5">
                <button onClick={closeActionModal} disabled={actionLoading} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button
                  onClick={handleIntelligenceAction}
                  disabled={actionLoading || (pendingAction === 'resolve' && actionReason.trim().length < 10)}
                  className="flex-1 px-4 py-2 bg-burgundy-900 text-white rounded-lg hover:bg-burgundy-800 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dismiss Modal */}
      {showDismissModal && selectedAlert && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0" style={{ zIndex: 999999 }}>
          <div className="fixed inset-0 bg-black/50" onClick={closeDismissModal} />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
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
        </div>,
        document.body
      )}

      {/* Suspend Modal */}
      {showSuspendModal && selectedAlert && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0" style={{ zIndex: 999999 }}>
          <div className="fixed inset-0 bg-black/50" onClick={closeSuspendModal} />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
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
        </div>,
        document.body
      )}
    </div>
  );
}
