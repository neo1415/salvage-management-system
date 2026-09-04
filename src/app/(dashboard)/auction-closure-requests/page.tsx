'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { AppLink } from '@/components/navigation/app-link';

type ClosureRequest = {
  id: string; claimReference: string; assetType: string; requesterName: string;
  status: string; reason: string; currentBid: string | number | null; requestedAt: string;
};

const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export default function AuctionClosureRequestsPage() {
  const [requests, setRequests] = useState<ClosureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadSequence = useRef(0);

  const loadRequests = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setError('');
    try {
      await fetch('/api/auction-closure-requests', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load closure requests');
        if (sequence === loadSequence.current) setRequests(result.requests || []);
      });
    } catch (cause) {
      if (sequence === loadSequence.current) {
        setError(cause instanceof Error ? cause.message : 'Unable to load closure requests');
      }
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
    const handleRequestsChanged = () => void loadRequests();
    const pollingFallback = window.setInterval(handleRequestsChanged, 15_000);
    window.addEventListener('auction-closure-requests-changed', handleRequestsChanged);
    window.addEventListener('focus', handleRequestsChanged);
    return () => {
      window.removeEventListener('auction-closure-requests-changed', handleRequestsChanged);
      window.removeEventListener('focus', handleRequestsChanged);
      window.clearInterval(pollingFallback);
    };
  }, [loadRequests]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header><h1 className="text-3xl font-bold text-gray-950">Early Closure Requests</h1><p className="mt-1 text-gray-600">Review and retain a record of requested auction closures.</p></header>
      {loading ? <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin" /></div> : null}
      {error ? <div className="border border-red-300 bg-red-50 p-4 text-red-800">{error}</div> : null}
      {!loading && !error && requests.length === 0 ? <div className="border border-gray-200 bg-white p-10 text-center text-gray-600">No closure requests yet.</div> : null}
      <div className="divide-y divide-gray-200 border border-gray-200 bg-white">
        {requests.map((request) => (
          <AppLink key={request.id} href={`/auction-closure-requests/${request.id}`} className="grid gap-3 p-5 hover:bg-gray-50 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
            <div><p className="font-semibold text-gray-950">{request.claimReference}</p><p className="text-sm capitalize text-gray-600">{request.assetType} · {request.requesterName}</p></div>
            <div><p className="line-clamp-2 text-sm text-gray-700">{request.reason}</p><p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><Clock className="h-3.5 w-3.5" />{new Date(request.requestedAt).toLocaleString()}</p></div>
            <div className="text-left md:text-right"><span className="inline-block bg-gray-100 px-2 py-1 text-xs font-semibold uppercase text-gray-700">{request.status}</span><p className="mt-2 font-semibold">{money.format(Number(request.currentBid || 0))}</p></div>
          </AppLink>
        ))}
      </div>
    </div>
  );
}
