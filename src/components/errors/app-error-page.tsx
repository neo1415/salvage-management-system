'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Home, ShieldAlert, FileQuestion, Ban } from 'lucide-react';
import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';
import type { BrandingPolicy } from '@/features/business-policy/types';
import { getBrandGradient } from '@/features/branding/brand-colors';

type ErrorVariant = 'not-found' | 'forbidden' | 'unauthorized';

const VARIANT_CONFIG: Record<
  ErrorVariant,
  {
    code: string;
    title: string;
    description: string;
    icon: typeof FileQuestion;
  }
> = {
  'not-found': {
    code: '404',
    title: 'Page not found',
    description:
      'The page you requested does not exist or may have been moved. Check the address or return to your dashboard.',
    icon: FileQuestion,
  },
  forbidden: {
    code: '403',
    title: 'Access denied',
    description:
      'You do not have permission to view this resource. If you believe this is a mistake, contact your administrator.',
    icon: Ban,
  },
  unauthorized: {
    code: '401',
    title: 'Not authorized',
    description:
      'Your account cannot open this area of the app. Use the links below to return to your workspace.',
    icon: ShieldAlert,
  },
};

interface AppErrorPageProps {
  variant: ErrorVariant;
}

function getSafeBranding(): BrandingPolicy {
  if (typeof window === 'undefined') {
    return DEFAULT_BUSINESS_POLICY.branding;
  }

  try {
    return window.__PUBLIC_BUSINESS_POLICY__?.branding ?? DEFAULT_BUSINESS_POLICY.branding;
  } catch {
    return DEFAULT_BUSINESS_POLICY.branding;
  }
}

function getSafeRequestedPath(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const from = new URLSearchParams(window.location.search).get('from');
    return from || null;
  } catch {
    return null;
  }
}

export function AppErrorPage({ variant }: AppErrorPageProps) {
  const branding = getSafeBranding();
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  const fromPath = getSafeRequestedPath();
  const dashboardHref = '/dashboard';

  const handleGoBack = () => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.assign(dashboardHref);
    } catch {
      window.location.href = dashboardHref;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl p-8 text-center text-white shadow-xl" style={{ background: getBrandGradient(branding) }}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/95 p-2 shadow-lg">
            <Image
              src={branding.logoPath || '/icons/icon-192.png'}
              alt={branding.brandName}
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
              unoptimized
            />
          </div>
          <p className="text-sm font-semibold tracking-[0.25em] uppercase" style={{ color: branding.accentColor }}>
            {branding.brandName}
          </p>
          <p className="mt-4 text-6xl font-bold tracking-tight">{config.code}</p>
          <h1 className="mt-2 text-2xl font-semibold">{config.title}</h1>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${branding.primaryColor}1A` }}>
              <Icon className="h-5 w-5" style={{ color: branding.primaryColor }} aria-hidden />
            </div>
            <p className="text-sm leading-relaxed text-gray-600">{config.description}</p>
          </div>

          {fromPath && variant !== 'not-found' && (
            <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 break-all">
              Requested: <span className="font-mono text-gray-700">{fromPath}</span>
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Go back
            </button>
            <Link
              href={dashboardHref}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
              style={{ backgroundColor: branding.primaryColor }}
            >
              <Home className="h-4 w-4" aria-hidden />
              My dashboard
            </Link>
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">
            Need help?{' '}
            <a href={`mailto:${branding.supportEmail}`} className="hover:underline" style={{ color: branding.primaryColor }}>
              {branding.supportEmail}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
