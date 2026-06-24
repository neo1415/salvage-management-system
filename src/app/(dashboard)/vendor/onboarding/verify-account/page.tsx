'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAppRouter } from '@/hooks/use-app-router';
import { Loader2, Mail, Phone, ShieldCheck } from 'lucide-react';

export default function VendorVerifyAccountPage() {
  const router = useAppRouter();
  const { update } = useSession();
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codesSent, setCodesSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sendCodes = useCallback(async () => {
    setError(null);
    setMessage(null);
    setSending(true);
    try {
      const res = await fetch('/api/vendor/onboarding/verify-account/send', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send codes');
      setCodesSent(true);
      setMaskedPhone(data.maskedPhone || '');
      setMaskedEmail(data.maskedEmail || '');
      setMessage(data.message || 'Codes sent to your phone and email.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send codes');
    } finally {
      setSending(false);
    }
  }, []);

  useEffect(() => {
    sendCodes();
  }, [sendCodes]);

  const handleVerify = async () => {
    setError(null);
    setMessage(null);
    setVerifying(true);
    try {
      const res = await fetch('/api/vendor/onboarding/verify-account/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneOtp, emailOtp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      await update();
      const statusRes = await fetch('/api/vendor/onboarding-status');
      const statusData = await statusRes.json();
      const nextPath = statusData?.data?.redirectPath || '/vendor/auctions';
      router.push(nextPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-[var(--brand-primary)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Verify your account</h1>
            <p className="text-sm text-gray-600 mt-1">
              Confirm your phone and email before continuing with verification.
            </p>
          </div>
        </div>

        {message && (
          <div className="mb-4 p-3 rounded-lg text-sm bg-green-50 text-green-800">{message}</div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-800">{error}</div>
        )}

        <div className="space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Phone className="w-4 h-4" />
              Phone code {maskedPhone ? `(${maskedPhone})` : ''}
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={phoneOtp}
              onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4" />
              Email code {maskedEmail ? `(${maskedEmail})` : ''}
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={emailOtp}
              onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || phoneOtp.length !== 6 || emailOtp.length !== 6}
            className="flex-1 px-4 py-2.5 bg-[var(--brand-primary)] text-white rounded-lg font-medium hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Confirm verification
          </button>
          <button
            type="button"
            onClick={sendCodes}
            disabled={sending}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {sending ? 'Sending...' : codesSent ? 'Resend codes' : 'Send codes'}
          </button>
        </div>
      </div>
    </div>
  );
}
