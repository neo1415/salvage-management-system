'use client';

import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, Loader2, Search, ShieldCheck } from 'lucide-react';

interface PickupContext {
  auctionId: string;
  claimReference: string;
  assetName: string;
  pickupLocation: string | null;
  vendorBusinessName: string | null;
  vendorName: string;
  vendorEmail: string;
  vendorPhone: string | null;
  saleAmount: string | null;
  paymentStatus: string | null;
  paymentVerifiedAt: string | null;
  pickupDeadline: string | null;
  pickupConfirmedVendor: boolean;
  pickupConfirmedAdmin: boolean;
  pickupConfirmedAdminAt: string | null;
  lifecycleStatus: 'not_ready' | 'ready_for_pickup' | 'vendor_confirmed' | 'staff_confirmed';
}

function formatMoney(value: string | null) {
  const amount = Number(value || 0);
  return Number.isFinite(amount)
    ? `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
    : 'Not available';
}

function statusLabel(status: PickupContext['lifecycleStatus']) {
  switch (status) {
    case 'staff_confirmed':
      return 'Pickup completed';
    case 'vendor_confirmed':
      return 'Vendor confirmed';
    case 'ready_for_pickup':
      return 'Ready for pickup';
    default:
      return 'Not ready';
  }
}

export function PickupConfirmationDesk({ onConfirmed }: { onConfirmed?: () => void }) {
  const [pickupAuthCode, setPickupAuthCode] = useState('');
  const [notes, setNotes] = useState('');
  const [pickup, setPickup] = useState<PickupContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setPickup(null);

    try {
      const response = await fetch('/api/pickups/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupAuthCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Pickup lookup failed.');
      setPickup(data.pickup);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pickup lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    setConfirming(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/pickups/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupAuthCode, notes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Pickup confirmation failed.');
      setPickup(data.pickup);
      setMessage(data.message || 'Pickup confirmed.');
      setNotes('');
      onConfirmed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pickup confirmation failed.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-lg bg-[var(--brand-primary)] text-white flex items-center justify-center">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Pickup Code Desk</h2>
          <p className="text-sm text-gray-600">
            Validate the buyer's pickup code, confirm payment readiness, and complete asset handoff.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
        <label className="block">
          <span className="sr-only">Pickup authorization code</span>
          <input
            value={pickupAuthCode}
            onChange={(event) => setPickupAuthCode(event.target.value.toUpperCase())}
            placeholder="Enter pickup authorization code"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base tracking-wide focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          onClick={lookup}
          disabled={loading || pickupAuthCode.trim().length < 6}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          Lookup
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {message}
        </div>
      )}

      {pickup && (
        <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Asset</p>
              <h3 className="text-lg font-bold text-gray-900">{pickup.assetName}</h3>
              <p className="text-sm text-gray-600">Claim {pickup.claimReference}</p>
            </div>
            <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-semibold ${
              pickup.lifecycleStatus === 'staff_confirmed'
                ? 'bg-green-100 text-green-800'
                : pickup.lifecycleStatus === 'not_ready'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-900'
            }`}>
              {statusLabel(pickup.lifecycleStatus)}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-gray-500">Vendor</p>
              <p className="font-semibold text-gray-900">{pickup.vendorBusinessName || pickup.vendorName}</p>
              <p className="text-sm text-gray-600">{pickup.vendorPhone || pickup.vendorEmail}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-gray-500">Payment</p>
              <p className="font-semibold text-gray-900">{formatMoney(pickup.saleAmount)}</p>
              <p className="text-sm text-gray-600">
                {pickup.paymentStatus === 'verified' ? 'Verified' : 'Not verified'}
                {pickup.paymentVerifiedAt ? ` on ${new Date(pickup.paymentVerifiedAt).toLocaleString()}` : ''}
              </p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-gray-500">Pickup</p>
              <p className="font-semibold text-gray-900">{pickup.pickupLocation || 'Configured pickup location'}</p>
              <p className="text-sm text-gray-600">{pickup.pickupDeadline || 'Deadline not set'}</p>
            </div>
          </div>

          {pickup.lifecycleStatus !== 'staff_confirmed' && (
            <div className="mt-4">
              <label htmlFor="pickup-notes" className="block text-sm font-medium text-gray-700">
                Staff notes
              </label>
              <textarea
                id="pickup-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Optional handoff notes, ID check observations, or asset condition comments"
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
              />
              <button
                type="button"
                onClick={confirm}
                disabled={confirming || pickup.paymentStatus !== 'verified'}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-5 py-3 font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {confirming ? <Loader2 className="h-5 w-5 animate-spin" /> : <ClipboardCheck className="h-5 w-5" />}
                Confirm pickup
              </button>
            </div>
          )}

          {pickup.lifecycleStatus === 'staff_confirmed' && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-green-800">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">
                Completed {pickup.pickupConfirmedAdminAt ? new Date(pickup.pickupConfirmedAdminAt).toLocaleString() : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
