'use client';

import { useMemo, useState, type MouseEvent } from 'react';
import { AlertTriangle, CheckCircle2, MonitorSmartphone, Rocket, Save, ShieldAlert, Upload } from 'lucide-react';
import type { BusinessPolicy, PolicyValidationResult } from '@/features/business-policy/types';
import { validateBusinessPolicy } from '@/features/business-policy/policy-validation';
import { HOMEPAGE_TEMPLATE_OPTIONS, normalizeHomepageTemplate } from '@/components/landing/template-config';
import { WhiteLabelHomeTemplates } from '@/components/landing/home-templates';
import { getReadableTextColor } from '@/features/branding/brand-colors';
import { useToast } from '@/components/ui/toast';

type EnterprisePolicyEditorProps = {
  initialPolicy: BusinessPolicy;
};

type SaveResult = {
  success: boolean;
  record?: { id: string; version: string; policy?: BusinessPolicy };
  validation?: PolicyValidationResult;
  error?: string;
};

type TemplateEditorGuide = {
  bestFor: string;
  sections: string[];
  image: string;
};

const TEMPLATE_EDITOR_GUIDE: Record<string, TemplateEditorGuide> = {
  reclaim_editorial: {
    bestFor: 'Premium recovery story with a strong editorial first impression.',
    sections: ['Hero story', 'Recovery brief', 'Auction inventory', 'Trust and contact'],
    image: '/assets/hero-1.png',
  },
  nem_salvage: {
    bestFor: 'Classic public auction homepage with carousel, day/night mode, bidding steps, and buyer support.',
    sections: ['Carousel hero', 'Auction path', 'Buyer controls', 'Contact'],
    image: '/assets/Hero-3.png',
  },
  recovery_command: {
    bestFor: 'Auction buyers and verified vendors who need clear auction access, bidding, documents, payment, and pickup steps.',
    sections: ['Buyer hero', 'Bid workflow', 'Buyer controls', 'Pickup path', 'Contact'],
    image: '/assets/recovery-command/hero-yard.png',
  },
  auction_pulse: {
    bestFor: 'Mobile-first salvage auction portal for vendors who need auction listings, wallet readiness, bidding, documents, payment, and pickup clarity.',
    sections: ['Swipe hero', 'Active auctions', 'Filters', 'Bid readiness', 'Vendor support'],
    image: '/assets/auction-pulse/mobile-auction.png',
  },
  executive_terminal: {
    bestFor: 'Private, quiet sign-in-first experience with a restrained executive feel.',
    sections: ['Minimal hero', 'Dossier list', 'Control protocol', 'Lot ledger'],
    image: '/assets/hero-2.png',
  },
};

const TEMPLATE_COPY_MAP: Record<string, Array<{ label: string; fields: string; appears: string }>> = {
  reclaim_editorial: [
    { label: 'Editorial hero', fields: 'Small label, hero title, subtitle, buttons', appears: 'Top full-screen editorial intro' },
    { label: 'About section', fields: 'Supporting line and stats', appears: 'Light section below the hero' },
    { label: 'Trust block', fields: 'Trust line and support contacts', appears: 'Trust and contact section near the footer' },
  ],
  nem_salvage: [
    { label: 'Carousel hero', fields: 'Hero slides, subtitle, buttons, badges', appears: 'Classic public auction homepage' },
    { label: 'Auction path', fields: 'Workflow labels and process copy', appears: 'Register to pickup release flow' },
    { label: 'Contact and support', fields: 'Contact text, trust line, sign-in copy', appears: 'Support form, footer, and authentication screens' },
  ],
  recovery_command: [
    { label: 'Buyer hero', fields: 'Small label, hero title, subtitle, buttons', appears: 'Public salvage auction landing hero' },
    { label: 'Bid workflow', fields: 'Workflow labels and process copy', appears: 'Vendor verification to pickup release timeline' },
    { label: 'Contact section', fields: 'Trust line, support email, support phone', appears: 'Vendor help and footer support area' },
  ],
  auction_pulse: [
    { label: 'Mobile auction hero', fields: 'Small label, carousel title, intro, buttons', appears: 'Swipeable public auction intro' },
    { label: 'Active auctions and filters', fields: 'Auction marketplace copy, badges, and filter language', appears: 'Featured auction cards and quick filters' },
    { label: 'Vendor support', fields: 'Trust line, wallet guidance, contact text', appears: 'Bid readiness, support, and footer areas' },
  ],
  executive_terminal: [
    { label: 'Private entry', fields: 'Hero title, subtitle, buttons', appears: 'Left-side access panel' },
    { label: 'Protocol view', fields: 'Supporting line and trust line', appears: 'Dossier and workflow sections' },
    { label: 'Sign-in shell', fields: 'Auth headline and subtitle', appears: 'Login and registration screens' },
  ],
};

function clonePolicy(policy: BusinessPolicy): BusinessPolicy {
  return structuredClone(policy);
}

function createEditablePolicyVersion() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `policy-${stamp}`;
}

function canApplyCloudinaryCompression(file: File) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

function numberValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isVeryLightHex(hex: string): boolean {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return false;
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 230;
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-950">{label}</span>
      {description ? <span className="mt-1 block text-xs text-gray-500">{description}</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function BrandAssetUploadCard({
  target,
  label,
  description,
  value,
  brandName,
  uploading,
  onUpload,
}: {
  target: 'logo' | 'favicon';
  label: string;
  description: string;
  value: string;
  brandName: string;
  uploading: boolean;
  onUpload: (file: File, target: 'logo' | 'favicon') => void;
}) {
  const inputId = `brand-${target}-upload`;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-center gap-3">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            {value ? (
              <img
                src={value}
                alt={`${brandName || 'Brand'} ${target} preview`}
                className={`${target === 'favicon' ? 'h-9 w-9' : 'h-12 w-12'} object-contain`}
              />
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {target}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{label}</p>
            <p className="mt-1 max-w-md text-xs leading-5 text-gray-500">{description}</p>
            {value ? (
              <p className="mt-2 max-w-xs truncate text-[11px] text-gray-400" title={value}>
                Uploaded
              </p>
            ) : null}
          </div>
        </div>
        <div className="lg:justify-self-end">
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file, target);
              event.currentTarget.value = '';
            }}
            className="sr-only"
          />
          <label
            htmlFor={inputId}
            className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-primary-foreground)] transition hover:bg-[var(--brand-primary-hover)] lg:w-auto ${
              uploading ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : value ? 'Replace' : 'Upload'}
          </label>
        </div>
      </div>
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="min-h-24 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
    />
  );
}

type HomepageCopyKey = keyof BusinessPolicy['branding']['homepageCopy'];

type ContentFieldConfig = {
  key: HomepageCopyKey;
  label: string;
  type?: 'text' | 'textarea';
  hint?: string;
};

type ContentPanelConfig = {
  id: string;
  label: string;
  summary: string;
  fields: ContentFieldConfig[];
};

type PreviewEditHotspot = {
  id: string;
  label: string;
  keys: HomepageCopyKey[];
  panel: string;
};

const RECOVERY_COMMAND_PREVIEW_WIDTH = 1180;
const RECOVERY_COMMAND_PREVIEW_SCALE = 0.78;

const RECOVERY_COMMAND_PREVIEW_HOTSPOTS: PreviewEditHotspot[] = [
  { id: 'hero-label', label: 'Hero label', panel: 'hero', keys: ['eyebrow'] },
  { id: 'hero-title', label: 'Hero headline', panel: 'hero', keys: ['heroTitle'] },
  { id: 'hero-copy', label: 'Hero intro', panel: 'hero', keys: ['heroSubtitle'] },
  { id: 'hero-primary-button', label: 'Primary button', panel: 'hero', keys: ['primaryCtaLabel'] },
  { id: 'hero-secondary-button', label: 'Secondary button', panel: 'hero', keys: ['secondaryCtaLabel'] },
  { id: 'auction-slide-1', label: 'Carousel slide 1', panel: 'hero', keys: ['heroTitle', 'heroSubtitle', 'primaryCtaLabel', 'secondaryCtaLabel'] },
  { id: 'auction-slide-2', label: 'Carousel slide 2', panel: 'hero', keys: ['statOneValue', 'statOneLabel', 'auctionSectionButtonLabel', 'auctionSectionEyebrow'] },
  { id: 'auction-slide-3', label: 'Carousel slide 3', panel: 'hero', keys: ['statTwoValue', 'statTwoLabel', 'proofContactLabel', 'auctionSectionTitle'] },
  { id: 'auction-slide-4', label: 'Carousel slide 4', panel: 'hero', keys: ['statThreeValue', 'statThreeLabel', 'recoveryBriefTitle', 'recoveryBriefBody'] },
  { id: 'hero-badges', label: 'Hero badges', panel: 'hero', keys: ['statOneLabel', 'statTwoLabel', 'statThreeLabel'] },
  { id: 'workflow-heading', label: 'Workflow heading', panel: 'workflow', keys: ['workflowTitle', 'workflowSubtitle'] },
  {
    id: 'workflow-steps',
    label: 'Workflow steps',
    panel: 'workflow',
    keys: ['workflowStepOneTitle', 'workflowStepOneBody', 'workflowStepTwoTitle', 'workflowStepTwoBody', 'workflowStepThreeTitle', 'workflowStepThreeBody', 'workflowStepFourTitle', 'workflowStepFourBody'],
  },
  { id: 'controls-copy', label: 'Buyer controls copy', panel: 'controls', keys: ['operationsSectionEyebrow', 'operationsSectionTitle', 'operationsSectionSubtitle'] },
  {
    id: 'controls-cards',
    label: 'Buyer control cards',
    panel: 'controls',
    keys: ['operationsCardOneTitle', 'operationsCardOneBody', 'operationsCardTwoTitle', 'operationsCardTwoBody'],
  },
  {
    id: 'control-step-cards',
    label: 'Control step cards',
    panel: 'controls',
    keys: [
      'proofCardOneTitle',
      'proofCardOneBody',
      'proofCardTwoTitle',
      'proofCardTwoBody',
      'proofCardThreeTitle',
      'proofCardThreeBody',
      'proofCardFourTitle',
      'proofCardFourBody',
      'operationsCardThreeTitle',
      'operationsCardThreeBody',
      'recoveryBriefTitle',
      'recoveryBriefBody',
    ],
  },
  { id: 'buyer-copy', label: 'Buyer reassurance', panel: 'buyers', keys: ['proofSectionTitle', 'proofSectionSubtitle'] },
  { id: 'contact-copy', label: 'Contact copy', panel: 'contact', keys: ['contactHeadline', 'contactSubtitle'] },
];

const RECOVERY_COMMAND_DEFAULT_COPY: Partial<Record<HomepageCopyKey, string>> = {
  eyebrow: 'Verified salvage auction access',
  heroTitle: 'Bid on verified salvage assets with confidence.',
  heroSubtitle: 'Browse auction-ready salvage, complete verification, place secured bids, sign documents, and arrange pickup through one trusted recovery marketplace.',
  primaryCtaLabel: 'Register to bid',
  secondaryCtaLabel: 'View workflow',
  trustLine: 'Verified salvage auctions, secure deposits, signed documents, and clear pickup steps.',
  statOneLabel: 'Verified listings',
  statTwoLabel: 'Secured deposits',
  statThreeLabel: 'Pickup-ready steps',
  workflowTitle: 'How buying works',
  workflowSubtitle: 'A clear path from account setup to pickup release.',
  workflowStepOneTitle: 'Verify access',
  workflowStepOneBody: 'Create your vendor profile and complete the checks required for auction access.',
  workflowStepTwoTitle: 'Review auctions',
  workflowStepTwoBody: 'Inspect photos, condition notes, reserve cues, and document requirements before bidding.',
  workflowStepThreeTitle: 'Bid securely',
  workflowStepThreeBody: 'Place bids with clear increments, deposit rules, and verified bidder controls.',
  workflowStepFourTitle: 'Pay and pickup',
  workflowStepFourBody: 'Sign documents, complete payment, and follow the pickup release steps.',
  operationsSectionEyebrow: 'Buyer controls',
  operationsSectionTitle: 'Bid with the important steps already visible.',
  operationsSectionSubtitle: 'The public page should make vendors feel oriented before they enter the auction: what is verified, what is required, and what happens after a winning bid.',
  operationsCardOneTitle: 'Review the auction',
  operationsCardOneBody: 'Review visual evidence and condition notes before you commit to a bid.',
  operationsCardTwoTitle: 'Track next steps',
  operationsCardTwoBody: 'After winning, documents, payment, and pickup status stay visible in one place.',
  proofCardOneTitle: 'Register',
  proofCardOneBody: 'Create a vendor account and keep your bidder profile ready.',
  proofCardTwoTitle: 'Inspect',
  proofCardTwoBody: 'Review auction details, photos, condition notes, and document requirements.',
  proofCardThreeTitle: 'Bid',
  proofCardThreeBody: 'Place verified bids with reserve gates and clear minimum increments.',
  proofCardFourTitle: 'Deposit',
  proofCardFourBody: 'Use auction-specific deposits that are tracked to the auction.',
  operationsCardThreeTitle: 'Documents',
  operationsCardThreeBody: 'Sign required documents before pickup authorization.',
  recoveryBriefTitle: 'Payment',
  recoveryBriefBody: 'Complete payment and move the auction toward pickup release.',
  proofSectionTitle: 'A clearer way to buy salvage assets.',
  proofSectionSubtitle: 'Verified vendors can review salvage auctions, bid securely, complete documents, pay the balance, and prepare for pickup.',
  contactHeadline: 'Need help before you bid?',
  contactSubtitle: 'Ask about vendor verification, auction access, deposits, documents, payment, or pickup requirements before joining an auction.',
  authHeadline: 'Access verified salvage auctions.',
  authSubtitle: 'Sign in to Review auctions, manage bids, complete documents, track payment, and prepare for pickup.',
};

