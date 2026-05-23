'use client';

import { useEffect, useState } from 'react';
import { Shield, Mail, Smartphone } from 'lucide-react';

type MfaChannel = 'sms' | 'email' | 'both';

interface SecurityData {
  mfaEnabled: boolean;
  mfaChannel: MfaChannel;
  mfaPhone: string | null;
  email: string;
  phone: string;
  loginMfaEnforced: boolean;
}

export function SecuritySettingsPanel() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaChannel, setMfaChannel] = useState<MfaChannel>('email');
  const [mfaPhone, setMfaPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/security');
      if (!res.ok) throw new Error('Failed to load security settings');
      const json = await res.json();
      setData(json);
      setMfaEnabled(Boolean(json.mfaEnabled));
      setMfaChannel(json.mfaChannel);
      setMfaPhone(json.mfaPhone || '');
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Failed to load',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      setMessage(null);
      const res = await fetch('/api/settings/security', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mfaEnabled,
          mfaChannel,
          mfaPhone: mfaPhone.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      setMessage({ type: 'success', text: 'Security preferences saved.' });
      await load();
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Failed to save',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse h-48" />
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <Shield className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-medium">Two-factor login</p>
          <p className="mt-1">
            Turn on MFA for your account and choose how login codes should be delivered. Once enabled,
            your next login will require a verification code.
            {data?.loginMfaEnforced
              ? ' Platform-wide MFA enforcement is also active in this environment.'
              : ''}
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <label
          className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer ${
            mfaEnabled ? 'border-[#800020] bg-red-50/50' : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <input
            type="checkbox"
            checked={mfaEnabled}
            onChange={(e) => setMfaEnabled(e.target.checked)}
            className="mt-1"
          />
          <Shield className="w-5 h-5 text-gray-500 flex-shrink-0" />
          <div>
            <span className="font-medium text-gray-900">Enable two-factor login for my account</span>
            <p className="text-sm text-gray-600 mt-0.5">
              Staff accounts can also be required by policy even if this toggle is off.
            </p>
          </div>
        </label>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">Login verification method</h2>
          <p className="text-sm text-gray-600 mt-1">
            Email is recommended while SMS delivery is being stabilized with Termii.
          </p>
        </div>

        <div className="space-y-3">
          {(
            [
              ['email', 'Email only', Mail, data?.email] as const,
              ['sms', 'SMS only', Smartphone, data?.phone] as const,
              ['both', 'Email and SMS', Shield, 'Both contacts'] as const,
            ] as const
          ).map(([value, label, Icon, hint]) => (
            <label
              key={value}
              className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer ${
                mfaChannel === value
                  ? 'border-[#800020] bg-red-50/50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="mfaChannel"
                value={value}
                checked={mfaChannel === value}
                onChange={() => setMfaChannel(value as MfaChannel)}
                className="mt-1"
              />
              <Icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
              <div>
                <span className="font-medium text-gray-900">{label}</span>
                <p className="text-sm text-gray-600 mt-0.5">{hint}</p>
              </div>
            </label>
          ))}
        </div>

        {(mfaChannel === 'sms' || mfaChannel === 'both') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              MFA SMS number (optional override)
            </label>
            <input
              type="tel"
              value={mfaPhone}
              onChange={(e) => setMfaPhone(e.target.value)}
              placeholder={data?.phone || '+234…'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020]"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave blank to use your profile phone ({data?.phone}).
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-900">MFA on login</p>
            <p className="text-xs text-gray-500">
              {data?.mfaEnabled ? 'Enabled for this account' : 'Not enabled yet'}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {data?.mfaEnabled ? 'Active' : 'Optional'}
          </span>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-[#800020] text-white rounded-lg hover:bg-[#600018] disabled:opacity-50 font-medium"
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
    </div>
  );
}
