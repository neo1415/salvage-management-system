import type { BrandingPolicy } from '@/features/business-policy/types';

export type CanonicalHomepageTemplate =
  | 'reclaim_editorial'
  | 'nem_salvage'
  | 'recovery_command'
  | 'auction_pulse'
  | 'executive_terminal';

export type TemplateSurface = {
  id: CanonicalHomepageTemplate;
  name: string;
  description: string;
  defaultTheme: 'day' | 'night';
  authTone: string;
};

export const HOMEPAGE_TEMPLATE_OPTIONS: TemplateSurface[] = [
  {
    id: 'reclaim_editorial',
    name: 'Salvage Bridge',
    description: 'Flagship Salvage Bridge homepage for the platform provider, with an editorial recovery story and premium buyer confidence.',
    defaultTheme: 'night',
    authTone: 'Salvage Bridge access',
  },
  {
    id: 'nem_salvage',
    name: 'Classic',
    description: 'The animated salvage showcase style with bold motion, auctions, and a familiar recovery flow.',
    defaultTheme: 'night',
    authTone: 'Verified salvage access',
  },
  {
    id: 'recovery_command',
    name: 'Recovery Command',
    description: 'Command-center layout for operations-heavy insurers that want dashboards, timelines, and controls above the fold.',
    defaultTheme: 'day',
    authTone: 'Operations command center',
  },
  {
    id: 'auction_pulse',
    name: 'Auction Pulse',
    description: 'Mobile-first auction portal for vendors and buyers who need lots, bid readiness, documents, payment, and pickup clarity.',
    defaultTheme: 'night',
    authTone: 'Verified auction access',
  },
  // Executive Terminal remains supported for existing policies, but it is
  // hidden from the picker until the template is fully wired into the live editor.
];

export function normalizeHomepageTemplate(template: BrandingPolicy['homepageTemplate']): CanonicalHomepageTemplate {
  if (template === 'salvage_showcase') return 'nem_salvage';
  if (template === 'auction_marketplace') return 'recovery_command';
  if (template === 'claims_orbit') return 'auction_pulse';
  if (template === 'minimal_private') return 'executive_terminal';
  return template;
}

export function resolveTemplateTheme(branding: BrandingPolicy): 'day' | 'night' {
  if (branding.homepageTheme === 'day' || branding.homepageTheme === 'night') return branding.homepageTheme;
  const template = HOMEPAGE_TEMPLATE_OPTIONS.find((option) => option.id === normalizeHomepageTemplate(branding.homepageTemplate));
  return template?.defaultTheme ?? 'night';
}

export function getAuthSurfaceCopy(branding: BrandingPolicy) {
  const template = HOMEPAGE_TEMPLATE_OPTIONS.find((option) => option.id === normalizeHomepageTemplate(branding.homepageTemplate));
  return {
    tone: template?.authTone ?? 'Secure workspace',
    headline: branding.homepageCopy.authHeadline || branding.homepageCopy.heroTitle,
    subtitle: branding.homepageCopy.authSubtitle || branding.homepageCopy.heroSubtitle,
  };
}