const AUCTION_PULSE_DEFAULT_COPY: Partial<Record<HomepageCopyKey, string>> = {
  eyebrow: 'Mobile salvage bidding',
  heroTitle: 'Bid from your phone with the asset details in view.',
  heroSubtitle: 'Browse active salvage auctions, check damage notes, keep your wallet ready, and track every step after you win.',
  primaryCtaLabel: 'Browse Active Auctions',
  secondaryCtaLabel: 'Register as a Vendor',
  trustLine: 'Verified auction access, deposit visibility, signed documents, and pickup instructions.',
  statOneValue: 'Get cleared before the auction clock runs out.',
  statOneLabel: 'Complete verification, confirm your wallet coverage, and see which auctions you can join.',
  auctionSectionButtonLabel: 'Start Verification',
  auctionSectionEyebrow: 'Wallet Guide',
  statTwoValue: 'Know the path before you place a bid.',
  statTwoLabel: 'Review the vehicle, fund your wallet, bid, win, sign documents, pay, and receive pickup instructions.',
  proofContactLabel: 'See Bidding Steps',
  auctionSectionTitle: 'View Sample Auction',
  statThreeValue: 'After you win, the next steps stay visible.',
  statThreeLabel: 'Track document signing, payment confirmation, and pickup release without guessing what happens next.',
  recoveryBriefTitle: 'View After-Win Flow',
  recoveryBriefBody: 'Contact Support',
  workflowTitle: 'Your bidding path, one step at a time.',
  workflowSubtitle: 'A vertical action rail keeps the buying journey easy to follow on mobile.',
  workflowStepOneTitle: 'Register',
  workflowStepOneBody: 'Create a vendor account and keep your bidder profile ready.',
  workflowStepTwoTitle: 'Verify',
  workflowStepTwoBody: 'Complete the checks required for eligible auctions and bid limits.',
  workflowStepThreeTitle: 'Bid',
  workflowStepThreeBody: 'Review auction details, keep your wallet ready, and place verified bids.',
  workflowStepFourTitle: 'Pickup',
  workflowStepFourBody: 'Sign documents, complete payment, and receive pickup instructions.',
  operationsSectionEyebrow: 'Bid readiness',
  operationsSectionTitle: 'Know your status before you join an auction.',
  operationsSectionSubtitle: 'See auction requirements, wallet coverage, verification status, documents, payment, and pickup readiness before you commit.',
  operationsCardOneTitle: 'Wallet coverage',
  operationsCardOneBody: 'Check the deposit or wallet balance needed for eligible auctions before placing a bid.',
  operationsCardTwoTitle: 'Post-win tracking',
  operationsCardTwoBody: 'After winning, follow document signing, payment, and pickup release from one clear page.',
  operationsCardThreeTitle: 'Auction rules',
  operationsCardThreeBody: 'Bids, deadlines, document windows, and pickup steps are shown before you act.',
  proofCardOneTitle: 'Active auctions',
  proofCardOneBody: 'Scan vehicle images, condition notes, location, current bid, and time left.',
  proofCardTwoTitle: 'Clear eligibility',
  proofCardTwoBody: 'Know when verification or wallet funding is needed before joining an auction.',
  proofCardThreeTitle: 'Bid status',
  proofCardThreeBody: 'Track whether you are leading, outbid, or waiting for auction close.',
  proofCardFourTitle: 'Pickup path',
  proofCardFourBody: 'Move from documents and payment to release instructions without confusion.',
  proofSectionTitle: 'Clear rules. Verified bidders. Structured handoff.',
  proofSectionSubtitle: 'The portal keeps auction details, deposit expectations, payment steps, documents, and pickup instructions visible to buyers.',
  contactHeadline: 'Need help before you bid?',
  contactSubtitle: 'Ask vendor support about verification, wallet funding, auction access, documents, payment, or pickup requirements.',
  authHeadline: 'Access verified salvage auctions.',
  authSubtitle: 'Sign in to Review auctions, manage bids, complete documents, track payment, and prepare for pickup.',
};

const CLASSIC_DEFAULT_COPY: Partial<Record<HomepageCopyKey, string>> = {
  eyebrow: 'Verified salvage marketplace',
  heroTitle: 'Buy verified salvage with clear next steps.',
  heroSubtitle: 'Register, review active auctions, place secured bids, sign documents, complete payment, and receive pickup guidance.',
  primaryCtaLabel: 'Register to bid',
  secondaryCtaLabel: 'Browse auctions',
  trustLine: 'Verified auctions, clear deposit handling, signed documents, and pickup-ready communication.',
  statOneValue: 'Find auctions that are ready for review.',
  statOneLabel: 'Check vehicle photos, damage notes, location, current bid, and time left before joining the auction.',
  auctionSectionButtonLabel: 'View auctions',
  auctionSectionEyebrow: 'How bidding works',
  statTwoValue: 'Know when you are ready to bid.',
  statTwoLabel: 'Verification, wallet coverage, auction rules, and document requirements are shown before you act.',
  proofContactLabel: 'Check readiness',
  auctionSectionTitle: 'Learn deposits',
  statThreeValue: 'Move from winning bid to pickup release.',
  statThreeLabel: 'Track documents, payment, support messages, and pickup status after the auction closes.',
  recoveryBriefTitle: 'See pickup flow',
  recoveryBriefBody: 'Contact support',
  workflowTitle: 'How the auction path works',
  workflowSubtitle: 'Move from account setup to pickup release without guessing the next step.',
  workflowStepOneTitle: 'Register',
  workflowStepOneBody: 'Create your vendor account and keep your bidder profile ready.',
  workflowStepTwoTitle: 'Review',
  workflowStepTwoBody: 'Inspect photos, notes, auction rules, and document requirements.',
  workflowStepThreeTitle: 'Bid',
  workflowStepThreeBody: 'Place secured bids with clear increments, deposits, and status updates.',
  workflowStepFourTitle: 'Pickup',
  workflowStepFourBody: 'Sign documents, complete payment, and receive pickup instructions.',
  operationsSectionEyebrow: 'Auction controls',
  operationsSectionTitle: 'Everything important stays visible.',
  operationsSectionSubtitle: 'Auction details, bidder readiness, documents, payments, and pickup updates are presented in plain language.',
  operationsCardOneTitle: 'Auction details',
  operationsCardOneBody: 'Review condition notes, photos, bids, and location before you commit.',
  operationsCardTwoTitle: 'Bid readiness',
  operationsCardTwoBody: 'See verification, wallet, and auction access requirements before bidding.',
  operationsCardThreeTitle: 'After winning',
  operationsCardThreeBody: 'Follow document signing, payment, and pickup release from one place.',
  proofCardOneTitle: 'Verified access',
  proofCardOneBody: 'Registration and review steps keep auction access structured.',
  proofCardTwoTitle: 'Clear auction rules',
  proofCardTwoBody: 'Bids, deposits, deadlines, and document windows are easy to follow.',
  proofCardThreeTitle: 'Payment visibility',
  proofCardThreeBody: 'Track what is paid, what is pending, and when pickup can be released.',
  proofCardFourTitle: 'Support contact',
  proofCardFourBody: 'Reach the auction support team before or after bidding.',
  proofSectionTitle: 'A familiar auction page with clearer safeguards.',
  proofSectionSubtitle: 'Classic keeps the marketplace feel, but adds verification, deposit visibility, document tracking, and pickup guidance.',
  contactHeadline: 'Questions before you bid?',
  contactSubtitle: 'Contact support for help with registration, verification, deposits, payment, documents, or pickup instructions.',
  authHeadline: 'Access verified salvage auctions.',
  authSubtitle: 'Sign in to review auctions, manage bids, complete documents, track payment, and prepare for pickup.',
};

function isGenericRecoveryCopy(value: string | undefined) {
  const text = (value || '').toLowerCase();
  return text.includes('total losses become recovered capital')
    || text.includes('where losses become recovered capital')
    || text.includes('salvage auction platform for insurers')
    || text.includes('insurance recovery')
    || text.includes('claim intake')
    || text.includes('request demo')
    || text.includes('start recovery')
    || text.includes('recover value without losing control');
}

function resolveTemplateEditorValue(copy: BusinessPolicy['branding']['homepageCopy'], key: HomepageCopyKey, defaults: Partial<Record<HomepageCopyKey, string>>) {
  const value = copy[key];
  const stringValue = typeof value === 'string' ? value : '';
  const fallback = defaults[key];
  if (value === undefined || value === null) return fallback ?? '';
  if (fallback && isGenericRecoveryCopy(stringValue)) return fallback;
  return stringValue;
}

const RECOVERY_COMMAND_CONTENT_PANELS: ContentPanelConfig[] = [
  {
    id: 'hero',
    label: 'Hero',
    summary: 'Top of the homepage: promise, intro, and action buttons.',
    fields: [
      { key: 'eyebrow', label: 'Small label' },
      { key: 'heroTitle', label: 'Headline', hint: 'Keep this short and buyer-facing.' },
      { key: 'heroSubtitle', label: 'Intro text', type: 'textarea' },
      { key: 'primaryCtaLabel', label: 'Main button' },
      { key: 'secondaryCtaLabel', label: 'Secondary button' },
      { key: 'statOneValue', label: 'Slide 2 headline' },
      { key: 'statOneLabel', label: 'Badge 1 / slide 2 body', type: 'textarea' },
      { key: 'auctionSectionButtonLabel', label: 'Slide 2 main button' },
      { key: 'auctionSectionEyebrow', label: 'Slide 2 secondary button' },
      { key: 'statTwoValue', label: 'Slide 3 headline' },
      { key: 'statTwoLabel', label: 'Badge 2 / slide 3 body', type: 'textarea' },
      { key: 'proofContactLabel', label: 'Slide 3 main button' },
      { key: 'auctionSectionTitle', label: 'Slide 3 secondary button' },
      { key: 'statThreeValue', label: 'Slide 4 headline' },
      { key: 'statThreeLabel', label: 'Badge 3 / slide 4 body', type: 'textarea' },
      { key: 'recoveryBriefTitle', label: 'Slide 4 main button' },
      { key: 'recoveryBriefBody', label: 'Slide 4 secondary button' },
      { key: 'trustLine', label: 'Footer trust line', type: 'textarea' },
    ],
  },
  {
    id: 'workflow',
    label: 'Workflow',
    summary: 'The buying path from verification to pickup release.',
    fields: [
      { key: 'workflowTitle', label: 'Section headline' },
      { key: 'workflowSubtitle', label: 'Section intro', type: 'textarea' },
      { key: 'workflowStepOneTitle', label: 'Step 1 title' },
      { key: 'workflowStepOneBody', label: 'Step 1 description', type: 'textarea' },
      { key: 'workflowStepTwoTitle', label: 'Step 2 title' },
      { key: 'workflowStepTwoBody', label: 'Step 2 description', type: 'textarea' },
      { key: 'workflowStepThreeTitle', label: 'Step 3 title' },
      { key: 'workflowStepThreeBody', label: 'Step 3 description', type: 'textarea' },
      { key: 'workflowStepFourTitle', label: 'Step 4 title' },
      { key: 'workflowStepFourBody', label: 'Step 4 description', type: 'textarea' },
    ],
  },
  {
    id: 'controls',
    label: 'Buyer Controls',
    summary: 'The visual control-room section shown below the workflow.',
    fields: [
      { key: 'operationsSectionEyebrow', label: 'Small label' },
      { key: 'operationsSectionTitle', label: 'Section headline' },
      { key: 'operationsSectionSubtitle', label: 'Section intro', type: 'textarea' },
      { key: 'operationsCardOneTitle', label: 'Image card 1 title' },
      { key: 'operationsCardOneBody', label: 'Image card 1 description', type: 'textarea' },
      { key: 'operationsCardTwoTitle', label: 'Image card 2 title' },
      { key: 'operationsCardTwoBody', label: 'Image card 2 description', type: 'textarea' },
      { key: 'proofCardOneTitle', label: 'Control card 1 title' },
      { key: 'proofCardOneBody', label: 'Control card 1 description', type: 'textarea' },
      { key: 'proofCardTwoTitle', label: 'Control card 2 title' },
      { key: 'proofCardTwoBody', label: 'Control card 2 description', type: 'textarea' },
      { key: 'proofCardThreeTitle', label: 'Control card 3 title' },
      { key: 'proofCardThreeBody', label: 'Control card 3 description', type: 'textarea' },
      { key: 'proofCardFourTitle', label: 'Control card 4 title' },
      { key: 'proofCardFourBody', label: 'Control card 4 description', type: 'textarea' },
      { key: 'operationsCardThreeTitle', label: 'Control card 5 title' },
      { key: 'operationsCardThreeBody', label: 'Control card 5 description', type: 'textarea' },
      { key: 'recoveryBriefTitle', label: 'Control card 6 title' },
      { key: 'recoveryBriefBody', label: 'Control card 6 description', type: 'textarea' },
    ],
  },
  {
    id: 'buyers',
    label: 'For Buyers',
    summary: 'The reassurance section for vendors and bidders.',
    fields: [
      { key: 'proofSectionTitle', label: 'Section headline' },
      { key: 'proofSectionSubtitle', label: 'Section intro', type: 'textarea' },
    ],
  },
  {
    id: 'contact',
    label: 'Contact',
    summary: 'Vendor help copy and sign-in page copy.',
    fields: [
      { key: 'contactHeadline', label: 'Contact headline' },
      { key: 'contactSubtitle', label: 'Contact text', type: 'textarea' },
      { key: 'authHeadline', label: 'Sign-in headline' },
      { key: 'authSubtitle', label: 'Sign-in subtitle', type: 'textarea' },
    ],
  },
];

