'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Clock, RefreshCcw, Search } from 'lucide-react';

type PrivacyRequestStatus = 'submitted' | 'in_review' | 'completed' | 'rejected' | 'cancelled';

interface AdminPrivacyRequest {
  id: string;
  type: string;
  status: PrivacyRequestStatus;
  reason: string | null;
  responseNotes: string | null;
  createdAt: string;
  updatedAt: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userRole: string;
  userStatus: string;
}

interface RetentionCheckResult {
  canProceed: boolean;
  dryRunOnly: boolean;
  blockers: Array<{ code: string; message: string; count: number }>;
  retentionEvidence: Record<string, number>;
  recommendedNextAction: string;
}

const STATUS_OPTIONS: Array<'all' | PrivacyRequestStatus> = [
  'all',
  'submitted',
  'in_review',
  'completed',
  'rejected',
  'cancelled',
];

function humanize(value: string) {
  return value.replace(/_/g, ' ');
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function PrivacyRequestsContent() {
  const [requests, setRequests] = useState<AdminPrivacyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'all' | PrivacyRequestStatus>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminPrivacyRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState<PrivacyRequestStatus>('in_review');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkingRetention, setCheckingRetention] = useState(false);
  const [retentionCheck, setRetentionCheck] = useState<RetentionCheckResult | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const params = new URLSearchParams({ limit: '50' });
      if (status !== 'all') params.set('status', status);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/admin/privacy-requests?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load privacy requests');
      setRequests(data.requests ?? []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load privacy requests',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const beginReview = (request: AdminPrivacyRequest) => {
    setSelected(request);
    setReviewStatus(request.status === 'submitted' ? 'in_review' : request.status);
    setNotes(request.responseNotes ?? '');
    setRetentionCheck(null);
    setMessage(null);
  };

  const runRetentionCheck = async () => {
    if (!selected) return;
    setCheckingRetention(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/privacy-requests/${selected.id}/retention-check`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run retention check');
      setRetentionCheck(data);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to run retention check',
      });
    } finally {
      setCheckingRetention(false);
    }
  };

  const saveReview = async () => {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/privacy-requests/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: reviewStatus, responseNotes: notes.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update privacy request');
      setSelected(null);
      setMessage({ type: 'success', text: 'Privacy request updated.' });
      await load();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update privacy request',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Privacy Requests</h1>
        <p className="mt-2 max-w-3xl text-gray-600">
          Review data access, export, correction, deactivation, deletion, restriction, and objection
          requests. Complete fulfilment only after legal, payment, fraud, audit, and dispute-retention
          checks are satisfied.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg p-3 text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-lg bg-white p-4 shadow">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatus(option)}
                className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                  status === option
                    ? 'bg-[var(--brand-primary)] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-[var(--brand-primary)]/10'
                }`}
              >
                {humanize(option)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') load();
                }}
                className="rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
                placeholder="Search user"
              />
            </div>
            <button
              type="button"
              onClick={load}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-[var(--brand-primary)]"
              aria-label="Refresh privacy requests"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading privacy requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No privacy requests found.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map((request) => (
              <div key={request.id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-700">
                        {humanize(request.type)}
                      </span>
                      <span className="rounded-full bg-[var(--brand-primary)]/10 px-3 py-1 text-xs font-semibold capitalize text-[var(--brand-primary)]">
                        {humanize(request.status)}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">{request.userName}</h2>
                    <p className="text-sm text-gray-600">
                      {request.userEmail} - {request.userPhone} - {humanize(request.userRole)}
                    </p>
                    {request.reason && <p className="max-w-3xl text-sm text-gray-700">{request.reason}</p>}
                    <p className="text-xs text-gray-500">Submitted {formatDate(request.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => beginReview(request)}
                    className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
                  >
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-primary)]">
                  Review request
                </p>
                <h2 className="mt-1 text-2xl font-bold text-gray-900 capitalize">
                  {humanize(selected.type)}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {selected.userName} - {selected.userEmail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
              Review legal, audit, payment, fraud, document, and dispute-retention obligations before
              marking a request completed or rejected.
            </div>

            <div className="mt-4 rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Retention dry-run</p>
                  <p className="text-sm text-gray-600">
                    Check open payments, active winner records, pending documents, auction participation,
                    and retained evidence before fulfilment.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={checkingRetention}
                  onClick={runRetentionCheck}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white disabled:opacity-60"
                >
                  <RefreshCcw className={`h-4 w-4 ${checkingRetention ? 'animate-spin' : ''}`} />
                  Check blockers
                </button>
              </div>

              {retentionCheck && (
                <div className="mt-4 space-y-3">
                  <div
                    className={`rounded-lg p-3 text-sm ${
                      retentionCheck.canProceed
                        ? 'bg-green-50 text-green-800'
                        : 'bg-red-50 text-red-800'
                    }`}
                  >
                    {retentionCheck.recommendedNextAction}
                  </div>
                  {retentionCheck.blockers.length > 0 && (
                    <div className="space-y-2">
                      {retentionCheck.blockers.map((blocker) => (
                        <div key={blocker.code} className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                          <span className="font-semibold">{humanize(blocker.code)}</span>: {blocker.message}{' '}
                          ({blocker.count})
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-3">
                    {Object.entries(retentionCheck.retentionEvidence).map(([key, value]) => (
                      <div key={key} className="rounded-lg bg-gray-50 p-2">
                        <span className="block font-semibold capitalize text-gray-900">{humanize(key)}</span>
                        {value}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <label className="mt-5 block text-sm font-semibold text-gray-900">Status</label>
            <select
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value as PrivacyRequestStatus)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
            >
              {STATUS_OPTIONS.filter((option) => option !== 'all').map((option) => (
                <option key={option} value={option}>
                  {humanize(option)}
                </option>
              ))}
            </select>

            <label className="mt-5 block text-sm font-semibold text-gray-900">Review notes</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value.slice(0, 3000))}
              rows={6}
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
              placeholder="Record decision notes, retention exception, fulfilment reference, or next action."
            />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveReview}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
              >
                {busy ? <Clock className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Save review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
