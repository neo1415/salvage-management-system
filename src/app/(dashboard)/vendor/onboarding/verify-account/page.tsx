'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAppRouter } from '@/hooks/use-app-router';
import { Loader2, Mail, Phone, ShieldCheck } from 'lucide-react';
import { GENERIC_NAME_BVN_ORDER_EXAMPLE } from '@/lib/kyc/kyc-user-messages';

type VerifyState = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  needsPhone: boolean;
  needsDob: boolean;
};

export default function VendorVerifyAccountPage() {
  const router = useAppRouter();
  const { update } = useSession();
  const [state, setState] = useState<VerifyState | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [otp, setOtp] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/vendor/onboarding/verify-account');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load account details');

      setState({
        fullName: data.fullName || '',
        email: data.email || '',
        phone: data.phone || '',
        dateOfBirth: data.dateOfBirth || '',
        needsPhone: data.needsPhone,
        needsDob: data.needsDob,
      });
      setFullName(data.fullName || '');
      setPhone(data.phone || '');
      setDateOfBirth(data.dateOfBirth || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load account details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const sendCode = async () => {
    setError(null);
    setMessage(null);
    setSending(true);
    try {
      const payload: Record<string, string> = {};
      if (fullName.trim()) payload.fullName = fullName.trim();
      if (phone.trim()) payload.phone = phone.trim();
      if (dateOfBirth) payload.dateOfBirth = dateOfBirth;

      const res = await fetch('/api/vendor/onboarding/verify-account/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');

      setCodeSent(true);
      setMaskedPhone(data.maskedPhone || '');
      setMaskedEmail(data.maskedEmail || '');
      setMessage(
        data.message ||
          'Enter the verification code sent to your phone and email (same code on both).'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send code');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setMessage(null);
    setVerifying(true);
    try {
      const res = await fetch('/api/vendor/onboarding/verify-account/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
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

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

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
              Confirm your details, then enter the code we send to your phone and email.
            </p>
          </div>
        </div>

        {message && (
          <div className="mb-4 p-3 rounded-lg text-sm bg-green-50 text-green-800">{message}</div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-800">{error}</div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="flex items-center gap-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <Mail className="w-4 h-4 text-gray-500" />
              {state?.email}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Legal name (for BVN / NIN checks)
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setCodeSent(false);
              }}
              placeholder={`e.g. ${GENERIC_NAME_BVN_ORDER_EXAMPLE}`}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use the same order as on your bank ID: first name, middle name (if any), then surname.
            </p>
          </div>

          {(state?.needsPhone || !phone) && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-4 h-4" />
                Phone number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setCodeSent(false);
                }}
                placeholder="+2348012345678"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
              />
            </div>
          )}

          {state?.needsDob && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of birth</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => {
                  setDateOfBirth(e.target.value);
                  setCodeSent(false);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
              />
            </div>
          )}
        </div>

        {!codeSent ? (
          <button
            type="button"
            onClick={sendCode}
            disabled={sending || !fullName.trim() || (state?.needsPhone && !phone.trim())}
            className="w-full px-4 py-2.5 bg-[var(--brand-primary)] text-white rounded-lg font-medium hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Send verification code
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verification code
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Same code sent to {maskedPhone && maskedEmail
                  ? `${maskedPhone} and ${maskedEmail}`
                  : 'your phone and email'}
                . SMS may be delayed — check your email.
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying || otp.length !== 6}
                className="flex-1 px-4 py-2.5 bg-[var(--brand-primary)] text-white rounded-lg font-medium hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm verification
              </button>
              <button
                type="button"
                onClick={sendCode}
                disabled={sending}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Resend code'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
