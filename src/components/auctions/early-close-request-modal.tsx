'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { lockScroll } from '@/lib/utils/modal-scroll-lock';

export function EarlyCloseRequestModal({
  isOpen, isLoading, onClose, onSubmit,
}: {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (!isOpen) setReason('');
    if (isOpen) return lockScroll();
  }, [isOpen]);
  if (!isOpen || typeof document === 'undefined') return null;
  const valid = reason.trim().length >= 20;
  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="early-close-title">
      <div className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl">
        <button type="button" aria-label="Close" disabled={isLoading} onClick={onClose} className="absolute right-4 top-4 p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
        <AlertTriangle className="mb-4 h-10 w-10 text-amber-600" />
        <h2 id="early-close-title" className="text-xl font-semibold text-gray-950">Request early auction closure</h2>
        <p className="mt-2 text-sm text-gray-600">The auction remains active until the Managing Director approves this request.</p>
        <label htmlFor="early-close-reason" className="mt-5 block text-sm font-medium text-gray-900">Reason</label>
        <textarea id="early-close-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} rows={5} disabled={isLoading} placeholder="Explain the operational reason for ending this auction early." className="mt-2 w-full resize-y rounded-md border border-gray-300 px-3 py-2 focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-focus-ring)]" />
        <div className="mt-1 flex justify-between text-xs text-gray-500"><span>{valid ? 'Ready to submit' : 'At least 20 characters required'}</span><span>{reason.length}/2000</span></div>
        <div className="mt-6 flex gap-3">
          <button type="button" disabled={isLoading} onClick={onClose} className="flex-1 rounded-md border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={!valid || isLoading} onClick={() => onSubmit(reason.trim())} className="flex-1 rounded-md bg-[var(--brand-primary)] px-4 py-3 font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50">{isLoading ? 'Sending...' : 'Send request'}</button>
        </div>
      </div>
    </div>, document.body
  );
}
