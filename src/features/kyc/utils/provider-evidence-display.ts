/** Safe display helpers for Dojah / provider verification evidence (no raw PII). */

export function maskIdentifier(value: unknown, visibleTail = 4): string {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text) return '';
  if (text.length <= visibleTail) return '*'.repeat(text.length);
  return `${'*'.repeat(Math.max(0, text.length - visibleTail))}${text.slice(-visibleTail)}`;
}

export function displayOrFallback(value: unknown, fallback = 'Not provided by Dojah'): string {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

export function formatCheckList(checks: string[] | undefined | null): string[] {
  return (checks ?? []).map((check) => check.replace(/_/g, ' '));
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
  }
): DojahEvidenceSections {
  const businessId = (normalized?.businessId as Record<string, unknown> | null) ?? null;
  const businessData = (normalized?.businessData as Record<string, unknown> | null) ?? null;
  const ipDeviceRisk = (normalized?.ipDeviceRisk as Record<string, unknown> | null) ?? null;

  return {
    providerSummary: {
      Provider: displayOrFallback(providerEvidence?.provider ?? 'dojah'),
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
        : 'Pending from provider',
      Message: displayOrFallback(providerEvidence?.displayMessage, 'Not available'),
    },
    pendingReason: {
      Reason: displayOrFallback(
        normalized?.pendingReason ?? normalized?.providerMessage,
        'No provider pending reason was returned.'
      ),
      'Reason codes': (providerEvidence?.reasonCodes?.length
        ? providerEvidence.reasonCodes.join(', ')
        : 'None') as string,
    },
    business: {
      'Business name': displayOrFallback(
        businessData?.businessName ?? businessId?.businessName
      ),
      'Registration number': displayOrFallback(
        maskIdentifier(businessData?.businessNumber ?? businessId?.businessNumber),
        'Not provided by Dojah'
      ),
      Country: displayOrFallback(businessData?.country ?? businessId?.country, 'Not provided by Dojah'),
      'Entity type': displayOrFallback(
        businessData?.businessType ?? businessId?.businessType,
        'Not available in this verification'
      ),
      Address: displayOrFallback(
        businessData?.businessAddress ?? businessId?.businessAddress
      ),
      'Registration date': displayOrFallback(
        businessData?.registrationDate ?? businessId?.registrationDate,
        'Not available in this verification'
      ),
      'Business ID check': displayOrFallback(normalized?.idStatus, 'Pending from provider'),
    },
    governmentData: {
      'Government data': displayOrFallback(
        normalized?.governmentStatus === true
          ? 'Matched'
          : normalized?.governmentStatus === false
            ? 'Mismatch'
            : undefined,
        'Not available in this verification'
      ),
      'User data consistency': displayOrFallback(
        normalized?.userDataStatus === true
          ? 'Consistent'
          : normalized?.userDataStatus === false
            ? 'Inconsistent'
            : undefined,
        'Not available in this verification'
      ),
      'Phone consistency': displayOrFallback(
        normalized?.phoneStatus === true
          ? 'Matched'
          : normalized?.phoneStatus === false
            ? 'Mismatch'
            : undefined,
        'Not available in this verification'
      ),
      'BVN/NIN raw values': 'Masked and not displayed in manager review.',
    },
    liveness: {
      'Liveness score': displayOrFallback(
        normalized?.livenessScore !== null && normalized?.livenessScore !== undefined
          ? `${normalized.livenessScore}%`
          : undefined,
        'Not available in this verification'
      ),
      'Face match score': displayOrFallback(
        normalized?.biometricMatchScore !== null && normalized?.biometricMatchScore !== undefined
          ? `${normalized.biometricMatchScore}%`
          : undefined,
        'Not available in this verification'
      ),
    },
    governmentId: {
      'Government ID': displayOrFallback(
        normalized?.idStatus === true ? 'Verified' : normalized?.idStatus === false ? 'Failed' : undefined,
        'Pending from provider'
      ),
      'Document metadata': 'Shown only when Dojah returns safe metadata; raw document numbers and images are not shown.',
    },
    address: {
      'Address result': displayOrFallback(normalized?.addressStatus, 'Not required for this flow'),
      'Digital address': displayOrFallback(
        (providerEvidence?.checksCompleted ?? []).includes('digital_address')
          ? 'Completed'
          : (providerEvidence?.failedChecks ?? []).includes('digital_address')
            ? 'Failed'
            : undefined,
        'Pending from provider'
      ),
      'Geolocation': 'Exact coordinates are not displayed in manager review.',
    },
    documents: {
      'Document verification': displayOrFallback(
        normalized?.idStatus === true ? 'Provider confirmed document step' : undefined,
        'Document files are not exposed here. Use Dojah dashboard or export for provider references.'
      ),
      Note: 'Raw document images are not shown in NEM Salvage. Metadata only when returned by Dojah.',
    },
    businessId: {
      'Business ID name': displayOrFallback(businessId?.businessName),
      'Business ID number': displayOrFallback(maskIdentifier(businessId?.businessNumber)),
      'Business ID type': displayOrFallback(businessId?.businessType, 'Not available in this verification'),
    },
    ipDevice: {
      'IP / device risk': displayOrFallback(
        ipDeviceRisk
          ? `Proxy: ${displayOrFallback(ipDeviceRisk.proxy, 'unknown')}; Hosting: ${displayOrFallback(ipDeviceRisk.hosting, 'unknown')}`
          : normalized?.hasIpInfo
            ? 'Screened — see reason codes'
            : undefined,
        'Not available in this verification'
      ),
      'Device fingerprint': normalized?.hasDeviceInfo ? 'Available from provider' : 'Not available in this verification',
      Coordinates: 'Exact geolocation coordinates are not displayed.',
    },
    aml: {
      'AML screening': displayOrFallback(
        normalized?.amlStatus === true
          ? 'No hits reported'
          : normalized?.amlStatus === false
            ? 'Flagged — manual review required'
            : undefined,
        'Pending from provider'
      ),
      'Reason codes': (providerEvidence?.reasonCodes?.length
        ? providerEvidence.reasonCodes.join(', ')
        : 'None') as string,
      'Failed checks': formatCheckList(providerEvidence?.failedChecks).join(', ') || 'None',
    },
  };
}
