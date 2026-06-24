'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Cookie, Settings } from 'lucide-react';
import { usePublicBranding } from '@/hooks/use-public-branding';
import {
  applyCookiePreferences,
  dismissCookieBanner,
  getDefaultCookiePreferences,
  hasCookieConsent,
  persistCookiePreferences,
  readStoredCookiePreferences,
  type CookiePreferences,
} from '@/lib/cookies/cookie-consent';

export function CookieConsentBanner() {
  const { branding } = usePublicBranding();
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(getDefaultCookiePreferences());

  useEffect(() => {
    const stored = readStoredCookiePreferences();
    if (stored) {
      applyCookiePreferences(stored);
      return;
    }

    if (!hasCookieConsent()) {
      const timer = window.setTimeout(() => {
        setIsVisible(true);
      }, 1000);

      return () => window.clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    persistCookiePreferences(getDefaultCookiePreferences());
    setIsVisible(false);
  };

  const handleRejectNonEssential = () => {
    persistCookiePreferences({
      essential: true,
      functional: false,
      analytics: false,
    });
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    persistCookiePreferences(preferences);
    setIsVisible(false);
  };

  const handleClose = () => {
    dismissCookieBanner();
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 md:left-auto md:right-3 md:max-w-xs z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden">
          {!showSettings ? (
            <div className="p-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[var(--brand-primary-surface)]">
                    <Cookie className="w-3 h-3 text-[var(--brand-primary)]" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-[11px] font-bold text-gray-900 mb-0.5">
                    Cookies
                  </h3>
                  <p className="text-[10px] text-gray-600 mb-2 leading-tight">
                    {branding.brandName} uses cookies.{' '}
                    <Link href="/cookies" className="text-[var(--brand-primary)] hover:underline">
                      Learn more
                    </Link>
                  </p>

                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={handleAcceptAll}
                      className="px-2 py-1 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-primary-foreground)] text-[10px] font-semibold rounded transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={handleRejectNonEssential}
                      className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-[10px] font-semibold rounded transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="px-2 py-1 bg-white hover:bg-gray-50 text-gray-700 text-[10px] font-semibold rounded border border-gray-300 transition-colors flex items-center gap-0.5"
                    >
                      <Settings className="w-2.5 h-2.5" />
                      <span className="hidden sm:inline">Settings</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleClose}
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-3 h-3 text-gray-500" />
                </button>
              </div>
            </div>
          ) : (
              <div className="p-2.5 max-h-[60vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-[11px] font-bold text-gray-900 mb-0.5">
                      Cookie Settings
                    </h3>
                    <p className="text-[10px] text-gray-600">
                      Essential always on.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Back"
                  >
                    <X className="w-3 h-3 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-1.5 mb-2">
                  <div className="flex items-center justify-between p-1.5 bg-gray-50 rounded">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <h4 className="text-[10px] font-semibold text-gray-900">Essential</h4>
                        <span className="px-1 py-0.5 bg-green-100 text-green-800 text-[9px] font-medium rounded">
                          On
                        </span>
                      </div>
                    </div>
                    <div className="ml-1.5">
                      <div className="w-7 h-4 bg-green-500 rounded-full flex items-center justify-end px-0.5">
                        <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-1.5 bg-gray-50 rounded">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[10px] font-semibold text-gray-900">Functional</h4>
                    </div>
                    <div className="ml-1.5">
                      <button
                        onClick={() => setPreferences(prev => ({ ...prev, functional: !prev.functional }))}
                        className={`w-7 h-4 rounded-full flex items-center transition-colors ${
                          preferences.functional
                            ? 'bg-[var(--brand-primary)] justify-end'
                            : 'bg-gray-300 justify-start'
                        } px-0.5`}
                        aria-label="Toggle functional cookies"
                      >
                        <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-1.5 bg-gray-50 rounded">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[10px] font-semibold text-gray-900">Analytics</h4>
                    </div>
                    <div className="ml-1.5">
                      <button
                        onClick={() => setPreferences(prev => ({ ...prev, analytics: !prev.analytics }))}
                        className={`w-7 h-4 rounded-full flex items-center transition-colors ${
                          preferences.analytics
                            ? 'bg-[var(--brand-primary)] justify-end'
                            : 'bg-gray-300 justify-start'
                        } px-0.5`}
                        aria-label="Toggle analytics cookies"
                      >
                        <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={handleSavePreferences}
                    className="px-2 py-1 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-primary-foreground)] text-[10px] font-semibold rounded transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleAcceptAll}
                    className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-[10px] font-semibold rounded transition-colors"
                  >
                    Accept All
                  </button>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-2 py-1 bg-white hover:bg-gray-50 text-gray-700 text-[10px] font-semibold rounded border border-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
        </div>
    </div>
  );
}
