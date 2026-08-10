'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { AppLink } from '@/components/navigation/app-link';

export function MdEarlyCloseBanner() {
  const [pendingCount, setPendingCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    const loadPending = async () => {
      try {
        const accessResponse = await fetch('/api/staff/department-access', { cache: 'no-store' });
        const access = accessResponse.ok ? await accessResponse.json() : null;
        if (!active || access?.isManagingDirector !== true) return;
        const response = await fetch('/api/auction-closure-requests?status=pending', { cache: 'no-store' });
        const result = response.ok ? await response.json() : null;
        if (active) {
          setPendingCount(Array.isArray(result?.requests) ? result.requests.length : 0);
          setDismissed(false);
        }
      } catch {
        if (active) setPendingCount(0);
      }
    };
    const handleRequestsChanged = () => void loadPending();
    void loadPending();
    window.addEventListener('auction-closure-requests-changed', handleRequestsChanged);
    window.addEventListener('focus', handleRequestsChanged);
    return () => {
      active = false;
      window.removeEventListener('auction-closure-requests-changed', handleRequestsChanged);
      window.removeEventListener('focus', handleRequestsChanged);
    };
  }, []);

  if (pendingCount === 0 || dismissed) return null;
  return (
    <div className="relative mb-4 flex flex-col gap-3 border border-amber-300 bg-amber-50 px-4 py-3 pr-12 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">Early closure approval pending</p>
          <p className="text-sm">{pendingCount} {pendingCount === 1 ? 'request requires' : 'requests require'} your decision.</p>
        </div>
      </div>
      <AppLink href="/auction-closure-requests?status=pending" className="inline-flex items-center gap-2 font-semibold text-amber-950">
        Review <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </AppLink>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 p-1 text-amber-900 hover:bg-amber-100"
        aria-label="Dismiss early closure notice"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
