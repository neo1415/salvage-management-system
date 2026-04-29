'use client';

import { useState, useEffect } from 'react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface NotificationPreferences {
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  bidAlerts: boolean;
  auctionEnding: boolean;
  paymentReminders: boolean;
  leaderboardUpdates: boolean;
}

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPreferencesModal({
  isOpen,
  onClose,
}: NotificationPreferencesModalProps) {
  const pushNotifications = usePushNotifications();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    pushEnabled: true,
    smsEnabled: true,
    emailEnabled: true,
    bidAlerts: true,
    auctionEnding: true,
    paymentReminders: true,
    leaderboardUpdates: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Load preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch('/api/notifications/preferences');
        if (response.ok) {
          const data = await response.json();
          if (data.preferences) {
            setPreferences(data.preferences);
          }
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      loadPreferences();
    }
  }, [isOpen]);

  // Handle push notification toggle
  const handlePushToggle = async (enabled: boolean) => {
    if (enabled && !pushNotifications.isSubscribed) {
      const success = await pushNotifications.subscribe();
      if (success) {
        setPreferences((prev) => ({ ...prev, pushEnabled: true }));
      }
    } else if (!enabled && pushNotifications.isSubscribed) {
      const success = await pushNotifications.unsubscribe();
      if (success) {
        setPreferences((prev) => ({ ...prev, pushEnabled: false }));
      }
    }
  };

  // Save preferences
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-[#800020]" />
            <h2 className="text-2xl font-bold text-gray-900">
              Notification Preferences
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XCircle className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#800020]" />
            </div>
          ) : (
            <>
              {/* Push Notification Status */}
              {!pushNotifications.isSupported && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Push notifications are not supported in this browser.
                    Please use a modern browser like Chrome, Firefox, or Safari.
                  </p>
                </div>
              )}

              {pushNotifications.permission === 'denied' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    ❌ Push notifications are blocked. Please enable them in your
                    browser settings.
                  </p>
                </div>
              )}

              {/* Channel Preferences */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Notification Channels
                </h3>

                <div className="space-y-4">
                  {/* Push Notifications */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor="push-enabled" className="text-base font-medium">
                        Push Notifications
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Instant notifications in your browser
                      </p>
                    </div>
                    <Switch
                      id="push-enabled"
                      checked={preferences.pushEnabled && pushNotifications.isSubscribed}
                      onCheckedChange={handlePushToggle}
                      disabled={!pushNotifications.isSupported || pushNotifications.isLoading}
                    />
                  </div>

                  {/* SMS Notifications */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor="sms-enabled" className="text-base font-medium">
                        SMS Notifications
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Text messages to your phone
                      </p>
                    </div>
                    <Switch
                      id="sms-enabled"
                      checked={preferences.smsEnabled}
                      onCheckedChange={(checked) =>
                        setPreferences((prev) => ({ ...prev, smsEnabled: checked }))
                      }
                    />
                  </div>

                  {/* Email Notifications */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor="email-enabled" className="text-base font-medium">
                        Email Notifications
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Notifications sent to your email
                      </p>
                    </div>
                    <Switch
                      id="email-enabled"
                      checked={preferences.emailEnabled}
                      onCheckedChange={(checked) =>
                        setPreferences((prev) => ({ ...prev, emailEnabled: checked }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Notification Types */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Notification Types
                </h3>

                <div className="space-y-4">
                  {/* Bid Alerts */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor="bid-alerts" className="text-base font-medium">
                        Bid Alerts
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        When you've been outbid on an auction
                      </p>
                    </div>
                    <Switch
                      id="bid-alerts"
                      checked={preferences.bidAlerts}
                      onCheckedChange={(checked) =>
                        setPreferences((prev) => ({ ...prev, bidAlerts: checked }))
                      }
                    />
                  </div>

                  {/* Auction Ending */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor="auction-ending" className="text-base font-medium">
                        Auction Ending Soon
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        When auctions you're watching are about to end
                      </p>
                    </div>
                    <Switch
                      id="auction-ending"
                      checked={preferences.auctionEnding}
                      onCheckedChange={(checked) =>
                        setPreferences((prev) => ({ ...prev, auctionEnding: checked }))
                      }
                    />
                  </div>

                  {/* Payment Reminders */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor="payment-reminders" className="text-base font-medium">
                        Payment Reminders
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Payment confirmations and reminders
                      </p>
                    </div>
                    <Switch
                      id="payment-reminders"
                      checked={preferences.paymentReminders}
                      onCheckedChange={(checked) =>
                        setPreferences((prev) => ({
                          ...prev,
                          paymentReminders: checked,
                        }))
                      }
                    />
                  </div>

                  {/* Leaderboard Updates */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor="leaderboard-updates" className="text-base font-medium">
                        Leaderboard Updates
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        When your leaderboard position changes
                      </p>
                    </div>
                    <Switch
                      id="leaderboard-updates"
                      checked={preferences.leaderboardUpdates}
                      onCheckedChange={(checked) =>
                        setPreferences((prev) => ({
                          ...prev,
                          leaderboardUpdates: checked,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="flex items-center gap-2">
            {saveStatus === 'success' && (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-600 font-medium">
                  Preferences saved!
                </span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm text-red-600 font-medium">
                  Failed to save preferences
                </span>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="bg-[#800020] hover:bg-[#600018]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Preferences'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
