'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Image from 'next/image';
import { usePublicBranding } from '@/hooks/use-public-branding';
import { hasCookieConsent } from '@/lib/cookies/cookie-consent';
import {
  getSafeStorageItem,
  removeSafeStorageItem,
  setSafeStorageItem,
} from '@/lib/utils/safe-browser-storage';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWA_DISMISSED_KEY = 'pwa-install-dismissed-v1';
const PWA_ACCEPTED_KEY = 'pwa-install-accepted-v1';

function isPwaPromptSuppressed(): boolean {
  if (typeof window === 'undefined') return true;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  if (isStandalone) return true;
  if (getSafeStorageItem('localStorage', PWA_ACCEPTED_KEY) === '1') return true;
  if (getSafeStorageItem('localStorage', PWA_DISMISSED_KEY) === '1') return true;

  return false;
}

/**
 * PWA Install Prompt Component
 * Shows a prompt to install the app when available
 */
export function InstallPrompt() {
  const { branding } = usePublicBranding();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [cookieResolved, setCookieResolved] = useState(() => hasCookieConsent());

  useEffect(() => {
    const syncCookieState = () => setCookieResolved(hasCookieConsent());
    window.addEventListener('salvage:cookie-banner-dismissed', syncCookieState);
    window.addEventListener('salvage:cookie-analytics-disabled', syncCookieState);
    return () => {
      window.removeEventListener('salvage:cookie-banner-dismissed', syncCookieState);
      window.removeEventListener('salvage:cookie-analytics-disabled', syncCookieState);
    };
  }, []);

  useEffect(() => {
    if (isPwaPromptSuppressed() || !cookieResolved) {
      return;
    }

    const handler = (e: Event) => {
      if (isPwaPromptSuppressed()) {
        return;
      }

      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      window.setTimeout(() => {
        if (!isPwaPromptSuppressed() && hasCookieConsent()) {
          setShowPrompt(true);
        }
      }, 4000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [cookieResolved]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setSafeStorageItem('localStorage', PWA_ACCEPTED_KEY, '1');
      removeSafeStorageItem('localStorage', PWA_DISMISSED_KEY);
    } else {
      setSafeStorageItem('localStorage', PWA_DISMISSED_KEY, '1');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setSafeStorageItem('localStorage', PWA_DISMISSED_KEY, '1');
  };

  if (!showPrompt || !deferredPrompt || isPwaPromptSuppressed() || !cookieResolved) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 animate-slide-up sm:max-w-[300px]">
      <div className="relative overflow-hidden rounded-lg border border-[var(--brand-primary-border)] bg-white p-3 shadow-xl">
        <button
          onClick={handleDismiss}
          className="absolute top-1.5 right-1.5 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Image
              src={branding.logoPath || branding.faviconPath || '/icons/icon-192.png'}
              alt={`${branding.brandName} logo`}
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8 rounded object-contain"
            />
          </div>

          <div className="flex-1 min-w-0 pr-3">
            <h3 className="mb-0.5 text-sm font-bold text-[var(--brand-primary)]">
              Install {branding.brandName}
            </h3>
            <p className="mb-2 text-xs leading-snug text-gray-600">
              Faster access and a smoother mobile experience.
            </p>

            <div className="flex gap-1.5">
              <button
                onClick={handleInstall}
                className="flex-1 bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] px-2 py-1 rounded text-[10px] font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors"
              >
                Install
              </button>
              <button
                onClick={handleDismiss}
                className="px-2 py-1 text-[10px] text-gray-600 hover:text-gray-800 transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
