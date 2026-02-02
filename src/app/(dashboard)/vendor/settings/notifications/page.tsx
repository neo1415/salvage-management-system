'use client';

/**
 * Notification Preferences UI
 * Allows vendors to customize notification preferences
 * 
 * Features:
 * - Toggle SMS, Email, Push on/off
 * - Per-notification-type controls (bid alerts, auction ending, payment reminders, leaderboard updates)
 * - Disable toggles for critical notifications (OTP, payment deadlines, account suspension)
 * - Save changes immediately
 * 
 * Requirements: 39, NFR5.3
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface NotificationPreferences {
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  bidAlerts: boolean;
  auctionEnding: boolean;
  paymentReminders: boolean;
  leaderboardUpdates: boolean;
}

export default function NotificationPreferencesPage() {
  const { data: _session, status } = useSession(); // session prefixed with _ as it's used only for auth check
  const router = useRouter();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Fetch current preferences
  useEffect(() => {
    if (status === 'authenticated') {
      fetchPreferences();
    }
  }, [status]);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/notifications/preferences');
      
      if (!response.ok) {
        throw new Error('Failed to fetch notification preferences');
      }

      const data = await response.json();
      setPreferences(data.preferences);
    } catch (err) {
      console.error('Error fetching preferences:', err);
      setError('Failed to load notification preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!preferences) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Optimistically update UI
      const newPreferences = { ...preferences, ...updates };
      setPreferences(newPreferences);

      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to update preferences');
      }

      const data = await response.json();
      setPreferences(data.preferences);
      setSuccessMessage('Preferences saved successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error updating preferences:', err);
      setError(err instanceof Error ? err.message : 'Failed to save preferences. Please try again.');
      
      // Revert optimistic update
      fetchPreferences();
    } finally {
      setSaving(false);
    }
  };

  const handleChannelToggle = (channel: 'pushEnabled' | 'smsEnabled' | 'emailEnabled') => {
    if (!preferences) return;
    updatePreferences({ [channel]: !preferences[channel] });
  };

  const handleNotificationTypeToggle = (
    type: 'bidAlerts' | 'auctionEnding' | 'paymentReminders' | 'leaderboardUpdates'
  ) => {
    if (!preferences) return;
    updatePreferences({ [type]: !preferences[type] });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
              <div className="space-y-4">
                <div className="h-16 bg-gray-200 rounded"></div>
                <div className="h-16 bg-gray-200 rounded"></div>
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-red-600">Failed to load notification preferences.</p>
            <button
              onClick={fetchPreferences}
              className="mt-4 px-4 py-2 bg-[#800020] text-white rounded-lg hover:bg-[#600018] transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Notification Preferences</h1>
          <p className="text-gray-600 mt-2">
            Customize how you receive notifications from the platform
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <svg
              className="w-5 h-5 text-green-600 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-green-800">{successMessage}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <svg
              className="w-5 h-5 text-red-600 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* Notification Channels */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Channels</h2>
          <p className="text-sm text-gray-600 mb-6">
            Choose how you want to receive notifications
          </p>

          <div className="space-y-4">
            {/* Push Notifications */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-gray-600 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  <div>
                    <h3 className="font-medium text-gray-900">Push Notifications</h3>
                    <p className="text-sm text-gray-600">Instant alerts on your device</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleChannelToggle('pushEnabled')}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2 ${
                  preferences.pushEnabled ? 'bg-[#800020]' : 'bg-gray-300'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.pushEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* SMS Notifications */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-gray-600 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                  <div>
                    <h3 className="font-medium text-gray-900">SMS Notifications</h3>
                    <p className="text-sm text-gray-600">Text messages to your phone</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleChannelToggle('smsEnabled')}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2 ${
                  preferences.smsEnabled ? 'bg-[#800020]' : 'bg-gray-300'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.smsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Email Notifications */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-gray-600 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <div>
                    <h3 className="font-medium text-gray-900">Email Notifications</h3>
                    <p className="text-sm text-gray-600">Detailed updates to your inbox</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleChannelToggle('emailEnabled')}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2 ${
                  preferences.emailEnabled ? 'bg-[#800020]' : 'bg-gray-300'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.emailEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Notification Types */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Types</h2>
          <p className="text-sm text-gray-600 mb-6">
            Choose which types of notifications you want to receive
          </p>

          <div className="space-y-4">
            {/* Bid Alerts */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Bid Alerts</h3>
                <p className="text-sm text-gray-600">
                  Get notified when you've been outbid on an auction
                </p>
              </div>
              <button
                onClick={() => handleNotificationTypeToggle('bidAlerts')}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2 ${
                  preferences.bidAlerts ? 'bg-[#800020]' : 'bg-gray-300'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.bidAlerts ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Auction Ending */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Auction Ending Soon</h3>
                <p className="text-sm text-gray-600">
                  Reminders when auctions you're watching are about to end
                </p>
              </div>
              <button
                onClick={() => handleNotificationTypeToggle('auctionEnding')}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2 ${
                  preferences.auctionEnding ? 'bg-[#800020]' : 'bg-gray-300'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.auctionEnding ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Payment Reminders - Critical */}
            <div className="flex items-center justify-between p-4 border border-[#FFD700] bg-yellow-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-[#FFD700] mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div>
                    <h3 className="font-medium text-gray-900">Payment Reminders</h3>
                    <p className="text-sm text-gray-600">
                      Critical: Payment deadlines and confirmations (cannot be disabled)
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#800020] opacity-50 cursor-not-allowed">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
              </div>
            </div>

            {/* Leaderboard Updates */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">Leaderboard Updates</h3>
                <p className="text-sm text-gray-600">
                  Weekly updates on your ranking and achievements
                </p>
              </div>
              <button
                onClick={() => handleNotificationTypeToggle('leaderboardUpdates')}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#800020] focus:ring-offset-2 ${
                  preferences.leaderboardUpdates ? 'bg-[#800020]' : 'bg-gray-300'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.leaderboardUpdates ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex">
            <svg
              className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">About Critical Notifications</p>
              <p>
                Some notifications like OTP codes, payment deadlines, and account security alerts
                cannot be disabled as they are essential for platform security and your account
                protection. You must keep at least one notification channel enabled.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
