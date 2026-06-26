'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { PublicBusinessPolicy } from '@/features/business-policy/types';
import { getBrandCssVariables } from '@/features/branding/brand-colors';
import {
  readCachedPublicBusinessPolicy,
  writeCachedPublicBusinessPolicy,
} from '@/lib/business-policy/client-policy-cache';

type PublicPolicyState = {
  policy: PublicBusinessPolicy | null;
  loading: boolean;
};

const PublicBusinessPolicyContext = createContext<PublicPolicyState>({
  policy: null,
  loading: true,
});

function getBootPolicy(): PublicBusinessPolicy | null {
  if (typeof window === 'undefined') return null;
  return window.__PUBLIC_BUSINESS_POLICY__ ?? null;
}

function resolveInitialPolicy(initialPolicy: PublicBusinessPolicy | null): PublicBusinessPolicy | null {
  return initialPolicy ?? getBootPolicy() ?? readCachedPublicBusinessPolicy();
}

type PublicBusinessPolicyProviderProps = {
  initialPolicy: PublicBusinessPolicy | null;
  children: ReactNode;
};

export function PublicBusinessPolicyProvider({
  initialPolicy,
  children,
}: PublicBusinessPolicyProviderProps) {
  const bootPolicy = resolveInitialPolicy(initialPolicy);
  const [state, setState] = useState<PublicPolicyState>({
    policy: bootPolicy,
    loading: !bootPolicy,
  });

  useEffect(() => {
    const seededPolicy = resolveInitialPolicy(initialPolicy);
    if (seededPolicy) {
      setState({ policy: seededPolicy, loading: false });
    }

    let cancelled = false;

    fetch('/api/business-policy/public', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;

        const fetchedPolicy = data?.policy as PublicBusinessPolicy | undefined;
        if (fetchedPolicy) {
          writeCachedPublicBusinessPolicy(fetchedPolicy);
          setState((current) => ({
            policy:
              !current.policy || current.policy.version !== fetchedPolicy.version
                ? fetchedPolicy
                : current.policy,
            loading: false,
          }));
          return;
        }

        setState((current) => ({
          policy: current.policy ?? seededPolicy ?? readCachedPublicBusinessPolicy() ?? null,
          loading: false,
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setState((current) => ({
          policy: current.policy ?? seededPolicy ?? readCachedPublicBusinessPolicy() ?? null,
          loading: false,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [initialPolicy]);

  useEffect(() => {
    if (!state.policy?.branding || typeof document === 'undefined') return;

    const variables = getBrandCssVariables(state.policy.branding);
    const root = document.documentElement;
    Object.entries(variables).forEach(([name, value]) => {
      const next = String(value);
      if (root.style.getPropertyValue(name) !== next) {
        root.style.setProperty(name, next);
      }
    });

    document.title = `${state.policy.branding.brandName} - Salvage Recovery And Auction Management`;
    upsertIconLink('icon', state.policy.branding.faviconPath || state.policy.branding.logoPath || '/icons/icon-192.png', state.policy.version);
    upsertIconLink('apple-touch-icon', state.policy.branding.faviconPath || state.policy.branding.logoPath || '/icons/icon-192.png', state.policy.version);
  }, [state.policy]);

  const value = useMemo(() => state, [state]);

  return (
    <PublicBusinessPolicyContext.Provider value={value}>
      {children}
    </PublicBusinessPolicyContext.Provider>
  );
}

export function usePublicBusinessPolicyContext(): PublicPolicyState {
  return useContext(PublicBusinessPolicyContext);
}

function upsertIconLink(rel: string, href: string, version: string) {
  if (!href) return;

  const selector = `link[rel="${rel}"]`;
  let link = document.head.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }

  const separator = href.includes('?') ? '&' : '?';
  link.href = `${href}${separator}v=${encodeURIComponent(version)}`;
}
