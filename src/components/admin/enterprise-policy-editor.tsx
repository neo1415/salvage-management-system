'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, MonitorSmartphone, Rocket, Save, ShieldAlert, Upload } from 'lucide-react';
import type { BusinessPolicy, PolicyValidationResult } from '@/features/business-policy/types';
import { validateBusinessPolicy } from '@/features/business-policy/policy-validation';
import { HOMEPAGE_TEMPLATE_OPTIONS } from '@/components/landing/template-config';
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
    bestFor: 'Animated public homepage with a familiar auction-marketplace feel.',
    sections: ['Animated hero', 'How it works', 'Auction preview', 'FAQ and contact'],
    image: '/assets/Hero-3.png',
  },
  recovery_command: {
    bestFor: 'Auction buyers and verified vendors who need clear lot access, bidding, documents, payment, and pickup steps.',
    sections: ['Buyer hero', 'Bid workflow', 'Buyer controls', 'Pickup path', 'Contact'],
    image: '/assets/recovery-command/hero-yard.png',
  },
  claims_orbit: {
    bestFor: 'Relationship-led teams that want a more animated, connected journey.',
    sections: ['Orbit hero', 'Connected loop', 'Stage cards', 'Assets in motion'],
    image: '/assets/hero-1.png',
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
    { label: 'Animated hero', fields: 'Hero title, subtitle, buttons, stats', appears: 'Classic animated public homepage' },
    { label: 'Below-fold sections', fields: 'Brand colors, support details, legal links', appears: 'How it works, auction preview, FAQ, and contact' },
    { label: 'Sign-in shell', fields: 'Auth headline and subtitle', appears: 'Login and registration screens' },
  ],
  recovery_command: [
    { label: 'Buyer hero', fields: 'Small label, hero title, subtitle, buttons', appears: 'Public salvage auction landing hero' },
    { label: 'Bid workflow', fields: 'Workflow labels and process copy', appears: 'Vendor verification to pickup release timeline' },
    { label: 'Contact section', fields: 'Trust line, support email, support phone', appears: 'Vendor help and footer support area' },
  ],
  claims_orbit: [
    { label: 'Orbit hero', fields: 'Small label, hero title, subtitle, buttons', appears: 'Animated circular recovery story' },
    { label: 'Connected stages', fields: 'Supporting line and stats', appears: 'Claims, auction, payment, and document sections' },
    { label: 'Contact section', fields: 'Trust line and support details', appears: 'Bottom support area' },
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
  const primaryText = getReadableTextColor(primaryColor);

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

  if (templateId === 'claims_orbit') {
    return (
      <div className="relative mt-4 overflow-hidden rounded-2xl bg-neutral-950 text-white">
        <div className="relative h-40 p-3">
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full border border-white/15" />
        <div className="absolute right-5 top-5 h-20 w-20 rounded-full border" style={{ borderColor: accentColor }} />
        <div className="relative z-10 flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/60">{brandName || 'Orbit'}</span>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
        </div>
        <div className="relative z-10 mt-8 h-4 w-4/5 rounded bg-white/85" />
        <div className="relative z-10 mt-2 h-4 w-3/5 rounded bg-white/45" />
        <div className="absolute bottom-3 left-3 right-3 grid grid-cols-3 gap-1">
          <div className="h-6 rounded-full bg-white/10" />
          <div className="h-6 rounded-full bg-white/10" />
          <div className="h-6 rounded-full" style={{ backgroundColor: accentColor }} />
        </div>
        </div>
        <TemplatePreviewFooter guide={guide} selected={selected} dark />
      </div>
    );
  }

  if (templateId === 'recovery_command') {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <div className="grid h-40 grid-cols-[1fr_0.8fr] gap-2 p-2">
        <div className="rounded-lg bg-white p-2 shadow-sm">
          <div className="mb-2 h-2 w-2/3 rounded-full" style={{ backgroundColor: primaryColor }} />
          <div className="h-9 rounded bg-slate-200" />
          <div className="mt-2 grid grid-cols-2 gap-1">
            <div className="h-8 rounded bg-slate-100" />
            <div className="h-8 rounded bg-slate-100" />
          </div>
          <div className="mt-2 h-4 w-20 rounded-full" style={{ backgroundColor: accentColor }} />
        </div>
        <div className="rounded-lg p-2 shadow-sm" style={{ backgroundColor: primaryColor, color: primaryText }}>
          <div className="h-2 w-12 rounded-full bg-white/60" />
          <div className="mt-4 space-y-1">
            <div className="h-5 rounded bg-white/20" />
            <div className="h-5 rounded bg-white/20" />
            <div className="h-5 rounded" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      </div>
      <TemplatePreviewFooter guide={guide} selected={selected} />
      </div>
    );
  }

  if (templateId === 'nem_salvage') {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`, color: primaryText }}>
      <div className="h-40 p-3">
        <div className="flex items-center justify-between">
          <div className="h-2 w-20 rounded-full bg-white/70" />
          <div className="h-6 w-6 rounded bg-white/20" />
        </div>
        <div className="mt-5 h-5 w-3/4 rounded bg-white/85" />
        <div className="mt-2 h-5 w-1/2 rounded bg-white/45" />
        <div className="mt-4 flex gap-2">
          <div className="h-6 w-20 rounded-full bg-white" />
          <div className="h-6 w-20 rounded-full border border-white/60" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-1">
          <div className="h-5 rounded bg-white/15" />
          <div className="h-5 rounded bg-white/15" />
          <div className="h-5 rounded bg-white/15" />
        </div>
      </div>
      <TemplatePreviewFooter guide={guide} selected={selected} dark={primaryText === '#FFFFFF'} />
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
  const selectedTemplateGuide = TEMPLATE_EDITOR_GUIDE[policy.branding.homepageTemplate] ?? TEMPLATE_EDITOR_GUIDE.reclaim_editorial;
  const selectedCopyMap = TEMPLATE_COPY_MAP[policy.branding.homepageTemplate] ?? TEMPLATE_COPY_MAP.reclaim_editorial;
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

      <div className="sticky top-3 z-30 mt-5 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-xl shadow-gray-900/10 backdrop-blur">
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
                {HOMEPAGE_TEMPLATE_OPTIONS.find((template) => template.id === policy.branding.homepageTemplate)?.name ?? 'Selected template'}
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
                  policy.branding.homepageTemplate === template.id
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
                  selected={policy.branding.homepageTemplate === template.id}
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

          <div className="grid gap-4 rounded-3xl border border-gray-200 p-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-primary)]">What this template includes</p>
              <h4 className="mt-2 text-xl font-black tracking-[-0.03em] text-gray-950">
                {selectedTemplateGuide.bestFor}
              </h4>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {selectedTemplateGuide.sections.map((section) => (
                <div key={section} className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
                  {section}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`rounded-3xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2 ${visibleStepClass('content')}`}>
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
