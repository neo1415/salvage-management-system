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

import { useEffect, useState, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { DataLoadingState, DataRefreshingHint } from '@/components/ui/loading-states';
import { useRouter } from 'next/navigation';
import { SwipeTabsBody } from '@/components/ui/swipe-tabs-body';
import { BodyPortal } from '@/components/ui/body-portal';
import { ChevronRight } from 'lucide-react';

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
  /** Normalized queue bucket from API */
  workflowStatus?: 'open' | 'in_review' | 'dismissed' | 'confirmed';
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
    pendingReason?: string;
    providerMessage?: string;
    amlStatus?: boolean | null;
    amlMatchDetails?: string;
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

type FraudListTab = 'open' | 'in_review' | 'dismissed' | 'confirmed' | 'all';

const FRAUD_LIST_TAB_ORDER: FraudListTab[] = ['open', 'in_review', 'dismissed', 'confirmed', 'all'];

const FRAUD_TAB_LABELS: Record<FraudListTab, string> = {
  open: 'Open',
  in_review: 'In review',
  dismissed: 'Dismissed',
  confirmed: 'Confirmed',
  all: 'All',
};

function alertWorkflowBucket(alert: FraudAlert): FraudListTab {
  if (alert.workflowStatus === 'in_review') return 'in_review';
  if (alert.workflowStatus === 'dismissed') return 'dismissed';
  if (alert.workflowStatus === 'confirmed') return 'confirmed';
  if (alert.workflowStatus === 'open') return 'open';
  if (alert.alertSource === 'intelligence' && alert.status === 'reviewed') return 'in_review';
  if (alert.alertSource === 'intelligence' && alert.status === 'dismissed') return 'dismissed';
  if (alert.alertSource === 'intelligence' && alert.status === 'confirmed') return 'confirmed';
  return 'open';
}

export default function FraudAlertDashboard() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const fraudAlertsRef = useRef<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const [fraudListTab, setFraudListTab] = useState<FraudListTab>('open');


  const fraudTabCounts = useMemo(() => {
    const counts: Record<FraudListTab, number> = {
      open: 0,
      in_review: 0,
      dismissed: 0,
      confirmed: 0,
      all: fraudAlerts.length,
    };
    for (const a of fraudAlerts) {
      counts[alertWorkflowBucket(a)] += 1;
    }
    return counts;
  }, [fraudAlerts]);

  const filteredFraudAlerts = useMemo(() => {
    if (fraudListTab === 'all') return fraudAlerts;
    return fraudAlerts.filter((a) => alertWorkflowBucket(a) === fraudListTab);
  }, [fraudAlerts, fraudListTab]);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (sessionStatus === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    const role = session?.user?.role;
    if (role !== 'system_admin') {
      if (role === 'salvage_manager') router.replace('/manager/dashboard');
      else if (role === 'finance_officer') router.replace('/finance/dashboard');
      else if (role === 'claims_adjuster') router.replace('/adjuster/dashboard');
      else if (role === 'vendor') router.replace('/vendor/dashboard');
      else router.replace('/unauthorized');
      return;
    }
    fetchFraudAlerts();
    fetchFraudSettings();
  }, [sessionStatus, session?.user?.role, router]);

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
    const showFullPageLoader = fraudAlertsRef.current.length === 0;
    try {
      if (showFullPageLoader) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      const response = await fetch('/api/admin/fraud-alerts');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch fraud alerts');
      }

      const data = await response.json();
      const nextAlerts = (data.fraudAlerts || []).filter(
        (a: FraudAlert | null | undefined): a is FraudAlert => Boolean(a?.id)
      );
      fraudAlertsRef.current = nextAlerts;
      setFraudAlerts(nextAlerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      if (showFullPageLoader) {
        fraudAlertsRef.current = [];
        setFraudAlerts([]);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
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
      setFraudListTab('dismissed');

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
      if (pendingAction === 'resolve') {
        setFraudListTab('confirmed');
      } else if (pendingAction === 'mark_under_review') {
        setFraudListTab('in_review');
      }
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

  const formatReasonCode = (reason: string) => {
    return reason.replace(/^dojah_/i, '').replace(/_/g, ' ');
  };

  const getSeverityBadgeColor = (severity?: FraudAlert['severity']) => {
    if (severity === 'critical') return 'bg-red-900 text-white';
    if (severity === 'high') return 'bg-red-100 text-red-800';
    if (severity === 'medium') return 'bg-orange-100 text-orange-800';
    return 'bg-blue-100 text-blue-800';
  };

  if (sessionStatus === 'loading' || (session?.user?.role && session.user.role !== 'system_admin')) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <DataLoadingState label="Fraud alerts" variant="page" />
        </div>
      </div>
    );
  }

  if (loading && fraudAlerts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Fraud Alert Dashboard</h1>
          <DataLoadingState label="Fraud alerts" variant="table" />
        </div>
      </div>
    );
  }

  if (error && fraudAlerts.length === 0) {
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
            {isRefreshing && <DataRefreshingHint className="inline-flex mb-0 ml-2" />}
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
              ipFraudEnabled ? 'bg-[var(--brand-primary)]' : 'bg-gray-300'
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

        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium text-gray-900 mb-1">What the actions do</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Mark under review</strong> — moves an intelligence alert into review while you investigate (status becomes &quot;reviewed&quot; in the database).
            </li>
            <li>
              <strong>Resolve</strong> — marks the alert as <strong>confirmed fraud</strong> after investigation (requires a reason, min. 10 characters).
            </li>
            <li>
              <strong>Dismiss (false positive)</strong> — closes the alert as not fraud; it moves to the <strong>Dismissed</strong> tab.
            </li>
            <li>
              <strong>Suspend vendor</strong> — suspends the linked vendor account (separate from closing the alert).
            </li>
          </ul>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-2xl font-bold text-gray-900">{fraudTabCounts.all}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500">Open</div>
            <div className="text-2xl font-bold text-orange-600">{fraudTabCounts.open}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500">In review</div>
            <div className="text-2xl font-bold text-blue-600">{fraudTabCounts.in_review}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500">Dismissed / Confirmed</div>
            <div className="text-2xl font-bold text-gray-800">
              {fraudTabCounts.dismissed} / {fraudTabCounts.confirmed}
            </div>
          </div>
        </div>

        {/* Tabs — one fetch, client-side filter; swipe on touch */}
        <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 pb-3">
          {FRAUD_LIST_TAB_ORDER.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFraudListTab(tab)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                fraudListTab === tab
                  ? 'bg-[var(--brand-primary)] text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {FRAUD_TAB_LABELS[tab]}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                fraudListTab === tab ? 'bg-white/20 text-white' : 'bg-white text-gray-600'
              }`}>
                {fraudTabCounts[tab]}
              </span>
            </button>
          ))}
        </div>

        {fraudAlerts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Fraud Alerts</h2>
            <p className="text-gray-600">All clear — no alerts in the system.</p>
          </div>
        ) : filteredFraudAlerts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
            No alerts in <strong>{FRAUD_TAB_LABELS[fraudListTab]}</strong>. Try another tab or refresh.
          </div>
        ) : (
          <SwipeTabsBody
            tabs={FRAUD_LIST_TAB_ORDER}
            activeTab={fraudListTab}
            onTabChange={setFraudListTab}
            className="space-y-2"
          >
            {filteredFraudAlerts.map((alert) => {
              if (!alert) return null;
              const bucket = alertWorkflowBucket(alert);
              const headline =
                alert.auction?.case?.claimReference ||
                (alert.entityType ? `${alert.entityType}` : 'Fraud alert');
              const sub =
                (alert.patterns?.[0] && formatReasonCode(alert.patterns[0])) ||
                alert?.evidenceSummary?.source ||
                'Suspicious activity';
              const who =
                alert.vendor?.businessName ||
                alert.vendor?.user?.fullName ||
                (alert.entityType === 'user' ? 'User alert' : 'Unknown party');
              return (
                <button
                  key={`${alert.alertSource}-${alert.id}`}
                  type="button"
                  onClick={() => openDetailModal(alert)}
                  className="flex w-full items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-[var(--brand-primary-border)] hover:bg-gray-50 md:p-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-gray-900">{headline}</span>
                      {alert.severity && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${getSeverityBadgeColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                      )}
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        {bucket.replace('_', ' ')}
                      </span>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                        {alert.alertSource === 'intelligence' ? 'Intel' : 'Bid/IP'}
                      </span>
                    </div>
                    <p className="truncate text-sm text-gray-600">{sub}</p>
                    <p className="truncate text-sm text-gray-800">{who}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(alert.flaggedAt)}
                      {typeof alert.riskScore === 'number' ? ` · Risk ${alert.riskScore}` : ''}
                      {alert.auction?.status ? ` · Auction ${alert.auction.status}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-gray-400" aria-hidden />
                </button>
              );
            })}
          </SwipeTabsBody>
        )}
      </div>

      {/* Detail Modal — guard children: JSX evaluates even when portal is closed */}
      <BodyPortal open={showDetailModal && !!selectedAlert}>
        {selectedAlert ? (
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

                {selectedAlert.auction && (
                  <section className="border border-gray-200 rounded-lg p-5">
                    <h4 className="font-semibold text-gray-900 mb-3">Auction</h4>
                    <dl className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Claim</dt><dd className="font-medium text-right">{selectedAlert.auction.case?.claimReference || '—'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Asset</dt><dd className="font-medium text-right capitalize">{selectedAlert.auction.case?.assetType || '—'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Market value</dt><dd className="font-medium text-right">{selectedAlert.auction.case?.marketValue ? formatCurrency(selectedAlert.auction.case.marketValue) : '—'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Current bid</dt><dd className="font-medium text-right">{formatCurrency(selectedAlert.auction.currentBid)}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Auction status</dt><dd className="font-medium text-right">{selectedAlert.auction.status}</dd></div>
                    </dl>
                  </section>
                )}

                {selectedAlert.details?.length > 0 && (
                  <section className="border border-gray-200 rounded-lg p-5">
                    <h4 className="font-semibold text-gray-900 mb-3">Evidence</h4>
                    <div className="space-y-2">
                      {selectedAlert.details.map((detail, idx) => (
                        <div key={idx} className="rounded border border-red-100 bg-red-50/80 p-3 text-sm">
                          <div className="font-medium text-red-900">{detail.pattern}</div>
                          <div className="text-red-800">{formatReasonCode(detail.evidence)}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedAlert.bidHistory?.length > 0 && (
                  <section className="border border-gray-200 rounded-lg p-5">
                    <h4 className="font-semibold text-gray-900 mb-3">Bid history ({selectedAlert.bidHistory.length})</h4>
                    <div className="max-h-56 space-y-2 overflow-y-auto text-sm">
                      {selectedAlert.bidHistory.map((bid) => (
                        <div key={bid.id} className="flex flex-wrap justify-between gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2">
                          <span className="font-medium">{formatCurrency(bid.amount)}</span>
                          <span className="text-gray-500">{formatDate(bid.createdAt)}</span>
                          <span className="w-full text-xs text-gray-600">IP {bid.ipAddress} · {bid.deviceType}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

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
                        className="mt-4 w-full px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-hover)]"
                      >
                        Open KYC Review
                      </button>
                    )}
                  </section>

                  <section className="border border-gray-200 rounded-lg p-5">
                    <h4 className="font-semibold text-gray-900 mb-4">Verification Evidence</h4>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Verification ref</dt><dd className="font-medium text-right break-all">{selectedAlert.evidenceSummary?.providerReference || selectedAlert.providerVerification?.providerReference || 'N/A'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Workflow ref</dt><dd className="font-medium text-right break-all">{selectedAlert.evidenceSummary?.workflowReference || selectedAlert.providerVerification?.workflowReference || 'N/A'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Verification type</dt><dd className="font-medium text-right">{selectedAlert.evidenceSummary?.verificationType || selectedAlert.providerVerification?.verificationType || 'N/A'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Verification status</dt><dd className="font-medium text-right">{selectedAlert.providerVerification?.status || 'N/A'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Risk level</dt><dd className="font-medium text-right">{selectedAlert.providerVerification?.riskLevel || selectedAlert.evidenceSummary?.riskLevel || 'N/A'}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-gray-500">AML status</dt><dd className="font-medium text-right">{selectedAlert.evidenceSummary?.amlStatus === false ? 'Flagged' : selectedAlert.evidenceSummary?.amlStatus === true ? 'No named hits' : 'N/A'}</dd></div>
                    </dl>
                  {(selectedAlert.evidenceSummary?.pendingReason || selectedAlert.evidenceSummary?.providerMessage || selectedAlert.evidenceSummary?.amlMatchDetails) && (
                    <div className="mt-4 rounded-lg bg-red-50 border border-red-100 p-3 text-sm">
                      {selectedAlert.evidenceSummary?.pendingReason && (
                        <p className="text-red-900"><span className="font-semibold">Review reason:</span> {selectedAlert.evidenceSummary.pendingReason}</p>
                      )}
                      {selectedAlert.evidenceSummary?.providerMessage && (
                        <p className="mt-1 text-red-900"><span className="font-semibold">Verification message:</span> {selectedAlert.evidenceSummary.providerMessage}</p>
                      )}
                      {selectedAlert.evidenceSummary?.amlMatchDetails && (
                        <p className="mt-1 text-red-900"><span className="font-semibold">AML match detail:</span> {selectedAlert.evidenceSummary.amlMatchDetails}</p>
                      )}
                    </div>
                  )}
                  </section>
                </div>

                <section className="border border-gray-200 rounded-lg p-5">
                  <h4 className="font-semibold text-gray-900 mb-4">Reason Codes & Evidence</h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(selectedAlert.reasonCodes?.length ? selectedAlert.reasonCodes : selectedAlert.patterns).map((reason) => (
                      <span key={reason} className="px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                        {formatReasonCode(reason)}
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
                          <div key={`${item.createdAt}-${idx}`} className="border-l-2 border-[var(--brand-primary)] pl-3">
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

                {selectedAlert.alertSource === 'audit' && alertWorkflowBucket(selectedAlert) === 'open' && (
                  <div className="border-t border-gray-200 pt-5 flex flex-wrap gap-3">
                    <button onClick={() => { setShowDetailModal(false); openDismissModal(selectedAlert); }} className="px-5 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                      Dismiss (false positive)
                    </button>
                    {selectedAlert.vendorId && (
                      <button onClick={() => { setShowDetailModal(false); openSuspendModal(selectedAlert); }} className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                        Suspend vendor
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        ) : null}
      </BodyPortal>

      {/* Alert Action Modal */}
      <BodyPortal open={showActionModal && !!selectedAlert && !!pendingAction}>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                placeholder={pendingAction === 'resolve' ? 'Explain why this alert is resolved...' : 'Add a note for the investigation...'}
              />
              <div className="flex gap-3 mt-5">
                <button onClick={closeActionModal} disabled={actionLoading} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button
                  onClick={handleIntelligenceAction}
                  disabled={actionLoading || (pendingAction === 'resolve' && actionReason.trim().length < 10)}
                  className="flex-1 px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </BodyPortal>

      {/* Dismiss Modal */}
      <BodyPortal open={showDismissModal && !!selectedAlert}>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
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
                  className="flex-1 px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
                >
                  {actionLoading ? 'Dismissing...' : 'Dismiss Flag'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </BodyPortal>

      {/* Suspend Modal */}
      <BodyPortal open={showSuspendModal && !!selectedAlert}>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
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
        </div>
      </BodyPortal>
    </div>
  );
}
