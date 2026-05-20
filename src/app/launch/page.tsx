'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  isStandalonePwa,
  PWA_LAST_PATH_KEY,
  PWA_SPLASH_COMPLETE_EVENT,
  PWA_SPLASH_DONE_KEY,
} from '@/lib/pwa/detect';

function getRoleHome(role?: string, bvnVerified?: boolean): string {
  switch (role) {
    case 'vendor':
      return bvnVerified ? '/vendor/dashboard' : '/vendor/kyc/tier1';
    case 'salvage_manager':
      return '/manager/dashboard';
    case 'claims_adjuster':
      return '/adjuster/dashboard';
    case 'finance_officer':
      return '/finance/dashboard';
    case 'system_admin':
      return '/admin/dashboard';
    default:
      return '/login';
  }
}

function getSafeRestorePath(): string | null {
  const raw = sessionStorage.getItem(PWA_LAST_PATH_KEY);
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  if (raw === '/' || raw === '/launch') return null;
  return raw;
}

/**
 * PWA entry: after splash, go to login, role home, or last visited page.
 */
export default function LaunchPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const navigated = useRef(false);

  useEffect(() => {
    if (!isStandalonePwa()) {
      router.replace('/');
      return;
    }

    const go = () => {
      if (navigated.current) return;
      if (status === 'loading') return;

      navigated.current = true;

      if (status !== 'authenticated' || !session?.user) {
        router.replace('/login');
        return;
      }

      const restored = getSafeRestorePath();
      if (restored) {
        router.replace(restored);
        return;
      }

      router.replace(
        getRoleHome(session.user.role, session.user.bvnVerified as boolean | undefined)
      );
    };

    if (sessionStorage.getItem(PWA_SPLASH_DONE_KEY) === '1') {
      go();
      return;
    }

    window.addEventListener(PWA_SPLASH_COMPLETE_EVENT, go, { once: true });
    return () => window.removeEventListener(PWA_SPLASH_COMPLETE_EVENT, go);
  }, [router, session, status]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#800020] via-[#6b001a] to-[#4a0012]" aria-hidden />
  );
}
