import type { MetadataRoute } from 'next';
import { businessPolicyService } from '@/features/business-policy';

export const revalidate = 300;

function iconMimeType(src: string): string {
  const cleanSrc = src.split('?')[0].toLowerCase();
  if (cleanSrc.endsWith('.svg')) return 'image/svg+xml';
  if (cleanSrc.endsWith('.webp')) return 'image/webp';
  if (cleanSrc.endsWith('.ico')) return 'image/x-icon';
  if (cleanSrc.endsWith('.jpg') || cleanSrc.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const publicPolicy = await businessPolicyService.getPublicPolicy();
  const branding = publicPolicy.branding;
  const icon192 = branding.faviconPath || branding.logoPath || '/icons/icon-192.png';
  const icon512 = branding.faviconPath || branding.logoPath || '/icons/icon-512.png';

  return {
    name: `${branding.brandName} Salvage Management`,
    short_name: branding.brandName,
    description: branding.homepageCopy.heroSubtitle || `${branding.brandName} salvage recovery workspace`,
    id: '/launch',
    start_url: '/launch',
    scope: '/',
    display: 'standalone',
    background_color: branding.primaryColor,
    theme_color: branding.primaryColor,
    orientation: 'portrait-primary',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: icon192,
        sizes: '192x192',
        type: iconMimeType(icon192),
        purpose: 'any',
      },
      {
        src: icon192,
        sizes: '192x192',
        type: iconMimeType(icon192),
        purpose: 'maskable',
      },
      {
        src: icon512,
        sizes: '512x512',
        type: iconMimeType(icon512),
        purpose: 'any',
      },
      {
        src: icon512,
        sizes: '512x512',
        type: iconMimeType(icon512),
        purpose: 'maskable',
      },
    ],
    screenshots: [],
  };
}
