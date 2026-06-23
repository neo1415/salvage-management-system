import { DEFAULT_BUSINESS_POLICY } from './default-policy';
import type {
  AiProvider,
  BusinessPolicy,
  OnboardingMode,
  PaymentProvider,
  VerificationProvider,
} from './types';

const ONBOARDING_MODES: OnboardingMode[] = [
  'tiered_bvn_fee_tier2',
  'full_kyc_before_bidding',
  'fee_before_tier1',
  'single_full_kyc',
  'no_registration_fee',
];

const PAYMENT_PROVIDERS: PaymentProvider[] = ['paystack', 'flutterwave', 'manual'];
const VERIFICATION_PROVIDERS: VerificationProvider[] = ['dojah'];
const AI_PROVIDERS: AiProvider[] = ['gemini', 'claude', 'serper'];
const HOMEPAGE_MODES: BusinessPolicy['branding']['homepageMode'][] = ['landing', 'login_first'];
const HOMEPAGE_TEMPLATES: BusinessPolicy['branding']['homepageTemplate'][] = [
  'reclaim_editorial',
  'nem_salvage',
  'recovery_command',
  'auction_pulse',
  'claims_orbit',
  'executive_terminal',
  'salvage_showcase',
  'minimal_private',
  'auction_marketplace',
];
const HOMEPAGE_THEMES: BusinessPolicy['branding']['homepageTheme'][] = ['day', 'night', 'auto'];
const TIER2_DECISIONS: BusinessPolicy['onboarding']['finalTier2Decision'][] = ['manual_review'];
const RESERVE_STRATEGIES: BusinessPolicy['auctions']['reserveValueStrategy'][] = ['percentage_of_salvage_value'];
const SOCKET_MODES: BusinessPolicy['auctions']['socketMode'][] = [
  'polling_primary_socket_secondary',
  'socket_primary_polling_fallback',
];
const REPORT_DATE_RANGES: BusinessPolicy['reports']['defaultDateRange'][] = ['all_time', 'last_30_days', 'last_90_days'];
const DOCUMENT_TYPES: BusinessPolicy['documents']['requiredAuctionDocuments'][number][] = ['bill_of_sale', 'liability_waiver'];
const ASSET_PROMPT_PROFILES: BusinessPolicy['cases']['enabledAssetTypes'][string]['promptProfile'][] = [
  'vehicle',
  'electronics',
  'property',
  'jewelry',
  'machinery',
  'general_asset',
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function optionalStringValue(value: unknown, fallback?: string): string | undefined {
  return typeof value === 'string' ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function boundedNumberValue(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = numberValue(value, fallback);
  return Math.min(max, Math.max(min, numeric));
}

function exchangeRatesValue(
  value: unknown,
  fallback: BusinessPolicy['aiValuation']['exchangeRates']
): BusinessPolicy['aiValuation']['exchangeRates'] {
  const rates = asRecord(value);
  return {
    USD: boundedNumberValue(rates.USD, fallback.USD, 100, 10000),
    GBP: boundedNumberValue(rates.GBP, fallback.GBP, 100, 15000),
    EUR: boundedNumberValue(rates.EUR, fallback.EUR, 100, 15000),
  };
}

function repairCostMultipliersValue(
  value: unknown,
  fallback: BusinessPolicy['aiValuation']['repairCostMultipliers']
): BusinessPolicy['aiValuation']['repairCostMultipliers'] {
  const multipliers = asRecord(value);
  return {
    laborPercent: boundedNumberValue(multipliers.laborPercent, fallback.laborPercent, 0, 100),
    paintAndMaterialsPercent: boundedNumberValue(multipliers.paintAndMaterialsPercent, fallback.paintAndMaterialsPercent, 0, 100),
    logisticsPercent: boundedNumberValue(multipliers.logisticsPercent, fallback.logisticsPercent, 0, 100),
    severeDamageMultiplier: boundedNumberValue(multipliers.severeDamageMultiplier, fallback.severeDamageMultiplier, 1, 3),
    moderateDamageMultiplier: boundedNumberValue(multipliers.moderateDamageMultiplier, fallback.moderateDamageMultiplier, 1, 2),
  };
}

function numericRecordValue(
  value: unknown,
  fallback: Record<string, number>,
  min: number,
  max: number
): Record<string, number> {
  const input = asRecord(value);
  const result: Record<string, number> = {};
  const keys = new Set([...Object.keys(fallback), ...Object.keys(input)]);

  for (const key of keys) {
    const normalizedKey = key.trim();
    if (!normalizedKey) continue;
    result[normalizedKey] = boundedNumberValue(input[key], fallback[key] ?? fallback.general_asset ?? min, min, max);
  }

  return Object.keys(result).length > 0 ? result : fallback;
}

function pricePlausibilityValue(
  value: unknown,
  fallback: BusinessPolicy['aiValuation']['pricePlausibility']
): BusinessPolicy['aiValuation']['pricePlausibility'] {
  const input = asRecord(value);
  return {
    marketMinimums: numericRecordValue(input.marketMinimums, fallback.marketMinimums, 0, 1_000_000_000),
    partMinimums: numericRecordValue(input.partMinimums, fallback.partMinimums, 0, 1_000_000_000),
    partMaximums: numericRecordValue(input.partMaximums, fallback.partMaximums, 1_000, 1_000_000_000),
  };
}

function photoRequirementsValue(
  value: unknown,
  fallback: BusinessPolicy['aiValuation']['photoRequirements']
): BusinessPolicy['aiValuation']['photoRequirements'] {
  const input = asRecord(value);
  const result: BusinessPolicy['aiValuation']['photoRequirements'] = {};
  const keys = new Set([...Object.keys(fallback), ...Object.keys(input)]);

  for (const key of keys) {
    const normalizedKey = sanitizeAssetTypeKey(key);
    if (!normalizedKey) continue;
    const entry = asRecord(input[key]);
    const fallbackEntry = fallback[normalizedKey] || fallback.general_asset;
    result[normalizedKey] = {
      minimumPhotos: Math.round(boundedNumberValue(entry.minimumPhotos, fallbackEntry.minimumPhotos, 1, 20)),
      recommendedPhotos: Math.round(boundedNumberValue(entry.recommendedPhotos, fallbackEntry.recommendedPhotos, 1, 30)),
      requiredAngles: stringArrayValue(entry.requiredAngles, fallbackEntry.requiredAngles),
    };
  }

  return Object.keys(result).length > 0 ? result : fallback;
}

function stringArrayValue(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback ?? [];
  return value.filter((item): item is string => typeof item === 'string');
}

function documentClauseArrayValue(
  value: unknown,
  fallback: BusinessPolicy['documents']['liabilityWaiverClauses']
): BusinessPolicy['documents']['liabilityWaiverClauses'] {
  if (!Array.isArray(value)) return fallback;

  const clauses = value
    .map((item) => {
      const clause = asRecord(item);
      return {
        title: stringValue(clause.title, '').trim(),
        body: stringValue(clause.body, '').trim(),
      };
    })
    .filter((clause) => clause.title && clause.body);

  return clauses.length > 0 ? clauses : fallback;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
}

function enumArrayValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T[]): T[] {
  if (!Array.isArray(value)) return fallback;
  const sanitized = value.filter((item): item is T => typeof item === 'string' && allowed.includes(item as T));
  return sanitized.length > 0 ? sanitized : fallback;
}

function sanitizeAssetTypeKey(key: string): string | null {
  const normalized = key.trim().toLowerCase();
  return /^[a-z][a-z0-9_-]{1,40}$/.test(normalized) ? normalized : null;
}

function sanitizeInsuranceClassKey(key: string): string | null {
  const normalized = key.trim().toLowerCase();
  return /^[a-z][a-z0-9_-]{1,60}$/.test(normalized) ? normalized : null;
}

export function sanitizeBusinessPolicy(input: unknown): BusinessPolicy {
  const source = asRecord(input);
  const fallback = DEFAULT_BUSINESS_POLICY;

  const branding = asRecord(source.branding);
  const auth = asRecord(source.auth);
  const onboarding = asRecord(source.onboarding);
  const kyc = asRecord(source.kyc);
  const payments = asRecord(source.payments);
  const escrow = asRecord(source.escrow);
  const auctions = asRecord(source.auctions);
  const cases = asRecord(source.cases);
  const aiValuation = asRecord(source.aiValuation);
  const notifications = asRecord(source.notifications);
  const documents = asRecord(source.documents);
  const legal = asRecord(source.legal);
  const fraud = asRecord(source.fraud);
  const reports = asRecord(source.reports);
  const homepageCopy = asRecord(branding.homepageCopy);

  const enabledAssetTypes: BusinessPolicy['cases']['enabledAssetTypes'] = {};
  const assetSource = asRecord(cases.enabledAssetTypes);
  const assetFallback = fallback.cases.enabledAssetTypes ?? {};

  const assetKeySet = new Set<string>(Object.keys(assetFallback));
  for (const rawKey of Object.keys(assetSource)) {
    const key = sanitizeAssetTypeKey(rawKey);
    if (key) assetKeySet.add(key);
  }

  for (const key of assetKeySet) {
    const config = asRecord(assetSource[key]);
    const defaultAsset = assetFallback[key] ?? {
      enabled: false,
      label: key.replace(/_/g, ' '),
      promptProfile: 'general_asset',
      requiredFields: [],
      requiresAiAnalysis: true,
      requiresMarketValue: true,
      requiresInspectionLocation: true,
    };

    enabledAssetTypes[key] = {
      enabled: booleanValue(config.enabled, defaultAsset.enabled),
      label: stringValue(config.label, defaultAsset.label ?? key),
      promptProfile: enumValue(config.promptProfile, ASSET_PROMPT_PROFILES, defaultAsset.promptProfile ?? 'general_asset'),
      requiredFields: stringArrayValue(config.requiredFields, defaultAsset.requiredFields ?? []),
      requiresAiAnalysis: booleanValue(config.requiresAiAnalysis, defaultAsset.requiresAiAnalysis),
      requiresMarketValue: booleanValue(config.requiresMarketValue, defaultAsset.requiresMarketValue),
      requiresInspectionLocation: booleanValue(config.requiresInspectionLocation, defaultAsset.requiresInspectionLocation),
    };
  }

  const insuranceClasses: BusinessPolicy['cases']['insuranceClasses'] = {};
  const classSource = asRecord(cases.insuranceClasses);
  const classFallback = fallback.cases.insuranceClasses ?? {};
  const classEntries = Object.keys(classSource).length > 0 ? Object.entries(classSource) : Object.entries(classFallback);

  for (const [rawKey, rawConfig] of classEntries) {
    const key = sanitizeInsuranceClassKey(rawKey);
    if (!key) continue;

    const config = asRecord(rawConfig);
    const defaultClass = classFallback[key] ?? {
      enabled: false,
      label: key,
      description: '',
      defaultAssetTypes: ['other'],
    };

    const defaultAssetTypes = stringArrayValue(config.defaultAssetTypes, defaultClass.defaultAssetTypes ?? ['other'])
      .map((assetType) => sanitizeAssetTypeKey(assetType))
      .filter((assetType): assetType is string => Boolean(assetType));

    insuranceClasses[key] = {
      enabled: booleanValue(config.enabled, defaultClass.enabled),
      label: stringValue(config.label, defaultClass.label ?? key),
      description: optionalStringValue(config.description, defaultClass.description),
      defaultAssetTypes: defaultAssetTypes.length > 0 ? defaultAssetTypes : ['other'],
    };
  }

  if (Object.values(insuranceClasses).every((config) => !config.enabled)) {
    insuranceClasses.other = {
      enabled: true,
      label: 'Other',
      description: 'Fallback insurance class.',
      defaultAssetTypes: ['other'],
    };
  }

  return {
    version: stringValue(source.version, fallback.version).trim(),
    updatedAt: stringValue(source.updatedAt, new Date().toISOString()),
    branding: {
      brandName: stringValue(branding.brandName, fallback.branding.brandName),
      legalName: stringValue(branding.legalName, fallback.branding.legalName),
      supportEmail: stringValue(branding.supportEmail, fallback.branding.supportEmail),
      supportPhone: optionalStringValue(branding.supportPhone, fallback.branding.supportPhone),
      primaryColor: stringValue(branding.primaryColor, fallback.branding.primaryColor),
      accentColor: stringValue(branding.accentColor, fallback.branding.accentColor),
      logoPath: stringValue(branding.logoPath, fallback.branding.logoPath),
      faviconPath: stringValue(branding.faviconPath, fallback.branding.faviconPath),
      homepageMode: enumValue(branding.homepageMode, HOMEPAGE_MODES, fallback.branding.homepageMode),
      homepageTemplate: enumValue(branding.homepageTemplate, HOMEPAGE_TEMPLATES, fallback.branding.homepageTemplate),
      homepageTheme: enumValue(branding.homepageTheme, HOMEPAGE_THEMES, fallback.branding.homepageTheme),
      splashEnabled: booleanValue(branding.splashEnabled, fallback.branding.splashEnabled),
      homepageCopy: {
        heroTitle: stringValue(homepageCopy.heroTitle, fallback.branding.homepageCopy.heroTitle),
        heroSubtitle: stringValue(homepageCopy.heroSubtitle, fallback.branding.homepageCopy.heroSubtitle),
        supportingText: stringValue(homepageCopy.supportingText, fallback.branding.homepageCopy.supportingText),
        primaryCtaLabel: stringValue(homepageCopy.primaryCtaLabel, fallback.branding.homepageCopy.primaryCtaLabel),
        secondaryCtaLabel: optionalStringValue(homepageCopy.secondaryCtaLabel, fallback.branding.homepageCopy.secondaryCtaLabel),
        eyebrow: optionalStringValue(homepageCopy.eyebrow, fallback.branding.homepageCopy.eyebrow),
        trustLine: optionalStringValue(homepageCopy.trustLine, fallback.branding.homepageCopy.trustLine),
        statOneLabel: optionalStringValue(homepageCopy.statOneLabel, fallback.branding.homepageCopy.statOneLabel),
        statOneValue: optionalStringValue(homepageCopy.statOneValue, fallback.branding.homepageCopy.statOneValue),
        statTwoLabel: optionalStringValue(homepageCopy.statTwoLabel, fallback.branding.homepageCopy.statTwoLabel),
        statTwoValue: optionalStringValue(homepageCopy.statTwoValue, fallback.branding.homepageCopy.statTwoValue),
        statThreeLabel: optionalStringValue(homepageCopy.statThreeLabel, fallback.branding.homepageCopy.statThreeLabel),
        statThreeValue: optionalStringValue(homepageCopy.statThreeValue, fallback.branding.homepageCopy.statThreeValue),
        authHeadline: optionalStringValue(homepageCopy.authHeadline, fallback.branding.homepageCopy.authHeadline),
        authSubtitle: optionalStringValue(homepageCopy.authSubtitle, fallback.branding.homepageCopy.authSubtitle),
        workflowTitle: optionalStringValue(homepageCopy.workflowTitle, fallback.branding.homepageCopy.workflowTitle),
        workflowSubtitle: optionalStringValue(homepageCopy.workflowSubtitle, fallback.branding.homepageCopy.workflowSubtitle),
        workflowStepOneTitle: optionalStringValue(homepageCopy.workflowStepOneTitle, fallback.branding.homepageCopy.workflowStepOneTitle),
        workflowStepOneBody: optionalStringValue(homepageCopy.workflowStepOneBody, fallback.branding.homepageCopy.workflowStepOneBody),
        workflowStepTwoTitle: optionalStringValue(homepageCopy.workflowStepTwoTitle, fallback.branding.homepageCopy.workflowStepTwoTitle),
        workflowStepTwoBody: optionalStringValue(homepageCopy.workflowStepTwoBody, fallback.branding.homepageCopy.workflowStepTwoBody),
        workflowStepThreeTitle: optionalStringValue(homepageCopy.workflowStepThreeTitle, fallback.branding.homepageCopy.workflowStepThreeTitle),
        workflowStepThreeBody: optionalStringValue(homepageCopy.workflowStepThreeBody, fallback.branding.homepageCopy.workflowStepThreeBody),
        workflowStepFourTitle: optionalStringValue(homepageCopy.workflowStepFourTitle, fallback.branding.homepageCopy.workflowStepFourTitle),
        workflowStepFourBody: optionalStringValue(homepageCopy.workflowStepFourBody, fallback.branding.homepageCopy.workflowStepFourBody),
        auctionSectionEyebrow: optionalStringValue(homepageCopy.auctionSectionEyebrow, fallback.branding.homepageCopy.auctionSectionEyebrow),
        auctionSectionTitle: optionalStringValue(homepageCopy.auctionSectionTitle, fallback.branding.homepageCopy.auctionSectionTitle),
        auctionSectionButtonLabel: optionalStringValue(homepageCopy.auctionSectionButtonLabel, fallback.branding.homepageCopy.auctionSectionButtonLabel),
        operationsSectionEyebrow: optionalStringValue(homepageCopy.operationsSectionEyebrow, fallback.branding.homepageCopy.operationsSectionEyebrow),
        operationsSectionTitle: optionalStringValue(homepageCopy.operationsSectionTitle, fallback.branding.homepageCopy.operationsSectionTitle),
        operationsSectionSubtitle: optionalStringValue(homepageCopy.operationsSectionSubtitle, fallback.branding.homepageCopy.operationsSectionSubtitle),
        operationsCardOneTitle: optionalStringValue(homepageCopy.operationsCardOneTitle, fallback.branding.homepageCopy.operationsCardOneTitle),
        operationsCardOneBody: optionalStringValue(homepageCopy.operationsCardOneBody, fallback.branding.homepageCopy.operationsCardOneBody),
        operationsCardTwoTitle: optionalStringValue(homepageCopy.operationsCardTwoTitle, fallback.branding.homepageCopy.operationsCardTwoTitle),
        operationsCardTwoBody: optionalStringValue(homepageCopy.operationsCardTwoBody, fallback.branding.homepageCopy.operationsCardTwoBody),
        operationsCardThreeTitle: optionalStringValue(homepageCopy.operationsCardThreeTitle, fallback.branding.homepageCopy.operationsCardThreeTitle),
        operationsCardThreeBody: optionalStringValue(homepageCopy.operationsCardThreeBody, fallback.branding.homepageCopy.operationsCardThreeBody),
        proofSectionTitle: optionalStringValue(homepageCopy.proofSectionTitle, fallback.branding.homepageCopy.proofSectionTitle),
        proofSectionSubtitle: optionalStringValue(homepageCopy.proofSectionSubtitle, fallback.branding.homepageCopy.proofSectionSubtitle),
        proofCardOneTitle: optionalStringValue(homepageCopy.proofCardOneTitle, fallback.branding.homepageCopy.proofCardOneTitle),
        proofCardOneBody: optionalStringValue(homepageCopy.proofCardOneBody, fallback.branding.homepageCopy.proofCardOneBody),
        proofCardTwoTitle: optionalStringValue(homepageCopy.proofCardTwoTitle, fallback.branding.homepageCopy.proofCardTwoTitle),
        proofCardTwoBody: optionalStringValue(homepageCopy.proofCardTwoBody, fallback.branding.homepageCopy.proofCardTwoBody),
        proofCardThreeTitle: optionalStringValue(homepageCopy.proofCardThreeTitle, fallback.branding.homepageCopy.proofCardThreeTitle),
        proofCardThreeBody: optionalStringValue(homepageCopy.proofCardThreeBody, fallback.branding.homepageCopy.proofCardThreeBody),
        proofCardFourTitle: optionalStringValue(homepageCopy.proofCardFourTitle, fallback.branding.homepageCopy.proofCardFourTitle),
        proofCardFourBody: optionalStringValue(homepageCopy.proofCardFourBody, fallback.branding.homepageCopy.proofCardFourBody),
        proofContactLabel: optionalStringValue(homepageCopy.proofContactLabel, fallback.branding.homepageCopy.proofContactLabel),
        recoveryBriefTitle: optionalStringValue(homepageCopy.recoveryBriefTitle, fallback.branding.homepageCopy.recoveryBriefTitle),
        recoveryBriefBody: optionalStringValue(homepageCopy.recoveryBriefBody, fallback.branding.homepageCopy.recoveryBriefBody),
        contactHeadline: optionalStringValue(homepageCopy.contactHeadline, fallback.branding.homepageCopy.contactHeadline),
        contactSubtitle: optionalStringValue(homepageCopy.contactSubtitle, fallback.branding.homepageCopy.contactSubtitle),
      },
    },
    auth: {
      emailPasswordEnabled: booleanValue(auth.emailPasswordEnabled, fallback.auth.emailPasswordEnabled),
      googleOAuthEnabled: booleanValue(auth.googleOAuthEnabled, fallback.auth.googleOAuthEnabled),
      businessEmailOnly: booleanValue(auth.businessEmailOnly, fallback.auth.businessEmailOnly),
      allowedEmailDomains: stringArrayValue(auth.allowedEmailDomains, fallback.auth.allowedEmailDomains),
      staffMfaRequired: booleanValue(auth.staffMfaRequired, fallback.auth.staffMfaRequired),
      vendorMfaRequired: booleanValue(auth.vendorMfaRequired, fallback.auth.vendorMfaRequired),
      userManagedMfaAllowed: booleanValue(auth.userManagedMfaAllowed, fallback.auth.userManagedMfaAllowed),
    },
    onboarding: {
      mode: enumValue(onboarding.mode, ONBOARDING_MODES, fallback.onboarding.mode),
      tier1BidLimit: numberValue(onboarding.tier1BidLimit, fallback.onboarding.tier1BidLimit),
      registrationFeeRequired: booleanValue(onboarding.registrationFeeRequired, fallback.onboarding.registrationFeeRequired),
      registrationFeeAmount: numberValue(onboarding.registrationFeeAmount, fallback.onboarding.registrationFeeAmount),
      registrationFeeDueDays: numberValue(onboarding.registrationFeeDueDays, fallback.onboarding.registrationFeeDueDays),
      allowBrowseBeforeKyc: booleanValue(onboarding.allowBrowseBeforeKyc, fallback.onboarding.allowBrowseBeforeKyc),
      allowBidAfterTier1: booleanValue(onboarding.allowBidAfterTier1, fallback.onboarding.allowBidAfterTier1),
      requireTier2ForUnlimitedBidding: booleanValue(onboarding.requireTier2ForUnlimitedBidding, fallback.onboarding.requireTier2ForUnlimitedBidding),
      finalTier2Decision: enumValue(onboarding.finalTier2Decision, TIER2_DECISIONS, fallback.onboarding.finalTier2Decision),
    },
    kyc: {
      provider: enumValue(kyc.provider, VERIFICATION_PROVIDERS, fallback.kyc.provider),
      tier1RequiresBvn: booleanValue(kyc.tier1RequiresBvn, fallback.kyc.tier1RequiresBvn),
      tier2RequiresBusinessData: booleanValue(kyc.tier2RequiresBusinessData, fallback.kyc.tier2RequiresBusinessData),
      tier2RequiresGovernmentId: booleanValue(kyc.tier2RequiresGovernmentId, fallback.kyc.tier2RequiresGovernmentId),
      tier2RequiresLiveness: booleanValue(kyc.tier2RequiresLiveness, fallback.kyc.tier2RequiresLiveness),
      tier2RequiresAddress: booleanValue(kyc.tier2RequiresAddress, fallback.kyc.tier2RequiresAddress),
      tier2RequiresAmlScreening: booleanValue(kyc.tier2RequiresAmlScreening, fallback.kyc.tier2RequiresAmlScreening),
      tier2RequiresDuplicateIdentityCheck: booleanValue(kyc.tier2RequiresDuplicateIdentityCheck, fallback.kyc.tier2RequiresDuplicateIdentityCheck),
      providerPassRequiresInternalReview: booleanValue(kyc.providerPassRequiresInternalReview, fallback.kyc.providerPassRequiresInternalReview),
    },
    payments: {
      defaultProvider: enumValue(payments.defaultProvider, PAYMENT_PROVIDERS, fallback.payments.defaultProvider),
      registrationFeeProvider: enumValue(payments.registrationFeeProvider, PAYMENT_PROVIDERS, fallback.payments.registrationFeeProvider),
      auctionPaymentProvider: enumValue(payments.auctionPaymentProvider, PAYMENT_PROVIDERS, fallback.payments.auctionPaymentProvider),
      walletEnabled: booleanValue(payments.walletEnabled, fallback.payments.walletEnabled),
      paystackEnabled: booleanValue(payments.paystackEnabled, fallback.payments.paystackEnabled),
      flutterwaveEnabled: booleanValue(payments.flutterwaveEnabled, fallback.payments.flutterwaveEnabled),
      hybridPaymentEnabled: booleanValue(payments.hybridPaymentEnabled, fallback.payments.hybridPaymentEnabled),
      manualPaymentEnabled: booleanValue(payments.manualPaymentEnabled, fallback.payments.manualPaymentEnabled),
      paymentDeadlineAfterSigningHours: numberValue(payments.paymentDeadlineAfterSigningHours, fallback.payments.paymentDeadlineAfterSigningHours),
    },
    escrow: {
      depositSystemEnabled: booleanValue(escrow.depositSystemEnabled, fallback.escrow.depositSystemEnabled),
      depositRatePercent: numberValue(escrow.depositRatePercent, fallback.escrow.depositRatePercent),
      minimumDepositFloor: numberValue(escrow.minimumDepositFloor, fallback.escrow.minimumDepositFloor),
      topBiddersToKeepFrozen: numberValue(escrow.topBiddersToKeepFrozen, fallback.escrow.topBiddersToKeepFrozen),
      forfeiturePercentage: numberValue(escrow.forfeiturePercentage, fallback.escrow.forfeiturePercentage),
    },
    auctions: {
      minimumBidIncrement: numberValue(auctions.minimumBidIncrement, fallback.auctions.minimumBidIncrement),
      documentValidityHours: numberValue(auctions.documentValidityHours, fallback.auctions.documentValidityHours),
      maxGraceExtensions: numberValue(auctions.maxGraceExtensions, fallback.auctions.maxGraceExtensions),
      graceExtensionDurationHours: numberValue(auctions.graceExtensionDurationHours, fallback.auctions.graceExtensionDurationHours),
      fallbackBufferHours: numberValue(auctions.fallbackBufferHours, fallback.auctions.fallbackBufferHours),
      reserveValueStrategy: enumValue(auctions.reserveValueStrategy, RESERVE_STRATEGIES, fallback.auctions.reserveValueStrategy),
      reserveValuePercentage: numberValue(auctions.reserveValuePercentage, fallback.auctions.reserveValuePercentage),
      socketMode: enumValue(auctions.socketMode, SOCKET_MODES, fallback.auctions.socketMode),
    },
    cases: {
      enabledAssetTypes,
      insuranceClasses,
      voiceNotesEnabled: booleanValue(cases.voiceNotesEnabled, fallback.cases.voiceNotesEnabled),
      claimsAdjusterTranscriptEditable: booleanValue(cases.claimsAdjusterTranscriptEditable, fallback.cases.claimsAdjusterTranscriptEditable),
      salvageManagerTranscriptReviewRequired: booleanValue(cases.salvageManagerTranscriptReviewRequired, fallback.cases.salvageManagerTranscriptReviewRequired),
    },
    aiValuation: {
      enabled: booleanValue(aiValuation.enabled, fallback.aiValuation.enabled),
      providerPriority: enumArrayValue(aiValuation.providerPriority, AI_PROVIDERS, fallback.aiValuation.providerPriority),
      marketSearchEnabled: booleanValue(aiValuation.marketSearchEnabled, fallback.aiValuation.marketSearchEnabled),
      repairVsReplaceEnabled: booleanValue(aiValuation.repairVsReplaceEnabled, fallback.aiValuation.repairVsReplaceEnabled),
      showDamageCostBreakdownToVendors: booleanValue(aiValuation.showDamageCostBreakdownToVendors, fallback.aiValuation.showDamageCostBreakdownToVendors),
      lowConfidenceRequiresManualReview: booleanValue(aiValuation.lowConfidenceRequiresManualReview, fallback.aiValuation.lowConfidenceRequiresManualReview),
      minimumOverallConfidence: boundedNumberValue(aiValuation.minimumOverallConfidence, fallback.aiValuation.minimumOverallConfidence, 0, 100),
      minimumMarketConfidence: boundedNumberValue(aiValuation.minimumMarketConfidence, fallback.aiValuation.minimumMarketConfidence, 0, 100),
      minimumDamageConfidence: boundedNumberValue(aiValuation.minimumDamageConfidence, fallback.aiValuation.minimumDamageConfidence, 0, 100),
      minimumMarketSourceCount: Math.round(boundedNumberValue(aiValuation.minimumMarketSourceCount, fallback.aiValuation.minimumMarketSourceCount, 1, 20)),
      sourceDiversityRequired: booleanValue(aiValuation.sourceDiversityRequired, fallback.aiValuation.sourceDiversityRequired),
      maxAllowedPriceSpreadPercent: boundedNumberValue(aiValuation.maxAllowedPriceSpreadPercent, fallback.aiValuation.maxAllowedPriceSpreadPercent, 0, 300),
      reservePriceRatio: boundedNumberValue(aiValuation.reservePriceRatio, fallback.aiValuation.reservePriceRatio, 0.05, 0.95),
      totalLossSalvageCapRatio: boundedNumberValue(aiValuation.totalLossSalvageCapRatio, fallback.aiValuation.totalLossSalvageCapRatio, 0.05, 0.95),
      exchangeRates: exchangeRatesValue(aiValuation.exchangeRates, fallback.aiValuation.exchangeRates),
      repairCostMultipliers: repairCostMultipliersValue(aiValuation.repairCostMultipliers, fallback.aiValuation.repairCostMultipliers),
      pricePlausibility: pricePlausibilityValue(aiValuation.pricePlausibility, fallback.aiValuation.pricePlausibility),
      photoRequirements: photoRequirementsValue(aiValuation.photoRequirements, fallback.aiValuation.photoRequirements),
    },
    notifications: {
      emailEnabled: booleanValue(notifications.emailEnabled, fallback.notifications.emailEnabled),
      smsEnabled: booleanValue(notifications.smsEnabled, fallback.notifications.smsEnabled),
      pushEnabled: booleanValue(notifications.pushEnabled, fallback.notifications.pushEnabled),
      smsCategories: stringArrayValue(notifications.smsCategories, fallback.notifications.smsCategories),
      roleFanoutShouldBeQueued: booleanValue(notifications.roleFanoutShouldBeQueued, fallback.notifications.roleFanoutShouldBeQueued),
    },
    documents: {
      requiredAuctionDocuments: enumArrayValue(documents.requiredAuctionDocuments, DOCUMENT_TYPES, fallback.documents.requiredAuctionDocuments),
      attachPaymentReceiptToAuctionDocuments: booleanValue(documents.attachPaymentReceiptToAuctionDocuments, fallback.documents.attachPaymentReceiptToAuctionDocuments),
      useBrandLetterhead: booleanValue(documents.useBrandLetterhead, fallback.documents.useBrandLetterhead),
      authorizedSignerName: optionalStringValue(documents.authorizedSignerName, fallback.documents.authorizedSignerName),
      authorizedSignerTitle: optionalStringValue(documents.authorizedSignerTitle, fallback.documents.authorizedSignerTitle),
      authorizedSignatureUrl: optionalStringValue(documents.authorizedSignatureUrl, fallback.documents.authorizedSignatureUrl),
      billOfSaleDisclaimerTitle: stringValue(documents.billOfSaleDisclaimerTitle, fallback.documents.billOfSaleDisclaimerTitle),
      billOfSaleDisclaimerBody: stringValue(documents.billOfSaleDisclaimerBody, fallback.documents.billOfSaleDisclaimerBody),
      liabilityWaiverClauses: documentClauseArrayValue(documents.liabilityWaiverClauses, fallback.documents.liabilityWaiverClauses),
    },
    legal: {
      registrationNumber: stringValue(legal.registrationNumber, fallback.legal.registrationNumber),
      addressLine1: stringValue(legal.addressLine1, fallback.legal.addressLine1),
      addressLine2: stringValue(legal.addressLine2, fallback.legal.addressLine2),
      privacyEmail: stringValue(legal.privacyEmail, fallback.legal.privacyEmail),
      dpoEmail: stringValue(legal.dpoEmail, fallback.legal.dpoEmail),
      legalEmail: stringValue(legal.legalEmail, fallback.legal.legalEmail),
      legalLastUpdated: stringValue(legal.legalLastUpdated, fallback.legal.legalLastUpdated),
    },
    fraud: {
      dojahRiskAlertsEnabled: booleanValue(fraud.dojahRiskAlertsEnabled, fallback.fraud.dojahRiskAlertsEnabled),
      ipFraudDetectionEnabled: booleanValue(fraud.ipFraudDetectionEnabled, fallback.fraud.ipFraudDetectionEnabled),
      biddingFraudDetectionEnabled: booleanValue(fraud.biddingFraudDetectionEnabled, fallback.fraud.biddingFraudDetectionEnabled),
      highRiskRequiresManualReview: booleanValue(fraud.highRiskRequiresManualReview, fallback.fraud.highRiskRequiresManualReview),
      vendorInactivityAlertsEnabled: booleanValue(fraud.vendorInactivityAlertsEnabled, fallback.fraud.vendorInactivityAlertsEnabled),
      vendorInactivityDays: Math.round(boundedNumberValue(fraud.vendorInactivityDays, fallback.fraud.vendorInactivityDays, 7, 730)),
      vendorInactivityCooldownDays: Math.round(boundedNumberValue(fraud.vendorInactivityCooldownDays, fallback.fraud.vendorInactivityCooldownDays, 1, 365)),
    },
    reports: {
      defaultDateRange: enumValue(reports.defaultDateRange, REPORT_DATE_RANGES, fallback.reports.defaultDateRange),
      excludeMarkedTestDataByDefault: booleanValue(reports.excludeMarkedTestDataByDefault, fallback.reports.excludeMarkedTestDataByDefault),
      requireConsistentMetricDefinitions: booleanValue(reports.requireConsistentMetricDefinitions, fallback.reports.requireConsistentMetricDefinitions),
    },
  };
}
