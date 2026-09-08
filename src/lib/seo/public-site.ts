import { getAppUrl } from '@/features/notifications/templates/email-urls';

export function getPublicSiteUrl(): string {
  const url = new URL(process.env.PUBLIC_CANONICAL_URL || getAppUrl());
  if (['salvagebridge.com', 'www.salvagebridge.com', 'www.nemsalvage.com'].includes(url.hostname)) return 'https://nemsalvage.com';
  return url.origin;
}

export function isPublicSiteIndexable(): boolean {
  const url = new URL(getPublicSiteUrl());
  return process.env.VERCEL_ENV !== 'preview' && !url.hostname.startsWith('staging.') && !['localhost','127.0.0.1'].includes(url.hostname);
}
