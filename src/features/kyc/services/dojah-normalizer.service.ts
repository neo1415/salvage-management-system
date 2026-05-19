import type { DojahAMLResult, DojahBVNValidationResult, DojahVerificationResult } from '../schemas/dojah.schemas';
import type { NormalizedVerificationResult } from '../types/provider-verification.types';

function riskFromScore(score: number): NormalizedVerificationResult['riskLevel'] {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function hasAmlHit(aml?: DojahAMLResult | null): boolean {
  const entity = aml?.entity;
  return Boolean(
    (entity?.sanctions?.length ?? 0) > 0 ||
      (entity?.pep?.length ?? 0) > 0 ||
      (entity?.adverse_media?.length ?? 0) > 0
  );
}

export function normalizeDojahBVNResult(
  result: DojahBVNValidationResult,
  providerReference: string
): NormalizedVerificationResult {
  const entity = result.entity;
  const bvnPassed = entity?.bvn?.status === true;
  const firstNamePassed = entity?.first_name?.status !== false;
  const lastNamePassed = entity?.last_name?.status !== false;
  const dobPassed = entity?.dob?.status !== false;
  const failedChecks: string[] = [];

  if (!bvnPassed) failedChecks.push('bvn_validity');
  if (!firstNamePassed) failedChecks.push('first_name_match');
  if (!lastNamePassed) failedChecks.push('last_name_match');
  if (!dobPassed) failedChecks.push('date_of_birth_match');

  const passed = bvnPassed && firstNamePassed && lastNamePassed && dobPassed;

  return {
    provider: 'dojah',
    providerReference,
    verificationType: 'bvn',
    status: passed ? 'passed' : 'failed',
    riskLevel: passed ? 'low' : 'high',
    checksCompleted: ['bvn_validity', 'first_name_match', 'last_name_match', 'date_of_birth_match'],
    pendingChecks: [],
    failedChecks,
    reasonCodes: failedChecks.length ? failedChecks.map((check) => `dojah_${check}_failed`) : [],
    displayMessage: passed
      ? 'BVN matched the vendor registration details.'
      : 'BVN details did not fully match the vendor registration details.',
    normalizedResult: {
      bvnStatus: entity?.bvn?.status ?? null,
      firstNameConfidence: entity?.first_name?.confidence_value ?? null,
      lastNameConfidence: entity?.last_name?.confidence_value ?? null,
      firstNameStatus: entity?.first_name?.status ?? null,
      lastNameStatus: entity?.last_name?.status ?? null,
      dobStatus: entity?.dob?.status ?? null,
    },
  };
}

export function normalizeDojahWorkflowResult(
  result: DojahVerificationResult,
  amlResult?: DojahAMLResult | null
): NormalizedVerificationResult {
  const completed = new Set<string>();
  const failed = new Set<string>();
  const pending = new Set<string>();
  const reasonCodes = new Set<string>();

  const providerReference = result.reference_id ?? undefined;
  const statusText = (result.verification_status ?? '').toLowerCase();
  const livenessScore = result.data?.selfie?.data?.liveness_score ?? undefined;
  const biometricMatchScore = result.data?.selfie?.data?.match_score ?? undefined;
  const idStatus = result.data?.id?.status;
  const governmentStatus = result.data?.government_data?.status;
  const userDataStatus = result.data?.user_data?.status;
  const phoneStatus = result.data?.phone_number?.status;
  const businessId = result.data?.business_id;
  const businessData = result.data?.business_data;
  const addressData = result.data?.address;
  const amlStatus = amlResult ? !hasAmlHit(amlResult) : result.aml?.status;
  const ipInfo = result.metadata?.ipinfo as Record<string, unknown> | undefined;
  const deviceInfo = result.metadata?.device_info;
  const ipRisky = Boolean(ipInfo?.proxy || ipInfo?.hosting);

  if (idStatus === true) completed.add('government_id');
  if (idStatus === false) {
    failed.add('government_id');
    reasonCodes.add('dojah_government_id_failed');
  }

  if (governmentStatus === true) completed.add('government_data');
  if (governmentStatus === false) {
    failed.add('government_data');
    reasonCodes.add('dojah_government_data_mismatch');
  }

  if (userDataStatus === true) completed.add('user_data_consistency');
  if (userDataStatus === false) {
    failed.add('user_data_consistency');
    reasonCodes.add('dojah_user_data_inconsistent');
  }

  if (phoneStatus === true) completed.add('phone_consistency');
  if (phoneStatus === false) {
    failed.add('phone_consistency');
    reasonCodes.add('dojah_phone_mismatch');
  }

  if (businessId?.business_number || businessId?.business_name) completed.add('business_id');
  if (businessData?.business_number || businessData?.business_name) completed.add('business_data');
  if (businessId && !businessId.business_number && !businessId.business_name) {
    failed.add('business_id');
    reasonCodes.add('dojah_business_id_incomplete');
  }
  if (businessData && !businessData.business_number && !businessData.business_name) {
    pending.add('business_data');
    reasonCodes.add('dojah_business_data_pending');
  }

  if (addressData) {
    const addressStatus = String(addressData.status ?? '').toLowerCase();
    if (addressStatus.includes('failed')) {
      failed.add('digital_address');
      reasonCodes.add('dojah_address_failed');
    } else if (addressStatus.includes('pending')) {
      pending.add('digital_address');
    } else {
      completed.add('digital_address');
    }
  }

  if (typeof livenessScore === 'number') {
    completed.add('liveness');
    if (livenessScore < 50) {
      failed.add('liveness');
      reasonCodes.add('dojah_liveness_failed');
    }
  } else {
    pending.add('liveness');
  }

  if (typeof biometricMatchScore === 'number') {
    completed.add('face_match');
    if (biometricMatchScore < 80) {
      failed.add('face_match');
      reasonCodes.add('dojah_face_match_low');
    }
  } else {
    pending.add('face_match');
  }

  if (amlResult || result.aml) {
    completed.add('aml_screening');
    if (amlStatus === false || hasAmlHit(amlResult)) {
      failed.add('aml_screening');
      reasonCodes.add('dojah_aml_flagged');
    }
  } else {
    pending.add('aml_screening');
  }

  if (ipInfo) completed.add('ip_device_screening');
  if (ipRisky) {
    failed.add('ip_device_screening');
    reasonCodes.add('dojah_ip_device_flagged');
  }
  if (deviceInfo) completed.add('device_fingerprint');

  if (statusText.includes('fail') || statusText.includes('reject')) {
    reasonCodes.add('dojah_workflow_failed');
  }
  if (statusText.includes('pending') || statusText.includes('review')) {
    pending.add('manual_review');
  }

  let riskScore = 0;
  if (failed.has('aml_screening')) riskScore += 40;
  if (failed.has('liveness')) riskScore += 25;
  if (failed.has('face_match')) riskScore += 25;
  if (failed.has('government_data')) riskScore += 20;
  if (failed.has('government_id')) riskScore += 20;
  if (failed.has('business_id')) riskScore += 20;
  if (failed.has('digital_address')) riskScore += 15;
  if (failed.has('ip_device_screening')) riskScore += 15;
  if (failed.has('user_data_consistency')) riskScore += 15;

  const failedChecks = [...failed];
  const status: NormalizedVerificationResult['status'] =
    failedChecks.length > 0
      ? 'review_required'
      : statusText.includes('pass') || statusText.includes('success') || result.status
        ? 'review_required'
        : 'pending';

  return {
    provider: 'dojah',
    providerReference,
    workflowReference: providerReference,
    verificationType: 'tier2',
    status,
    riskLevel: riskFromScore(riskScore),
    checksCompleted: [...completed],
    pendingChecks: [...pending],
    failedChecks,
    reasonCodes: [...reasonCodes],
    displayMessage:
      status === 'review_required'
        ? 'Dojah verification evidence is ready for internal review.'
        : 'Dojah verification is still pending.',
    normalizedResult: {
      verificationStatus: result.verification_status ?? null,
      verificationMode: result.verification_mode ?? null,
      verificationType: result.verification_type ?? null,
      livenessScore: livenessScore ?? null,
      biometricMatchScore: biometricMatchScore ?? null,
      idStatus: idStatus ?? null,
      governmentStatus: governmentStatus ?? null,
      userDataStatus: userDataStatus ?? null,
      phoneStatus: phoneStatus ?? null,
      businessId: businessId
        ? {
            businessName: businessId.business_name ?? null,
            businessType: businessId.business_type ?? null,
            businessNumber: businessId.business_number ?? null,
            businessAddress: businessId.business_address ?? null,
            registrationDate: businessId.registration_date ?? null,
          }
        : null,
      businessData: businessData
        ? {
            businessName: businessData.business_name ?? null,
            businessType: businessData.business_type ?? null,
            businessNumber: businessData.business_number ?? null,
            businessAddress: businessData.business_address ?? null,
            registrationDate: businessData.registration_date ?? null,
          }
        : null,
      addressStatus: addressData?.status ?? null,
      amlStatus: amlStatus ?? null,
      hasIpInfo: Boolean(ipInfo),
      ipDeviceRisk: ipRisky ? { proxy: ipInfo?.proxy ?? null, hosting: ipInfo?.hosting ?? null } : null,
      hasDeviceInfo: Boolean(deviceInfo),
    },
  };
}
