/** Safe display helpers for identity verification evidence (no raw PII). */

export function maskIdentifier(value: unknown, visibleTail = 4): string {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text) return '';
  if (text.length <= visibleTail) return '*'.repeat(text.length);
  return `${'*'.repeat(Math.max(0, text.length - visibleTail))}${text.slice(-visibleTail)}`;
}

export function displayOrFallback(value: unknown, fallback = 'Not available'): string {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

export function formatCheckList(checks: string[] | undefined | null): string[] {
  return (checks ?? []).map((check) => check.replace(/_/g, ' '));
}

export function formatReasonCode(reason: string): string {
  return reason.replace(/^(dojah|nem)_/i, '').replace(/_/g, ' ');
}

function formatReasonCodes(reasons: string[] | undefined | null): string {
  return (reasons ?? []).map(formatReasonCode).join(', ') || 'None';
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringRecordFrom(value: unknown): Record<string, string> | null {
  const record = recordFrom(value);
  if (!record) return null;
  const entries = Object.entries(record)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0);
  return entries.length ? Object.fromEntries(entries) : null;
}

function mergeEvidenceFields(
  fallback: Record<string, string>,
  section?: Record<string, string> | null
): Record<string, string> {
  if (!section) return fallback;
  return { ...fallback, ...section };
}

export interface DojahEvidenceSections {
  providerSummary: Record<string, string>;
  pendingReason: Record<string, string>;
  business: Record<string, string>;
  governmentData: Record<string, string>;
  liveness: Record<string, string>;
  address: Record<string, string>;
  governmentId: Record<string, string>;
  businessId: Record<string, string>;
  ipDevice: Record<string, string>;
  documents: Record<string, string>;
  aml: Record<string, string>;
}

type EvidenceViewerRole = 'salvage_manager' | 'system_admin';

function omitFields(fields: Record<string, string>, hiddenLabels: string[]): Record<string, string> {
  const hidden = new Set(hiddenLabels.map((label) => label.toLowerCase()));
  return Object.fromEntries(
    Object.entries(fields).filter(([label]) => !hidden.has(label.toLowerCase()))
  );
}

function managerSafeProviderFields(section: Record<string, string> | null, hiddenLabels: string[]): Record<string, string> | null {
  if (!section) return null;
  const filtered = omitFields(section, hiddenLabels);
  return Object.keys(filtered).length ? filtered : null;
}

function cleanBusinessFields(fields: Record<string, string>, businessNumber: unknown): Record<string, string> {
  const number = displayOrFallback(businessNumber, 'Not returned');
  const clean: Record<string, string> = {
    ...fields,
    'Registration number': number,
  };
  delete clean['Business number'];
  return clean;
}

function cleanBusinessIdFields(fields: Record<string, string>, businessNumber: unknown): Record<string, string> {
  const number = displayOrFallback(businessNumber, 'Not returned');
  const clean: Record<string, string> = {
    ...fields,
    'Business ID number': number,
  };
  delete clean['Business number'];
  delete clean['Registration number'];
  return clean;
}

function identityNumberLabel(normalized: Record<string, unknown> | null | undefined): string {
  const verificationType = String(normalized?.verificationType ?? '').toLowerCase();
  if (verificationType.includes('bvn')) return 'BVN';
  if (verificationType.includes('nin')) return 'NIN';
  return 'Identity number';
}

export function buildDojahEvidenceSections(
  normalized: Record<string, unknown> | null | undefined,
  providerEvidence?: {
    provider?: string;
    providerReference?: string | null;
    workflowReference?: string | null;
    status?: string;
    riskLevel?: string;
    displayMessage?: string | null;
    updatedAt?: Date;
    checksCompleted?: string[];
    pendingChecks?: string[];
    failedChecks?: string[];
    reasonCodes?: string[];
  },
  options: { viewerRole?: EvidenceViewerRole } = {}
): DojahEvidenceSections {
  const viewerRole = options.viewerRole ?? 'salvage_manager';
  const isSystemAdmin = viewerRole === 'system_admin';
  const businessId = (normalized?.businessId as Record<string, unknown> | null) ?? null;
  const businessData = (normalized?.businessData as Record<string, unknown> | null) ?? null;
  const ipDeviceRisk = (normalized?.ipDeviceRisk as Record<string, unknown> | null) ?? null;
  const providerSections = recordFrom(normalized?.dojahEvidenceSections);
  const providerBusinessData = stringRecordFrom(providerSections?.businessData);
  const providerGovernmentData = managerSafeProviderFields(
    stringRecordFrom(providerSections?.governmentData),
    isSystemAdmin ? [] : ['App id', 'Customer', 'Sc', 'Created At', 'Updated At', 'Image Url']
  );
  const providerLiveness = stringRecordFrom(providerSections?.liveness);
  const providerAddress = managerSafeProviderFields(
    stringRecordFrom(providerSections?.address),
    isSystemAdmin ? [] : ['Latitude', 'Longitude']
  );
  const providerGovernmentId = stringRecordFrom(providerSections?.governmentId);
  const providerBusinessId = stringRecordFrom(providerSections?.businessId);
  const providerIpDevice = managerSafeProviderFields(
    stringRecordFrom(providerSections?.ipDevice),
    isSystemAdmin ? [] : ['As', 'Lat', 'Lon', 'Query']
  );
  const providerAml = stringRecordFrom(providerSections?.aml);
  const media = recordFrom(normalized?.dojahMedia);
  const mediaAssets = Array.isArray(media?.assets) ? media.assets : [];
  const documentMetadata = recordFrom(normalized?.documentMetadata);
  const managerDecision = recordFrom(normalized?.managerDecision);
  const submittedProfile = recordFrom(normalized?.nemSubmittedProfile);
  const addressData = recordFrom(normalized?.addressData);
  const dojahEvidenceSummary = recordFrom(normalized?.dojahEvidenceSummary);
  const isManualHybrid = normalized?.verificationMode === 'nem_hybrid_manual_review';

  if (isManualHybrid) {
    const cac = recordFrom(dojahEvidenceSummary?.cac);
    const nin = recordFrom(dojahEvidenceSummary?.nin);
    const bvn = recordFrom(dojahEvidenceSummary?.bvn);
    const aml = recordFrom(dojahEvidenceSummary?.aml);
    const liveness = recordFrom(dojahEvidenceSummary?.liveness);
    const livenessStatus = displayOrFallback(normalized?.livenessStatus, 'pending_liveness');

    return {
      providerSummary: {
        Source: 'Manual verification',
        'Reference ID': displayOrFallback(providerEvidence?.providerReference),
        'Workflow reference': displayOrFallback(providerEvidence?.workflowReference, 'nem-hybrid-tier2'),
        Status: displayOrFallback(providerEvidence?.status?.replace(/_/g, ' ')),
        'Risk level': displayOrFallback(providerEvidence?.riskLevel),
        'Verification status': displayOrFallback(normalized?.verificationStatus),
        Mode: 'Manual evidence with automated supporting checks',
        'Last updated': providerEvidence?.updatedAt
          ? new Date(providerEvidence.updatedAt).toLocaleString()
          : 'Pending review',
        Message: displayOrFallback(providerEvidence?.displayMessage, 'Submitted for internal review'),
        'Reviewer decision': displayOrFallback(managerDecision?.decision, 'Not reviewed yet'),
        'Reviewed at': managerDecision?.reviewedAt
          ? new Date(String(managerDecision.reviewedAt)).toLocaleString()
          : 'Not reviewed yet',
        'Submitted name': displayOrFallback(submittedProfile?.fullName, 'Not provided'),
        'Submitted business': displayOrFallback(submittedProfile?.businessName, 'Not provided'),
        'Submitted business number': displayOrFallback(submittedProfile?.businessRegistrationNumber, 'Not provided'),
      },
      pendingReason: {
        Reason: 'The documents and profile were collected directly. Automated checks are supporting evidence; manager approval remains the final decision.',
        'Reason codes': formatReasonCodes(providerEvidence?.reasonCodes),
      },
      business: {
        'Submitted business name': displayOrFallback(submittedProfile?.businessName, 'Not provided'),
        'Submitted business type': displayOrFallback(submittedProfile?.businessType, 'Not provided'),
        'Submitted registration number': displayOrFallback(submittedProfile?.businessRegistrationNumber, 'Not provided'),
        'Provider lookup': displayOrFallback(cac?.status, 'Not completed'),
        'Provider business name': displayOrFallback(cac?.providerBusinessName, 'Not returned'),
        'Business name match': cac?.businessNameMatched === true ? 'Matched' : cac?.businessNameMatched === false ? 'Needs manager review' : 'Not checked',
        'Provider message': displayOrFallback(cac?.message, 'No provider message returned'),
      },
      governmentData: {
        'Identity number': displayOrFallback(normalized?.maskedIdentityValue, 'Stored securely'),
        'Government ID type': displayOrFallback(documentMetadata?.governmentIdType, 'Not provided'),
        'NIN lookup': displayOrFallback(nin?.status, 'Not completed'),
        'NIN last four': displayOrFallback(nin?.lastFour, 'Stored securely'),
        'Provider name': displayOrFallback(nin?.providerName, 'Not returned'),
        'Name match': nin?.nameMatched === true ? 'Matched' : nin?.nameMatched === false ? 'Needs manager review' : 'Not checked',
        'Date of birth match': nin?.dobMatched === true ? 'Matched' : nin?.dobMatched === false ? 'Needs manager review' : 'Not checked',
        'NIN message': displayOrFallback(nin?.message, 'No provider message returned'),
        'BVN source': displayOrFallback(addressData?.bvnSource, 'Not provided'),
        'BVN check': displayOrFallback(bvn?.status, 'Already verified or not required in this flow'),
      },
      liveness: {
        'Liveness status': livenessStatus.replace(/_/g, ' '),
        'Liveness score': displayOrFallback(
          normalized?.livenessScore !== null && normalized?.livenessScore !== undefined ? `${normalized.livenessScore}%` : liveness?.livenessScore,
          livenessStatus === 'completed' ? 'Completed, score not returned' : 'Pending liveness completion'
        ),
        'Face match score': displayOrFallback(
          normalized?.biometricMatchScore !== null && normalized?.biometricMatchScore !== undefined ? `${normalized.biometricMatchScore}%` : liveness?.biometricMatchScore,
          livenessStatus === 'completed' ? 'Completed, score not returned' : 'Pending liveness completion'
        ),
        'Selfie evidence': normalized?.selfieUrl || liveness?.hasSelfie ? 'Available' : 'Not linked yet',
      },
      address: {
        'Submitted address': displayOrFallback(addressData?.address, 'Not provided'),
        City: displayOrFallback(addressData?.city, 'Not provided'),
        State: displayOrFallback(addressData?.state, 'Not provided'),
        'Address proof': documentMetadata?.addressProof ? 'Uploaded' : 'Not uploaded',
        'Review status': displayOrFallback(normalized?.addressStatus, 'submitted_for_manual_review'),
      },
      governmentId: {
        'Government ID type': displayOrFallback(documentMetadata?.governmentIdType, 'Not provided'),
        'Government ID document': documentMetadata?.photoId ? 'Uploaded' : 'Not uploaded',
        'Document decision': 'Manager review required',
      },
      businessId: {
        'Business document type': displayOrFallback(documentMetadata?.businessDocumentType, 'Not provided'),
        'Business document': documentMetadata?.businessDocument ? 'Uploaded' : 'Not uploaded',
        'Document decision': 'Manager review required',
      },
      documents: {
        'Government ID': documentMetadata?.photoId ? 'Uploaded for protected review' : 'Not uploaded',
        'Address proof': documentMetadata?.addressProof ? 'Uploaded for protected review' : 'Not uploaded',
        'Business document': documentMetadata?.businessDocument ? 'Uploaded for protected review' : 'Not required or not uploaded',
        'Provider document OCR': 'Not used in this manual review flow',
        Note: 'Files open through protected manager-only document routes.',
      },
      aml: {
        'AML screening': displayOrFallback(aml?.status, 'Not completed'),
        'PEP hits': aml?.hasPepHits === true ? 'Yes' : aml?.hasPepHits === false ? 'No' : 'Not returned',
        'Sanctions hits': aml?.hasSanctionHits === true ? 'Yes' : aml?.hasSanctionHits === false ? 'No' : 'Not returned',
        'Adverse media hits': aml?.hasAdverseMediaHits === true ? 'Yes' : aml?.hasAdverseMediaHits === false ? 'No' : 'Not returned',
        'Reason codes': formatReasonCodes(providerEvidence?.reasonCodes),
        'Failed checks': formatCheckList(providerEvidence?.failedChecks).join(', ') || 'None',
      },
      ipDevice: {
        'IP / device risk': 'Not part of this manual submission',
        'Device fingerprint': 'Not part of this manual submission',
      },
    };
  }

  return {
    providerSummary: {
      Source: 'Identity verification',
      'Reference ID': displayOrFallback(
        providerEvidence?.providerReference ?? providerEvidence?.workflowReference
      ),
      'Workflow reference': displayOrFallback(providerEvidence?.workflowReference, 'Not available'),
      Status: displayOrFallback(providerEvidence?.status?.replace(/_/g, ' ')),
      'Risk level': displayOrFallback(providerEvidence?.riskLevel),
      'Verification status': displayOrFallback(normalized?.verificationStatus),
      Mode: displayOrFallback(normalized?.verificationMode, 'Not available in this verification'),
      'Last updated': providerEvidence?.updatedAt
        ? new Date(providerEvidence.updatedAt).toLocaleString()
        : 'Pending review',
      Message: displayOrFallback(providerEvidence?.displayMessage, 'Not available'),
      'Reviewer decision': displayOrFallback(managerDecision?.decision, 'Not reviewed yet'),
      'Reviewed at': managerDecision?.reviewedAt
        ? new Date(String(managerDecision.reviewedAt)).toLocaleString()
        : 'Not reviewed yet',
      'Submitted name': displayOrFallback(submittedProfile?.fullName, 'Not provided'),
      'Submitted email': displayOrFallback(submittedProfile?.email, 'Not provided'),
      'Submitted business': displayOrFallback(submittedProfile?.businessName, 'Not provided'),
      'Submitted business number': displayOrFallback(submittedProfile?.businessRegistrationNumber, 'Not provided'),
    },
    pendingReason: {
      Reason: displayOrFallback(
        normalized?.pendingReason ?? normalized?.providerMessage,
        'No review reason was returned.'
      ),
      'Reason codes': formatReasonCodes(providerEvidence?.reasonCodes),
    },
    business: cleanBusinessFields(mergeEvidenceFields({
      'Business name': displayOrFallback(businessData?.businessName ?? businessId?.businessName),
      'Registration number': displayOrFallback(businessData?.businessNumber ?? businessId?.businessNumber, 'Not returned'),
      Country: displayOrFallback(businessData?.country ?? businessId?.country ?? normalized?.country, 'Not returned in registry data'),
      'Entity type': displayOrFallback(businessData?.businessType ?? businessId?.businessType, 'Not available in this verification'),
      Address: displayOrFallback(businessData?.businessAddress ?? businessId?.businessAddress, 'No business address was returned in registry data'),
      'Registration date': displayOrFallback(businessData?.registrationDate ?? businessId?.registrationDate, 'Not available in this verification'),
      'Business ID check': displayOrFallback(normalized?.idStatus === false ? 'Failed' : normalized?.idStatus === true ? 'Passed' : undefined, 'Pending review'),
    }, providerBusinessData), businessData?.businessNumber ?? businessId?.businessNumber),
    governmentData: mergeEvidenceFields({
      'Government data': displayOrFallback(
        normalized?.governmentStatus === true ? 'Matched' : normalized?.governmentStatus === false ? 'Mismatch' : undefined,
        'Not available in this verification'
      ),
      'User data consistency': displayOrFallback(
        normalized?.userDataStatus === true ? 'Consistent' : normalized?.userDataStatus === false ? 'Inconsistent' : undefined,
        'Not available in this verification'
      ),
      'Phone consistency': displayOrFallback(
        normalized?.phoneStatus === true ? 'Matched' : normalized?.phoneStatus === false ? 'Mismatch' : undefined,
        'Not available in this verification'
      ),
      [identityNumberLabel(normalized)]: displayOrFallback(
        normalized?.maskedIdentityValue,
        'Stored securely'
      ),
    }, providerGovernmentData),
    liveness: mergeEvidenceFields({
      'Liveness score': displayOrFallback(
        normalized?.livenessScore !== null && normalized?.livenessScore !== undefined ? `${normalized.livenessScore}%` : undefined,
        'Not available in this verification'
      ),
      'Face match score': displayOrFallback(
        normalized?.biometricMatchScore !== null && normalized?.biometricMatchScore !== undefined ? `${normalized.biometricMatchScore}%` : undefined,
        'Not available in this verification'
      ),
    }, providerLiveness),
    governmentId: mergeEvidenceFields({
      'Government ID': displayOrFallback(
        normalized?.idStatus === true ? 'Verified' : normalized?.idStatus === false ? 'Failed' : undefined,
        'Pending review'
      ),
      'Document metadata': displayOrFallback(
        documentMetadata ? `${Object.entries(documentMetadata).map(([key, value]) => `${key}: ${value}`).join(', ')}` : undefined,
        'No document metadata returned'
      ),
    }, providerGovernmentId),
    address: mergeEvidenceFields({
      'Address result': displayOrFallback(normalized?.addressStatus, 'Not required for this flow'),
      'Digital address': displayOrFallback(
        (providerEvidence?.checksCompleted ?? []).includes('digital_address')
          ? 'Completed'
          : (providerEvidence?.failedChecks ?? []).includes('digital_address')
            ? 'Failed'
            : undefined,
        'Pending review'
      ),
    }, providerAddress),
    documents: {
      'Government ID document check': displayOrFallback(
        normalized?.idStatus === true ? 'Document step passed' : undefined,
        normalized?.idStatus === false ? 'Document step failed' : 'No document decision returned'
      ),
      'Imported media files': String(mediaAssets.length),
      'Media import status': media
        ? `Uploaded ${displayOrFallback(recordFrom(media.diagnostics)?.uploadedCount, '0')} of ${displayOrFallback(recordFrom(media.diagnostics)?.candidateCount, '0')} evidence files`
        : 'No media import record found',
      Note: normalized?.idStatus === false && mediaAssets.length
        ? 'Media files are available, but the document/OCR check failed.'
        : 'Imported files are stored in protected evidence storage when available.',
    },
    businessId: cleanBusinessIdFields(mergeEvidenceFields({
      'Business ID name': displayOrFallback(businessId?.businessName),
      'Business ID number': displayOrFallback(businessId?.businessNumber, 'Not returned'),
      'Business ID type': displayOrFallback(businessId?.businessType, 'Not available in this verification'),
    }, providerBusinessId), businessId?.businessNumber),
    ipDevice: mergeEvidenceFields({
      'IP / device risk': displayOrFallback(
        ipDeviceRisk
          ? `Proxy: ${displayOrFallback(ipDeviceRisk.proxy, 'unknown')}; Hosting: ${displayOrFallback(ipDeviceRisk.hosting, 'unknown')}`
          : normalized?.hasIpInfo
            ? 'Screened — see reason codes'
            : undefined,
        'Not available in this verification'
      ),
      'Device fingerprint': normalized?.hasDeviceInfo ? 'Available' : 'Not available in this verification',
    }, providerIpDevice),
    aml: mergeEvidenceFields({
      'AML screening': displayOrFallback(
        normalized?.amlStatus === true
          ? 'No hits reported'
          : normalized?.amlStatus === false
            ? 'Flagged — manual review required'
            : undefined,
        'Pending review'
      ),
      'Watchlist message': displayOrFallback(
        normalized?.pendingReason ?? normalized?.providerMessage,
        'No watchlist message returned'
      ),
      'Reason codes': formatReasonCodes(providerEvidence?.reasonCodes),
      'Failed checks': formatCheckList(providerEvidence?.failedChecks).join(', ') || 'None',
      'Match details returned': displayOrFallback(
        normalized?.amlMatchDetails,
        'No individual PEP/sanctions match names or confidence records were returned in this verification package.'
      ),
    }, providerAml),
  };
}
