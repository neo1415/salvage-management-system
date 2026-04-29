'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA Install Prompt Component
 * Shows a prompt to install the app when available
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
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
    // Don't show again for this session
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  // Don't show if already dismissed in this session
  if (typeof window !== 'undefined' && sessionStorage.getItem('pwa-prompt-dismissed')) {
    return null;
  }

  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-3 left-3 right-3 md:left-auto md:right-3 md:max-w-[280px] z-50 animate-slide-up">
      <div className="bg-white rounded-md shadow-lg p-2 border border-burgundy-900">
        <button
          onClick={handleDismiss}
          className="absolute top-1.5 right-1.5 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-2">
          <div className="flex-shrink-0">
            <Image
              src="/icons/Nem-insurance-Logo.jpg"
              alt="NEM Insurance"
              width={32}
              height={32}
              className="rounded"
            />
          </div>

          <div className="flex-1 min-w-0 pr-3">
            <h3 className="text-[11px] font-bold text-burgundy-900 mb-0.5">
              Install App
            </h3>
            <p className="text-[10px] text-gray-600 mb-1.5 leading-tight">
              Faster access & offline!
            </p>

            <div className="flex gap-1.5">
              <button
                onClick={handleInstall}
                className="flex-1 bg-burgundy-900 text-white px-2 py-1 rounded text-[10px] font-semibold hover:bg-burgundy-800 transition-colors"
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
