'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { AppLink } from '@/components/navigation/app-link';
import { useRealtimeNotifications } from '@/hooks/use-socket';

export function MdEarlyCloseBanner() {
  const [pendingCount, setPendingCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const { newNotification } = useRealtimeNotifications();

  useEffect(() => {
    const data = newNotification?.data;
    if (data?.requestId || data?.url?.startsWith('/auction-closure-requests/')) {
      window.dispatchEvent(new Event('auction-closure-requests-changed'));
    }
  }, [newNotification]);

  useEffect(() => {
    let active = true;
    let loadSequence = 0;
    const loadPending = async () => {
      const sequence = ++loadSequence;
      try {
        const accessResponse = await fetch('/api/staff/department-access', { cache: 'no-store' });
        const access = accessResponse.ok ? await accessResponse.json() : null;
        if (!active || sequence !== loadSequence) return;
        if (access?.isManagingDirector !== true) {
          setPendingCount(0);
          return;
        }
        const response = await fetch('/api/auction-closure-requests?status=pending', { cache: 'no-store' });
        const result = response.ok ? await response.json() : null;
        if (active && sequence === loadSequence) {
          setPendingCount(Array.isArray(result?.requests) ? result.requests.length : 0);
          setDismissed(false);
        }
      } catch {
        // Keep the last known count during a transient network or socket outage.
      }
    };
    const handleRequestsChanged = () => void loadPending();
    void loadPending();
    const pollingFallback = window.setInterval(loadPending, 15_000);
    window.addEventListener('auction-closure-requests-changed', handleRequestsChanged);
    window.addEventListener('focus', handleRequestsChanged);
    return () => {
      active = false;
      window.clearInterval(pollingFallback);
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
