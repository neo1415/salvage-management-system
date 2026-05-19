import type { VerificationRiskLevel, VerificationStatus } from '@/lib/db/schema/provider-verifications';

export type ProviderName = 'dojah' | 'paystack';

export type ProviderVerificationType =
  | 'tier1'
  | 'tier2'
  | 'bvn'
  | 'nin'
  | 'business'
  | 'liveness'
  | 'aml'
  | 'fraud'
  | 'address'
  | 'document';

export interface NormalizedVerificationResult {
  provider: ProviderName;
  providerReference?: string;
  workflowReference?: string;
  verificationType: ProviderVerificationType;
  status: VerificationStatus;
  riskLevel: VerificationRiskLevel;
  checksCompleted: string[];
  pendingChecks: string[];
  failedChecks: string[];
  reasonCodes: string[];
  displayMessage: string;
  normalizedResult: Record<string, unknown>;
}
