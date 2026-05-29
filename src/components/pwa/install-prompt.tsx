'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { usePublicBranding } from '@/hooks/use-public-branding';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA Install Prompt Component
 * Shows a prompt to install the app when available
 */
export function InstallPrompt() {
  const { branding } = usePublicBranding();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [canShowPrompt, setCanShowPrompt] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dismissedUntil = Number(localStorage.getItem('pwa-prompt-dismissed-until') || '0');

    if (isStandalone || dismissedUntil > Date.now()) {
      return;
    }

    setCanShowPrompt(true);

    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show the install prompt after a delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // Show after 3 seconds
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`User response to the install prompt: ${outcome}`);

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for 7 days.
    localStorage.setItem('pwa-prompt-dismissed-until', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  };

  if (!canShowPrompt || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up sm:left-auto sm:right-4 sm:max-w-[300px]">
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
            <img
              src={branding.logoPath || branding.faviconPath || '/icons/icon-192.png'}
              alt={`${branding.brandName} logo`}
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
