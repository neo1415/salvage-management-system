'use client';

import { useEffect, useState } from 'react';
import {
  getDefaultCookiePreferences,
  persistCookiePreferences,
  readStoredCookiePreferences,
  type CookiePreferences,
} from '@/lib/cookies/cookie-consent';

export function CookiePreferencesPanel() {
  const [preferences, setPreferences] = useState<CookiePreferences>(getDefaultCookiePreferences());
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStoredCookiePreferences();
    if (stored) {
      setPreferences(stored);
    }
  }, []);

  const save = (next: CookiePreferences) => {
    persistCookiePreferences(next);
    setPreferences(next);
    setSavedMessage('Your cookie preferences have been saved.');
    window.setTimeout(() => setSavedMessage(null), 4000);
  };

  return (
    <section className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-5">
      <h2 className="text-2xl font-bold text-[var(--brand-primary)] mb-2">Manage cookie preferences</h2>
      <p className="text-gray-700 mb-4">
        Update how this browser stores optional cookies. Essential cookies stay enabled because they are required for sign-in and security.
      </p>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <p className="font-semibold text-gray-900">Essential</p>
            <p className="text-sm text-gray-600">Authentication, security, and session management.</p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-green-700">Always on</span>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <p className="font-semibold text-gray-900">Functional</p>
            <p className="text-sm text-gray-600">Remember settings such as cookie consent and UI preferences.</p>
          </div>
          <button
            type="button"
            onClick={() => setPreferences((prev) => ({ ...prev, functional: !prev.functional }))}
            className={`h-7 w-12 rounded-full px-0.5 transition-colors ${
              preferences.functional ? 'bg-[var(--brand-primary)]' : 'bg-gray-300'
            }`}
            aria-pressed={preferences.functional}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white transition-transform ${
                preferences.functional ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <p className="font-semibold text-gray-900">Analytics</p>
            <p className="text-sm text-gray-600">Help us understand usage and performance on this device.</p>
          </div>
          <button
            type="button"
            onClick={() => setPreferences((prev) => ({ ...prev, analytics: !prev.analytics }))}
            className={`h-7 w-12 rounded-full px-0.5 transition-colors ${
              preferences.analytics ? 'bg-[var(--brand-primary)]' : 'bg-gray-300'
            }`}
            aria-pressed={preferences.analytics}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white transition-transform ${
                preferences.analytics ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => save(preferences)}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--brand-primary-foreground)] hover:bg-[var(--brand-primary-hover)]"
        >
          Save preferences
        </button>
        <button
          type="button"
          onClick={() => save(getDefaultCookiePreferences())}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Accept all
        </button>
        <button
          type="button"
          onClick={() => save({ essential: true, functional: false, analytics: false })}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Reject non-essential
        </button>
      </div>

      {savedMessage ? <p className="mt-3 text-sm font-medium text-green-700">{savedMessage}</p> : null}
    </section>
  );
}
