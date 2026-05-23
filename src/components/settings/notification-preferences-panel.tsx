'use client';

import { useEffect, useState } from 'react';

interface NotificationPreferences {
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  bidAlerts: boolean;
  auctionEnding: boolean;
  paymentReminders: boolean;
  leaderboardUpdates: boolean;
}

function Toggle({
  on,
  disabled,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2 ${
        on ? 'bg-[#800020]' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export function NotificationPreferencesPanel({
  showVendorTypes = false,
}: {
  showVendorTypes?: boolean;
}) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/notifications/preferences');
      if (!response.ok) throw new Error('Failed to fetch notification preferences');
      const data = await response.json();
      setPreferences(data.preferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!preferences) return;
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      const newPreferences = { ...preferences, ...updates };
      setPreferences(newPreferences);
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update preferences');
      }
      const data = await response.json();
      setPreferences(data.preferences);
      setSuccessMessage('Preferences saved');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      fetchPreferences();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-12 bg-gray-200 rounded" />
        <div className="h-12 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-red-600">{error || 'Failed to load preferences.'}</p>
        <button
          type="button"
          onClick={fetchPreferences}
          className="mt-4 px-4 py-2 bg-[#800020] text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Notification channels</h2>
        <p className="text-sm text-gray-600 mb-6">
          Choose how you want to receive alerts. Security and OTP messages may still be sent when
          required.
        </p>
        <div className="space-y-4">
          {(
            [
              ['pushEnabled', 'Push notifications', 'Instant alerts in the app'] as const,
              ['smsEnabled', 'SMS', 'Text messages to your phone'] as const,
              ['emailEnabled', 'Email', 'Updates in your inbox'] as const,
            ] as const
          ).map(([key, title, desc]) => (
            <div
              key={key}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div>
                <h3 className="font-medium text-gray-900">{title}</h3>
                <p className="text-sm text-gray-600">{desc}</p>
              </div>
              <Toggle
                on={preferences[key]}
                disabled={saving}
                onToggle={() => updatePreferences({ [key]: !preferences[key] })}
              />
            </div>
          ))}
        </div>
      </div>

      {showVendorTypes && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Auction notifications</h2>
          <div className="space-y-4">
            {(
              [
                ['bidAlerts', 'Bid alerts', "When you've been outbid"] as const,
                ['auctionEnding', 'Auction ending soon', 'Reminders before auctions close'] as const,
                ['leaderboardUpdates', 'Leaderboard updates', 'Ranking and achievements'] as const,
              ] as const
            ).map(([key, title, desc]) => (
              <div
                key={key}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div>
                  <h3 className="font-medium text-gray-900">{title}</h3>
                  <p className="text-sm text-gray-600">{desc}</p>
                </div>
                <Toggle
                  on={preferences[key]}
                  disabled={saving}
                  onToggle={() => updatePreferences({ [key]: !preferences[key] })}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p className="font-medium mb-1">Critical notifications</p>
        <p>
          OTP codes, payment deadlines, and account security alerts cannot be fully disabled. Keep
          at least one channel enabled so you do not miss important messages.
        </p>
      </div>
    </div>
  );
}
