'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AppLink } from '@/components/navigation/app-link';

type RequestDetail = {
  id: string; auctionId: string; claimReference: string; assetType: string; requesterName: string;
  requesterEmail: string; reason: string; status: string; currentBid: string | number | null;
  auctionStatus: string; requestedAt: string; reviewedAt: string | null; reviewerName: string | null;
  reviewNote: string | null; failureReason: string | null;
};
const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export default function AuctionClosureRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<RequestDetail | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => fetch(`/api/auction-closure-requests/${id}`, { cache: 'no-store' }).then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to load request');
    setItem(result.request);
  }), [id]);
  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load request')).finally(() => setLoading(false)); }, [load]);

  const decide = async (decision: 'approve' | 'reject') => {
    setError(''); setSubmitting(decision);
    try {
      const response = await fetch(`/api/auction-closure-requests/${id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, reviewNote: note.trim() || undefined }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Decision could not be saved');
      await load();
      window.dispatchEvent(new Event('auction-closure-requests-changed'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Decision could not be saved'); }
    finally { setSubmitting(null); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (!item) return <div className="border border-red-300 bg-red-50 p-4 text-red-800">{error || 'Request not found'}</div>;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <AppLink href="/auction-closure-requests" className="font-semibold text-[var(--brand-primary)]">Back to requests</AppLink>
      <header><h1 className="text-3xl font-bold">Closure Request</h1><p className="mt-1 text-gray-600">{item.claimReference} · <span className="capitalize">{item.assetType}</span></p></header>
      <section className="grid gap-5 border border-gray-200 bg-white p-6 sm:grid-cols-2">
        <div><p className="text-sm text-gray-500">Requested by</p><p className="font-semibold">{item.requesterName}</p><p className="text-sm text-gray-600">{item.requesterEmail}</p></div>
        <div><p className="text-sm text-gray-500">Current bid</p><p className="text-xl font-bold">{money.format(Number(item.currentBid || 0))}</p></div>
        <div><p className="text-sm text-gray-500">Requested</p><p>{new Date(item.requestedAt).toLocaleString()}</p></div>
        <div><p className="text-sm text-gray-500">Status</p><p className="font-semibold uppercase">{item.status}</p></div>
        <div className="sm:col-span-2"><p className="text-sm text-gray-500">Reason</p><p className="mt-1 whitespace-pre-wrap text-gray-900">{item.reason}</p></div>
        {item.reviewNote ? <div className="sm:col-span-2"><p className="text-sm text-gray-500">Decision note</p><p>{item.reviewNote}</p></div> : null}
        {item.failureReason ? <div className="sm:col-span-2 border border-red-300 bg-red-50 p-3 text-red-800">{item.failureReason}</div> : null}
      </section>
      {item.status === 'pending' ? <section className="space-y-4 border border-gray-200 bg-white p-6">
        <div><label htmlFor="review-note" className="mb-2 block font-semibold">Decision note</label><textarea id="review-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={4} className="w-full border border-gray-300 p-3" placeholder="Required when rejecting" /></div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={submitting !== null} onClick={() => void decide('reject')} className="border border-red-700 px-5 py-3 font-semibold text-red-700 disabled:opacity-50">{submitting === 'reject' ? 'Rejecting...' : 'Reject'}</button><button type="button" disabled={submitting !== null} onClick={() => void decide('approve')} className="bg-[var(--brand-primary)] px-5 py-3 font-semibold text-white disabled:opacity-50">{submitting === 'approve' ? 'Closing auction...' : 'Approve and close auction'}</button></div>
      </section> : null}
    </div>
  );
}
