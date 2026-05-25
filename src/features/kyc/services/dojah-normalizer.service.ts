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

function stringFrom(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const text = stringFrom(value);
    if (text) return text;
  }
  return null;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.trim().toLowerCase();
      if (['true', 'passed', 'pass', 'success', 'successful', 'completed', 'verified', 'match', 'matched'].includes(lower)) return true;
      if (['false', 'failed', 'fail', 'rejected', 'mismatch', 'unmatched'].includes(lower)) return false;
    }
  }
  return undefined;
}

function includesWatchlistSignal(value: string | null): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return ['pep', 'watchlist', 'warning', 'adverse', 'sanction'].some((token) => lower.includes(token));
}

function valueAtPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    const record = recordFrom(current);
    return record ? record[key] : undefined;
  }, source);
}

function firstRecord(source: unknown, paths: string[]): Record<string, unknown> | null {
  for (const path of paths) {
    const value = valueAtPath(source, path);
    const record = recordFrom(value);
    if (record) return record;
  }
  return null;
}

function sectionStatus(section: Record<string, unknown> | null): boolean | undefined {
  return firstBoolean(
    section?.status,
    section?.verified,
    section?.passed,
    section?.match,
    section?.matched,
    section?.verification_status,
    section?.verificationStatus
  );
}

const SENSITIVE_FIELD_PATTERN = /(bvn|nin|raw|payload|base64|image|photo|selfie|document_url|verification_url|id_url|back_url|file|token|secret|signature)/i;
const MASKED_IDENTIFIER_PATTERN = /(document_number|id_number)/i;

function maskEdgeIdentifier(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (text.length <= 4) return '*'.repeat(text.length);
  return `${text.slice(0, 2)}${'*'.repeat(Math.max(0, text.length - 4))}${text.slice(-2)}`;
}

function summarizeAmlMatches(aml?: DojahAMLResult | null): string | null {
  const entity = aml?.entity;
  if (!entity) return null;

  const groups = [
    ['PEP', entity.pep ?? []],
    ['Sanctions', entity.sanctions ?? []],
    ['Adverse media', entity.adverse_media ?? []],
  ] as const;

  const summaries = groups.flatMap(([label, matches]) =>
    matches.map((match) => {
      const parts = [
        match.name,
        match.type,
        typeof match.score === 'number' ? `score ${match.score}` : null,
        Array.isArray(match.categories) && match.categories.length ? match.categories.join('/') : null,
        match.source,
      ].filter(Boolean);
      return `${label}: ${parts.join(' — ')}`;
    })
  );

  return summaries.length ? summaries.join('; ') : 'Separate AML screening returned no named PEP, sanctions, or adverse media matches.';
}

function safeEvidenceValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (SENSITIVE_FIELD_PATTERN.test(key)) return null;

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return null;
    if (MASKED_IDENTIFIER_PATTERN.test(key)) {
      return trimmed.length <= 4 ? '*'.repeat(trimmed.length) : `${'*'.repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
    }
    return trimmed.length > 300 ? `${trimmed.slice(0, 300)}...` : trimmed;
  }
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : null;
  if (recordFrom(value)) return 'Available from provider';
  return null;
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function flattenSafeEvidence(record: Record<string, unknown> | null, maxFields = 12): Record<string, string> | null {
  if (!record) return null;
  const output: Record<string, string> = {};

  const addEntry = (key: string, value: unknown) => {
    if (Object.keys(output).length >= maxFields) return;
    const safeValue = safeEvidenceValue(key, value);
    if (safeValue) output[humanizeKey(key)] = safeValue;
  };

  const walk = (value: unknown, key: string, depth = 0) => {
    if (Object.keys(output).length >= maxFields || depth > 4) return;
    const nested = recordFrom(value);
    if (nested) {
      for (const [nestedKey, nestedValue] of Object.entries(nested)) {
        walk(nestedValue, nestedKey, depth + 1);
      }
    } else {
      addEntry(key, value);
    }
  };

  for (const [key, value] of Object.entries(record)) {
    if (Object.keys(output).length >= maxFields) break;
    walk(value, key);
  }

  return Object.keys(output).length ? output : null;
}

function extractDojahEvidenceSections(result: DojahVerificationResult): Record<string, Record<string, string> | null> {
  const source = result as Record<string, unknown>;
  return {
    governmentData: flattenSafeEvidence(firstRecord(source, ['government_data', 'governmentData', 'government', 'data.government_data', 'data.governmentData'])),
    liveness: flattenSafeEvidence(firstRecord(source, ['liveness', 'selfie', 'face', 'faceMatch', 'data.selfie', 'data.liveness'])),
    address: flattenSafeEvidence(firstRecord(source, ['address', 'address_data', 'addressData', 'data.address', 'data.address_data'])),
    governmentId: flattenSafeEvidence(firstRecord(source, ['government_id', 'governmentId', 'id', 'idData', 'document', 'data.id', 'data.government_id'])),
    businessData: flattenSafeEvidence(firstRecord(source, ['business_data', 'businessData', 'business', 'data.business_data', 'data.businessData'])),
    businessId: flattenSafeEvidence(firstRecord(source, ['business_id', 'businessId', 'businessDocument', 'data.business_id', 'data.businessId'])),
    ipDevice: flattenSafeEvidence(firstRecord(source, ['ip_device', 'ipDevice', 'ip_device_info', 'ipDeviceInfo', 'metadata.ipinfo', 'metadata.ipInfo'])),
    aml: flattenSafeEvidence(firstRecord(source, ['aml', 'aml_screening', 'amlScreening', 'watchlist', 'data.aml'])),
  };
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
  const resultRecord = result as Record<string, unknown>;
  const completed = new Set<string>();
  const failed = new Set<string>();
  const pending = new Set<string>();
  const reasonCodes = new Set<string>();

  const providerReference = firstString(result.reference_id, result.referenceId, result.reference) ?? undefined;
  const statusText = String(
    result.verification_status ??
    result.verificationStatus ??
    (typeof result.status === 'string' ? result.status : '') ??
    ''
  ).toLowerCase();
  const livenessSection = firstRecord(resultRecord, ['liveness', 'selfie', 'face', 'data.selfie', 'data.liveness']);
  const governmentIdSection = firstRecord(resultRecord, ['government_id', 'governmentId', 'id', 'idData', 'document', 'data.id']);
  const governmentDataSection = firstRecord(resultRecord, ['government_data', 'governmentData', 'government', 'data.government_data']);
  const userDataSection = firstRecord(resultRecord, ['user_data', 'userData', 'data.user_data']);
  const phoneSection = firstRecord(resultRecord, ['phone_number', 'phoneNumber', 'data.phone_number']);
  const businessIdSection = firstRecord(resultRecord, ['business_id', 'businessId', 'businessDocument', 'data.business_id']);
  const businessDataSection = firstRecord(resultRecord, ['business_data', 'businessData', 'business', 'data.business_data']);
  const addressDataSection = firstRecord(resultRecord, ['address', 'address_data', 'addressData', 'data.address']);
  const amlSection = firstRecord(resultRecord, ['aml', 'aml_screening', 'amlScreening', 'watchlist', 'data.aml']);
  const livenessScore = firstNumber(
    result.data?.selfie?.data?.liveness_score,
    livenessSection?.liveness_score,
    livenessSection?.livenessScore,
    resultRecord.liveness_score,
    resultRecord.livenessScore
  );
  const biometricMatchScore = firstNumber(
    result.data?.selfie?.data?.match_score,
    livenessSection?.match_score,
    livenessSection?.matchScore,
    livenessSection?.face_match_score,
    livenessSection?.faceMatchScore,
    resultRecord.match_score,
    resultRecord.matchScore,
    resultRecord.face_match_score,
    resultRecord.faceMatchScore
  );
  const idStatus = firstBoolean(result.data?.id?.status, sectionStatus(governmentIdSection));
  const governmentStatus = firstBoolean(result.data?.government_data?.status, sectionStatus(governmentDataSection));
  const userDataStatus = firstBoolean(result.data?.user_data?.status, sectionStatus(userDataSection));
  const phoneStatus = firstBoolean(result.data?.phone_number?.status, sectionStatus(phoneSection));
  const businessId = result.data?.business_id ?? businessIdSection;
  const businessData = result.data?.business_data ?? businessDataSection;
  const addressData = result.data?.address ?? addressDataSection;
  const amlStatus = amlResult ? !hasAmlHit(amlResult) : firstBoolean(result.aml?.status, sectionStatus(amlSection));
  const ipInfo = (result.metadata?.ipinfo as Record<string, unknown> | undefined) ??
    firstRecord(resultRecord, ['metadata.ipInfo', 'metadata.ipinfo', 'ip_device', 'ipDevice', 'ipDeviceInfo']) ??
    undefined;
  const deviceInfo = result.metadata?.device_info ?? result.metadata?.deviceInfo ?? valueAtPath(resultRecord, 'metadata.device');
  const ipRisky = Boolean(ipInfo?.proxy || ipInfo?.hosting);
  const pendingReason = firstString(
    result.pending_reason,
    result.reason,
    result.message,
    resultRecord.pendingReason,
    resultRecord.review_reason,
    resultRecord.reviewReason,
    amlSection?.reason,
    amlSection?.message
  );
  const watchlistFlagged = includesWatchlistSignal(pendingReason);

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

  if (amlResult || result.aml || watchlistFlagged) {
    completed.add('aml_screening');
    if (amlStatus === false || hasAmlHit(amlResult) || watchlistFlagged) {
      failed.add('aml_screening');
      reasonCodes.add('dojah_aml_flagged');
      reasonCodes.add('dojah_watchlist_flagged');
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
  if (statusText.includes('pending') || statusText.includes('review') || statusText.includes('manual')) {
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
      : statusText.includes('pass') || statusText.includes('success') || statusText.includes('complete') || result.status
        ? 'review_required'
        : 'pending';
  const userData = recordFrom(result.data?.user_data?.data) ?? userDataSection;
  const phoneData = recordFrom(result.data?.phone_number?.data) ?? phoneSection;
  const governmentData = recordFrom(result.data?.government_data?.data) ?? governmentDataSection;
  const countrySection = firstRecord(resultRecord, ['data.countries.data', 'countries.data', 'country', 'data.country']);
  const governmentEntity = firstRecord(resultRecord, [
    'data.government_data.data.nin.entity',
    'data.government_data.data.bvn.entity',
    'government_data.data.nin.entity',
    'government_data.data.bvn.entity',
    'governmentData.data.nin.entity',
    'governmentData.data.bvn.entity',
  ]);
  const verifiedFirstName = firstString(
    result.first_name,
    resultRecord.firstName,
    userData?.first_name,
    userData?.firstName,
    governmentEntity?.first_name,
    governmentEntity?.firstname
  );
  const verifiedLastName = firstString(
    result.last_name,
    resultRecord.lastName,
    userData?.last_name,
    userData?.lastName,
    governmentEntity?.last_name,
    governmentEntity?.surname
  );
  const dojahEvidenceSections = extractDojahEvidenceSections(result);

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
        ? 'Identity verification evidence is ready for internal review.'
        : 'Identity verification is still pending.',
    normalizedResult: {
      referenceId: providerReference ?? null,
      appId: result.app_id ?? result.appId ?? null,
      environment: result.environment ?? null,
      country: firstString(countrySection?.country, resultRecord.country),
      verificationStatus: result.verification_status ?? result.verificationStatus ?? null,
      verificationMode: result.verification_mode ?? null,
      verificationType: result.verification_type ?? null,
      providerMessage: result.message ?? null,
      firstName: verifiedFirstName,
      lastName: verifiedLastName,
      fullName: firstString(result.full_name, [verifiedFirstName, verifiedLastName].filter(Boolean).join(' ')),
      email: firstString(result.email, userData?.email, governmentEntity?.email),
      phone: firstString(
        result.phone,
        resultRecord.phoneNumber,
        phoneData?.phone,
        phoneData?.phone_number,
        phoneData?.phoneNumber,
        governmentEntity?.phone_number,
        governmentEntity?.telephoneno
      ),
      maskedIdentityValue: maskEdgeIdentifier(
        result.verification_value ??
        result.value ??
        governmentEntity?.nin ??
        governmentEntity?.bvn
      ),
      pendingReason:
        pendingReason ??
        (amlStatus === false || hasAmlHit(amlResult) || watchlistFlagged
          ? 'This user has been flagged on PEP/warning/adverse-media/sanction watchlists.'
          : null),
      livenessScore: livenessScore ?? null,
      biometricMatchScore: biometricMatchScore ?? null,
      idStatus: idStatus ?? null,
      governmentStatus: governmentStatus ?? null,
      governmentData: governmentData ? { available: true } : null,
      dojahEvidenceSections,
      userDataStatus: userDataStatus ?? null,
      phoneStatus: phoneStatus ?? null,
      businessName: firstString(result.business_name, resultRecord.businessName, businessDataSection?.business_name, businessDataSection?.businessName),
      businessId: businessId
        ? {
            businessName: businessId.business_name ?? businessId.businessName ?? null,
            businessType: businessId.business_type ?? businessId.businessType ?? null,
            businessNumber: businessId.business_number ?? businessId.businessNumber ?? businessId.rc_number ?? null,
            businessAddress: businessId.business_address ?? businessId.businessAddress ?? businessId.address ?? null,
            registrationDate: businessId.registration_date ?? businessId.registrationDate ?? null,
            country: (businessId as Record<string, unknown>).country ?? null,
          }
        : null,
      businessData: businessData
        ? {
            businessName: businessData.business_name ?? businessData.businessName ?? null,
            businessType: businessData.business_type ?? businessData.businessType ?? null,
            businessNumber: businessData.business_number ?? businessData.businessNumber ?? businessData.rc_number ?? null,
            businessAddress: businessData.business_address ?? businessData.businessAddress ?? businessData.address ?? null,
            registrationDate: businessData.registration_date ?? businessData.registrationDate ?? null,
            country: (businessData as Record<string, unknown>).country ?? null,
          }
        : null,
      addressStatus: addressData?.status ?? null,
      amlStatus: amlStatus ?? null,
      amlMatchDetails: summarizeAmlMatches(amlResult),
      hasIpInfo: Boolean(ipInfo),
      ipDeviceRisk: ipRisky ? { proxy: ipInfo?.proxy ?? null, hosting: ipInfo?.hosting ?? null } : null,
      hasDeviceInfo: Boolean(deviceInfo),
      documentMetadata: {
        hasSelfieUrl: Boolean(result.selfie_url || result.data?.selfie?.data?.selfie_url),
        hasIdUrl: Boolean(result.id_url || result.data?.id?.data?.id_url),
        hasBackUrl: Boolean(result.back_url || result.data?.id?.data?.back_url),
        additionalDocumentCount: result.data?.additional_document?.length ?? 0,
      },
      timestamps: {
        datetime: result.datetime ?? null,
        createdAt: result.created_at ?? null,
        updatedAt: result.updated_at ?? null,
      },
    },
  };
}
