export type OnboardingMode =
  | 'tiered_bvn_fee_tier2'
  | 'full_kyc_before_bidding'
  | 'fee_before_tier1'
  | 'single_full_kyc'
  | 'no_registration_fee';

export type PaymentProvider = 'paystack' | 'flutterwave' | 'manual';

export type VerificationProvider = 'dojah';

export type AiProvider = 'gemini' | 'claude' | 'serper';

export type AssetTypePolicy = {
  enabled: boolean;
  label: string;
  promptProfile: 'vehicle' | 'electronics' | 'property' | 'jewelry' | 'machinery' | 'general_asset';
  requiredFields: string[];
  requiresAiAnalysis: boolean;
  requiresMarketValue: boolean;
  requiresInspectionLocation: boolean;
};

export type InsuranceClassPolicy = {
  enabled: boolean;
  label: string;
  description?: string;
  defaultAssetTypes: string[];
};

export type BrandingPolicy = {
  brandName: string;
  legalName: string;
  supportEmail: string;
  supportPhone?: string;
  primaryColor: string;
  accentColor: string;
  logoPath: string;
  faviconPath: string;
  homepageMode: 'landing' | 'login_first';
  homepageTemplate:
    | 'reclaim_editorial'
    | 'nem_salvage'
    | 'recovery_command'
    | 'auction_pulse'
    | 'claims_orbit'
    | 'executive_terminal'
    // Backward-compatible aliases for already-saved draft policies.
    | 'salvage_showcase'
    | 'minimal_private'
    | 'auction_marketplace';
  homepageTheme: 'day' | 'night' | 'auto';
  splashEnabled: boolean;
  homepageCopy: {
    heroTitle: string;
    heroSubtitle: string;
    supportingText: string;
    primaryCtaLabel: string;
    secondaryCtaLabel?: string;
    eyebrow?: string;
    trustLine?: string;
    statOneLabel?: string;
    statOneValue?: string;
    statTwoLabel?: string;
    statTwoValue?: string;
    statThreeLabel?: string;
    statThreeValue?: string;
    authHeadline?: string;
    authSubtitle?: string;
    workflowTitle?: string;
    workflowSubtitle?: string;
    workflowStepOneTitle?: string;
    workflowStepOneBody?: string;
    workflowStepTwoTitle?: string;
    workflowStepTwoBody?: string;
    workflowStepThreeTitle?: string;
    workflowStepThreeBody?: string;
    workflowStepFourTitle?: string;
    workflowStepFourBody?: string;
    auctionSectionEyebrow?: string;
    auctionSectionTitle?: string;
    auctionSectionButtonLabel?: string;
    operationsSectionEyebrow?: string;
    operationsSectionTitle?: string;
    operationsSectionSubtitle?: string;
    operationsCardOneTitle?: string;
    operationsCardOneBody?: string;
    operationsCardTwoTitle?: string;
    operationsCardTwoBody?: string;
    operationsCardThreeTitle?: string;
    operationsCardThreeBody?: string;
    proofSectionTitle?: string;
    proofSectionSubtitle?: string;
    proofCardOneTitle?: string;
    proofCardOneBody?: string;
    proofCardTwoTitle?: string;
    proofCardTwoBody?: string;
    proofCardThreeTitle?: string;
    proofCardThreeBody?: string;
    proofCardFourTitle?: string;
    proofCardFourBody?: string;
    proofContactLabel?: string;
    recoveryBriefTitle?: string;
    recoveryBriefBody?: string;
    contactHeadline?: string;
    contactSubtitle?: string;
  };
};

export type AuthPolicy = {
  emailPasswordEnabled: boolean;
  googleOAuthEnabled: boolean;
  businessEmailOnly: boolean;
  allowedEmailDomains: string[];
  staffMfaRequired: boolean;
  vendorMfaRequired: boolean;
  userManagedMfaAllowed: boolean;
};

export type VendorOnboardingPolicy = {
  mode: OnboardingMode;
  tier1BidLimit: number;
  registrationFeeRequired: boolean;
  registrationFeeAmount: number;
  registrationFeeDueDays: number;
  allowBrowseBeforeKyc: boolean;
  allowBidAfterTier1: boolean;
  requireTier2ForUnlimitedBidding: boolean;
  finalTier2Decision: 'manual_review';
};

