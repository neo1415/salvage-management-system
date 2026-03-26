export type KYCVerificationStatus =
  | 'not_started'
  | 'in_progress'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'expired';

export type AMLRiskLevel = 'Low' | 'Medium' | 'High';

export interface KYCStatus {
  status: KYCVerificationStatus;
  tier: 'tier1_bvn' | 'tier2_full';
  submittedAt?: Date;
  approvedAt?: Date;
  expiresAt?: Date;
  rejectionReason?: string;
  amlRiskLevel?: AMLRiskLevel;
  fraudRiskScore?: number;
  dojahReferenceId?: string;
  steps: {
    nin: boolean;
    liveness: boolean;
    biometric: boolean;
    document: boolean;
    aml: boolean;
  };
}

export interface KYCVerificationData {
  dojahReferenceId: string;
  // NIN
  ninEncrypted?: string;
  ninVerificationData?: Record<string, unknown>;
  ninVerifiedAt?: Date;
  // Photo ID
  photoIdUrl?: string;
  photoIdType?: string;
  photoIdVerifiedAt?: Date;
  // Biometrics
  selfieUrl?: string;
  livenessScore?: number;
  biometricMatchScore?: number;
  biometricVerifiedAt?: Date;
  // Address
  addressProofUrl?: string;
  addressVerifiedAt?: Date;
  // AML
  amlScreeningData?: Record<string, unknown>;
  amlRiskLevel?: AMLRiskLevel;
  amlScreenedAt?: Date;
  // Fraud
  fraudRiskScore?: number;
  fraudFlags?: FraudFlag[];
  // Workflow
  tier2SubmittedAt?: Date;
}

export interface ManagerDecision {
  decision: 'approve' | 'reject';
  managerId: string;
  reason?: string;
  decidedAt: Date;
}

export interface VerificationCost {
  verificationType: string;
  costAmount: string;
  currency: string;
  dojahReferenceId?: string;
}

export interface PendingApproval {
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  submittedAt: Date;
  amlRiskLevel?: AMLRiskLevel;
  fraudRiskScore?: number;
  flaggedReasons: string[];
  // Verification data for review
  selfieUrl?: string;
  photoIdUrl?: string;
  photoIdType?: string;
  addressProofUrl?: string;
  ninVerificationData?: Record<string, unknown>;
  livenessScore?: number;
  biometricMatchScore?: number;
  amlScreeningData?: Record<string, unknown>;
}

export interface FraudFlag {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  detectedAt: Date;
}

export interface FraudSignals {
  livenessScore?: number;
  biometricMatchScore?: number;
  amlRiskLevel?: AMLRiskLevel;
  completionTimeSeconds?: number;
  ipAddress?: string;
  duplicateNIN?: boolean;
  documentTampered?: boolean;
}
