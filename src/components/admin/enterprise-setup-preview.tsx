import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  Gavel,
  Lock,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import type { BusinessPolicy, PolicyValidationResult } from '@/features/business-policy';
import {
  resolveTier2Access,
  resolveTier2ReviewRequirement,
  resolveVendorBidEligibility,
  resolveVendorBvnGate,
} from '@/features/business-policy';

type EnterpriseSetupPreviewProps = {
  policy: BusinessPolicy;
  validation: PolicyValidationResult;
  storageMode?: 'runtime_default' | 'published_policy';
  publishedVersion?: string | null;
  versionCount?: number;
};

const formatter = new Intl.NumberFormat('en-NG');

function money(value: number) {
  return `₦${formatter.format(value)}`;
}

function boolLabel(value: boolean) {
  return value ? 'Enabled' : 'Disabled';
}

function PolicyCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#800020]/10 text-[#800020]">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function DefinitionList({ rows }: { rows: Array<[string, string | number]> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-md bg-gray-50 p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
          <dd className="mt-1 break-words text-sm font-semibold text-gray-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'good' | 'warn' | 'neutral' }) {
  const toneClass =
    tone === 'good'
      ? 'bg-green-50 text-green-700 ring-green-200'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : 'bg-gray-50 text-gray-700 ring-gray-200';

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${toneClass}`}>
      {children}
    </span>
  );
}

function ValidationPanel({ validation }: { validation: PolicyValidationResult }) {
  const errors = validation.issues.filter((issue) => issue.severity === 'error');
  const warnings = validation.issues.filter((issue) => issue.severity === 'warning');

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${validation.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {validation.valid ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Policy Validation</h2>
            <p className="mt-1 text-sm text-gray-600">
              Publish checks are previewed here and enforced before drafts can become active.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <StatusPill tone={errors.length === 0 ? 'good' : 'warn'}>{errors.length} errors</StatusPill>
          <StatusPill tone={warnings.length === 0 ? 'good' : 'warn'}>{warnings.length} warnings</StatusPill>
        </div>
      </div>

      {validation.issues.length > 0 ? (
        <div className="mt-4 space-y-2">
          {validation.issues.map((issue) => (
            <div key={`${issue.path}-${issue.message}`} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <span className="font-semibold">{issue.path}</span>: {issue.message}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Current NEM policy passes the first validation layer.
        </p>
      )}
    </section>
  );
}

function VersionPanel({
  policy,
  storageMode,
  publishedVersion,
  versionCount,
}: {
  policy: BusinessPolicy;
  storageMode?: 'runtime_default' | 'published_policy';
  publishedVersion?: string | null;
  versionCount?: number;
}) {
  const isPublished = storageMode === 'published_policy';

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#800020]/10 text-[#800020]">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Policy Versioning</h2>
          <p className="mt-1 text-sm text-gray-600">
            Published policies will become the source of truth after validation. Until then, NEM defaults and legacy config remain active.
          </p>
        </div>
      </div>
      <div className="mt-4">
        <DefinitionList
          rows={[
            ['Active source', isPublished ? 'Published policy' : 'Runtime NEM defaults + legacy config'],
            ['Effective version', policy.version],
            ['Published version', publishedVersion || 'None'],
            ['Stored versions', versionCount ?? 0],
          ]}
        />
      </div>
    </section>
  );
}

function VendorJourney({ policy }: { policy: BusinessPolicy }) {
  const unverifiedGate = resolveVendorBvnGate(policy, { role: 'vendor', bvnVerified: false });
  const tier1Bid = resolveVendorBidEligibility(policy, { tier: 'tier1_bvn', bvnVerified: true }, policy.onboarding.tier1BidLimit);
  const tier1HighBid = resolveVendorBidEligibility(policy, { tier: 'tier1_bvn', bvnVerified: true }, policy.onboarding.tier1BidLimit + 1);
  const tier2Access = resolveTier2Access(policy, {
    tier: 'tier1_bvn',
    bvnVerified: true,
    registrationFeePaid: true,
  });
  const tier2Review = resolveTier2ReviewRequirement(policy);

  const steps = [
    {
      title: 'Register account',
      detail: policy.auth.businessEmailOnly ? 'Business email required' : 'Standard email registration allowed',
      decision: 'auth.businessEmailOnly',
    },
    {
      title: 'Complete Tier 1 verification',
      detail: unverifiedGate.allowed ? 'BVN verification is not required' : 'BVN verification through Dojah',
      decision: unverifiedGate.decision.rulePath,
    },
    {
      title: 'Bid with Tier 1 limit',
      detail: tier1Bid.allowed && !tier1HighBid.allowed
        ? `Can bid up to ${money(policy.onboarding.tier1BidLimit)}`
        : 'Bidding rule differs from the default Tier 1 cap',
      decision: tier1Bid.decision.rulePath,
    },
    {
      title: 'Pay registration fee',
      detail: policy.onboarding.registrationFeeRequired
        ? `${money(policy.onboarding.registrationFeeAmount)} via ${policy.payments.registrationFeeProvider}`
        : 'No registration fee required',
      decision: 'onboarding.registrationFeeRequired',
    },
    {
      title: 'Complete Tier 2 KYC',
      detail: tier2Review.value === 'manual_review'
        ? 'Dojah evidence goes to manual review'
        : 'Provider pass can unlock next step',
      decision: tier2Review.decision.rulePath,
    },
    {
      title: 'Bid without Tier 1 restriction',
      detail: tier2Access.allowed && policy.onboarding.requireTier2ForUnlimitedBidding
        ? 'Allowed after Tier 2 approval'
        : 'Not tied to Tier 2 approval',
      decision: tier2Access.decision.rulePath,
    },
  ];

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#800020]/10 text-[#800020]">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Vendor Journey Preview</h2>
          <p className="mt-1 text-sm text-gray-600">This is how a new vendor moves through the current effective policy.</p>
        </div>
      </div>
      <ol className="grid gap-3 lg:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#800020] text-sm font-bold text-white">
              {index + 1}
            </div>
            <h3 className="font-semibold text-gray-900">{step.title}</h3>
            <p className="mt-1 text-sm text-gray-600">{step.detail}</p>
            <p className="mt-3 text-xs font-medium text-gray-500">Rule: {step.decision}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function EnterpriseSetupPreview({
  policy,
  validation,
  storageMode,
  publishedVersion,
  versionCount,
}: EnterpriseSetupPreviewProps) {
  const enabledAssetTypes = Object.entries(policy.cases.enabledAssetTypes)
    .filter(([, config]) => config.enabled)
    .map(([, config]) => `${config.label} (${config.promptProfile})`);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[#800020]/20 bg-[#800020] p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-white/70">Effective policy preview</p>
            <h1 className="mt-2 text-3xl font-bold">Enterprise Setup</h1>
            <p className="mt-2 max-w-3xl text-white/80">
              Review the currently effective business policy. Draft edits above only affect behavior after a valid policy is published.
            </p>
          </div>
          <div className="rounded-lg bg-white/10 p-4">
            <p className="text-xs uppercase tracking-wide text-white/60">Policy version</p>
            <p className="mt-1 font-semibold">{policy.version}</p>
          </div>
        </div>
      </section>

      <ValidationPanel validation={validation} />
      <VersionPanel
        policy={policy}
        storageMode={storageMode}
        publishedVersion={publishedVersion}
        versionCount={versionCount}
      />

      <VendorJourney policy={policy} />

      <div className="grid gap-6 xl:grid-cols-2">
        <PolicyCard title="Brand And Access" description="Client-facing identity, login, and MFA behavior." icon={<Building2 className="h-5 w-5" />}>
          <DefinitionList
            rows={[
              ['Brand', policy.branding.brandName],
              ['Legal name', policy.branding.legalName],
              ['Homepage', policy.branding.homepageMode],
              ['Homepage template', policy.branding.homepageTemplate],
              ['Hero title', policy.branding.homepageCopy.heroTitle],
              ['Primary CTA', policy.branding.homepageCopy.primaryCtaLabel],
              ['Google login', boolLabel(policy.auth.googleOAuthEnabled)],
              ['Business email only', boolLabel(policy.auth.businessEmailOnly)],
              ['Staff MFA required', boolLabel(policy.auth.staffMfaRequired)],
              ['Vendor MFA required', boolLabel(policy.auth.vendorMfaRequired)],
              ['User-managed MFA', boolLabel(policy.auth.userManagedMfaAllowed)],
            ]}
          />
        </PolicyCard>

        <PolicyCard title="Onboarding And KYC" description="How vendors become eligible to bid and upgrade." icon={<ShieldCheck className="h-5 w-5" />}>
          <DefinitionList
            rows={[
              ['Mode', policy.onboarding.mode],
              ['Tier 1 bid limit', money(policy.onboarding.tier1BidLimit)],
              ['Registration fee', policy.onboarding.registrationFeeRequired ? money(policy.onboarding.registrationFeeAmount) : 'Not required'],
              ['Fee due window', `${policy.onboarding.registrationFeeDueDays} days`],
              ['KYC provider', policy.kyc.provider],
              ['Tier 2 decision', policy.onboarding.finalTier2Decision],
              ['AML required', boolLabel(policy.kyc.tier2RequiresAmlScreening)],
              ['Liveness required', boolLabel(policy.kyc.tier2RequiresLiveness)],
            ]}
          />
        </PolicyCard>

        <PolicyCard title="Payments And Escrow" description="Provider, wallet, deposit, and forfeiture rules." icon={<Wallet className="h-5 w-5" />}>
          <DefinitionList
            rows={[
              ['Default provider', policy.payments.defaultProvider],
              ['Wallet', boolLabel(policy.payments.walletEnabled)],
              ['Paystack', boolLabel(policy.payments.paystackEnabled)],
              ['Flutterwave', boolLabel(policy.payments.flutterwaveEnabled)],
              ['Manual payments', boolLabel(policy.payments.manualPaymentEnabled)],
              ['Hybrid payment', boolLabel(policy.payments.hybridPaymentEnabled)],
              ['Payment deadline', `${policy.payments.paymentDeadlineAfterSigningHours} hours after signing`],
              ['Deposit system', boolLabel(policy.escrow.depositSystemEnabled)],
              ['Deposit rate', `${policy.escrow.depositRatePercent}%`],
              ['Deposit floor', money(policy.escrow.minimumDepositFloor)],
              ['Forfeiture', `${policy.escrow.forfeiturePercentage}%`],
            ]}
          />
        </PolicyCard>

        <PolicyCard title="Auction Rules" description="Bid increments, document deadlines, fallback, and reserve rules." icon={<Gavel className="h-5 w-5" />}>
          <DefinitionList
            rows={[
              ['Minimum increment', money(policy.auctions.minimumBidIncrement)],
              ['Document validity', `${policy.auctions.documentValidityHours} hours`],
              ['Grace extensions', policy.auctions.maxGraceExtensions],
              ['Grace duration', `${policy.auctions.graceExtensionDurationHours} hours`],
              ['Fallback buffer', `${policy.auctions.fallbackBufferHours} hours`],
              ['Reserve strategy', policy.auctions.reserveValueStrategy],
              ['Reserve percentage', `${policy.auctions.reserveValuePercentage}%`],
              ['Live updates', policy.auctions.socketMode],
            ]}
          />
        </PolicyCard>

        <PolicyCard title="Cases And AI" description="Asset coverage, AI analysis, and valuation posture." icon={<Eye className="h-5 w-5" />}>
          <DefinitionList
            rows={[
              ['Enabled assets', enabledAssetTypes.join(', ') || 'None'],
              ['Voice notes', boolLabel(policy.cases.voiceNotesEnabled)],
              ['Transcript review', boolLabel(policy.cases.salvageManagerTranscriptReviewRequired)],
              ['AI valuation', boolLabel(policy.aiValuation.enabled)],
              ['Provider order', policy.aiValuation.providerPriority.join(' → ')],
              ['Market search', boolLabel(policy.aiValuation.marketSearchEnabled)],
              ['Repair vs replace', boolLabel(policy.aiValuation.repairVsReplaceEnabled)],
              ['Show cost breakdown', boolLabel(policy.aiValuation.showDamageCostBreakdownToVendors)],
            ]}
          />
        </PolicyCard>

        <PolicyCard title="Notifications, Documents, Fraud" description="Operational controls that will become configurable in later phases." icon={<FileText className="h-5 w-5" />}>
          <DefinitionList
            rows={[
              ['Email', boolLabel(policy.notifications.emailEnabled)],
              ['SMS', boolLabel(policy.notifications.smsEnabled)],
              ['Push', boolLabel(policy.notifications.pushEnabled)],
              ['SMS categories', policy.notifications.smsCategories.join(', ')],
              ['Required docs', policy.documents.requiredAuctionDocuments.join(', ')],
              ['Receipt in documents', boolLabel(policy.documents.attachPaymentReceiptToAuctionDocuments)],
              ['Dojah risk alerts', boolLabel(policy.fraud.dojahRiskAlertsEnabled)],
              ['IP fraud detection', boolLabel(policy.fraud.ipFraudDetectionEnabled)],
            ]}
          />
        </PolicyCard>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Protected Implementation Standard</h2>
            <p className="mt-1 text-sm text-gray-600">
              The editor intentionally excludes provider keys, webhook secrets, raw fraud thresholds, and sensitive internal controls. Those remain private environment or admin-only settings.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