function TemplateContentStep({
  policy,
  selectedCopyMap,
  updateHomepageCopy,
  updatePolicy,
}: {
  policy: BusinessPolicy;
  selectedCopyMap: Array<{ label: string; fields: string; appears: string }>;
  updateHomepageCopy: (key: HomepageCopyKey, value: string) => void;
  updatePolicy: (updater: (draft: BusinessPolicy) => void) => void;
}) {
  const template = normalizeHomepageTemplate(policy.branding.homepageTemplate);

  if (template === 'recovery_command' || template === 'auction_pulse' || template === 'nem_salvage') {
    const config = {
      recovery_command: {
        defaults: RECOVERY_COMMAND_DEFAULT_COPY,
        title: 'Recovery Command Editor',
        intro: 'Click a headline, paragraph, button, workflow step, or contact text in the preview and edit it in place.',
      },
      auction_pulse: {
        defaults: AUCTION_PULSE_DEFAULT_COPY,
        title: 'Auction Pulse Editor',
        intro: 'Click the actual auction portal text, auction copy, workflow, wallet guidance, or support copy in the preview and edit it in place.',
      },
      nem_salvage: {
        defaults: CLASSIC_DEFAULT_COPY,
        title: 'Classic Editor',
        intro: 'Click the carousel slide, badges, workflow, controls, support copy, or footer-related text in the preview and edit it in place.',
      },
    }[template];
    return (
      <RecoveryCommandContentEditor
        policy={policy}
        updateHomepageCopy={updateHomepageCopy}
        updatePolicy={updatePolicy}
        templateId={template}
        defaults={config.defaults}
        title={config.title}
        intro={config.intro}
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-primary)]">Page copy</p>
          <h3 className="mt-2 text-2xl font-black text-gray-950">Write the homepage in sections</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Keep the main promise short, then use support text, trust lines, and stats to explain the public experience.
          </p>
        </div>
        <section className="rounded-2xl border border-[var(--brand-primary-border)] bg-[var(--brand-primary-surface)] p-4">
          <h4 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">Where this copy appears</h4>
          <div className="mt-4 grid gap-3">
            {selectedCopyMap.map((item) => (
              <div key={item.label} className="rounded-2xl bg-white/80 p-4 shadow-sm">
                <p className="text-sm font-black text-gray-950">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-gray-600">{item.appears}</p>
                <p className="mt-2 text-xs font-semibold text-[var(--brand-primary)]">{item.fields}</p>
              </div>
            ))}
          </div>
        </section>
        <ContentPanel
          title="Hero section"
          fields={[
            { key: 'eyebrow', label: 'Small label above headline' },
            { key: 'heroTitle', label: 'Hero title', hint: 'Best at 6 to 12 words.' },
            { key: 'heroSubtitle', label: 'Hero subtitle', type: 'textarea' },
            { key: 'supportingText', label: 'Supporting line', type: 'textarea' },
            { key: 'primaryCtaLabel', label: 'Main button' },
            { key: 'secondaryCtaLabel', label: 'Secondary button' },
            { key: 'trustLine', label: 'Footer trust line', type: 'textarea' },
            { key: 'contactHeadline', label: 'Contact headline' },
            { key: 'contactSubtitle', label: 'Contact subtitle', type: 'textarea' },
          ]}
          copy={policy.branding.homepageCopy}
          updateHomepageCopy={updateHomepageCopy}
        />
      </div>
      <GenericContentPreview policy={policy} />
    </div>
  );
}

