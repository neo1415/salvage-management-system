'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface ProfileUser {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  createdAt: string;
  dateOfBirth?: string | null;
}

interface VendorInfo {
  id: string;
  businessName: string | null;
  businessType: string | null;
  cacNumber: string | null;
  tin: string | null;
  tier: string;
  status: string;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  bankName: string | null;
  bvnVerifiedAt: string | null;
  ninVerified: string | null;
  bankAccountVerified: string | null;
  addressVerifiedAt: string | null;
  amlRiskLevel: string | null;
  fraudRiskScore: string | null;
  registrationFeePaid: boolean;
  registrationFeePaidAt: string | null;
  tier2SubmittedAt: string | null;
  tier2ApprovedAt: string | null;
  tier2RejectionReason: string | null;
  tier2ExpiresAt: string | null;
  tier2DojahReferenceId: string | null;
  tier2ReviewStatus: string;
  latestProviderEvidence: {
    provider: string;
    providerReference: string | null;
    workflowReference: string | null;
    status: string;
    riskLevel: string;
    checksCompleted: string[];
    pendingChecks: string[];
    failedChecks: string[];
    reasonCodes: string[];
    displayMessage: string | null;
    updatedAt: string;
    sections?: {
      providerSummary?: Record<string, string>;
      business?: Record<string, string>;
      address?: Record<string, string>;
      aml?: Record<string, string>;
      governmentData?: Record<string, string>;
    };
  } | null;
}

