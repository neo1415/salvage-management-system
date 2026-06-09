'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, FileText, ShieldCheck, UserX } from 'lucide-react';
import { usePublicBranding } from '@/hooks/use-public-branding';

type RequestType =
  | 'access'
  | 'export'
  | 'correction'
  | 'deactivation'
  | 'deletion'
  | 'restriction'
  | 'objection';

interface PrivacyRequest {
  id: string;
  type: RequestType;
  status: 'submitted' | 'in_review' | 'completed' | 'rejected' | 'cancelled';
  reason: string | null;
  responseNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const REQUEST_OPTIONS: Array<{
  type: RequestType;
  title: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    type: 'export',
    title: 'Request a data export',
    description: 'Ask for a copy of account, vendor, auction, wallet, and document metadata linked to you.',
    icon: Download,
  },
  {
    type: 'correction',
    title: 'Request a correction',
    description: 'Tell the review team what personal or business profile data should be corrected.',
    icon: FileText,
  },
  {
    type: 'deactivation',
    title: 'Request account deactivation',
    description: 'Ask for account access to be disabled after retention and open-transaction checks.',
    icon: UserX,
  },
  {
    type: 'deletion',
    title: 'Request deletion review',
    description: 'Ask for deletion or anonymisation where legal, audit, payment, and dispute rules allow it.',
    icon: AlertTriangle,
  },
];

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not available';
}

export function PrivacySettingsPanel() {
  const { branding } = usePublicBranding();
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [selectedType, setSelectedType] = useState<RequestType>('export');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);

  const selectedOption = useMemo(
    () => REQUEST_OPTIONS.find((option) => option.type === selectedType) ?? REQUEST_OPTIONS[0],
    [selectedType]
  );

  const load = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch('/api/settings/privacy');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load privacy requests');
      setRequests(data.requests ?? []);
      setSetupRequired(Boolean(data.setupRequired));
      if (data.setupRequired) {
        setMessage({
          type: 'error',
          text: data.warning || 'Privacy request storage is not ready yet.',
        });
      }
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
  }, []);

  const submitRequest = async () => {
    if (setupRequired) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit privacy request');
      setReason('');
      setMessage({ type: 'success', text: data.message || 'Privacy request received.' });
      await load();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to submit privacy request',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="bg-white rounded-lg shadow-md p-6 animate-pulse h-72" />;
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-[var(--brand-primary)]/10 p-3 text-[var(--brand-primary)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Privacy and data rights</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Submit privacy requests for review. Some auction, KYC, wallet, payment, document,
              audit, fraud, and legal records may need to be retained even when access changes.
            </p>
            <p className="mt-2 max-w-2xl text-xs text-gray-500">
              Submitted requests are recorded in the admin privacy queue and sent to {branding.supportEmail}
              {' '}and the platform privacy desk.
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`mt-5 rounded-lg p-3 text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900">Create a request</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {REQUEST_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = selectedType === option.type;
            return (
              <button
                key={option.type}
                type="button"
                onClick={() => setSelectedType(option.type)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  active
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                    : 'border-gray-200 hover:border-[var(--brand-primary)]'
                }`}
              >
                <Icon className="h-5 w-5 text-[var(--brand-primary)]" />
                <span className="mt-3 block font-semibold text-gray-900">{option.title}</span>
                <span className="mt-1 block text-sm text-gray-600">{option.description}</span>
              </button>
            );
          })}
        </div>

        <label className="mt-5 block text-sm font-medium text-gray-900" htmlFor="privacy-reason">
          Notes for the review team
        </label>
        <textarea
          id="privacy-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value.slice(0, 1500))}
          rows={5}
          className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
          placeholder={`Optional context for: ${selectedOption.title.toLowerCase()}`}
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            Requests are audited and reviewed before fulfilment. This prevents accidental loss of
            records needed for payment, fraud, legal, or dispute handling.
          </p>
          <button
            type="button"
            onClick={submitRequest}
            disabled={busy || setupRequired}
            className="rounded-lg bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
          >
            {setupRequired ? 'Storage setup required' : busy ? 'Submitting...' : 'Submit request'}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900">Request history</h3>
        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">No privacy requests have been submitted yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-gray-100">
            {requests.map((request) => (
              <div key={request.id} className="py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold capitalize text-gray-900">{formatLabel(request.type)}</p>
                    <p className="text-sm text-gray-500">Submitted {formatDate(request.createdAt)}</p>
                  </div>
                  <span className="self-start rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-700">
                    {formatLabel(request.status)}
                  </span>
                </div>
                {request.reason && <p className="mt-2 text-sm text-gray-600">{request.reason}</p>}
                {request.responseNotes && (
                  <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                    {request.responseNotes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