function ContentPanel({
  title,
  fields,
  copy,
  updateHomepageCopy,
  resolveValue,
}: {
  title: string;
  fields: ContentFieldConfig[];
  copy: BusinessPolicy['branding']['homepageCopy'];
  updateHomepageCopy: (key: HomepageCopyKey, value: string) => void;
  resolveValue?: (key: HomepageCopyKey) => string;
}) {
  return (
    <section className="rounded-[1.5rem] border border-gray-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gray-500">{title}</h4>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {fields.map((field) => {
          const value = resolveValue ? resolveValue(field.key) : String(copy[field.key] ?? '');
          return (
            <label key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
              <span className="text-sm font-bold text-gray-950">{field.label}</span>
              {field.hint ? <span className="mt-1 block text-xs leading-5 text-gray-500">{field.hint}</span> : null}
              {field.type === 'textarea' ? (
                <textarea
                  value={value}
                  onChange={(event) => updateHomepageCopy(field.key, event.target.value)}
                  className="mt-2 min-h-32 w-full resize-y rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-900 shadow-inner outline-none transition focus:border-[var(--brand-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
                />
              ) : (
                <input
                  value={value}
                  onChange={(event) => updateHomepageCopy(field.key, event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 shadow-inner outline-none transition focus:border-[var(--brand-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
                />
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}

function RecoveryCommandContentEditor({
  policy,
  updateHomepageCopy,
  updatePolicy,
  templateId,
  defaults,
  title,
  intro,
}: {
  policy: BusinessPolicy;
  updateHomepageCopy: (key: HomepageCopyKey, value: string) => void;
  updatePolicy: (updater: (draft: BusinessPolicy) => void) => void;
  templateId: 'recovery_command' | 'auction_pulse' | 'nem_salvage';
  defaults: Partial<Record<HomepageCopyKey, string>>;
  title: string;
  intro: string;
}) {
  const [activePanel, setActivePanel] = useState(RECOVERY_COMMAND_CONTENT_PANELS[0].id);
  const resolved = (key: HomepageCopyKey) => resolveTemplateEditorValue(policy.branding.homepageCopy, key, defaults);
  const accentText = getReadableTextColor(policy.branding.accentColor);

  const applyDefaults = () => {
    updatePolicy((draft) => {
      Object.entries(defaults).forEach(([key, value]) => {
        draft.branding.homepageCopy[key as HomepageCopyKey] = value ?? '';
      });
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[1.75rem] border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--brand-primary)]">{title}</p>
            <h3 className="mt-2 text-3xl font-black text-gray-950">Click the template text to edit it</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
              {intro}
            </p>
          </div>
          <button
            type="button"
            onClick={applyDefaults}
            className="w-fit rounded-2xl px-4 py-3 text-sm font-black shadow-sm"
            style={{ backgroundColor: policy.branding.accentColor, color: accentText }}
          >
            Use template copy
          </button>
        </div>
      </div>

      <RecoveryCommandLivePreview
        policy={policy}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        resolved={resolved}
        updateHomepageCopy={updateHomepageCopy}
        templateId={templateId}
        defaults={defaults}
      />
    </div>
  );
}

function RecoveryCommandLivePreview({
  policy,
  activePanel,
  setActivePanel,
  resolved,
  updateHomepageCopy,
  templateId,
  defaults,
}: {
  policy: BusinessPolicy;
  activePanel: string;
  setActivePanel: (panel: string) => void;
  resolved: (key: HomepageCopyKey) => string;
  updateHomepageCopy: (key: HomepageCopyKey, value: string) => void;
  templateId: 'recovery_command' | 'auction_pulse' | 'nem_salvage';
  defaults: Partial<Record<HomepageCopyKey, string>>;
}) {
  const [activeHotspotId, setActiveHotspotId] = useState('hero-title');
  const previewBranding = useMemo(() => {
    const homepageCopy = { ...policy.branding.homepageCopy };
    (Object.keys(defaults) as HomepageCopyKey[]).forEach((key) => {
      homepageCopy[key] = resolved(key);
    });

    return {
      ...policy.branding,
      homepageTemplate: templateId,
      homepageMode: 'landing' as const,
      homepageTheme: policy.branding.homepageTheme === 'night' ? 'night' as const : 'day' as const,
      splashEnabled: false,
      homepageCopy,
    };
  }, [policy.branding, resolved, templateId, defaults]);

  const activeHotspot = RECOVERY_COMMAND_PREVIEW_HOTSPOTS.find((hotspot) => hotspot.id === activeHotspotId) ?? RECOVERY_COMMAND_PREVIEW_HOTSPOTS[1];
  const selectedPanel = RECOVERY_COMMAND_CONTENT_PANELS.find((panel) => panel.id === activePanel);
  const handlePreviewClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const editable = target?.closest<HTMLElement>('[data-recovery-edit-id]');
    if (!editable) return;

    event.preventDefault();
    event.stopPropagation();

    const hotspot = RECOVERY_COMMAND_PREVIEW_HOTSPOTS.find(
      (item) => item.id === editable.dataset.recoveryEditId
    );
    if (!hotspot) return;

    setActiveHotspotId(hotspot.id);
    setActivePanel(hotspot.panel);
  };

  return (
    <aside>
      <div className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-300" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <span className="text-xs font-semibold text-gray-500">Live template editor</span>
        </div>
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="recovery-template-editor-scroll max-h-[72vh] overflow-auto bg-slate-100 p-4">
            <style>{`
              .recovery-template-editor-scroll,
              .recovery-template-editor-scroll * {
                scrollbar-color: var(--brand-primary) #e5e7eb;
              }
              .recovery-template-editor-scroll::-webkit-scrollbar,
              .recovery-template-editor-scroll *::-webkit-scrollbar {
                width: 12px;
                height: 12px;
              }
              .recovery-template-editor-scroll::-webkit-scrollbar-track,
              .recovery-template-editor-scroll *::-webkit-scrollbar-track {
                background: #e5e7eb;
                border-radius: 999px;
              }
              .recovery-template-editor-scroll::-webkit-scrollbar-thumb,
              .recovery-template-editor-scroll *::-webkit-scrollbar-thumb {
                background: var(--brand-primary);
                border: 3px solid #e5e7eb;
                border-radius: 999px;
              }
              .recovery-template-editor-surface [data-recovery-edit-id] {
                cursor: text;
                outline: 2px solid transparent;
                outline-offset: 5px;
                border-radius: 16px;
                transition: outline-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
              }
              .recovery-template-editor-surface [data-recovery-edit-id]:hover,
              .recovery-template-editor-surface [data-recovery-edit-id="${activeHotspot.id}"] {
                outline-color: var(--brand-primary);
                box-shadow: 0 0 0 5px var(--brand-focus-ring);
                background-color: rgba(255,255,255,0.18);
              }
              .recovery-template-editor-surface [data-recovery-edit-id="${activeHotspot.id}"] {
                position: relative;
              }
            `}</style>
            <div
              className="mx-auto origin-top-left overflow-hidden rounded-[1.5rem] bg-white shadow-sm"
              style={{
                width: RECOVERY_COMMAND_PREVIEW_WIDTH,
                transform: `scale(${RECOVERY_COMMAND_PREVIEW_SCALE})`,
                marginRight: -(RECOVERY_COMMAND_PREVIEW_WIDTH * (1 - RECOVERY_COMMAND_PREVIEW_SCALE)),
              }}
            >
              <div
                className="recovery-template-editor-surface"
                style={{ width: RECOVERY_COMMAND_PREVIEW_WIDTH }}
                onClickCapture={handlePreviewClick}
              >
                <WhiteLabelHomeTemplates branding={previewBranding} showLegacyBelowFold={false} />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 bg-white p-4 xl:border-l xl:border-t-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">Editing</p>
            <h4 className="mt-2 text-xl font-black text-gray-950">{activeHotspot.label}</h4>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              {selectedPanel?.summary || 'Change the selected text. Empty values stay empty where the template supports it.'}
            </p>
            <div className="mt-4 space-y-4">
              {activeHotspot.keys.map((key) => {
                const field = RECOVERY_COMMAND_CONTENT_PANELS
                  .flatMap((panel) => panel.fields)
                  .find((item) => item.key === key);
                const label = field?.label ?? key;
                const value = resolved(key);
                const longField = field?.type === 'textarea' || value.length > 70;
                return (
                  <label key={key} className="block">
                    <span className="text-sm font-bold text-gray-950">{label}</span>
                    {longField ? (
                      <textarea
                        value={value}
                        onChange={(event) => updateHomepageCopy(key, event.target.value)}
                        className="mt-2 min-h-28 w-full resize-y rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-900 outline-none transition focus:border-[var(--brand-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
                      />
                    ) : (
                      <input
                        value={value}
                        onChange={(event) => updateHomepageCopy(key, event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[var(--brand-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function GenericContentPreview({ policy }: { policy: BusinessPolicy }) {
  return (
    <aside className="xl:sticky xl:top-24 xl:self-start">
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-gray-950 text-white shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-xs font-semibold text-white/50">Live content preview</span>
        </div>
        <div className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: policy.branding.accentColor }}>
            {policy.branding.homepageCopy.eyebrow || 'Homepage label'}
          </p>
          <h4 className="mt-4 text-3xl font-black leading-none">
            {policy.branding.homepageCopy.heroTitle || 'Homepage headline'}
          </h4>
          <p className="mt-4 text-sm leading-6 text-white/65">
            {policy.branding.homepageCopy.heroSubtitle || 'Short introduction shown on the homepage.'}
          </p>
        </div>
      </div>
    </aside>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
        checked
          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-surface)] text-[var(--brand-primary)]'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className={`h-5 w-9 rounded-full p-0.5 transition ${checked ? 'bg-[var(--brand-primary)]' : 'bg-gray-300'}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

function SafetyNote({
  title,
  children,
  tone = 'neutral',
}: {
  title: string;
  children: React.ReactNode;
  tone?: 'neutral' | 'warn';
}) {
  const styles =
    tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-blue-100 bg-blue-50 text-blue-900';

  return (
    <div className={`rounded-md border p-3 text-sm ${styles}`}>
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-xs leading-5 opacity-90">{children}</div>
    </div>
  );
}

function TemplateMiniPreview({
  templateId,
  primaryColor,
  accentColor,
  brandName,
  heroTitle,
  selected,
}: {
  templateId: BusinessPolicy['branding']['homepageTemplate'];
  primaryColor: string;
  accentColor: string;
  brandName: string;
  heroTitle: string;
  selected?: boolean;
}) {
  const guide = TEMPLATE_EDITOR_GUIDE[templateId] ?? TEMPLATE_EDITOR_GUIDE.reclaim_editorial;
  const accentText = getReadableTextColor(accentColor);

  if (templateId === 'executive_terminal') {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-[#0B0F16] text-white shadow-inner">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/60">{brandName || 'Brand'}</span>
          <span className="rounded-full px-2 py-0.5 text-[8px] font-bold" style={{ backgroundColor: accentColor, color: accentText }}>LIVE</span>
        </div>
        <div className="grid h-40 grid-cols-[1.1fr_0.9fr] gap-2 p-3">
          <div className="space-y-2">
            <div className="h-2 w-16 rounded-full" style={{ backgroundColor: accentColor }} />
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <div className="h-3 w-11/12 rounded bg-white/80" />
              <div className="mt-1 h-3 w-2/3 rounded bg-white/50" />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="h-8 rounded bg-white/10" />
              <div className="h-8 rounded bg-white/10" />
            </div>
          </div>
          <div className="rounded border border-white/10 p-2">
            <div className="h-full rounded" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }} />
          </div>
        </div>
        <TemplatePreviewFooter guide={guide} selected={selected} dark />
      </div>
    );
  }

  if (templateId === 'auction_pulse') {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-[#081019] text-white shadow-inner">
        <div className="grid h-52 grid-cols-[0.82fr_1.18fr]">
          <div className="flex flex-col justify-between p-4">
            <div>
              <div className="h-2 w-20 rounded-full" style={{ backgroundColor: accentColor }} />
              <div className="mt-5 h-6 w-11/12 rounded bg-white/95" />
              <div className="mt-2 h-6 w-4/5 rounded bg-white/72" />
              <div className="mt-2 h-6 w-2/3 rounded bg-white/40" />
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-20 rounded-full" style={{ backgroundColor: primaryColor }} />
              <div className="h-7 w-16 rounded-full border border-white/30" />
            </div>
          </div>
          <div className="relative overflow-hidden">
            <img src="/assets/auction-pulse/mobile-auction.png" alt="" className="h-full w-full object-cover opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/40 p-3 backdrop-blur">
              <div className="h-2 w-16 rounded bg-white/70" />
              <div className="mt-2 h-3 w-28 rounded bg-white" />
              <div className="mt-3 h-6 rounded-full" style={{ backgroundColor: primaryColor }} />
            </div>
            <span className="absolute right-3 top-3 rounded-full bg-white px-2 py-1 text-[8px] font-black text-slate-950">MOBILE</span>
          </div>
        </div>
        <TemplatePreviewFooter guide={guide} selected={selected} dark />
      </div>
    );
  }

  if (templateId === 'recovery_command') {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid h-48 grid-cols-[1fr_1fr] gap-2 p-3">
        <div className="rounded-2xl bg-slate-50 p-3 shadow-sm">
          <div className="mb-3 h-2 w-2/3 rounded-full" style={{ backgroundColor: accentColor }} />
          <div className="h-8 rounded" style={{ backgroundColor: primaryColor }} />
          <div className="mt-2 h-8 w-4/5 rounded" style={{ backgroundColor: `${primaryColor}88` }} />
          <div className="mt-4 grid grid-cols-3 gap-1">
            <div className="h-8 rounded bg-white" />
            <div className="h-8 rounded bg-white" />
            <div className="h-8 rounded bg-white" />
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl shadow-sm">
          <img src="/assets/recovery-command/hero-yard.png" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-white/85 p-2">
            <div className="h-2 w-20 rounded bg-slate-300" />
            <div className="mt-2 h-4 rounded" style={{ backgroundColor: primaryColor }} />
          </div>
        </div>
      </div>
      <TemplatePreviewFooter guide={guide} selected={selected} />
      </div>
    );
  }

  if (templateId === 'nem_salvage') {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-inner">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <span className="flex items-center gap-2 text-xs font-black text-slate-950">
            <span className="h-5 w-5 rounded-full" style={{ backgroundColor: primaryColor }} />
            {brandName || 'Classic'}
          </span>
          <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-white">Classic</span>
        </div>
        <div className="grid h-52 grid-cols-[0.88fr_1.12fr]">
          <div className="flex flex-col justify-between p-4">
            <div>
              <div className="h-2 w-20 rounded-full" style={{ backgroundColor: accentColor }} />
              <div className="mt-5 h-6 w-11/12 rounded" style={{ backgroundColor: primaryColor }} />
              <div className="mt-2 h-6 w-4/5 rounded" style={{ backgroundColor: `${primaryColor}99` }} />
              <div className="mt-2 h-6 w-2/3 rounded" style={{ backgroundColor: `${primaryColor}66` }} />
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-20 rounded-xl" style={{ backgroundColor: primaryColor }} />
              <div className="h-7 w-16 rounded-xl border border-slate-200 bg-white" />
            </div>
          </div>
          <div className="relative overflow-hidden">
            <img src="/assets/Hero-3.png" alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-white/88 p-3 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="h-2 w-20 rounded bg-slate-300" />
                <span className="rounded-full px-2 py-0.5 text-[8px] font-black" style={{ backgroundColor: accentColor, color: accentText }}>LIVE</span>
              </div>
              <div className="mt-2 h-4 rounded" style={{ backgroundColor: primaryColor }} />
            </div>
          </div>
        </div>
        <TemplatePreviewFooter guide={guide} selected={selected} />
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl bg-[#0C0C0B] text-white">
      <div className="relative h-40 p-3">
      <img src={guide.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/50 to-black/75" />
      <div className="relative z-10">
      <div className="flex items-center justify-between">
        <div className="h-2 w-16 rounded-full" style={{ backgroundColor: accentColor }} />
        <span className="text-[9px] uppercase tracking-[0.16em] text-white/50">Editorial</span>
      </div>
      <div className="mt-4 grid gap-1">
        <div className="h-5 w-11/12 rounded bg-white/90" title={heroTitle} />
        <div className="h-5 w-2/3 rounded" style={{ backgroundColor: accentColor }} />
        <div className="h-5 w-5/6 rounded bg-white/90" />
      </div>
      <div className="mt-4 grid grid-cols-[0.8fr_1fr] gap-2">
        <div className="h-11 rounded bg-white/10" />
        <div className="h-11 rounded bg-white/10" />
      </div>
      </div>
      </div>
      <TemplatePreviewFooter guide={guide} selected={selected} dark />
    </div>
  );
}

function TemplatePreviewFooter({
  guide,
  selected,
  dark = false,
}: {
  guide: TemplateEditorGuide;
  selected?: boolean;
  dark?: boolean;
}) {
  return (
    <div className={`border-t px-3 py-3 ${dark ? 'border-white/10 bg-black/25 text-white' : 'border-slate-200 bg-white text-slate-950'}`}>
      <p className={`text-xs leading-5 ${dark ? 'text-white/70' : 'text-slate-600'}`}>{guide.bestFor}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {guide.sections.map((section) => (
          <span key={section} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${dark ? 'bg-white/10 text-white/75' : 'bg-slate-100 text-slate-600'}`}>
            {section}
          </span>
        ))}
      </div>
      {selected ? (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-primary)]">
          <CheckCircle2 className="h-3.5 w-3.5" /> Selected
        </p>
      ) : null}
    </div>
  );
}

const ONBOARDING_PRESETS: Array<{
  mode: BusinessPolicy['onboarding']['mode'];
  title: string;
  description: string;
}> = [
  {
    mode: 'tiered_bvn_fee_tier2',
    title: 'Tiered vendor journey',
    description: 'Identity checks unlock limited bidding, registration fees unlock full verification, and final approval stays manual.',
  },
  {
    mode: 'full_kyc_before_bidding',
    title: 'Full KYC before bidding',
    description: 'Vendors can browse, but cannot bid until full business KYC is approved.',
  },
  {
    mode: 'fee_before_tier1',
    title: 'Fee before Tier 1',
    description: 'Registration fee must be paid before the vendor can use Tier 1 bidding.',
  },
  {
    mode: 'single_full_kyc',
    title: 'Single full KYC',
    description: 'Skip the Tier 1 path and require one full KYC flow before bidding.',
  },
  {
    mode: 'no_registration_fee',
    title: 'No registration fee',
    description: 'Keep verification controls, but remove registration fee gates.',
  },
];

const SETUP_STEPS = [
  {
    id: 'welcome',
    title: 'Start',
    description: 'Choose how this workspace should look and operate.',
    paths: [],
  },
  {
    id: 'brand',
    title: 'Business',
    description: 'Names, colors, logos, and support contacts.',
    paths: ['branding'],
  },
  {
    id: 'template',
    title: 'Template',
    description: 'Choose the homepage and sign-in style.',
    paths: ['branding'],
  },
  {
    id: 'content',
    title: 'Content',
    description: 'Write homepage, sign-in, and button copy.',
    paths: ['branding'],
  },
  {
    id: 'onboarding',
    title: 'Access',
    description: 'Authentication, MFA, vendor onboarding, KYC gates.',
    paths: ['auth', 'onboarding', 'kyc'],
  },
  {
    id: 'operations',
    title: 'Auctions',
    description: 'Deposits, reserve rules, and deadlines.',
    paths: ['escrow', 'auctions', 'payments'],
  },
  {
    id: 'workflow',
    title: 'Workflow',
    description: 'Asset types, case workflow, notifications.',
    paths: ['cases', 'aiValuation', 'notifications'],
  },
  {
    id: 'documents',
    title: 'Documents',
    description: 'Reports, legal pages, clauses, and letterhead.',
    paths: ['documents', 'reports', 'legal'],
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Review settings and publish changes.',
    paths: ['fraud'],
  },
] as const;

type SetupStepId = (typeof SETUP_STEPS)[number]['id'];

function applyOnboardingPreset(draft: BusinessPolicy, mode: BusinessPolicy['onboarding']['mode']) {
  draft.onboarding.mode = mode;

  if (mode === 'tiered_bvn_fee_tier2') {
    draft.kyc.tier1RequiresBvn = true;
    draft.onboarding.registrationFeeRequired = true;
    draft.onboarding.allowBrowseBeforeKyc = false;
    draft.onboarding.allowBidAfterTier1 = true;
    draft.onboarding.requireTier2ForUnlimitedBidding = true;
  }

  if (mode === 'full_kyc_before_bidding') {
    draft.kyc.tier1RequiresBvn = true;
    draft.onboarding.registrationFeeRequired = true;
    draft.onboarding.allowBrowseBeforeKyc = true;
    draft.onboarding.allowBidAfterTier1 = false;
    draft.onboarding.requireTier2ForUnlimitedBidding = true;
  }

  if (mode === 'fee_before_tier1') {
    draft.kyc.tier1RequiresBvn = true;
    draft.onboarding.registrationFeeRequired = true;
    draft.onboarding.allowBrowseBeforeKyc = false;
    draft.onboarding.allowBidAfterTier1 = true;
    draft.onboarding.requireTier2ForUnlimitedBidding = true;
  }

  if (mode === 'single_full_kyc') {
    draft.kyc.tier1RequiresBvn = false;
    draft.onboarding.registrationFeeRequired = true;
    draft.onboarding.allowBrowseBeforeKyc = true;
    draft.onboarding.allowBidAfterTier1 = false;
    draft.onboarding.requireTier2ForUnlimitedBidding = true;
  }

  if (mode === 'no_registration_fee') {
    draft.kyc.tier1RequiresBvn = true;
    draft.onboarding.registrationFeeRequired = false;
    draft.onboarding.registrationFeeAmount = 0;
    draft.onboarding.allowBrowseBeforeKyc = false;
    draft.onboarding.allowBidAfterTier1 = true;
    draft.onboarding.requireTier2ForUnlimitedBidding = true;
  }
}

export function EnterprisePolicyEditor({ initialPolicy }: EnterprisePolicyEditorProps) {
  const toast = useToast();
  const [policy, setPolicy] = useState(() => clonePolicy(initialPolicy));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingBrandAsset, setUploadingBrandAsset] = useState<'logo' | 'favicon' | null>(null);
  const [lastDraftId, setLastDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'success' | 'error' | 'info'>('info');
  const [activeStep, setActiveStep] = useState<SetupStepId>('welcome');

  const validation = useMemo(() => validateBusinessPolicy(policy), [policy]);
  const errors = validation.issues.filter((issue) => issue.severity === 'error');
  const warnings = validation.issues.filter((issue) => issue.severity === 'warning');
  const normalizedTemplate = normalizeHomepageTemplate(policy.branding.homepageTemplate);
  const selectedCopyMap = TEMPLATE_COPY_MAP[normalizedTemplate] ?? TEMPLATE_COPY_MAP.reclaim_editorial;
  const activeStepIndex = SETUP_STEPS.findIndex((step) => step.id === activeStep);
  const activeStepConfig = SETUP_STEPS[activeStepIndex] ?? SETUP_STEPS[0];
  const visibleStepClass = (step: SetupStepId) => activeStep === step ? '' : 'hidden';
  const issueCountForStep = (step: (typeof SETUP_STEPS)[number]) =>
    validation.issues.filter((issue) => step.paths.some((path) => issue.path === path || issue.path.startsWith(`${path}.`))).length;

  const updatePolicy = (updater: (draft: BusinessPolicy) => void) => {
    setPolicy((current) => {
      const next = clonePolicy(current);
      updater(next);
      next.updatedAt = new Date().toISOString();
      return next;
    });
    setLastDraftId(null);
    setMessage(null);
  };

  const updateHomepageCopy = (key: keyof BusinessPolicy['branding']['homepageCopy'], value: string) => {
    updatePolicy((draft) => {
      draft.branding.homepageCopy[key] = value;
    });
  };

  const showMessage = (text: string, tone: 'success' | 'error' | 'info' = 'info') => {
    setMessageTone(tone);
    setMessage(text);

    if (tone === 'success') {
      toast.success(text);
    } else if (tone === 'error') {
      toast.error(text);
    } else {
      toast.info(text);
    }
  };

  const saveDraft = async (options?: { quiet?: boolean }) => {
    setSaving(true);
    setMessage(null);

    try {
      const policyToSave = clonePolicy(policy);
      policyToSave.version = createEditablePolicyVersion();
      policyToSave.updatedAt = new Date().toISOString();

      const response = await fetch('/api/admin/business-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: policyToSave, notes }),
      });
      const result = (await response.json()) as SaveResult;

      if (!response.ok || !result.success || !result.record?.id) {
        showMessage(result.error || 'Draft could not be saved. Check validation errors and migration 0037.', 'error');
        return null;
      }

      setLastDraftId(result.record.id);
      if (result.record.policy) {
        setPolicy(result.record.policy);
      } else {
        setPolicy(policyToSave);
      }
      if (!options?.quiet) {
        showMessage('Draft saved.', 'success');
      }
      return result.record.id;
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Draft save failed.', 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = async () => {
    setPublishing(true);
    setMessage(null);

    try {
      const draftId = lastDraftId ?? (await saveDraft({ quiet: true }));
      if (!draftId) return;

      const response = await fetch('/api/admin/business-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', id: draftId }),
      });
      const result = (await response.json()) as SaveResult;

      if (!response.ok || !result.success) {
        showMessage(result.error || 'Draft could not be published.', 'error');
        return;
      }

      showMessage('Changes published successfully.', 'success');
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Publish failed.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const uploadBrandAsset = async (file: File, target: 'logo' | 'favicon') => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    const allowedNames = /\.(jpe?g|png|webp|svg|ico)$/i;
    if (!allowedTypes.includes(file.type) && !allowedNames.test(file.name)) {
      showMessage('Brand assets must be JPG, PNG, WebP, SVG, or ICO files.', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showMessage('Brand asset uploads must be 2MB or smaller.', 'error');
      return;
    }

    setUploadingBrandAsset(target);
    setMessage(null);

    try {
      const signResponse = await fetch('/api/upload/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'brand-asset',
          entityId: target,
          ...(target === 'logo' && canApplyCloudinaryCompression(file) ? { transformation: 'compressed' } : {}),
        }),
      });

      if (!signResponse.ok) {
        const details = await signResponse.json().catch(() => ({}));
        throw new Error(details.error || 'Could not prepare secure upload. Make sure you are signed in as a system admin.');
      }

      const signData = await signResponse.json();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('signature', signData.signature);
      formData.append('timestamp', signData.timestamp.toString());
      formData.append('folder', signData.folder);
      formData.append('api_key', signData.apiKey);

      if (signData.transformation) {
        formData.append('transformation', signData.transformation);
      }

      const uploadResponse = await fetch(signData.uploadUrl, {
        method: 'POST',
        body: formData,
      });

      const result = await uploadResponse.json() as { secure_url?: string; secureUrl?: string; url?: string; error?: { message?: string } };
      if (!uploadResponse.ok) {
        throw new Error(result.error?.message || 'Brand asset upload failed.');
      }

      const secureUrl = result.secure_url || result.secureUrl || result.url;
      if (!secureUrl) {
        throw new Error('Upload finished without a secure URL.');
      }

      updatePolicy((draft) => {
        if (target === 'logo') {
          draft.branding.logoPath = secureUrl;
        } else {
          draft.branding.faviconPath = secureUrl;
        }
      });
      showMessage(`${target === 'logo' ? 'Logo' : 'Favicon'} uploaded. Save and publish when ready.`, 'success');
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Brand asset upload failed.', 'error');
    } finally {
      setUploadingBrandAsset(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-[#0C0C0B] p-6 text-white sm:p-8">
        <div
          className="absolute inset-y-0 right-0 w-1/2 opacity-25"
          style={{ background: `radial-gradient(circle at top right, ${policy.branding.accentColor}, transparent 55%), linear-gradient(135deg, transparent, ${policy.branding.primaryColor})` }}
        />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: policy.branding.accentColor }}>
              Enterprise setup
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Configure your business rules.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
              Set the brand, vendor journey, auction rules, documents, notifications, and review controls from one guided workspace.
            </p>
          </div>
          <div className="grid min-w-[220px] gap-2 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Validation</span>
              <span className={validation.valid ? 'font-bold text-emerald-200' : 'font-bold text-red-200'}>
                {validation.valid ? 'Ready' : `${errors.length} fix${errors.length === 1 ? '' : 'es'}`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: validation.valid ? '100%' : `${Math.max(12, Math.round(((SETUP_STEPS.length - validation.issues.length) / SETUP_STEPS.length) * 100))}%`,
                  backgroundColor: validation.valid ? '#34D399' : policy.branding.accentColor,
                }}
              />
            </div>
            <p className="text-xs text-white/55">
              Step {activeStepIndex + 1} of {SETUP_STEPS.length}: {activeStepConfig.title}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
      {message ? (
        <div className={`mt-4 rounded-md border p-3 text-sm font-medium ${
          messageTone === 'success'
            ? 'border-green-200 bg-green-50 text-green-800'
            : messageTone === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-gray-200 bg-gray-50 text-gray-700'
        }`}>
          {message}
        </div>
      ) : null}

      <div className="sticky top-0 z-40 mt-5 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-xl shadow-gray-900/10 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-primary)]">
              Setup progress
            </p>
            <p className="text-sm text-gray-600">
              {activeStepConfig.title} is active. Save a draft anytime, or publish when everything is ready.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => saveDraft()}
              disabled={saving || publishing || !validation.valid}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary-surface)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save draft'}
            </button>
            <button
              type="button"
              onClick={publishDraft}
              disabled={saving || publishing || !validation.valid}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--brand-primary-foreground)] transition hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Rocket className="h-4 w-4" />
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white px-4 py-5 shadow-sm">
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max items-start">
          {SETUP_STEPS.map((step, index) => {
            const issueCount = issueCountForStep(step);
            const selected = activeStep === step.id;

            return (
              <div key={step.id} className="flex items-start">
                <button
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className="group flex w-28 flex-col items-center text-center"
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full border text-sm font-bold transition ${
                      selected
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] shadow-md shadow-[var(--brand-shadow-color)]'
                        : 'border-gray-300 bg-white text-gray-500 group-hover:border-[var(--brand-primary)] group-hover:text-[var(--brand-primary)]'
                    }`}
                  >
                    {issueCount ? '!' : index + 1}
                  </span>
                  <span className={`mt-2 text-sm font-bold ${selected ? 'text-[var(--brand-primary)]' : 'text-gray-900'}`}>{step.title}</span>
                  <span className="mt-1 text-[11px] leading-4 text-gray-500">{step.description}</span>
                </button>
                {index < SETUP_STEPS.length - 1 ? (
                  <span className="mt-4 h-px w-10 bg-gray-200" aria-hidden="true" />
                ) : null}
              </div>
            );
          })}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-primary)]">
          Step {activeStepIndex + 1} of {SETUP_STEPS.length}
        </p>
        <h3 className="mt-1 text-lg font-bold text-gray-900">{activeStepConfig.title}</h3>
        <p className="mt-1 text-sm text-gray-600">{activeStepConfig.description}</p>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className={`space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2 ${visibleStepClass('welcome')}`}>
          <div className="max-w-4xl py-4">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--brand-primary)]">
              Guided setup
            </p>
            <h3 className="mt-3 text-3xl font-black tracking-[-0.04em] text-gray-950 sm:text-5xl">
              Shape the platform around your operating model.
            </h3>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
              Configure brand identity, vendor onboarding, auction rules, documents, notifications, asset categories, and review controls in one place.
            </p>
          </div>

          <div className={`rounded-2xl border p-4 text-sm ${validation.valid ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
            <div className="flex items-start gap-2">
              {validation.valid ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
              <div>
                <p className="font-semibold">
                  {validation.valid ? 'Ready to save' : `${errors.length} item${errors.length === 1 ? '' : 's'} need attention`}
                </p>
                {validation.issues.length ? (
                  <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-2">
                    {validation.issues.map((issue) => (
                      <li key={`${issue.path}-${issue.message}`}>
                        <span className="font-semibold">{issue.path}</span>: {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className={`space-y-6 rounded-2xl border border-gray-200 p-5 shadow-sm xl:col-span-2 ${visibleStepClass('brand')}`}>
          <div>
            <h3 className="text-xl font-black tracking-[-0.03em] text-gray-950">Business details</h3>
            <p className="mt-1 text-sm text-gray-600">These details appear on public pages, documents, emails, and support areas.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Brand name">
              <TextInput value={policy.branding.brandName} onChange={(event) => updatePolicy((draft) => { draft.branding.brandName = event.target.value; })} />
            </Field>
            <Field label="Legal name">
              <TextInput value={policy.branding.legalName} onChange={(event) => updatePolicy((draft) => { draft.branding.legalName = event.target.value; })} />
            </Field>
            <Field label="Primary color" description="Hex color, e.g. #800020">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={policy.branding.primaryColor}
                  onChange={(event) => updatePolicy((draft) => { draft.branding.primaryColor = event.target.value; })}
                  className="h-10 w-12 rounded-md border border-gray-300 bg-white p-1"
                  aria-label="Primary color picker"
                />
                <TextInput value={policy.branding.primaryColor} onChange={(event) => updatePolicy((draft) => { draft.branding.primaryColor = event.target.value; })} />
              </div>
              {isVeryLightHex(policy.branding.primaryColor) ? (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-900">
                  This primary color is very light. The app will switch button text to dark automatically, but a stronger brand color is safer for contrast.
                </div>
              ) : null}
            </Field>
            <Field label="Accent color" description="Hex color, e.g. #FFD700">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={policy.branding.accentColor}
                  onChange={(event) => updatePolicy((draft) => { draft.branding.accentColor = event.target.value; })}
                  className="h-10 w-12 rounded-md border border-gray-300 bg-white p-1"
                  aria-label="Accent color picker"
                />
                <TextInput value={policy.branding.accentColor} onChange={(event) => updatePolicy((draft) => { draft.branding.accentColor = event.target.value; })} />
              </div>
            </Field>
            <Field label="Support email">
              <TextInput value={policy.branding.supportEmail} onChange={(event) => updatePolicy((draft) => { draft.branding.supportEmail = event.target.value; })} />
            </Field>
            <Field label="Support phone">
              <TextInput value={policy.branding.supportPhone ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.supportPhone = event.target.value; })} />
            </Field>
            <div className="lg:col-span-2 grid gap-4 xl:grid-cols-2">
              <BrandAssetUploadCard
                target="logo"
                label="Logo"
                description="Used on public pages, emails, documents, and install prompts. Upload JPG, PNG, WebP, or SVG."
                value={policy.branding.logoPath}
                brandName={policy.branding.brandName}
                uploading={uploadingBrandAsset === 'logo'}
                onUpload={(file, target) => void uploadBrandAsset(file, target)}
              />
              <BrandAssetUploadCard
                target="favicon"
                label="Favicon and app icon"
                description="Used for browser tabs and installed app icons. Square PNG, SVG, WebP, or ICO works best."
                value={policy.branding.faviconPath}
                brandName={policy.branding.brandName}
                uploading={uploadingBrandAsset === 'favicon'}
                onUpload={(file, target) => void uploadBrandAsset(file, target)}
              />
            </div>
          </div>
        </div>

        <div className={`space-y-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2 ${visibleStepClass('template')}`}>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-primary)]">Template library</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-gray-950">Choose the public experience</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                Pick the style that best fits the way the business wants to introduce its salvage marketplace before people sign in.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <div className="flex items-center gap-2 font-bold text-gray-950">
                <MonitorSmartphone className="h-4 w-4 text-[var(--brand-primary)]" />
                Active choice
              </div>
              <p className="mt-1">
                {HOMEPAGE_TEMPLATE_OPTIONS.find((template) => template.id === normalizedTemplate)?.name ?? 'Selected template'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {HOMEPAGE_TEMPLATE_OPTIONS.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => updatePolicy((draft) => {
                  draft.branding.homepageTemplate = template.id;
                  if (draft.branding.homepageTheme === 'auto') return;
                  draft.branding.homepageTheme = template.defaultTheme;
                })}
                className={`group rounded-3xl border p-3 text-left transition ${
                  normalizedTemplate === template.id
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-surface)] shadow-md shadow-[var(--brand-shadow-color)]'
                    : 'border-gray-200 bg-white hover:border-[var(--brand-primary-border)] hover:shadow-sm'
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-gray-950">{template.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    template.defaultTheme === 'night' ? 'bg-slate-900 text-white' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {template.defaultTheme}
                  </span>
                </span>
                <TemplateMiniPreview
                  templateId={template.id}
                  primaryColor={policy.branding.primaryColor}
                  accentColor={policy.branding.accentColor}
                  brandName={policy.branding.brandName}
                  heroTitle={policy.branding.homepageCopy.heroTitle}
                  selected={normalizedTemplate === template.id}
                />
              </button>
            ))}
          </div>

          <div className="grid gap-4 rounded-3xl border border-gray-200 bg-gray-50 p-4 lg:grid-cols-4">
            <Field label="Homepage mode" description="Choose what visitors see first.">
              <SelectInput
                value={policy.branding.homepageMode}
                onChange={(event) => updatePolicy((draft) => { draft.branding.homepageMode = event.target.value as BusinessPolicy['branding']['homepageMode']; })}
              >
                <option value="landing">Show homepage</option>
                <option value="login_first">Go straight to sign in</option>
              </SelectInput>
            </Field>
            <Field label="Theme" description="Light, dark, or template default.">
              <SelectInput
                value={policy.branding.homepageTheme}
                onChange={(event) => updatePolicy((draft) => { draft.branding.homepageTheme = event.target.value as BusinessPolicy['branding']['homepageTheme']; })}
              >
                <option value="auto">Template default</option>
                <option value="day">Light</option>
                <option value="night">Dark</option>
              </SelectInput>
            </Field>
            <div className="lg:col-span-2">
              <Toggle
                checked={policy.branding.splashEnabled}
                onChange={(checked) => updatePolicy((draft) => { draft.branding.splashEnabled = checked; })}
                label="Show opening splash screen"
              />
              <p className="mt-2 text-xs leading-5 text-gray-500">
                Adds a short branded opening moment on the public homepage.
              </p>
            </div>
          </div>

        </div>

        <div className={`rounded-3xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2 ${visibleStepClass('content')}`}>
          <TemplateContentStep
            policy={policy}
            selectedCopyMap={selectedCopyMap}
            updateHomepageCopy={updateHomepageCopy}
            updatePolicy={updatePolicy}
          />
          {false ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-primary)]">Page copy</p>
                <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-gray-950">Write the homepage in sections</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                  Keep the main promise short, then use support text, trust lines, and stats to explain the recovery experience.
                </p>
              </div>

              <section className="rounded-2xl border border-[var(--brand-primary-border)] bg-[var(--brand-primary-surface)] p-4">
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">Where this copy appears</h4>
                <div className="mt-4 grid gap-3">
                  {selectedCopyMap.map((item) => (
                    <div key={item.label} className="rounded-2xl bg-white/80 p-4 shadow-sm">
                      <p className="text-sm font-black text-gray-950">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-600">{item.appears}</p>
                      <p className="mt-2 text-xs font-semibold text-[var(--brand-primary)]">{item.fields}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gray-500">Hero section</h4>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <Field label="Small label above headline">
                    <TextInput value={policy.branding.homepageCopy.eyebrow ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.eyebrow = event.target.value; })} />
                  </Field>
                  <Field label="Hero title" description="Best at 6 to 12 words.">
                    <TextInput value={policy.branding.homepageCopy.heroTitle} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.heroTitle = event.target.value; })} />
                  </Field>
                  <Field label="Hero subtitle">
                    <TextArea value={policy.branding.homepageCopy.heroSubtitle} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.heroSubtitle = event.target.value; })} />
                  </Field>
                  <Field label="Supporting line">
                    <TextArea value={policy.branding.homepageCopy.supportingText} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.supportingText = event.target.value; })} />
                  </Field>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 p-4">
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gray-500">Buttons and trust line</h4>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <Field label="Main button">
                    <TextInput value={policy.branding.homepageCopy.primaryCtaLabel} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.primaryCtaLabel = event.target.value; })} />
                  </Field>
                  <Field label="Secondary button">
                    <TextInput value={policy.branding.homepageCopy.secondaryCtaLabel ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.secondaryCtaLabel = event.target.value; })} />
                  </Field>
                  <Field label="Footer trust line">
                    <TextInput value={policy.branding.homepageCopy.trustLine ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.trustLine = event.target.value; })} />
                  </Field>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 p-4">
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gray-500">Template sections</h4>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <Field label="Workflow section title">
                    <TextInput value={policy.branding.homepageCopy.workflowTitle ?? ''} onChange={(event) => updateHomepageCopy('workflowTitle', event.target.value)} />
                  </Field>
                  <Field label="Workflow section subtitle">
                    <TextInput value={policy.branding.homepageCopy.workflowSubtitle ?? ''} onChange={(event) => updateHomepageCopy('workflowSubtitle', event.target.value)} />
                  </Field>
                  <Field label="Auction section label">
                    <TextInput value={policy.branding.homepageCopy.auctionSectionEyebrow ?? ''} onChange={(event) => updateHomepageCopy('auctionSectionEyebrow', event.target.value)} />
                  </Field>
                  <Field label="Auction section title">
                    <TextInput value={policy.branding.homepageCopy.auctionSectionTitle ?? ''} onChange={(event) => updateHomepageCopy('auctionSectionTitle', event.target.value)} />
                  </Field>
                  <Field label="Auction section button">
                    <TextInput value={policy.branding.homepageCopy.auctionSectionButtonLabel ?? ''} onChange={(event) => updateHomepageCopy('auctionSectionButtonLabel', event.target.value)} />
                  </Field>
                  <Field label="Middle section label">
                    <TextInput value={policy.branding.homepageCopy.operationsSectionEyebrow ?? ''} onChange={(event) => updateHomepageCopy('operationsSectionEyebrow', event.target.value)} />
                  </Field>
                  <Field label="Middle section headline">
                    <TextInput value={policy.branding.homepageCopy.operationsSectionTitle ?? ''} onChange={(event) => updateHomepageCopy('operationsSectionTitle', event.target.value)} />
                  </Field>
                  <Field label="Middle section text">
                    <TextArea value={policy.branding.homepageCopy.operationsSectionSubtitle ?? ''} onChange={(event) => updateHomepageCopy('operationsSectionSubtitle', event.target.value)} />
                  </Field>
                  <Field label="Proof section headline">
                    <TextInput value={policy.branding.homepageCopy.proofSectionTitle ?? ''} onChange={(event) => updateHomepageCopy('proofSectionTitle', event.target.value)} />
                  </Field>
                  <Field label="Proof section text">
                    <TextArea value={policy.branding.homepageCopy.proofSectionSubtitle ?? ''} onChange={(event) => updateHomepageCopy('proofSectionSubtitle', event.target.value)} />
                  </Field>
                  <Field label="Recovery brief headline">
                    <TextInput value={policy.branding.homepageCopy.recoveryBriefTitle ?? ''} onChange={(event) => updateHomepageCopy('recoveryBriefTitle', event.target.value)} />
                  </Field>
                  <Field label="Recovery brief text">
                    <TextArea value={policy.branding.homepageCopy.recoveryBriefBody ?? ''} onChange={(event) => updateHomepageCopy('recoveryBriefBody', event.target.value)} />
                  </Field>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gray-500">Workflow cards</h4>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {[
                    ['Step one', 'workflowStepOneTitle', 'workflowStepOneBody'],
                    ['Step two', 'workflowStepTwoTitle', 'workflowStepTwoBody'],
                    ['Step three', 'workflowStepThreeTitle', 'workflowStepThreeBody'],
                    ['Step four', 'workflowStepFourTitle', 'workflowStepFourBody'],
                  ].map(([label, titleKey, bodyKey]) => (
                    <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4">
                      <p className="text-sm font-bold text-gray-950">{label}</p>
                      <div className="mt-3 grid gap-3">
                        <TextInput
                          value={policy.branding.homepageCopy[titleKey as keyof BusinessPolicy['branding']['homepageCopy']] ?? ''}
                          onChange={(event) => updateHomepageCopy(titleKey as keyof BusinessPolicy['branding']['homepageCopy'], event.target.value)}
                          placeholder="Title"
                        />
                        <TextArea
                          value={policy.branding.homepageCopy[bodyKey as keyof BusinessPolicy['branding']['homepageCopy']] ?? ''}
                          onChange={(event) => updateHomepageCopy(bodyKey as keyof BusinessPolicy['branding']['homepageCopy'], event.target.value)}
                          placeholder="Short description"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 p-4">
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gray-500">Feature cards</h4>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  {[
                    ['Card one', 'operationsCardOneTitle', 'operationsCardOneBody'],
                    ['Card two', 'operationsCardTwoTitle', 'operationsCardTwoBody'],
                    ['Card three', 'operationsCardThreeTitle', 'operationsCardThreeBody'],
                  ].map(([label, titleKey, bodyKey]) => (
                    <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4">
                      <p className="text-sm font-bold text-gray-950">{label}</p>
                      <div className="mt-3 grid gap-3">
                        <TextInput
                          value={policy.branding.homepageCopy[titleKey as keyof BusinessPolicy['branding']['homepageCopy']] ?? ''}
                          onChange={(event) => updateHomepageCopy(titleKey as keyof BusinessPolicy['branding']['homepageCopy'], event.target.value)}
                          placeholder="Title"
                        />
                        <TextArea
                          value={policy.branding.homepageCopy[bodyKey as keyof BusinessPolicy['branding']['homepageCopy']] ?? ''}
                          onChange={(event) => updateHomepageCopy(bodyKey as keyof BusinessPolicy['branding']['homepageCopy'], event.target.value)}
                          placeholder="Short description"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gray-500">Assurance cards</h4>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {[
                    ['Assurance one', 'proofCardOneTitle', 'proofCardOneBody'],
                    ['Assurance two', 'proofCardTwoTitle', 'proofCardTwoBody'],
                    ['Assurance three', 'proofCardThreeTitle', 'proofCardThreeBody'],
                    ['Assurance four', 'proofCardFourTitle', 'proofCardFourBody'],
                  ].map(([label, titleKey, bodyKey]) => (
                    <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4">
                      <p className="text-sm font-bold text-gray-950">{label}</p>
                      <div className="mt-3 grid gap-3">
                        <TextInput
                          value={policy.branding.homepageCopy[titleKey as keyof BusinessPolicy['branding']['homepageCopy']] ?? ''}
                          onChange={(event) => updateHomepageCopy(titleKey as keyof BusinessPolicy['branding']['homepageCopy'], event.target.value)}
                          placeholder="Title"
                        />
                        <TextArea
                          value={policy.branding.homepageCopy[bodyKey as keyof BusinessPolicy['branding']['homepageCopy']] ?? ''}
                          onChange={(event) => updateHomepageCopy(bodyKey as keyof BusinessPolicy['branding']['homepageCopy'], event.target.value)}
                          placeholder="Short description"
                        />
                      </div>
                    </div>
                  ))}
                  <Field label="Contact card label">
                    <TextInput value={policy.branding.homepageCopy.proofContactLabel ?? ''} onChange={(event) => updateHomepageCopy('proofContactLabel', event.target.value)} />
                  </Field>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 p-4">
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gray-500">Contact section</h4>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <Field label="Contact headline">
                    <TextInput value={policy.branding.homepageCopy.contactHeadline ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.contactHeadline = event.target.value; })} />
                  </Field>
                  <Field label="Contact subtitle">
                    <TextInput value={policy.branding.homepageCopy.contactSubtitle ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.contactSubtitle = event.target.value; })} />
                  </Field>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 p-4">
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gray-500">Sign-in page copy</h4>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <Field label="Sign-in headline">
                    <TextInput value={policy.branding.homepageCopy.authHeadline ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.authHeadline = event.target.value; })} />
                  </Field>
                  <Field label="Sign-in subtitle">
                    <TextInput value={policy.branding.homepageCopy.authSubtitle ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.authSubtitle = event.target.value; })} />
                  </Field>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 p-4">
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gray-500">Homepage stats</h4>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <Field label="Stat one">
                    <div className="grid gap-2">
                      <TextInput value={policy.branding.homepageCopy.statOneValue ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.statOneValue = event.target.value; })} placeholder="94%" />
                      <TextInput value={policy.branding.homepageCopy.statOneLabel ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.statOneLabel = event.target.value; })} placeholder="Average recovery rate" />
                    </div>
                  </Field>
                  <Field label="Stat two">
                    <div className="grid gap-2">
                      <TextInput value={policy.branding.homepageCopy.statTwoValue ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.statTwoValue = event.target.value; })} placeholder="48hrs" />
                      <TextInput value={policy.branding.homepageCopy.statTwoLabel ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.statTwoLabel = event.target.value; })} placeholder="Average time to sale" />
                    </div>
                  </Field>
                  <Field label="Stat three">
                    <div className="grid gap-2">
                      <TextInput value={policy.branding.homepageCopy.statThreeValue ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.statThreeValue = event.target.value; })} placeholder="3,200+" />
                      <TextInput value={policy.branding.homepageCopy.statThreeLabel ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.statThreeLabel = event.target.value; })} placeholder="Verified buyers" />
                    </div>
                  </Field>
                </div>
              </section>
            </div>

            <aside className="xl:sticky xl:top-24 xl:self-start">
              <div className="overflow-hidden rounded-3xl border border-gray-200 bg-gray-950 text-white shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-300" />
                    <span className="h-3 w-3 rounded-full bg-green-400" />
                  </div>
                  <span className="text-xs font-semibold text-white/50">Live content preview</span>
                </div>
                <div className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: policy.branding.accentColor }}>
                    {policy.branding.homepageCopy.eyebrow || 'Homepage label'}
                  </p>
                  <h4 className="mt-4 text-3xl font-black leading-none tracking-[-0.06em]">
                    {policy.branding.homepageCopy.heroTitle || 'Homepage headline'}
                  </h4>
                  <p className="mt-4 text-sm leading-6 text-white/65">
                    {policy.branding.homepageCopy.heroSubtitle || 'Short introduction shown on the homepage.'}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full px-4 py-2 text-sm font-bold"
                      style={{ backgroundColor: policy.branding.accentColor, color: getReadableTextColor(policy.branding.accentColor) }}
                    >
                      {policy.branding.homepageCopy.primaryCtaLabel || 'Primary button'}
                    </button>
                    <button type="button" className="rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white">
                      {policy.branding.homepageCopy.secondaryCtaLabel || 'Secondary button'}
                    </button>
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {[
                      [policy.branding.homepageCopy.statOneValue, policy.branding.homepageCopy.statOneLabel],
                      [policy.branding.homepageCopy.statTwoValue, policy.branding.homepageCopy.statTwoLabel],
                      [policy.branding.homepageCopy.statThreeValue, policy.branding.homepageCopy.statThreeLabel],
                    ].map(([value, label], index) => (
                      <div key={index} className="rounded-2xl bg-white/10 p-3">
                        <p className="text-lg font-black">{value || '--'}</p>
                        <p className="mt-1 text-[10px] leading-4 text-white/55">{label || 'Stat label'}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl bg-white/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Trust line</p>
                    <p className="mt-2 text-sm leading-6 text-white/75">{policy.branding.homepageCopy.trustLine || 'Short reassurance appears here.'}</p>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <div className="rounded-2xl bg-white/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Workflow</p>
                      <p className="mt-2 text-sm font-bold">{policy.branding.homepageCopy.workflowTitle || 'Workflow section title'}</p>
                      <p className="mt-1 text-xs leading-5 text-white/55">{policy.branding.homepageCopy.workflowSubtitle || 'Workflow section subtitle'}</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Contact</p>
                      <p className="mt-2 text-sm font-bold">{policy.branding.homepageCopy.contactHeadline || 'Contact headline'}</p>
                      <p className="mt-1 text-xs leading-5 text-white/55">{policy.branding.homepageCopy.contactSubtitle || 'Contact subtitle'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
          ) : null}
        </div>

        <div className={`space-y-4 rounded-lg border border-gray-200 p-4 ${visibleStepClass('onboarding')}`}>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--brand-primary-surface)] text-[var(--brand-primary)]">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Access And MFA</h3>
              <p className="mt-1 text-sm text-gray-600">
                Control how people sign in and when multi-factor verification becomes mandatory.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle checked={policy.auth.emailPasswordEnabled} onChange={(checked) => updatePolicy((draft) => { draft.auth.emailPasswordEnabled = checked; })} label="Email/password login" />
            <Toggle checked={policy.auth.businessEmailOnly} onChange={(checked) => updatePolicy((draft) => { draft.auth.businessEmailOnly = checked; })} label="Business email only" />
            <Toggle checked={policy.auth.googleOAuthEnabled} onChange={(checked) => updatePolicy((draft) => { draft.auth.googleOAuthEnabled = checked; })} label="Google login enabled" />
            <Toggle checked={policy.auth.staffMfaRequired} onChange={(checked) => updatePolicy((draft) => { draft.auth.staffMfaRequired = checked; })} label="Staff MFA required" />
            <Toggle checked={policy.auth.vendorMfaRequired} onChange={(checked) => updatePolicy((draft) => { draft.auth.vendorMfaRequired = checked; })} label="Vendor MFA required" />
            <Toggle checked={policy.auth.userManagedMfaAllowed} onChange={(checked) => updatePolicy((draft) => { draft.auth.userManagedMfaAllowed = checked; })} label="Users can manage MFA" />
          </div>
          <Field label="Allowed email domains" description="Comma-separated domains allowed even when business-email-only is enabled. Leave empty to allow any non-personal business domain.">
            <TextInput
              value={policy.auth.allowedEmailDomains.join(', ')}
              onChange={(event) => updatePolicy((draft) => {
                draft.auth.allowedEmailDomains = event.target.value
                  .split(',')
                  .map((domain) => domain.trim().toLowerCase())
                  .filter(Boolean);
              })}
              placeholder="nem-insurance.com, partner.example"
            />
          </Field>
          <SafetyNote title="MFA safety check" tone="warn">
            If staff or vendor MFA is required, user-managed MFA must stay enabled so accounts have a path to configure their second factor.
          </SafetyNote>
        </div>

        <div className={`space-y-4 rounded-lg border border-gray-200 p-4 ${visibleStepClass('onboarding')}`}>
          <h3 className="font-bold text-gray-900">Vendor Onboarding</h3>
          <div className="grid gap-3">
            {ONBOARDING_PRESETS.map((preset) => (
              <button
                key={preset.mode}
                type="button"
                onClick={() => updatePolicy((draft) => applyOnboardingPreset(draft, preset.mode))}
                className={`rounded-md border p-3 text-left transition ${
                  policy.onboarding.mode === preset.mode
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-surface)]'
                    : 'border-gray-200 bg-white hover:border-[var(--brand-primary-border)] hover:bg-gray-50'
                }`}
              >
                <span className="block text-sm font-semibold text-gray-900">{preset.title}</span>
                <span className="mt-1 block text-xs text-gray-600">{preset.description}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Journey mode">
              <SelectInput
                value={policy.onboarding.mode}
                onChange={(event) => updatePolicy((draft) => applyOnboardingPreset(draft, event.target.value as BusinessPolicy['onboarding']['mode']))}
              >
                {ONBOARDING_PRESETS.map((preset) => (
                  <option key={preset.mode} value={preset.mode}>{preset.title}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Tier 1 bid limit">
              <TextInput type="number" value={policy.onboarding.tier1BidLimit} onChange={(event) => updatePolicy((draft) => { draft.onboarding.tier1BidLimit = numberValue(event.target.value, draft.onboarding.tier1BidLimit); })} />
            </Field>
            <Field label="Registration fee amount">
              <TextInput type="number" value={policy.onboarding.registrationFeeAmount} onChange={(event) => updatePolicy((draft) => { draft.onboarding.registrationFeeAmount = numberValue(event.target.value, draft.onboarding.registrationFeeAmount); })} />
            </Field>
            <Field label="Fee due days">
              <TextInput type="number" value={policy.onboarding.registrationFeeDueDays} onChange={(event) => updatePolicy((draft) => { draft.onboarding.registrationFeeDueDays = numberValue(event.target.value, draft.onboarding.registrationFeeDueDays); })} />
            </Field>
            <Toggle checked={policy.onboarding.registrationFeeRequired} onChange={(checked) => updatePolicy((draft) => { draft.onboarding.registrationFeeRequired = checked; })} label="Registration fee required" />
            <Toggle checked={policy.onboarding.allowBidAfterTier1} onChange={(checked) => updatePolicy((draft) => { draft.onboarding.allowBidAfterTier1 = checked; })} label="Allow Tier 1 bidding" />
            <Toggle checked={policy.onboarding.requireTier2ForUnlimitedBidding} onChange={(checked) => updatePolicy((draft) => { draft.onboarding.requireTier2ForUnlimitedBidding = checked; })} label="Full verification unlocks higher bidding" />
            <Toggle checked={policy.onboarding.allowBrowseBeforeKyc} onChange={(checked) => updatePolicy((draft) => { draft.onboarding.allowBrowseBeforeKyc = checked; })} label="Allow browsing before KYC" />
          </div>
        </div>

        <div className={`space-y-4 rounded-lg border border-gray-200 p-4 ${visibleStepClass('operations')}`}>
          <h3 className="font-bold text-gray-900">Deposits And Auction Rules</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Deposit rate (%)">
              <TextInput type="number" value={policy.escrow.depositRatePercent} onChange={(event) => updatePolicy((draft) => { draft.escrow.depositRatePercent = numberValue(event.target.value, draft.escrow.depositRatePercent); })} />
            </Field>
            <Field label="Deposit floor">
              <TextInput type="number" value={policy.escrow.minimumDepositFloor} onChange={(event) => updatePolicy((draft) => { draft.escrow.minimumDepositFloor = numberValue(event.target.value, draft.escrow.minimumDepositFloor); })} />
            </Field>
            <Field label="Minimum bid increment">
              <TextInput type="number" value={policy.auctions.minimumBidIncrement} onChange={(event) => updatePolicy((draft) => { draft.auctions.minimumBidIncrement = numberValue(event.target.value, draft.auctions.minimumBidIncrement); })} />
            </Field>
            <Field label="Reserve percentage">
              <TextInput type="number" value={policy.auctions.reserveValuePercentage} onChange={(event) => updatePolicy((draft) => { draft.auctions.reserveValuePercentage = numberValue(event.target.value, draft.auctions.reserveValuePercentage); })} />
            </Field>
            <Field label="Document validity hours">
              <TextInput type="number" value={policy.auctions.documentValidityHours} onChange={(event) => updatePolicy((draft) => { draft.auctions.documentValidityHours = numberValue(event.target.value, draft.auctions.documentValidityHours); })} />
            </Field>
            <Field label="Payment deadline hours">
              <TextInput type="number" value={policy.payments.paymentDeadlineAfterSigningHours} onChange={(event) => updatePolicy((draft) => { draft.payments.paymentDeadlineAfterSigningHours = numberValue(event.target.value, draft.payments.paymentDeadlineAfterSigningHours); })} />
            </Field>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-900">Auction payment methods</h4>
            <p className="mt-1 text-xs text-gray-600">
              Choose which payment choices vendors can use after they win and sign documents.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Toggle
                checked={policy.payments.paystackEnabled && policy.payments.auctionPaymentProvider === 'paystack'}
                onChange={(checked) => updatePolicy((draft) => {
                  draft.payments.paystackEnabled = checked;
                  if (checked) draft.payments.auctionPaymentProvider = 'paystack';
                  if (!checked) draft.payments.hybridPaymentEnabled = false;
                })}
                label="Online checkout"
              />
              <Toggle
                checked={policy.payments.walletEnabled}
                onChange={(checked) => updatePolicy((draft) => {
                  draft.payments.walletEnabled = checked;
                  if (!checked) draft.payments.hybridPaymentEnabled = false;
                })}
                label="Wallet payment"
              />
              <Toggle
                checked={policy.payments.hybridPaymentEnabled && policy.payments.walletEnabled && policy.payments.paystackEnabled}
                onChange={(checked) => updatePolicy((draft) => {
                  draft.payments.hybridPaymentEnabled = checked;
                  if (checked) {
                    draft.payments.walletEnabled = true;
                    draft.payments.paystackEnabled = true;
                    draft.payments.auctionPaymentProvider = 'paystack';
                  }
                })}
                label="Wallet + online"
              />
            </div>
          </div>
        </div>

        <div className={`space-y-4 rounded-lg border border-gray-200 p-4 xl:col-span-2 ${visibleStepClass('workflow')}`}>
          <h3 className="font-bold text-gray-900">Enabled Asset Types</h3>
          <p className="text-sm text-gray-600">
            Choose the asset categories that should appear when a new case is created.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {Object.entries(policy.cases.enabledAssetTypes).map(([assetType, config]) => (
              <div key={assetType} className="rounded-lg border border-gray-200 p-4">
                <Toggle
                  checked={config.enabled}
                  onChange={(checked) => updatePolicy((draft) => {
                    draft.cases.enabledAssetTypes[assetType] = {
                      ...draft.cases.enabledAssetTypes[assetType],
                      enabled: checked,
                    };
                  })}
                  label={config.label || assetType}
                />
                <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  Uses <span className="font-semibold text-gray-800">{config.promptProfile.replace('_', ' ')}</span> analysis after: {config.requiredFields.length > 0 ? config.requiredFields.join(', ') : 'no field gate configured'}
                </div>
                <details className="mt-3 rounded-md border border-dashed border-gray-300 bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-gray-700">
                  Category details
                  </summary>
                  <div className="grid gap-3 border-t border-gray-100 p-3 sm:grid-cols-2">
                    <Field label="Display label">
                      <TextInput value={config.label} onChange={(event) => updatePolicy((draft) => { draft.cases.enabledAssetTypes[assetType].label = event.target.value; })} />
                    </Field>
                    <Field label="AI prompt profile">
                      <SelectInput
                        value={config.promptProfile}
                        onChange={(event) => updatePolicy((draft) => { draft.cases.enabledAssetTypes[assetType].promptProfile = event.target.value as BusinessPolicy['cases']['enabledAssetTypes'][string]['promptProfile']; })}
                      >
                        <option value="vehicle">Vehicle</option>
                        <option value="electronics">Electronics</option>
                        <option value="property">Property</option>
                        <option value="jewelry">Jewelry</option>
                        <option value="machinery">Machinery</option>
                        <option value="general_asset">General asset</option>
                      </SelectInput>
                    </Field>
                    <Field label="Required fields" description="Comma-separated fields that must be captured for this asset type.">
                      <TextInput
                        value={config.requiredFields.join(', ')}
                        onChange={(event) => updatePolicy((draft) => {
                          draft.cases.enabledAssetTypes[assetType].requiredFields = event.target.value
                            .split(',')
                            .map((field) => field.trim())
                            .filter(Boolean);
                        })}
                      />
                    </Field>
                    <div className="grid gap-2">
                      <Toggle checked={config.requiresAiAnalysis} onChange={(checked) => updatePolicy((draft) => { draft.cases.enabledAssetTypes[assetType].requiresAiAnalysis = checked; })} label="AI analysis" />
                      <Toggle checked={config.requiresMarketValue} onChange={(checked) => updatePolicy((draft) => { draft.cases.enabledAssetTypes[assetType].requiresMarketValue = checked; })} label="Market value" />
                      <Toggle checked={config.requiresInspectionLocation} onChange={(checked) => updatePolicy((draft) => { draft.cases.enabledAssetTypes[assetType].requiresInspectionLocation = checked; })} label="Inspection location" />
                    </div>
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>

        <div className={`space-y-4 rounded-lg border border-gray-200 p-4 ${visibleStepClass('workflow')}`}>
          <h3 className="font-bold text-gray-900">Case Workflow</h3>
          <p className="text-sm text-gray-600">
            Controls how case notes and voice transcripts move from claims adjusters to salvage managers.
          </p>
          <div className="grid gap-3">
            <Toggle checked={policy.cases.voiceNotesEnabled} onChange={(checked) => updatePolicy((draft) => { draft.cases.voiceNotesEnabled = checked; })} label="Voice notes enabled" />
            <Toggle checked={policy.cases.claimsAdjusterTranscriptEditable} onChange={(checked) => updatePolicy((draft) => { draft.cases.claimsAdjusterTranscriptEditable = checked; })} label="Adjuster can edit transcript" />
            <Toggle checked={policy.cases.salvageManagerTranscriptReviewRequired} onChange={(checked) => updatePolicy((draft) => { draft.cases.salvageManagerTranscriptReviewRequired = checked; })} label="Manager reviews transcript before auction" />
          </div>
        </div>

        <div className={`space-y-4 rounded-lg border border-gray-200 p-4 ${visibleStepClass('workflow')}`}>
          <h3 className="font-bold text-gray-900">Notifications</h3>
          <p className="text-sm text-gray-600">
            Keep SMS for important events and use email or push for lower-cost operational updates.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Toggle checked={policy.notifications.emailEnabled} onChange={(checked) => updatePolicy((draft) => { draft.notifications.emailEnabled = checked; })} label="Email" />
            <Toggle checked={policy.notifications.smsEnabled} onChange={(checked) => updatePolicy((draft) => { draft.notifications.smsEnabled = checked; })} label="SMS" />
            <Toggle checked={policy.notifications.pushEnabled} onChange={(checked) => updatePolicy((draft) => { draft.notifications.pushEnabled = checked; })} label="Push" />
          </div>
          <Field label="SMS categories" description="Comma-separated categories allowed to spend SMS credits.">
            <TextInput
              value={policy.notifications.smsCategories.join(', ')}
              onChange={(event) => updatePolicy((draft) => {
                draft.notifications.smsCategories = event.target.value
                  .split(',')
                  .map((category) => category.trim())
                  .filter(Boolean);
              })}
            />
          </Field>
          <Toggle checked={policy.notifications.roleFanoutShouldBeQueued} onChange={(checked) => updatePolicy((draft) => { draft.notifications.roleFanoutShouldBeQueued = checked; })} label="Queue role fanout notifications" />
        </div>

        <div className={`space-y-4 rounded-lg border border-gray-200 p-4 ${visibleStepClass('documents')}`}>
          <h3 className="font-bold text-gray-900">Documents And Reports</h3>
          <div className="grid gap-3">
            <Toggle checked={policy.documents.useBrandLetterhead} onChange={(checked) => updatePolicy((draft) => { draft.documents.useBrandLetterhead = checked; })} label="Use brand letterhead" />
            <Toggle checked={policy.documents.attachPaymentReceiptToAuctionDocuments} onChange={(checked) => updatePolicy((draft) => { draft.documents.attachPaymentReceiptToAuctionDocuments = checked; })} label="Attach payment receipts to auction documents" />
            <Toggle checked={policy.reports.excludeMarkedTestDataByDefault} onChange={(checked) => updatePolicy((draft) => { draft.reports.excludeMarkedTestDataByDefault = checked; })} label="Exclude marked test data by default" />
            <Toggle checked={policy.reports.requireConsistentMetricDefinitions} onChange={(checked) => updatePolicy((draft) => { draft.reports.requireConsistentMetricDefinitions = checked; })} label="Require consistent report metric definitions" />
          </div>
          <Field label="Default report date range">
            <SelectInput
              value={policy.reports.defaultDateRange}
              onChange={(event) => updatePolicy((draft) => { draft.reports.defaultDateRange = event.target.value as BusinessPolicy['reports']['defaultDateRange']; })}
            >
              <option value="all_time">All time</option>
              <option value="last_30_days">Last 30 days</option>
              <option value="last_90_days">Last 90 days</option>
            </SelectInput>
          </Field>
          <Field label="Bill of Sale disclaimer title">
            <TextInput
              value={policy.documents.billOfSaleDisclaimerTitle}
              onChange={(event) => updatePolicy((draft) => { draft.documents.billOfSaleDisclaimerTitle = event.target.value; })}
            />
          </Field>
          <Field label="Bill of Sale disclaimer body" description="Plain text only. This is shown inside the generated Bill of Sale PDF.">
            <textarea
              value={policy.documents.billOfSaleDisclaimerBody}
              onChange={(event) => updatePolicy((draft) => { draft.documents.billOfSaleDisclaimerBody = event.target.value; })}
              rows={4}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
            />
          </Field>
        </div>

        <div className={`space-y-4 rounded-lg border border-gray-200 p-4 ${visibleStepClass('documents')}`}>
          <h3 className="font-bold text-gray-900">Legal Pages</h3>
          <p className="text-sm text-gray-600">
            Used on privacy, cookie, terms, and data protection pages.
          </p>
          <div className="grid gap-3">
            <Field label="Registration number">
              <TextInput
                value={policy.legal.registrationNumber}
                onChange={(event) => updatePolicy((draft) => { draft.legal.registrationNumber = event.target.value; })}
              />
            </Field>
            <Field label="Address line 1">
              <TextInput
                value={policy.legal.addressLine1}
                onChange={(event) => updatePolicy((draft) => { draft.legal.addressLine1 = event.target.value; })}
              />
            </Field>
            <Field label="Address line 2">
              <TextInput
                value={policy.legal.addressLine2}
                onChange={(event) => updatePolicy((draft) => { draft.legal.addressLine2 = event.target.value; })}
              />
            </Field>
            <Field label="Privacy email">
              <TextInput
                type="email"
                value={policy.legal.privacyEmail}
                onChange={(event) => updatePolicy((draft) => { draft.legal.privacyEmail = event.target.value; })}
              />
            </Field>
            <Field label="Data Protection Officer email">
              <TextInput
                type="email"
                value={policy.legal.dpoEmail}
                onChange={(event) => updatePolicy((draft) => { draft.legal.dpoEmail = event.target.value; })}
              />
            </Field>
            <Field label="Legal email">
              <TextInput
                type="email"
                value={policy.legal.legalEmail}
                onChange={(event) => updatePolicy((draft) => { draft.legal.legalEmail = event.target.value; })}
              />
            </Field>
            <Field label="Legal page last-updated label">
              <TextInput
                value={policy.legal.legalLastUpdated}
                onChange={(event) => updatePolicy((draft) => { draft.legal.legalLastUpdated = event.target.value; })}
              />
            </Field>
          </div>
        </div>

        <div className={`space-y-4 rounded-lg border border-gray-200 p-4 xl:col-span-2 ${visibleStepClass('documents')}`}>
          <div>
            <h3 className="font-bold text-gray-900">Liability Waiver Clauses</h3>
            <p className="mt-1 text-sm text-gray-600">
              Configure the legal/commercial wording used in the generated liability waiver. Keep this plain-text and have legal counsel review changes before publishing.
            </p>
          </div>
          <div className="space-y-3">
            {policy.documents.liabilityWaiverClauses.map((clause, index) => (
              <div key={`${index}-${clause.title}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                  <Field label={`Clause ${index + 1} title`}>
                    <TextInput
                      value={clause.title}
                      onChange={(event) => updatePolicy((draft) => { draft.documents.liabilityWaiverClauses[index].title = event.target.value; })}
                    />
                  </Field>
                  <button
                    type="button"
                    disabled={policy.documents.liabilityWaiverClauses.length <= 1}
                    onClick={() => updatePolicy((draft) => { draft.documents.liabilityWaiverClauses.splice(index, 1); })}
                    className="mt-7 rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
                <Field label="Clause body">
                  <textarea
                    value={clause.body}
                    onChange={(event) => updatePolicy((draft) => { draft.documents.liabilityWaiverClauses[index].body = event.target.value; })}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
                  />
                </Field>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => updatePolicy((draft) => {
              draft.documents.liabilityWaiverClauses.push({
                title: 'New clause',
                body: 'Add clause text here.',
              });
            })}
            className="rounded-md border border-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary-surface)]"
          >
            Add clause
          </button>
        </div>

        <div className={`space-y-4 rounded-lg border border-gray-200 p-4 ${visibleStepClass('review')}`}>
          <h3 className="font-bold text-gray-900">Fraud Controls</h3>
          <p className="text-sm text-gray-600">
            Choose which risk signals should require closer review.
          </p>
          <div className="grid gap-3">
            <Toggle checked={policy.fraud.dojahRiskAlertsEnabled} onChange={(checked) => updatePolicy((draft) => { draft.fraud.dojahRiskAlertsEnabled = checked; })} label="Dojah risk alerts" />
            <Toggle checked={policy.fraud.ipFraudDetectionEnabled} onChange={(checked) => updatePolicy((draft) => { draft.fraud.ipFraudDetectionEnabled = checked; })} label="IP/device fraud detection" />
            <Toggle checked={policy.fraud.biddingFraudDetectionEnabled} onChange={(checked) => updatePolicy((draft) => { draft.fraud.biddingFraudDetectionEnabled = checked; })} label="Bidding fraud detection" />
            <Toggle checked={policy.fraud.highRiskRequiresManualReview} onChange={(checked) => updatePolicy((draft) => { draft.fraud.highRiskRequiresManualReview = checked; })} label="High risk requires manual review" />
          </div>
        </div>

        <div className={`space-y-2 rounded-lg border border-gray-200 p-4 xl:col-span-2 ${visibleStepClass('review')}`}>
          <Field label="Draft notes" description="Briefly describe why these changes are being made.">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
              placeholder="Example: Enable machinery assets and update the homepage for the next update."
            />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={activeStepIndex <= 0}
          onClick={() => setActiveStep(SETUP_STEPS[Math.max(0, activeStepIndex - 1)].id)}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <div className="text-center text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{activeStepConfig.title}</span>
          {issueCountForStep(activeStepConfig) ? ` has ${issueCountForStep(activeStepConfig)} validation item(s).` : ' has no validation items.'}
        </div>
        <button
          type="button"
          disabled={activeStepIndex >= SETUP_STEPS.length - 1}
          onClick={() => setActiveStep(SETUP_STEPS[Math.min(SETUP_STEPS.length - 1, activeStepIndex + 1)].id)}
          className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--brand-primary-foreground)] transition hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
      </div>
    </section>
  );
}