export function ProfileSettingsPanel() {
  const { data: session } = useSession();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phoneDraft, setPhoneDraft] = useState('');
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/settings/profile');
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setUser(data.user);
      setVendor(data.vendor ?? null);
      setPhoneDraft(data.user.phone || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const requestPhoneCode = async () => {
    setPhoneMessage(null);
    setPhoneBusy(true);
    try {
      const res = await fetch('/api/settings/profile/phone/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      setCodeSent(true);
      setPhoneMessage({
        type: 'success',
        text: data.message || 'Verification code sent.',
      });
    } catch (e) {
      setPhoneMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Failed to send code',
      });
    } finally {
      setPhoneBusy(false);
    }
  };

  const verifyPhoneCode = async () => {
    setPhoneMessage(null);
    setPhoneBusy(true);
    try {
      const res = await fetch('/api/settings/profile/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneDraft.trim(), otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setCodeSent(false);
      setOtp('');
      setPhoneMessage({ type: 'success', text: 'Phone number updated successfully.' });
      await load();
    } catch (e) {
      setPhoneMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Verification failed',
      });
    } finally {
      setPhoneBusy(false);
    }
  };

  const formatRole = (role: string) => role.replace(/_/g, ' ');
  const formatLabel = (value: string | null | undefined) =>
    value ? value.replace(/_/g, ' ') : 'Not available';
  const formatDate = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleDateString() : 'Not available';
  const hasValue = (value: unknown) =>
    value !== null && value !== undefined && String(value).trim().length > 0;
  const maskIdentifier = (value: string | null | undefined, visibleTail = 4) => {
    if (!value) return 'Not available';
    return value.length <= visibleTail
      ? '*'.repeat(value.length)
      : `${'*'.repeat(value.length - visibleTail)}${value.slice(-visibleTail)}`;
  };
  const evidenceFields = (fields?: Record<string, string>, limit = 4) =>
    Object.entries(fields ?? {})
      .filter(([, value]) => hasValue(value) && value !== 'Not available')
      .slice(0, limit);
  const detail = (label: string, value: unknown, options: { normalCase?: boolean } = {}) => (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className={`font-medium text-gray-900 mt-1 ${options.normalCase ? '' : 'capitalize'}`}>
        {hasValue(value) ? String(value) : 'Not available'}
      </dd>
    </div>
  );

  if (loading) {
    return <div className="bg-white rounded-lg shadow-md p-6 animate-pulse h-64" />;
  }

  if (error || !user) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-red-600">{error || 'Profile unavailable'}</p>
        <button
          type="button"
          onClick={load}
          className="mt-4 px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Account information</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {detail('Full name', user.fullName, { normalCase: true })}
          {detail('Role', formatRole(user.role))}
          {detail('Email', user.email, { normalCase: true })}
          {detail('Member since', formatDate(user.createdAt), { normalCase: true })}
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Phone number</h2>
        <p className="text-sm text-gray-600 mb-4">
          We send a verification code to your new number before saving (SMS + email backup).
        </p>
        {phoneMessage && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              phoneMessage.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {phoneMessage.text}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
          <input
            type="tel"
            value={phoneDraft}
            onChange={(e) => {
              setPhoneDraft(e.target.value);
              setCodeSent(false);
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
            placeholder="+2348012345678"
          />
          <button
            type="button"
            onClick={requestPhoneCode}
            disabled={phoneBusy || phoneDraft.trim() === user.phone}
            className="px-4 py-2 border border-[var(--brand-primary)] text-[var(--brand-primary)] rounded-lg hover:bg-red-50 disabled:opacity-50 font-medium whitespace-nowrap"
          >
            {phoneBusy ? 'Sending...' : 'Send code'}
          </button>
        </div>
        {codeSent && (
          <div className="mt-4 flex flex-col sm:flex-row gap-3 max-w-lg">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
            />
            <button
              type="button"
              onClick={verifyPhoneCode}
              disabled={phoneBusy || otp.length !== 6}
              className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 font-medium"
            >
              Confirm phone
            </button>
          </div>
        )}
      </div>

      {vendor && session?.user?.role === 'vendor' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Vendor profile</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {detail(
              'Business name',
              vendor.businessName || vendor.latestProviderEvidence?.sections?.business?.['Business name'],
              { normalCase: true }
            )}
            {detail(
              'Business type',
              vendor.businessType || vendor.latestProviderEvidence?.sections?.business?.['Entity type']
            )}
            {detail('Verification level', formatLabel(vendor.tier))}
            {detail('Tier 2 review', formatLabel(vendor.tier2ReviewStatus))}
            {detail('Vendor status', formatLabel(vendor.status))}
            {detail(
              'Registration fee',
              vendor.registrationFeePaid ? `Paid ${formatDate(vendor.registrationFeePaidAt)}` : 'Not paid',
              { normalCase: true }
            )}
            {detail(
              'CAC / registration number',
              vendor.cacNumber || vendor.latestProviderEvidence?.sections?.business?.['Registration number'],
              { normalCase: true }
            )}
            {detail('TIN', maskIdentifier(vendor.tin), { normalCase: true })}
            {detail(
              'BVN check',
              vendor.bvnVerifiedAt ? `Verified ${formatDate(vendor.bvnVerifiedAt)}` : 'Not verified',
              { normalCase: true }
            )}
            {detail(
              'NIN check',
              vendor.ninVerified ? `Verified ${formatDate(vendor.ninVerified)}` : 'Not verified',
              { normalCase: true }
            )}
            {detail(
              'Address check',
              vendor.addressVerifiedAt
                ? `Verified ${formatDate(vendor.addressVerifiedAt)}`
                : vendor.latestProviderEvidence?.sections?.address?.['Address result'],
              { normalCase: true }
            )}
            {detail('AML risk', vendor.amlRiskLevel || vendor.latestProviderEvidence?.riskLevel)}
            {vendor.bankAccountNumber && (
              <div>
                <dt className="text-gray-500">Bank account</dt>
                <dd className="font-medium text-gray-900 mt-1">
                  ****{vendor.bankAccountNumber.slice(-4)} - {vendor.bankName}
                </dd>
              </div>
            )}
            {vendor.tier2RejectionReason && (
              <div className="sm:col-span-2">
                <dt className="text-gray-500">Review note</dt>
                <dd className="font-medium text-gray-900 mt-1">{vendor.tier2RejectionReason}</dd>
              </div>
            )}
          </dl>

          {vendor.latestProviderEvidence && (
            <div className="mt-6 border-t border-gray-100 pt-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">Dojah verification evidence</h3>
                  <p className="text-sm text-gray-600">
                    Safe summary only. Raw documents and sensitive identifiers are not shown here.
                  </p>
                </div>
                <span className="self-start rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 capitalize">
                  {formatLabel(vendor.latestProviderEvidence.status)}
                </span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {detail('Provider', vendor.latestProviderEvidence.provider)}
                {detail('Risk level', vendor.latestProviderEvidence.riskLevel)}
                {detail('Reference', vendor.latestProviderEvidence.providerReference, { normalCase: true })}
                {detail('Last updated', formatDate(vendor.latestProviderEvidence.updatedAt), { normalCase: true })}
              </dl>

              {evidenceFields(vendor.latestProviderEvidence.sections?.business, 6).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Business evidence</h4>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {evidenceFields(vendor.latestProviderEvidence.sections?.business, 6).map(([label, value]) =>
                      detail(label, value, { normalCase: true })
                    )}
                  </dl>
                </div>
              )}

              {evidenceFields(vendor.latestProviderEvidence.sections?.address, 4).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Address evidence</h4>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {evidenceFields(vendor.latestProviderEvidence.sections?.address, 4).map(([label, value]) =>
                      detail(label, value, { normalCase: true })
                    )}
                  </dl>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
