/**
 * Shared URL builders for transactional emails and SMS links.
 * Never falls back to localhost outside development.
 */

export function getAppUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  throw new Error('Application URL is not configured. Set NEXT_PUBLIC_APP_URL or NEXTAUTH_URL.');
}

/** Deep link to vendor documents for a specific auction */
export function getVendorDocumentsUrl(auctionId: string): string {
  return `${getAppUrl()}/vendor/documents#auction-${auctionId}`;
}

export function getVendorPickupsUrl(): string {
  return `${getAppUrl()}/vendor/pickups`;
}

export function appPath(path: string): string {
  const base = getAppUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}