export type KycPolicy = {
  provider: VerificationProvider;
  tier1RequiresBvn: boolean;
  tier2RequiresBusinessData: boolean;
  tier2RequiresGovernmentId: boolean;
  tier2RequiresLiveness: boolean;
  tier2RequiresAddress: boolean;
  tier2RequiresAmlScreening: boolean;
  tier2RequiresDuplicateIdentityCheck: boolean;
  providerPassRequiresInternalReview: boolean;
};

export type PaymentPolicy = {
  defaultProvider: PaymentProvider;
  registrationFeeProvider: PaymentProvider;
  auctionPaymentProvider: PaymentProvider;
  walletEnabled: boolean;
  paystackEnabled: boolean;
  flutterwaveEnabled: boolean;
  hybridPaymentEnabled: boolean;
  manualPaymentEnabled: boolean;
  paymentDeadlineAfterSigningHours: number;
};

export type EscrowPolicy = {
  depositSystemEnabled: boolean;
  depositRatePercent: number;
  minimumDepositFloor: number;
  topBiddersToKeepFrozen: number;
  forfeiturePercentage: number;
};

export type AuctionPolicy = {
  minimumBidIncrement: number;
  documentValidityHours: number;
  maxGraceExtensions: number;
  graceExtensionDurationHours: number;
  fallbackBufferHours: number;
  reserveValueStrategy: 'percentage_of_salvage_value';
  reserveValuePercentage: number;
  socketMode: 'polling_primary_socket_secondary' | 'socket_primary_polling_fallback';
};

export type CasePolicy = {
  enabledAssetTypes: Record<string, AssetTypePolicy>;
  insuranceClasses: Record<string, InsuranceClassPolicy>;
  voiceNotesEnabled: boolean;
  claimsAdjusterTranscriptEditable: boolean;
  salvageManagerTranscriptReviewRequired: boolean;
};

export type AiValuationPolicy = {
  enabled: boolean;
  providerPriority: AiProvider[];
  marketSearchEnabled: boolean;
  repairVsReplaceEnabled: boolean;
  showDamageCostBreakdownToVendors: boolean;
  lowConfidenceRequiresManualReview: boolean;
  minimumOverallConfidence: number;
  minimumMarketConfidence: number;
  minimumDamageConfidence: number;
  minimumMarketSourceCount: number;
  sourceDiversityRequired: boolean;
  maxAllowedPriceSpreadPercent: number;
  reservePriceRatio: number;
  totalLossSalvageCapRatio: number;
  exchangeRates: {
    USD: number;
    GBP: number;
    EUR: number;
  };
  repairCostMultipliers: {
    laborPercent: number;
    paintAndMaterialsPercent: number;
    logisticsPercent: number;
    severeDamageMultiplier: number;
    moderateDamageMultiplier: number;
  };
  pricePlausibility: {
    marketMinimums: Record<string, number>;
    partMinimums: Record<string, number>;
    partMaximums: Record<string, number>;
  };
  photoRequirements: Record<string, {
    minimumPhotos: number;
    recommendedPhotos: number;
    requiredAngles: string[];
  }>;
};

export type NotificationPolicy = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  smsCategories: string[];
  roleFanoutShouldBeQueued: boolean;
};

export type DocumentPolicy = {
  requiredAuctionDocuments: Array<'bill_of_sale' | 'liability_waiver'>;
  attachPaymentReceiptToAuctionDocuments: boolean;
  useBrandLetterhead: boolean;
  authorizedSignerName?: string;
  authorizedSignerTitle?: string;
  authorizedSignatureUrl?: string;
  billOfSaleDisclaimerTitle: string;
  billOfSaleDisclaimerBody: string;
  liabilityWaiverClauses: Array<{
    title: string;
    body: string;
  }>;
};

export type LegalPolicy = {
  registrationNumber: string;
  addressLine1: string;
  addressLine2: string;
  privacyEmail: string;
  dpoEmail: string;
  legalEmail: string;
  legalLastUpdated: string;
};

export type FraudPolicy = {
  dojahRiskAlertsEnabled: boolean;
  ipFraudDetectionEnabled: boolean;
  biddingFraudDetectionEnabled: boolean;
  highRiskRequiresManualReview: boolean;
  vendorInactivityAlertsEnabled: boolean;
  vendorInactivityDays: number;
  vendorInactivityCooldownDays: number;
};

