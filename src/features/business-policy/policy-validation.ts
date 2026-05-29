import type { BusinessPolicy, PolicyValidationIssue, PolicyValidationResult } from './types';
import {
  getPaymentProviderCapability,
  isPaymentProviderEnabled,
} from './payment-provider-capabilities';

function issue(path: string, message: string, severity: PolicyValidationIssue['severity'] = 'error'): PolicyValidationIssue {
  return { path, message, severity };
}

const LIVE_CASE_ASSET_TYPES = new Set(['vehicle', 'property', 'electronics', 'machinery']);

export function validateBusinessPolicy(policy: BusinessPolicy): PolicyValidationResult {
  const issues: PolicyValidationIssue[] = [];

  if (!policy.version.trim()) {
    issues.push(issue('version', 'Policy version is required.'));
  }

  if (!policy.branding.brandName.trim()) {
    issues.push(issue('branding.brandName', 'Brand name is required.'));
  }

  if (!policy.branding.legalName.trim()) {
    issues.push(issue('branding.legalName', 'Legal name is required.'));
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(policy.branding.supportEmail)) {
    issues.push(issue('branding.supportEmail', 'Support email must be a valid email address.'));
  }

  if (!policy.branding.logoPath.startsWith('/') && !policy.branding.logoPath.startsWith('https://')) {
    issues.push(issue('branding.logoPath', 'Logo path must be an app-relative path or HTTPS URL.'));
  }

  if (!policy.branding.faviconPath.startsWith('/') && !policy.branding.faviconPath.startsWith('https://')) {
    issues.push(issue('branding.faviconPath', 'Favicon path must be an app-relative path or HTTPS URL.'));
  }

  if (!policy.branding.homepageCopy.heroTitle.trim()) {
    issues.push(issue('branding.homepageCopy.heroTitle', 'Homepage hero title is required.'));
  }

  if (!policy.branding.homepageCopy.heroSubtitle.trim()) {
    issues.push(issue('branding.homepageCopy.heroSubtitle', 'Homepage subtitle is required.'));
  }

  if (!policy.branding.homepageCopy.primaryCtaLabel.trim()) {
    issues.push(issue('branding.homepageCopy.primaryCtaLabel', 'Primary call-to-action label is required.'));
  }

  if (policy.branding.splashEnabled && policy.branding.homepageMode === 'login_first') {
    issues.push(
      issue(
        'branding.splashEnabled',
        'Splash screens are only shown on public landing pages. Login-first mode will skip the splash.',
        'warning'
      )
    );
  }

  if (policy.branding.homepageCopy.heroTitle.length > 70) {
    issues.push(issue('branding.homepageCopy.heroTitle', 'Hero title is long and may wrap awkwardly on mobile.', 'warning'));
  }

  if (policy.branding.homepageCopy.heroSubtitle.length > 150) {
    issues.push(issue('branding.homepageCopy.heroSubtitle', 'Hero subtitle is long and may reduce mobile readability.', 'warning'));
  }

  if ((policy.branding.homepageCopy.authHeadline?.length ?? 0) > 90) {
    issues.push(issue('branding.homepageCopy.authHeadline', 'Auth headline is long and may wrap awkwardly beside the login form.', 'warning'));
  }

  if ((policy.branding.homepageCopy.workflowTitle?.length ?? 0) > 70) {
    issues.push(issue('branding.homepageCopy.workflowTitle', 'Workflow title is long and may wrap awkwardly on mobile.', 'warning'));
  }

  if ((policy.branding.homepageCopy.auctionSectionTitle?.length ?? 0) > 70) {
    issues.push(issue('branding.homepageCopy.auctionSectionTitle', 'Auction section title is long and may wrap awkwardly on mobile.', 'warning'));
  }

  if ((policy.branding.homepageCopy.operationsSectionTitle?.length ?? 0) > 90) {
    issues.push(issue('branding.homepageCopy.operationsSectionTitle', 'Middle section headline is long and may crowd smaller screens.', 'warning'));
  }

  if ((policy.branding.homepageCopy.proofSectionTitle?.length ?? 0) > 90) {
    issues.push(issue('branding.homepageCopy.proofSectionTitle', 'Assurance section headline is long and may crowd smaller screens.', 'warning'));
  }

  if (!/^#[0-9A-Fa-f]{6}$/.test(policy.branding.primaryColor)) {
    issues.push(issue('branding.primaryColor', 'Primary color must be a six-digit hex color.'));
  }

  if (!/^#[0-9A-Fa-f]{6}$/.test(policy.branding.accentColor)) {
    issues.push(issue('branding.accentColor', 'Accent color must be a six-digit hex color.'));
  }

  if (!policy.auth.emailPasswordEnabled && !policy.auth.googleOAuthEnabled) {
    issues.push(issue('auth', 'At least one login method must be enabled.'));
  }

  if (policy.auth.businessEmailOnly && policy.auth.allowedEmailDomains.length === 0) {
    issues.push(
      issue(
        'auth.allowedEmailDomains',
        'Business email only is enabled without allowed domains. This may rely entirely on the personal-email denylist.',
        'warning'
      )
    );
  }

  if ((policy.auth.staffMfaRequired || policy.auth.vendorMfaRequired) && !policy.auth.userManagedMfaAllowed) {
    issues.push(
      issue(
        'auth.userManagedMfaAllowed',
        'MFA is required while user-managed MFA is disabled. Ensure staff can provision MFA before publishing.',
        'warning'
      )
    );
  }

  if (policy.onboarding.tier1BidLimit < 0) {
    issues.push(issue('onboarding.tier1BidLimit', 'Tier 1 bid limit cannot be negative.'));
  }

  if (
    (policy.onboarding.mode === 'full_kyc_before_bidding' || policy.onboarding.mode === 'single_full_kyc') &&
    policy.onboarding.allowBidAfterTier1
  ) {
    issues.push(
      issue(
        'onboarding.allowBidAfterTier1',
        'This onboarding mode requires full KYC before bidding, so Tier 1 bidding must be disabled.'
      )
    );
  }

  if (policy.onboarding.mode === 'no_registration_fee' && policy.onboarding.registrationFeeRequired) {
    issues.push(issue('onboarding.registrationFeeRequired', 'No-fee onboarding cannot require a registration fee.'));
  }

  if (policy.onboarding.mode === 'fee_before_tier1' && !policy.onboarding.registrationFeeRequired) {
    issues.push(issue('onboarding.registrationFeeRequired', 'Fee-before-Tier-1 onboarding must require a registration fee.'));
  }

  if (!policy.onboarding.requireTier2ForUnlimitedBidding && policy.onboarding.tier1BidLimit > 0) {
    issues.push(
      issue(
        'onboarding.requireTier2ForUnlimitedBidding',
        'Initial bid cap is configured, but full verification is not required for higher bidding access.',
        'warning'
      )
    );
  }

  if (policy.onboarding.registrationFeeRequired && policy.onboarding.registrationFeeAmount <= 0) {
    issues.push(issue('onboarding.registrationFeeAmount', 'Required registration fee must be greater than zero.'));
  }

  if (!policy.onboarding.registrationFeeRequired && policy.onboarding.registrationFeeAmount > 0) {
    issues.push(
      issue(
        'onboarding.registrationFeeAmount',
        'Registration fee amount is set while registration fee is disabled.',
        'warning'
      )
    );
  }

  if (policy.onboarding.registrationFeeDueDays <= 0) {
    issues.push(issue('onboarding.registrationFeeDueDays', 'Registration fee due days must be positive.'));
  }

  if (policy.payments.paymentDeadlineAfterSigningHours <= 0) {
    issues.push(issue('payments.paymentDeadlineAfterSigningHours', 'Payment deadline after signing must be positive.'));
  }

  if (policy.auctions.documentValidityHours <= 0) {
    issues.push(issue('auctions.documentValidityHours', 'Document validity period must be positive.'));
  }

  if (policy.auctions.minimumBidIncrement <= 0) {
    issues.push(issue('auctions.minimumBidIncrement', 'Minimum bid increment must be positive.'));
  }

  if (policy.auctions.maxGraceExtensions < 0) {
    issues.push(issue('auctions.maxGraceExtensions', 'Maximum grace extensions cannot be negative.'));
  }

  if (policy.auctions.graceExtensionDurationHours <= 0) {
    issues.push(issue('auctions.graceExtensionDurationHours', 'Grace extension duration must be positive.'));
  }

  if (policy.auctions.maxGraceExtensions > 0 && policy.auctions.graceExtensionDurationHours > policy.auctions.documentValidityHours) {
    issues.push(
      issue(
        'auctions.graceExtensionDurationHours',
        'A single grace extension should not exceed the document validity period.',
        'warning'
      )
    );
  }

  if (policy.auctions.fallbackBufferHours <= 0) {
    issues.push(issue('auctions.fallbackBufferHours', 'Fallback buffer period must be positive.'));
  }

  if (policy.auctions.reserveValuePercentage <= 0 || policy.auctions.reserveValuePercentage > 100) {
    issues.push(issue('auctions.reserveValuePercentage', 'Reserve value percentage must be between 1 and 100.'));
  }

  if (policy.escrow.depositSystemEnabled) {
    if (policy.escrow.depositRatePercent <= 0 || policy.escrow.depositRatePercent > 100) {
      issues.push(issue('escrow.depositRatePercent', 'Deposit percentage must be between 1 and 100 when deposits are enabled.'));
    }

    if (policy.escrow.minimumDepositFloor < 0) {
      issues.push(issue('escrow.minimumDepositFloor', 'Minimum deposit floor cannot be negative.'));
    }

    if (policy.escrow.topBiddersToKeepFrozen < 1) {
      issues.push(issue('escrow.topBiddersToKeepFrozen', 'At least one bidder must remain frozen when deposits are enabled.'));
    }

    if (policy.escrow.forfeiturePercentage < 0 || policy.escrow.forfeiturePercentage > 100) {
      issues.push(issue('escrow.forfeiturePercentage', 'Forfeiture percentage must be between 0 and 100.'));
    }
  }

  const enabledAssetTypes = Object.entries(policy.cases.enabledAssetTypes).filter(([, config]) => config.enabled);
  if (enabledAssetTypes.length === 0) {
    issues.push(issue('cases.enabledAssetTypes', 'At least one asset type must be enabled.'));
  }

  for (const [assetType, config] of enabledAssetTypes) {
    if (!LIVE_CASE_ASSET_TYPES.has(assetType)) {
      issues.push(
        issue(
          `cases.enabledAssetTypes.${assetType}.enabled`,
          `Asset type "${assetType}" is not yet supported by the live case database/API. Keep it disabled until implementation support is complete.`
        )
      );
    }

    if (!config.label.trim()) {
      issues.push(issue(`cases.enabledAssetTypes.${assetType}.label`, `Asset type "${assetType}" needs a display label.`));
    }

    if (config.requiresAiAnalysis && config.requiredFields.length === 0 && assetType !== 'property') {
      issues.push(
        issue(
          `cases.enabledAssetTypes.${assetType}.requiredFields`,
          `Asset type "${assetType}" needs required field definitions before AI analysis can be enabled.`
        )
      );
    }

    if (config.requiresAiAnalysis && !policy.aiValuation.enabled) {
      issues.push(
        issue(
          `cases.enabledAssetTypes.${assetType}.requiresAiAnalysis`,
          `Asset type "${assetType}" requires AI analysis, but AI valuation is disabled.`
        )
      );
    }
  }

  if (policy.aiValuation.enabled && policy.aiValuation.providerPriority.length === 0) {
    issues.push(issue('aiValuation.providerPriority', 'At least one AI provider is required when AI valuation is enabled.'));
  }

  if (!policy.notifications.emailEnabled && !policy.notifications.smsEnabled && !policy.notifications.pushEnabled) {
    issues.push(issue('notifications', 'At least one notification channel must be enabled.'));
  }

  if (policy.notifications.smsEnabled && policy.notifications.smsCategories.length === 0) {
    issues.push(issue('notifications.smsCategories', 'SMS is enabled, but no SMS categories are allowed.'));
  }

  if (policy.documents.requiredAuctionDocuments.length === 0) {
    issues.push(issue('documents.requiredAuctionDocuments', 'At least one auction document type must be required.'));
  }

  if (!policy.documents.billOfSaleDisclaimerTitle.trim()) {
    issues.push(issue('documents.billOfSaleDisclaimerTitle', 'Bill of Sale disclaimer title is required.'));
  }

  if (!policy.documents.billOfSaleDisclaimerBody.trim()) {
    issues.push(issue('documents.billOfSaleDisclaimerBody', 'Bill of Sale disclaimer body is required.'));
  }

  if (policy.documents.billOfSaleDisclaimerBody.length > 700) {
    issues.push(issue('documents.billOfSaleDisclaimerBody', 'Bill of Sale disclaimer is long and may need a second page.', 'warning'));
  }

  if (policy.documents.liabilityWaiverClauses.length === 0) {
    issues.push(issue('documents.liabilityWaiverClauses', 'At least one liability waiver clause is required.'));
  }

  policy.documents.liabilityWaiverClauses.forEach((clause, index) => {
    if (!clause.title.trim()) {
      issues.push(issue(`documents.liabilityWaiverClauses.${index}.title`, 'Each liability waiver clause needs a title.'));
    }
    if (!clause.body.trim()) {
      issues.push(issue(`documents.liabilityWaiverClauses.${index}.body`, 'Each liability waiver clause needs body text.'));
    }
    if (clause.body.length > 900) {
      issues.push(issue(`documents.liabilityWaiverClauses.${index}.body`, 'Clause is long and may require document layout review.', 'warning'));
    }
  });

  if (!policy.legal.registrationNumber.trim()) {
    issues.push(issue('legal.registrationNumber', 'Legal registration details are recommended for legal pages.', 'warning'));
  }

  if (!policy.legal.addressLine1.trim() || !policy.legal.addressLine2.trim()) {
    issues.push(issue('legal.address', 'Legal address is required for privacy, terms, and NDPR pages.', 'warning'));
  }

  for (const [path, email] of [
    ['legal.privacyEmail', policy.legal.privacyEmail],
    ['legal.dpoEmail', policy.legal.dpoEmail],
    ['legal.legalEmail', policy.legal.legalEmail],
  ] as const) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push(issue(path, 'Enter a valid legal contact email address.'));
    }
  }

  const selectedProviders = [
    ['payments.defaultProvider', policy.payments.defaultProvider],
    ['payments.registrationFeeProvider', policy.payments.registrationFeeProvider],
    ['payments.auctionPaymentProvider', policy.payments.auctionPaymentProvider],
  ] as const;

  for (const [path, provider] of selectedProviders) {
    const capability = getPaymentProviderCapability(provider);

    if (!isPaymentProviderEnabled(policy.payments, provider)) {
      issues.push(issue(path, `${capability.label} cannot be selected while it is disabled.`));
    }

    if (capability.executionStatus !== 'wired') {
      issues.push(
        issue(
          path,
          `${capability.label} is represented in policy, but checkout execution still needs explicit adapter routing before it can control live payments.`,
          'warning'
        )
      );
    }
  }

  return {
    valid: issues.every((validationIssue) => validationIssue.severity !== 'error'),
    issues,
  };
}
