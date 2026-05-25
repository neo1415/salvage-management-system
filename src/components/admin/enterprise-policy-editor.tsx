'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Rocket, Save } from 'lucide-react';
import type { BusinessPolicy, PolicyValidationResult } from '@/features/business-policy/types';
import { validateBusinessPolicy } from '@/features/business-policy/policy-validation';
import { PAYMENT_PROVIDER_CAPABILITIES } from '@/features/business-policy/payment-provider-capabilities';

type EnterprisePolicyEditorProps = {
  initialPolicy: BusinessPolicy;
};

type SaveResult = {
  success: boolean;
  record?: { id: string; version: string };
  validation?: PolicyValidationResult;
  error?: string;
};

function clonePolicy(policy: BusinessPolicy): BusinessPolicy {
  return structuredClone(policy);
}

function numberValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
      <span className="text-sm font-semibold text-gray-900">{label}</span>
      {description ? <span className="mt-1 block text-xs text-gray-500">{description}</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/15"
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/15"
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
          ? 'border-[#800020] bg-[#800020]/5 text-[#800020]'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className={`h-5 w-9 rounded-full p-0.5 transition ${checked ? 'bg-[#800020]' : 'bg-gray-300'}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

const ONBOARDING_PRESETS: Array<{
  mode: BusinessPolicy['onboarding']['mode'];
  title: string;
  description: string;
}> = [
  {
    mode: 'tiered_bvn_fee_tier2',
    title: 'NEM tiered default',
    description: 'BVN unlocks limited bidding, registration fee unlocks Tier 2 KYC, final approval stays manual.',
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
  const [policy, setPolicy] = useState(() => clonePolicy(initialPolicy));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lastDraftId, setLastDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const validation = useMemo(() => validateBusinessPolicy(policy), [policy]);
  const errors = validation.issues.filter((issue) => issue.severity === 'error');
  const warnings = validation.issues.filter((issue) => issue.severity === 'warning');

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

  const saveDraft = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/business-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy, notes }),
      });
      const result = (await response.json()) as SaveResult;

      if (!response.ok || !result.success || !result.record?.id) {
        setMessage(result.error || 'Draft could not be saved. Check validation errors and migration 0037.');
        return null;
      }

      setLastDraftId(result.record.id);
      setMessage(`Draft saved: ${result.record.version}`);
      return result.record.id;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Draft save failed.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = async () => {
    setPublishing(true);
    setMessage(null);

    try {
      const draftId = lastDraftId ?? (await saveDraft());
      if (!draftId) return;

      const response = await fetch('/api/admin/business-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', id: draftId }),
      });
      const result = (await response.json()) as SaveResult;

      if (!response.ok || !result.success) {
        setMessage(result.error || 'Draft could not be published.');
        return;
      }

      setMessage(`Published policy: ${result.record?.version ?? policy.version}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#800020]">Draft editor</p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">Enterprise Business Rules</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Edit safe white-label and operating rules, validate them, save a draft, then publish only when ready. Provider secrets and sensitive fraud thresholds are intentionally excluded.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={saveDraft}
            disabled={saving || publishing || !validation.valid}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[#800020] px-4 py-2 text-sm font-semibold text-[#800020] transition hover:bg-[#800020]/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={publishDraft}
            disabled={saving || publishing || !validation.valid}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#800020] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#650019] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Rocket className="h-4 w-4" />
            {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      <div className={`mt-4 rounded-md border p-3 text-sm ${validation.valid ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
        <div className="flex items-start gap-2">
          {validation.valid ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
          <div>
            <p className="font-semibold">
              {validation.valid ? `${warnings.length} warnings, ready to save` : `${errors.length} errors must be fixed`}
            </p>
            {validation.issues.length ? (
              <ul className="mt-2 space-y-1">
                {validation.issues.slice(0, 5).map((issue) => (
                  <li key={`${issue.path}-${issue.message}`}>
                    <span className="font-semibold">{issue.path}</span>: {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm font-medium text-gray-700">
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900">Branding</h3>
          <div className="grid gap-4 sm:grid-cols-2">
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
            <Field label="Logo path or URL" description="Public logo path used by landing pages, emails, and documents.">
              <TextInput value={policy.branding.logoPath} onChange={(event) => updatePolicy((draft) => { draft.branding.logoPath = event.target.value; })} />
            </Field>
            <Field label="Homepage mode" description="Landing page for public marketing, or login-first for private deployments.">
              <SelectInput
                value={policy.branding.homepageMode}
                onChange={(event) => updatePolicy((draft) => { draft.branding.homepageMode = event.target.value as BusinessPolicy['branding']['homepageMode']; })}
              >
                <option value="landing">Landing page</option>
                <option value="login_first">Login first</option>
              </SelectInput>
            </Field>
            <Field label="Homepage template" description="Controls the public first impression for white-label deployments.">
              <SelectInput
                value={policy.branding.homepageTemplate}
                onChange={(event) => updatePolicy((draft) => { draft.branding.homepageTemplate = event.target.value as BusinessPolicy['branding']['homepageTemplate']; })}
              >
                <option value="salvage_showcase">Salvage showcase</option>
                <option value="auction_marketplace">Auction marketplace</option>
                <option value="minimal_private">Minimal private portal</option>
              </SelectInput>
            </Field>
            <Field label="Hero title" description="Keep this short enough to fit a mobile hero.">
              <TextInput value={policy.branding.homepageCopy.heroTitle} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.heroTitle = event.target.value; })} />
            </Field>
            <Field label="Hero subtitle">
              <TextInput value={policy.branding.homepageCopy.heroSubtitle} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.heroSubtitle = event.target.value; })} />
            </Field>
            <Field label="Supporting line">
              <TextInput value={policy.branding.homepageCopy.supportingText} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.supportingText = event.target.value; })} />
            </Field>
            <Field label="Primary CTA">
              <TextInput value={policy.branding.homepageCopy.primaryCtaLabel} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.primaryCtaLabel = event.target.value; })} />
            </Field>
            <Field label="Secondary CTA">
              <TextInput value={policy.branding.homepageCopy.secondaryCtaLabel ?? ''} onChange={(event) => updatePolicy((draft) => { draft.branding.homepageCopy.secondaryCtaLabel = event.target.value; })} />
            </Field>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div
              className="p-4 text-white"
              style={{ background: `linear-gradient(135deg, ${policy.branding.primaryColor}, ${policy.branding.accentColor})` }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Brand preview</p>
              <p className="mt-2 text-2xl font-bold">{policy.branding.brandName || 'Brand name'}</p>
              <p className="mt-1 text-sm opacity-90">{policy.branding.legalName || 'Legal entity name'}</p>
              <div className="mt-5 max-w-xl rounded-md bg-white/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{policy.branding.homepageTemplate.replaceAll('_', ' ')}</p>
                <p className="mt-2 text-xl font-bold">{policy.branding.homepageCopy.heroTitle}</p>
                <p className="mt-1 text-sm opacity-90">{policy.branding.homepageCopy.heroSubtitle}</p>
                <button
                  type="button"
                  className="mt-3 rounded-md px-4 py-2 text-sm font-bold"
                  style={{ backgroundColor: policy.branding.accentColor, color: policy.branding.primaryColor }}
                >
                  {policy.branding.homepageCopy.primaryCtaLabel}
                </button>
              </div>
            </div>
            <div className="grid gap-3 bg-gray-50 p-4 text-sm text-gray-700 sm:grid-cols-2">
              <div>
                <p className="font-semibold text-gray-900">Homepage</p>
                <p>{policy.branding.homepageMode === 'landing' ? 'Public landing page before login' : 'Send visitors directly to login'}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Support</p>
                <p>{policy.branding.supportEmail}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900">Access And MFA</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle checked={policy.auth.businessEmailOnly} onChange={(checked) => updatePolicy((draft) => { draft.auth.businessEmailOnly = checked; })} label="Business email only" />
            <Toggle checked={policy.auth.googleOAuthEnabled} onChange={(checked) => updatePolicy((draft) => { draft.auth.googleOAuthEnabled = checked; })} label="Google login enabled" />
            <Toggle checked={policy.auth.staffMfaRequired} onChange={(checked) => updatePolicy((draft) => { draft.auth.staffMfaRequired = checked; })} label="Staff MFA required" />
            <Toggle checked={policy.auth.vendorMfaRequired} onChange={(checked) => updatePolicy((draft) => { draft.auth.vendorMfaRequired = checked; })} label="Vendor MFA required" />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900">Vendor Onboarding</h3>
          <div className="grid gap-3">
            {ONBOARDING_PRESETS.map((preset) => (
              <button
                key={preset.mode}
                type="button"
                onClick={() => updatePolicy((draft) => applyOnboardingPreset(draft, preset.mode))}
                className={`rounded-md border p-3 text-left transition ${
                  policy.onboarding.mode === preset.mode
                    ? 'border-[#800020] bg-[#800020]/5'
                    : 'border-gray-200 bg-white hover:border-[#800020]/40 hover:bg-gray-50'
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
            <Toggle checked={policy.onboarding.requireTier2ForUnlimitedBidding} onChange={(checked) => updatePolicy((draft) => { draft.onboarding.requireTier2ForUnlimitedBidding = checked; })} label="Tier 2 unlocks unlimited bidding" />
            <Toggle checked={policy.onboarding.allowBrowseBeforeKyc} onChange={(checked) => updatePolicy((draft) => { draft.onboarding.allowBrowseBeforeKyc = checked; })} label="Allow browsing before KYC" />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
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
        </div>

        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900">Payment Providers</h3>
          <p className="text-sm text-gray-600">
            Paystack remains the live checkout path until a provider adapter is explicitly routed. Other providers can be prepared here for white-label deployments.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Toggle checked={policy.payments.paystackEnabled} onChange={(checked) => updatePolicy((draft) => { draft.payments.paystackEnabled = checked; })} label="Paystack" />
            <Toggle checked={policy.payments.flutterwaveEnabled} onChange={(checked) => updatePolicy((draft) => { draft.payments.flutterwaveEnabled = checked; })} label="Flutterwave" />
            <Toggle checked={policy.payments.manualPaymentEnabled} onChange={(checked) => updatePolicy((draft) => { draft.payments.manualPaymentEnabled = checked; })} label="Manual review" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Default provider">
              <SelectInput value={policy.payments.defaultProvider} onChange={(event) => updatePolicy((draft) => { draft.payments.defaultProvider = event.target.value as BusinessPolicy['payments']['defaultProvider']; })}>
                {PAYMENT_PROVIDER_CAPABILITIES.map((provider) => <option key={provider.provider} value={provider.provider}>{provider.label}</option>)}
              </SelectInput>
            </Field>
            <Field label="Registration fee provider">
              <SelectInput value={policy.payments.registrationFeeProvider} onChange={(event) => updatePolicy((draft) => { draft.payments.registrationFeeProvider = event.target.value as BusinessPolicy['payments']['registrationFeeProvider']; })}>
                {PAYMENT_PROVIDER_CAPABILITIES.map((provider) => <option key={provider.provider} value={provider.provider}>{provider.label}</option>)}
              </SelectInput>
            </Field>
            <Field label="Auction payment provider">
              <SelectInput value={policy.payments.auctionPaymentProvider} onChange={(event) => updatePolicy((draft) => { draft.payments.auctionPaymentProvider = event.target.value as BusinessPolicy['payments']['auctionPaymentProvider']; })}>
                {PAYMENT_PROVIDER_CAPABILITIES.map((provider) => <option key={provider.provider} value={provider.provider}>{provider.label}</option>)}
              </SelectInput>
            </Field>
          </div>
          <div className="space-y-2">
            {PAYMENT_PROVIDER_CAPABILITIES.map((provider) => (
              <div key={provider.provider} className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                <span className="font-semibold text-gray-900">{provider.label}</span>: {provider.note}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-gray-200 p-4 xl:col-span-2">
          <h3 className="font-bold text-gray-900">Enabled Asset Types</h3>
          <p className="text-sm text-gray-600">
            Choose the asset categories that should appear in case creation. Advanced AI mappings are available for implementation teams, but day-to-day client admins should usually only turn asset types on or off.
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
                    Advanced analysis mapping
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
                    <Field label="Required fields" description="Comma-separated form field keys. Changing these can affect when AI analysis starts.">
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

        <div className="space-y-2 rounded-lg border border-gray-200 p-4 xl:col-span-2">
          <Field label="Draft notes" description="Reason/context for audit reviewers. Do not include secrets or credentials.">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/15"
              placeholder="Example: Enable machinery assets for staging demo, keep NEM defaults for payments."
            />
          </Field>
        </div>
      </div>
    </section>
  );
}