export type ReportPolicy = {
  defaultDateRange: 'all_time' | 'last_30_days' | 'last_90_days';
  excludeMarkedTestDataByDefault: boolean;
  requireConsistentMetricDefinitions: boolean;
};

export type PolicyDecisionType =
  | 'vendor_bid_allowed'
  | 'vendor_bid_denied'
  | 'vendor_bid_limit_resolved'
  | 'vendor_bvn_gate_resolved'
  | 'auth_provider_allowed'
  | 'auth_provider_denied'
  | 'auth_email_domain_allowed'
  | 'auth_email_domain_denied'
  | 'registration_fee_payment_resolved'
  | 'payment_method_allowed'
  | 'payment_method_denied'
  | 'tier2_access_resolved'
  | 'tier2_review_requirement_resolved'
  | 'deposit_amount_required'
  | 'auction_close_behavior_selected'
  | 'document_deadline_resolved'
  | 'payment_deadline_resolved'
  | 'fallback_buffer_resolved'
  | 'grace_extension_limit_resolved'
  | 'grace_extension_duration_resolved'
  | 'forfeiture_percentage_resolved'
  | 'kyc_approval_requirement_resolved'
  | 'fraud_risk_gate_applied'
  | 'reserve_price_rule_applied'
  | 'case_asset_type_allowed'
  | 'case_asset_type_denied';

export type PolicyDecisionRecord = {
  policyVersion: string;
  decisionType: PolicyDecisionType;
  rulePath: string;
  outcome: 'allow' | 'deny' | 'require_review' | 'value_resolved' | 'not_applicable';
  entityType: 'vendor' | 'auction' | 'case' | 'payment' | 'document' | 'kyc' | 'fraud_alert';
  entityId?: string;
  reason: string;
  inputs?: Record<string, string | number | boolean | null>;
  resolvedValue?: string | number | boolean | null;
  createdAt: string;
};

export type PolicyValidationIssue = {
  path: string;
  severity: 'error' | 'warning';
  message: string;
};

export type PolicyValidationResult = {
  valid: boolean;
  issues: PolicyValidationIssue[];
};

export type VendorPolicySnapshot = {
  role: string;
  tier: 'tier0' | 'tier1_bvn' | 'tier2_full';
  bvnVerified: boolean;
  registrationFeePaid: boolean;
  tier2Status?: 'not_started' | 'in_progress' | 'pending_review' | 'approved' | 'rejected' | 'expired';
};

export type PolicyDecision<TValue = unknown> = {
  allowed: boolean;
  value?: TValue;
  message: string;
  decision: PolicyDecisionRecord;
};

export type BusinessPolicy = {
  version: string;
  updatedAt: string;
  branding: BrandingPolicy;
  auth: AuthPolicy;
  onboarding: VendorOnboardingPolicy;
  kyc: KycPolicy;
  payments: PaymentPolicy;
  escrow: EscrowPolicy;
  auctions: AuctionPolicy;
  cases: CasePolicy;
  aiValuation: AiValuationPolicy;
  notifications: NotificationPolicy;
  documents: DocumentPolicy;
  legal: LegalPolicy;
  fraud: FraudPolicy;
  reports: ReportPolicy;
};

export type PrivateBusinessPolicy = BusinessPolicy;

export type PublicBusinessPolicy = Pick<BusinessPolicy, 'version' | 'branding'> & {
  auth: Pick<AuthPolicy, 'emailPasswordEnabled' | 'googleOAuthEnabled' | 'businessEmailOnly'>;
  onboarding: Pick<
    VendorOnboardingPolicy,
    | 'mode'
    | 'tier1BidLimit'
    | 'registrationFeeRequired'
    | 'registrationFeeAmount'
    | 'allowBrowseBeforeKyc'
    | 'allowBidAfterTier1'
    | 'requireTier2ForUnlimitedBidding'
  >;
  payments: Pick<
    PaymentPolicy,
    | 'walletEnabled'
    | 'paystackEnabled'
    | 'flutterwaveEnabled'
    | 'hybridPaymentEnabled'
    | 'manualPaymentEnabled'
    | 'paymentDeadlineAfterSigningHours'
  >;
  auctions: Pick<AuctionPolicy, 'minimumBidIncrement'>;
  cases: Pick<CasePolicy, 'enabledAssetTypes' | 'insuranceClasses' | 'voiceNotesEnabled'>;
  documents: Pick<DocumentPolicy, 'requiredAuctionDocuments'>;
};
