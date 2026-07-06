'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  getPwaSplashDurationMs,
  isStandalonePwa,
  PWA_SPLASH_COMPLETE_EVENT,
  PWA_SPLASH_DONE_KEY,
  PWA_SPLASH_RECENT_KEY,
  PWA_SPLASH_RECENT_WINDOW_MS,
  PWA_SPLASH_SESSION_KEY,
} from '@/lib/pwa/detect';
import { getBrandGradient, usePublicBranding } from '@/hooks/use-public-branding';

const EXIT_MS = 650;

function shouldShowPwaSplash(): boolean {
  if (typeof window === 'undefined') return false;
  // Once per browser session (login/logout must not replay splash)
  if (sessionStorage.getItem(PWA_SPLASH_SESSION_KEY) === '1') {
    return false;
  }
  const recentSplash = Number(localStorage.getItem(PWA_SPLASH_RECENT_KEY) || '0');
  if (Number.isFinite(recentSplash) && Date.now() - recentSplash < PWA_SPLASH_RECENT_WINDOW_MS) {
    sessionStorage.setItem(PWA_SPLASH_SESSION_KEY, '1');
    return false;
  }
  if (isStandalonePwa()) return true;
  return sessionStorage.getItem('salvage-show-splash') === '1';
}

function removeInstantBootSplash(): void {
  document.documentElement.classList.remove('pwa-boot-lock');
  const instant = document.getElementById('pwa-instant-splash');
  if (instant) {
    instant.classList.add('pwa-instant-splash--hide');
    // Keep node in DOM — removing it while React navigates causes insertBefore/removeChild errors
  }
}

function markSplashComplete(): void {
  sessionStorage.setItem(PWA_SPLASH_DONE_KEY, '1');
  sessionStorage.setItem(PWA_SPLASH_SESSION_KEY, '1');
  localStorage.setItem(PWA_SPLASH_RECENT_KEY, String(Date.now()));
  window.dispatchEvent(new Event(PWA_SPLASH_COMPLETE_EVENT));
}

export function PwaSplashScreen() {
  const [visible, setVisible] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const { branding } = usePublicBranding();

  useEffect(() => {
    const clearBootLock = () => {
      document.documentElement.classList.remove('pwa-boot-lock');
      removeInstantBootSplash();
    };

    if (!shouldShowPwaSplash()) {
      clearBootLock();
      setAppReady(true);
      markSplashComplete();
      return;
    }

    setVisible(true);
    document.documentElement.classList.add('pwa-boot-lock');

    const durationMs = getPwaSplashDurationMs();
    const timer = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(() => {
        clearBootLock();
        setAppReady(true);
        markSplashComplete();
      }, EXIT_MS);
    }, durationMs);

    const failsafe = window.setTimeout(() => {
      setVisible(false);
      clearBootLock();
      setAppReady(true);
      markSplashComplete();
    }, 8000);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(failsafe);
    };
  }, []);

  useEffect(() => {
    if (appReady) {
      document.documentElement.classList.remove('pwa-boot-lock');
    }
  }, [appReady]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-[650ms] ease-out"
      style={{ background: getBrandGradient(branding) }}
      aria-hidden
      role="presentation"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[var(--brand-primary-surface)] blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center px-8">
        <div className="relative mb-8 rounded-2xl bg-white p-4 shadow-2xl shadow-black/25">
          <Image
            src={branding.logoPath || '/icons/icon-192.png'}
            alt={branding.brandName}
            width={96}
            height={96}
            priority
            unoptimized
            className="h-24 w-24 object-contain"
          />
          <div className="absolute -inset-1 rounded-2xl ring-2 ring-[var(--brand-accent)]" />
        </div>

        <h1 className="font-display text-center text-3xl font-semibold tracking-wide text-white sm:text-4xl">
          {branding.brandName}
        </h1>

        <p className="mt-3 text-center text-sm font-medium tracking-[0.2em] text-white/75 uppercase">
          Salvage auctions
        </p>

        <div className="mt-10 flex gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-[var(--brand-accent)] animate-pulse"
              style={{ animationDelay: `${i * 180}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
